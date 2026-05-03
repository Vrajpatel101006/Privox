const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, requireRole } = require('../middleware/auth');
const { db } = require('../lib/firebase');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

const ORDER_STATUSES = [
  'NOT_STARTED', 'STARTED', 'IN_PROCESS', 'COMPLETED', 'OUT_FOR_DELIVERY', 'DELIVERED'
];

// Helper to fetch user details
async function getUserBasicInfo(userId) {
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) return { name: 'Unknown User' };
  const data = userDoc.data();
  return { id: data.id, name: data.name, email: data.email, deliveryAddress: data.deliveryAddress || '' };
}

// POST /orders/create — Customer accepts a quote and creates an order
router.post('/create',
  auth, requireRole('CUSTOMER'),
  body('quoteId').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { quoteId } = req.body;

    try {
      const quoteRef = db.collection('quotes').doc(quoteId);
      const quoteDoc = await quoteRef.get();
      
      if (!quoteDoc.exists) return res.status(404).json({ error: 'Quote not found' });
      const quote = quoteDoc.data();

      const requestDoc = await db.collection('quoteRequests').doc(quote.requestId).get();
      if (!requestDoc.exists || requestDoc.data().customerId !== req.user.id) {
        return res.status(403).json({ error: 'Not your quote' });
      }
      const requestData = requestDoc.data();

      if (quote.status !== 'PENDING') {
        return res.status(400).json({ error: 'Quote already processed' });
      }

      const timestamp = new Date().toISOString();
      const orderId = uuidv4();
      const eventId = uuidv4();

      const orderData = {
        id: orderId,
        customerId: req.user.id,
        vendorId: quote.vendorId,
        quoteId,
        finalAmount: quote.totalCost,
        deliveryAddress: requestData.deliveryAddress || req.body.deliveryAddress || '',
        city: requestData.city || '',
        state: requestData.state || '',
        pincode: requestData.pincode || '',
        status: 'NOT_STARTED',
        createdAt: timestamp,
        updatedAt: timestamp
      };

      const trackingEvent = {
        id: eventId,
        orderId,
        status: 'NOT_STARTED',
        note: 'Order created',
        createdAt: timestamp,
        updatedAt: timestamp
      };

      // Mark quote as accepted and create order in a batch transaction
      const batch = db.batch();
      batch.update(quoteRef, { status: 'ACCEPTED', updatedAt: timestamp });
      batch.set(db.collection('orders').doc(orderId), orderData);
      batch.set(db.collection('orderTrackings').doc(eventId), trackingEvent);
      await batch.commit();

      // Build relation tree for response
      const vendorUser = await getUserBasicInfo(quote.vendorId);
      const responseData = {
        ...orderData,
        trackingEvents: [trackingEvent],
        vendor: { user: { name: vendorUser.name } },
      };

      // Notify vendor via socket
      const io = req.app.get('io');
      if (io) {
        io.to(`vendor:${quote.vendorId}`).emit('order:new', responseData);
      }

      res.status(201).json(responseData);
    } catch (err) {
      console.error('Order creation error:', err);
      res.status(500).json({ error: 'Failed to create order' });
    }
  }
);

