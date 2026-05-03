const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { auth, requireRole } = require('../middleware/auth');
const { db } = require('../lib/firebase');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Initialize Razorpay (works with placeholder keys in test mode)
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_PLACEHOLDER',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'PLACEHOLDER_SECRET',
});

// Helper to calculate financial breakdown for an order
function calcBreakdown(order, quote) {
  const totalPaid = parseFloat(order.finalAmount || 0);
  const commissionRate = quote?.commissionRate || 0.10;
  const gstRate = 0.18;

  // Work backwards: totalPaid = subtotal + gst + platformFee
  // subtotal * (1 + gstRate + commissionRate) = totalPaid
  const subtotal = parseFloat((totalPaid / (1 + gstRate + commissionRate)).toFixed(2));
  const gst = parseFloat((subtotal * gstRate).toFixed(2));
  const platformFee = parseFloat((subtotal * commissionRate).toFixed(2));
  const vendorAmount = subtotal; // Vendor gets the subtotal (before GST & fee)

  return { totalPaid, subtotal, gst, platformFee, vendorAmount, commissionRate };
}

// POST /payments/create-order — Step 1: Create Razorpay order before checkout
router.post('/create-order', auth, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const { orderId } = req.body;

    const orderDoc = await db.collection('orders').doc(orderId).get();
    if (!orderDoc.exists || orderDoc.data().customerId !== req.user.id) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderDoc.data();

    // Prevent duplicate payments
    const existingPayment = await db.collection('payments')
      .where('orderId', '==', orderId)
      .where('status', '!=', 'FAILED')
      .limit(1).get();
    if (!existingPayment.empty) {
      return res.status(409).json({ error: 'Payment already exists for this order' });
    }

    const amountPaise = Math.round(parseFloat(order.finalAmount) * 100); // Razorpay uses paise

    let razorpayOrder;
    try {
      razorpayOrder = await razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt: `prinvox_${orderId.slice(-8)}`,
        notes: { orderId, customerId: req.user.id },
      });
    } catch (rzpErr) {
      console.warn('[Payments] Razorpay unavailable (placeholder keys), using mock mode');
      // MOCK MODE: Works without real Razorpay keys for development
      razorpayOrder = {
        id: `mock_rzp_order_${uuidv4().slice(0, 8)}`,
        amount: amountPaise,
        currency: 'INR',
        status: 'created',
      };
    }

    // Create payment record in PENDING state
    const paymentId = uuidv4();
    const paymentData = {
      id: paymentId,
      orderId,
      customerId: req.user.id,
      vendorId: order.vendorId,
      amount: parseFloat(order.finalAmount),
      status: 'PENDING',
      razorpayOrderId: razorpayOrder.id,
      razorpayPaymentId: null,
      escrowReleasesAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.collection('payments').doc(paymentId).set(paymentData);

    res.json({
      paymentId,
      razorpayOrderId: razorpayOrder.id,
      amount: amountPaise,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_PLACEHOLDER',
    });
  } catch (err) {
    console.error('Create payment order error:', err);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// POST /payments/verify — Step 2: Customer completes payment, we verify & start escrow
router.post('/verify', auth, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const {
      paymentId, // our internal payment doc ID
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      isMock, // true when using placeholder keys in dev
    } = req.body;

    const paymentRef = db.collection('payments').doc(paymentId);
    const paymentDoc = await paymentRef.get();
    if (!paymentDoc.exists || paymentDoc.data().customerId !== req.user.id) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    const payment = paymentDoc.data();

    if (!isMock) {
      // Verify Razorpay signature (prevents tampered requests)
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (expectedSignature !== razorpaySignature) {
        return res.status(400).json({ error: 'Payment signature verification failed' });
      }
    }

    // Fetch quote for commission rate
    const orderDoc = await db.collection('orders').doc(payment.orderId).get();
    const order = orderDoc.data();
    let quote = null;
    if (order.quoteId) {
      const quoteDoc = await db.collection('quotes').doc(order.quoteId).get();
      if (quoteDoc.exists) quote = quoteDoc.data();
    }

    // Calculate financial breakdown
    const breakdown = calcBreakdown(order, quote);

    // Compute escrow release time: delivery + 48 hours (set properly on confirm-receipt)
    // For now set as 48h from payment as interim
    const escrowReleasesAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const timestamp = new Date().toISOString();
    const batch = db.batch();

    // Update payment → ESCROWED
    batch.update(paymentRef, {
      status: 'ESCROWED',
      razorpayPaymentId: razorpayPaymentId || `mock_pay_${Date.now()}`,
      vendorAmount: breakdown.vendorAmount,
      platformFee: breakdown.platformFee,
      gst: breakdown.gst,
      commissionRate: breakdown.commissionRate,
      escrowReleasesAt,
      updatedAt: timestamp,
    });

    // Mark order as PAID
    batch.update(db.collection('orders').doc(payment.orderId), {
      paymentStatus: 'PAID',
      paymentId,
      updatedAt: timestamp,
    });

    await batch.commit();

    // Notify vendor via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`vendor:${payment.vendorId}`).emit('payment:received', {
        orderId: payment.orderId,
        amount: payment.amount,
      });
    }

    res.json({ success: true, escrowReleasesAt });
  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// POST /payments/webhook — Razorpay server-to-server webhook (backup)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = req.body.toString();

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || '')
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const event = JSON.parse(body);
    console.log('[Webhook] Event received:', event.event);

    // Handle payment failure
    if (event.event === 'payment.failed') {
      const notes = event.payload?.payment?.entity?.notes || {};
      if (notes.orderId) {
        await db.collection('orders').doc(notes.orderId).update({
          paymentStatus: 'FAILED',
          updatedAt: new Date().toISOString(),
        });
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// GET /payments/order/:orderId — Get payment details for an order
router.get('/order/:orderId', auth, async (req, res) => {
  try {
    const snap = await db.collection('payments')
      .where('orderId', '==', req.params.orderId)
      .limit(1).get();

    if (snap.empty) return res.status(404).json({ error: 'Payment not found' });

    const payment = snap.docs[0].data();

    // Auth check
    const orderDoc = await db.collection('orders').doc(payment.orderId).get();
    const order = orderDoc.data();
    const vendorDoc = await db.collection('vendors').doc(order.vendorId).get();
    const isVendor = vendorDoc.exists && vendorDoc.data().userId === req.user.id;
    const isCustomer = payment.customerId === req.user.id;

    if (!isCustomer && !isVendor) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(payment);
  } catch (err) {
    console.error('Fetch payment error:', err);
    res.status(500).json({ error: 'Failed to fetch payment' });
  }
});

// GET /payments/vendor-earnings — Vendor sees all their payments
router.get('/vendor-earnings', auth, requireRole('VENDOR'), async (req, res) => {
  try {
    const vendorSnap = await db.collection('vendors').where('userId', '==', req.user.id).limit(1).get();
    if (vendorSnap.empty) return res.status(404).json({ error: 'Vendor not found' });
    const vendorId = vendorSnap.docs[0].id;

    const snap = await db.collection('payments')
      .where('vendorId', '==', vendorId)
      .get();

    const payments = snap.docs.map(d => d.data())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(payments);
  } catch (err) {
    console.error('Vendor earnings error:', err);
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
});

module.exports = router;

