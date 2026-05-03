const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, requireRole } = require('../middleware/auth');
const { db } = require('../lib/firebase');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Cancellation fee structure
const CANCELLATION_FEES = {
  NOT_STARTED: { type: 'flat', amount: 25 },        // ₹25 flat
  STARTED:     { type: 'percent', rate: 0.25 },      // 25% of order
  IN_PROCESS:  { type: 'percent', rate: 0.25 },      // 25% of order
  COMPLETED:   { type: 'percent', rate: 0.50 },      // 50% of order
};

// Stages where cancellation is NOT allowed
const NO_CANCEL_STAGES = ['OUT_FOR_DELIVERY', 'DELIVERED'];

// ──────────────────────────────────────────────────────────────
// POST /cancellations/request — Customer cancels an order
// ──────────────────────────────────────────────────────────────
router.post('/request',
  auth, requireRole('CUSTOMER'),
  body('orderId').notEmpty(),
  body('reason').trim().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { orderId, reason } = req.body;

    try {
      const orderRef = db.collection('orders').doc(orderId);
      const orderDoc = await orderRef.get();

      if (!orderDoc.exists || orderDoc.data().customerId !== req.user.id) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const order = orderDoc.data();

      // Block cancellation on late-stage orders
      if (NO_CANCEL_STAGES.includes(order.status)) {
        return res.status(400).json({
          error: `Cannot cancel an order that is already "${order.status}". Please use the refund system instead.`,
        });
      }

      // Block if already cancelled
      if (order.status === 'CANCELLED') {
        return res.status(400).json({ error: 'Order is already cancelled' });
      }

      // Calculate cancellation fee
      const feeRule = CANCELLATION_FEES[order.status] || CANCELLATION_FEES['NOT_STARTED'];
      const orderAmount = parseFloat(order.finalAmount || 0);
      let cancellationFee = 0;

      if (feeRule.type === 'flat') {
        cancellationFee = feeRule.amount;
      } else {
        cancellationFee = parseFloat((orderAmount * feeRule.rate).toFixed(2));
      }

      const refundAmount = Math.max(0, parseFloat((orderAmount - cancellationFee).toFixed(2)));
      const timestamp = new Date().toISOString();
      const cancellationId = uuidv4();

      const cancellationData = {
        id: cancellationId,
        orderId,
        customerId: req.user.id,
        vendorId: order.vendorId,
        paymentId: order.paymentId || null,
        reason,
        orderAmount,
        cancellationFee,
        refundAmount,
        feeStage: order.status, // at what stage they cancelled
        status: 'APPROVED',     // Auto-approve since it's a customer right
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const batch = db.batch();

      // Save cancellation record
      batch.set(db.collection('cancellations').doc(cancellationId), cancellationData);

      // Mark order cancelled
      batch.update(orderRef, {
        status: 'CANCELLED',
        cancellationId,
        cancellationFee,
        refundAmount,
        updatedAt: timestamp,
      });

      // Handle payment
      if (order.paymentId) {
        if (refundAmount > 0) {
          // Partial refund — update payment to reflect
          batch.update(db.collection('payments').doc(order.paymentId), {
            status: 'PARTIALLY_REFUNDED',
            cancellationFee,
            refundAmount,
            updatedAt: timestamp,
          });
        } else {
          // No refund (cancelled too late)
          batch.update(db.collection('payments').doc(order.paymentId), {
            status: 'RELEASED', // vendor keeps money for started work
            cancellationFee,
            refundAmount: 0,
            updatedAt: timestamp,
          });
        }
      }

      await batch.commit();

      // Notify vendor
      const io = req.app.get('io');
      if (io) {
        io.to(`vendor:${order.vendorId}`).emit('order:cancelled', {
          orderId,
          cancellationFee,
          reason,
        });
      }

      res.status(201).json({
        ...cancellationData,
        message: refundAmount > 0
          ? `Order cancelled. You will receive a refund of ₹${refundAmount} after deducting the ₹${cancellationFee} cancellation fee.`
          : `Order cancelled. No refund is available at this stage (cancellation fee: ₹${cancellationFee}).`,
      });
    } catch (err) {
      console.error('Cancellation error:', err);
      res.status(500).json({ error: 'Failed to cancel order' });
    }
  }
);

// GET /cancellations/customer — Customer's cancellation history
router.get('/customer', auth, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const snap = await db.collection('cancellations')
      .where('customerId', '==', req.user.id)
      .get();

    const cancellations = snap.docs.map(d => d.data())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(cancellations);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cancellations' });
  }
});

// GET /cancellations/fee-preview/:orderId — Preview fee before cancelling
router.get('/fee-preview/:orderId', auth, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const orderDoc = await db.collection('orders').doc(req.params.orderId).get();
    if (!orderDoc.exists || orderDoc.data().customerId !== req.user.id) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderDoc.data();

    if (NO_CANCEL_STAGES.includes(order.status)) {
      return res.json({
        canCancel: false,
        reason: `Order is already ${order.status}. Use the refund system.`,
      });
    }

    const feeRule = CANCELLATION_FEES[order.status] || CANCELLATION_FEES['NOT_STARTED'];
    const orderAmount = parseFloat(order.finalAmount || 0);
    const cancellationFee = feeRule.type === 'flat'
      ? feeRule.amount
      : parseFloat((orderAmount * feeRule.rate).toFixed(2));

    const refundAmount = Math.max(0, parseFloat((orderAmount - cancellationFee).toFixed(2)));

    res.json({
      canCancel: true,
      currentStage: order.status,
      orderAmount,
      cancellationFee,
      refundAmount,
      message: `Cancelling now will incur a ₹${cancellationFee} fee. You'll receive ₹${refundAmount} back.`,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to preview cancellation fee' });
  }
});

module.exports = router;