// GET /orders/customer
router.get('/customer', auth, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const showAll = req.query.showAll === 'true';
    const snapshot = await db.collection('orders')
      .where('customerId', '==', req.user.id)
      .get();
      
    let active = [];
    let history = [];

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.customerDeleted) return; // Hide soft-deleted orders
      if (data.status === 'DELIVERED') history.push(data);
      else active.push(data);
    });

    active.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    let ordersDocs = active.concat(showAll ? history : history.slice(0, 15));
    const hasMoreHistory = !showAll && history.length > 15;

    const orders = [];

    for (const order of ordersDocs) {

      // Fetch Vendor Info
      const vendorDoc = await db.collection('vendors').doc(order.vendorId).get();
      if (vendorDoc.exists) {
        const vData = vendorDoc.data();
        const vUser = await getUserBasicInfo(vData.userId);
        order.vendor = { ...vData, user: { name: vUser.name } };
      }

      // Fetch Quote & Request & Design (if quoteId exists)
      if (order.quoteId) {
        const quoteDoc = await db.collection('quotes').doc(order.quoteId).get();
        if (quoteDoc.exists) {
          order.quote = quoteDoc.data();
          const reqDoc = await db.collection('quoteRequests').doc(order.quote.requestId).get();
          if (reqDoc.exists) {
            order.quote.request = reqDoc.data();
            const designDoc = await db.collection('designFiles').doc(order.quote.request.designId).get();
            order.quote.request.design = designDoc.exists ? designDoc.data() : null;
          }
        }
      }

      // Fetch Tracking Events (sort in memory to prevent Firebase index errors)
      const trackSnap = await db.collection('orderTrackings')
        .where('orderId', '==', order.id)
        .get();
      order.trackingEvents = trackSnap.docs.map(t => t.data()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      orders.push(order);
    }

    res.json({ orders, hasMoreHistory });
  } catch (err) {
    console.error('Customer orders error:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /orders/vendor
router.get('/vendor', auth, requireRole('VENDOR'), async (req, res) => {
  try {
    const vendorSnap = await db.collection('vendors').where('userId', '==', req.user.id).limit(1).get();
    if (vendorSnap.empty) return res.status(404).json({ error: 'Vendor not found' });
    const vendorId = vendorSnap.docs[0].id;

    const showAll = req.query.showAll === 'true';
    const snapshot = await db.collection('orders')
      .where('vendorId', '==', vendorId)
      .get();
      
    let active = [];
    let history = [];

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.status === 'DELIVERED') history.push(data);
      else active.push(data);
    });

    active.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    let ordersDocs = active.concat(showAll ? history : history.slice(0, 15));
    const hasMoreHistory = !showAll && history.length > 15;

    const orders = [];

    for (const order of ordersDocs) {

      order.customer = await getUserBasicInfo(order.customerId);

      if (order.quoteId) {
        const quoteDoc = await db.collection('quotes').doc(order.quoteId).get();
        if (quoteDoc.exists) {
          order.quote = quoteDoc.data();
          const reqDoc = await db.collection('quoteRequests').doc(order.quote.requestId).get();
          if (reqDoc.exists) {
            order.quote.request = reqDoc.data();
            const designDoc = await db.collection('designFiles').doc(order.quote.request.designId).get();
            order.quote.request.design = designDoc.exists ? designDoc.data() : null;
          }
        }
      }

      const trackSnap = await db.collection('orderTrackings')
        .where('orderId', '==', order.id)
        .get();
      order.trackingEvents = trackSnap.docs.map(t => t.data()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      orders.push(order);
    }

    res.json({ orders, hasMoreHistory });
  } catch (err) {
    console.error('Vendor orders error:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// POST /orders/update-status — Vendor updates manufacturing status
router.post('/update-status',
  auth, requireRole('VENDOR'),
  body('orderId').notEmpty(),
  body('status').isIn(ORDER_STATUSES),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { orderId, status, note } = req.body;

    try {
      const vendorSnap = await db.collection('vendors').where('userId', '==', req.user.id).limit(1).get();
      if (vendorSnap.empty) return res.status(404).json({ error: 'Vendor not found' });
      const vendorId = vendorSnap.docs[0].id;

      const orderRef = db.collection('orders').doc(orderId);
      const orderDoc = await orderRef.get();
      
      if (!orderDoc.exists || orderDoc.data().vendorId !== vendorId) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const timestamp = new Date().toISOString();
      const eventId = uuidv4();
      
      const batch = db.batch();
      batch.update(orderRef, { status, updatedAt: timestamp });
      
      batch.set(db.collection('orderTrackings').doc(eventId), {
        id: eventId,
        orderId,
        status,
        note: note || `Status updated to ${status}`,
        createdAt: timestamp,
        updatedAt: timestamp
      });
      
      await batch.commit();

      // Notify customer via socket
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${orderDoc.data().customerId}`).emit('order:status_updated', {
          orderId,
          status,
          note,
        });
      }

      res.json({ success: true, status });
    } catch (err) {
      console.error('Update status error:', err);
      res.status(500).json({ error: 'Failed to update status' });
    }
  }
);

// POST /orders/confirm-receipt — Customer confirms they received the package
router.post('/confirm-receipt',
  auth, requireRole('CUSTOMER'),
  body('orderId').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { orderId } = req.body;

    try {
      const orderRef = db.collection('orders').doc(orderId);
      const orderDoc = await orderRef.get();
      
      if (!orderDoc.exists || orderDoc.data().customerId !== req.user.id) {
        return res.status(404).json({ error: 'Order not found or unauthorized' });
      }

      if (orderDoc.data().status === 'DELIVERED') {
        return res.status(400).json({ error: 'Order is already delivered' });
      }

      const timestamp = new Date().toISOString();
      const eventId = uuidv4();
      
      const batch = db.batch();
      batch.update(orderRef, {
        status: 'DELIVERED',
        deliveredAt: timestamp, // ← Used for 48h refund + escrow window
        updatedAt: timestamp,
      });
      
      batch.set(db.collection('orderTrackings').doc(eventId), {
        id: eventId,
        orderId,
        status: 'DELIVERED',
        note: 'Customer confirmed package receipt',
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      // Reset escrow window: 48h from NOW (delivery time), not payment time
      if (orderDoc.data().paymentId) {
        const escrowReleasesAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
        batch.update(db.collection('payments').doc(orderDoc.data().paymentId), {
          escrowReleasesAt,
          updatedAt: timestamp,
        });
      }
      
      await batch.commit();

      // Notify vendor via socket
      const io = req.app.get('io');
      if (io) {
        io.to(`vendor:${orderDoc.data().vendorId}`).emit('order:status_updated', {
          orderId,
          status: 'DELIVERED',
          note: 'Customer confirmed package receipt',
        });
      }

      res.json({ success: true, status: 'DELIVERED' });
    } catch (err) {
      console.error('Confirm receipt error:', err);
      res.status(500).json({ error: 'Failed to confirm receipt' });
    }
  }
);

// GET /orders/status/:orderId
router.get('/status/:orderId', auth, async (req, res) => {
  try {
    const orderDoc = await db.collection('orders').doc(req.params.orderId).get();
    if (!orderDoc.exists) return res.status(404).json({ error: 'Order not found' });
    
    const order = orderDoc.data();

    const vendorDoc = await db.collection('vendors').doc(order.vendorId).get();
    const vendorUserId = vendorDoc.exists ? vendorDoc.data().userId : null;

    // Auth check: only owner or vendor
    const isCustomer = order.customerId === req.user.id;
    const isVendor = vendorUserId === req.user.id;
    if (!isCustomer && !isVendor) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (vendorDoc.exists) {
      const vUser = await getUserBasicInfo(vendorUserId);
      order.vendor = { ...vendorDoc.data(), user: { name: vUser.name } };
    }

    order.customer = await getUserBasicInfo(order.customerId);

    const trackSnap = await db.collection('orderTrackings')
      .where('orderId', '==', order.id)
      .get();
    order.trackingEvents = trackSnap.docs.map(t => t.data()).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); // asc for timeline view

    res.json(order);
  } catch (err) {
    console.error('Fetch order status error:', err);
    res.status(500).json({ error: 'Failed to fetch order status' });
  }
});

// POST /orders/:id/customer-hide — Soft deletes an order from customer UI
router.post('/:id/customer-hide', auth, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const orderRef = db.collection('orders').doc(req.params.id);
    const doc = await orderRef.get();
    if (!doc.exists || doc.data().customerId !== req.user.id) {
      return res.status(404).json({ error: 'Order not found' });
    }
    await orderRef.update({ customerDeleted: true });
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to hide order:', err);
    res.status(500).json({ error: 'Failed to hide order' });
  }
});

module.exports = router;
