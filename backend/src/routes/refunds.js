const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, requireRole } = require('../middleware/auth');
const { db } = require('../lib/firebase');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// ──────────────────────────────────────────────────────────────
// Video/Photo Upload Setup
// ──────────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, '../../uploads/refunds');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `refund-${suffix}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB for videos
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.mov', '.webm', '.avi'];
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only images (JPG, PNG, WEBP) and videos (MP4, MOV, WebM) are allowed'));
  },
});

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

// ──────────────────────────────────────────────────────────────
// REFUND POLICY — Balanced 20% Deduction on ALL claim types
// ──────────────────────────────────────────────────────────────
// Customer gets 80% of the order amount back.
// The 20% deduction is split as:
//   - 12% → Vendor  (compensates for production cost, packing, labor)
//   - 8%  → Platform (platform fee, dispute handling, ops cost)
//
// This applies to: WRONG_ORDER, PARTIAL_DAMAGE, FULL_DAMAGE, FULL_RETURN
//
// Refund is credited to the customer within 12–24 hours via scheduler.
// ──────────────────────────────────────────────────────────────
const DEDUCTION_RATE        = 0.20; // 20% total deduction
const CUSTOMER_REFUND_RATE  = 0.80; // 80% → customer
const VENDOR_SHARE_RATE     = 0.12; // 12% → vendor (from the 20%)
const PLATFORM_SHARE_RATE   = 0.08; // 8%  → platform (from the 20%)

/**
 * Compute the financial split for any refund type.
 * @param {number} totalPaid - The original order finalAmount
 * @returns {{ customerRefund, vendorShare, platformShare, deductionAmount }}
 */
function computeRefundSplit(totalPaid) {
  const customerRefund  = parseFloat((totalPaid * CUSTOMER_REFUND_RATE).toFixed(2));
  const vendorShare     = parseFloat((totalPaid * VENDOR_SHARE_RATE).toFixed(2));
  const platformShare   = parseFloat((totalPaid * PLATFORM_SHARE_RATE).toFixed(2));
  const deductionAmount = parseFloat((totalPaid * DEDUCTION_RATE).toFixed(2));
  return { customerRefund, vendorShare, platformShare, deductionAmount };
}

// Helper: Get vendor ID from user ID
async function getVendorId(userId) {
  const snap = await db.collection('vendors').where('userId', '==', userId).limit(1).get();
  return snap.empty ? null : snap.docs[0].id;
}

// ──────────────────────────────────────────────────────────────
// POST /refunds/request — Customer files a refund (within 48h of delivery)
// ──────────────────────────────────────────────────────────────
router.post('/request',
  auth, requireRole('CUSTOMER'),
  body('orderId').notEmpty(),
  body('type').isIn(['WRONG_ORDER', 'PARTIAL_DAMAGE', 'FULL_DAMAGE', 'FULL_RETURN']),
  body('description').trim().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { orderId, type, description } = req.body;

    try {
      const orderRef = db.collection('orders').doc(orderId);
      const orderDoc = await orderRef.get();

      if (!orderDoc.exists || orderDoc.data().customerId !== req.user.id) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const order = orderDoc.data();

      if (order.status !== 'DELIVERED') {
        return res.status(400).json({ error: 'Refund can only be requested for delivered orders' });
      }

      // ── 48-hour window check ──
      const deliveredAt = order.deliveredAt ? new Date(order.deliveredAt) : null;
      if (deliveredAt) {
        const hoursSinceDelivery = (Date.now() - deliveredAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceDelivery > 48) {
          return res.status(400).json({ error: 'Refund window has expired. Refunds must be requested within 48 hours of delivery.' });
        }
      }

      // ── Check for existing refund (one per order) ──
      const existingRefundSnap = await db.collection('refundRequests')
        .where('orderId', '==', orderId)
        .get();

      if (!existingRefundSnap.empty) {
        return res.status(409).json({ error: 'A refund request has already been filed for this order' });
      }

      // ── Calculate 80/12/8 split for ALL claim types ──
      const totalPaid = parseFloat(order.finalAmount || 0);
      const { customerRefund, vendorShare, platformShare, deductionAmount } = computeRefundSplit(totalPaid);

      const timestamp = new Date().toISOString();
      const refundId = uuidv4();

      // Customer refund scheduled 12–24h from now (random in range for natural processing)
      const refundHoursDelay = 12 + Math.random() * 12; // 12h to 24h
      const refundScheduledAt = new Date(Date.now() + refundHoursDelay * 60 * 60 * 1000).toISOString();

      const refundData = {
        id: refundId,
        orderId,
        customerId: req.user.id,
        vendorId: order.vendorId,
        paymentId: order.paymentId || null,
        type,
        description,
        status: 'PENDING',
        // ── Financial breakdown (new balanced policy) ──
        orderAmount: totalPaid,
        deductionRate: DEDUCTION_RATE,           // 0.20 = 20%
        deductionAmount,                          // 20% of total
        customerRefund,                           // 80% → customer
        vendorShare,                              // 12% → vendor
        platformShare,                            // 8%  → platform
        refundScheduledAt,                        // when the 80% is scheduled to hit
        // Proof (uploaded separately)
        customerPhotoUrl: null,
        customerVideoUrl: null,
        // Vendor response
        vendorResponseNotes: null,
        vendorDisputePhotoUrl: null,
        vendorPackingVideoUrl: null,
        // Resolution
        replacementTrackingId: null,
        adminNotes: null,
        resolvedAt: null,
        filedWithin48h: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const batch = db.batch();
      batch.set(db.collection('refundRequests').doc(refundId), refundData);

      // Freeze payment during dispute
      if (order.paymentId) {
        batch.update(db.collection('payments').doc(order.paymentId), {
          status: 'FROZEN',
          updatedAt: timestamp,
        });
      }

      // Update order with refund reference
      batch.update(orderRef, {
        refundStatus: 'PENDING',
        refundId,
        updatedAt: timestamp,
      });

      await batch.commit();

      // Notify vendor via socket
      const io = req.app.get('io');
      if (io) {
        io.to(`vendor:${order.vendorId}`).emit('refund:request', {
          orderId,
          refundId,
          type,
          message: 'A customer has filed a refund request for your order.',
        });
      }

      res.status(201).json(refundData);
    } catch (err) {
      console.error('Refund request error:', err);
      res.status(500).json({ error: 'Failed to create refund request' });
    }
  }
);

// ──────────────────────────────────────────────────────────────
// POST /refunds/:id/upload-proof — Upload photo/video proof (customer)
// ──────────────────────────────────────────────────────────────
router.post('/:id/upload-proof', auth, requireRole('CUSTOMER'),
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'video', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const refundRef = db.collection('refundRequests').doc(req.params.id);
      const refundDoc = await refundRef.get();

      if (!refundDoc.exists || refundDoc.data().customerId !== req.user.id) {
        return res.status(404).json({ error: 'Refund request not found' });
      }

      const updates = { updatedAt: new Date().toISOString() };
      if (req.files?.photo?.[0]) {
        updates.customerPhotoUrl = `${BACKEND_URL}/uploads/refunds/${req.files.photo[0].filename}`;
      }
      if (req.files?.video?.[0]) {
        updates.customerVideoUrl = `${BACKEND_URL}/uploads/refunds/${req.files.video[0].filename}`;
      }

      await refundRef.update(updates);
      res.json({ success: true, ...updates });
    } catch (err) {
      console.error('Upload proof error:', err);
      res.status(500).json({ error: 'Failed to upload proof' });
    }
  }
);

// ──────────────────────────────────────────────────────────────
// POST /refunds/:id/vendor-respond — Vendor accepts or disputes claim
// ──────────────────────────────────────────────────────────────
router.post('/:id/vendor-respond',
  auth, requireRole('VENDOR'),
  body('action').isIn(['ACCEPT', 'DISPUTE']),
  body('notes').optional().trim(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const vendorId = await getVendorId(req.user.id);
      const refundRef = db.collection('refundRequests').doc(req.params.id);
      const refundDoc = await refundRef.get();

      if (!refundDoc.exists || refundDoc.data().vendorId !== vendorId) {
        return res.status(404).json({ error: 'Refund request not found' });
      }

      const refund = refundDoc.data();
      if (refund.status !== 'PENDING') {
        return res.status(400).json({ error: 'Refund request already responded to' });
      }

      const { action, notes } = req.body;
      const newStatus = action === 'ACCEPT' ? 'VENDOR_ACCEPTED' : 'VENDOR_DISPUTED';

      await refundRef.update({
        status: newStatus,
        vendorResponseNotes: notes || '',
        updatedAt: new Date().toISOString(),
      });

      // If disputed, escalate to admin
      if (action === 'DISPUTE') {
        await refundRef.update({ status: 'ADMIN_REVIEW' });
      }

      // Notify customer
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${refund.customerId}`).emit('refund:vendor_response', {
          refundId: req.params.id,
          action,
          notes,
        });

        if (action === 'DISPUTE') {
          io.to('admin').emit('refund:disputed_to_admin', {
            refundId: req.params.id,
            message: 'A vendor has disputed a refund claim. Action required.',
          });
        }
      }

      res.json({ success: true, status: newStatus });
    } catch (err) {
      console.error('Vendor respond error:', err);
      res.status(500).json({ error: 'Failed to respond to refund' });
    }
  }
);

// ──────────────────────────────────────────────────────────────
// POST /refunds/:id/vendor-upload-proof — Vendor counter-proof
// ──────────────────────────────────────────────────────────────
router.post('/:id/vendor-upload-proof', auth, requireRole('VENDOR'),
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'photo', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const vendorId = await getVendorId(req.user.id);
      const refundRef = db.collection('refundRequests').doc(req.params.id);
      const refundDoc = await refundRef.get();

      if (!refundDoc.exists || refundDoc.data().vendorId !== vendorId) {
        return res.status(404).json({ error: 'Refund not found' });
      }

      if (!req.files) return res.status(400).json({ error: 'No files uploaded' });

      const updates = { updatedAt: new Date().toISOString() };
      
      if (req.files.video?.[0]) {
        updates.vendorPackingVideoUrl = `${BACKEND_URL}/uploads/refunds/${req.files.video[0].filename}`;
      }
      if (req.files.photo?.[0]) {
        updates.vendorDisputePhotoUrl = `${BACKEND_URL}/uploads/refunds/${req.files.photo[0].filename}`;
      }

      await refundRef.update(updates);
      res.json({ success: true, ...updates });
    } catch (err) {
      console.error('Vendor proof upload error:', err);
      res.status(500).json({ error: 'Failed to upload proof files' });
    }
  }
);

// ──────────────────────────────────────────────────────────────
// POST /refunds/:id/vendor-ship-replacement — Vendor marks replacement shipped
// (Replacement path — no money refunded, vendor ships again)
// ──────────────────────────────────────────────────────────────
router.post('/:id/vendor-ship-replacement',
  auth, requireRole('VENDOR'),
  body('trackingId').notEmpty(),
  async (req, res) => {
    try {
      const vendorId = await getVendorId(req.user.id);
      const refundRef = db.collection('refundRequests').doc(req.params.id);
      const refundDoc = await refundRef.get();

      if (!refundDoc.exists || refundDoc.data().vendorId !== vendorId) {
        return res.status(404).json({ error: 'Refund not found' });
      }

      if (!['VENDOR_ACCEPTED'].includes(refundDoc.data().status)) {
        return res.status(400).json({ error: 'Cannot ship replacement in current status' });
      }

      await refundRef.update({
        status: 'REPLACEMENT_SHIPPED',
        replacementTrackingId: req.body.trackingId,
        updatedAt: new Date().toISOString(),
      });

      const io = req.app.get('io');
      if (io) {
        io.to(`user:${refundDoc.data().customerId}`).emit('refund:replacement_shipped', {
          refundId: req.params.id,
          trackingId: req.body.trackingId,
        });
      }

      res.json({ success: true });
    } catch (err) {
      console.error('Ship replacement error:', err);
      res.status(500).json({ error: 'Failed to update replacement status' });
    }
  }
);

// ──────────────────────────────────────────────────────────────
// POST /refunds/:id/customer-confirm — Customer confirms replacement received
// ──────────────────────────────────────────────────────────────
router.post('/:id/customer-confirm', auth, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const refundRef = db.collection('refundRequests').doc(req.params.id);
    const refundDoc = await refundRef.get();

    if (!refundDoc.exists || refundDoc.data().customerId !== req.user.id) {
      return res.status(404).json({ error: 'Refund not found' });
    }

    if (refundDoc.data().status !== 'REPLACEMENT_SHIPPED') {
      return res.status(400).json({ error: 'Cannot confirm in current status' });
    }

    const refund = refundDoc.data();
    const timestamp = new Date().toISOString();
    const batch = db.batch();

    batch.update(refundRef, {
      status: 'RESOLVED_REPLACED',
      resolvedAt: timestamp,
      updatedAt: timestamp,
    });

    // Release full payment to vendor (they fulfilled the replacement)
    if (refund.paymentId) {
      const escrowReleasesAt = new Date(Date.now() + 1 * 60 * 1000).toISOString();
      batch.update(db.collection('payments').doc(refund.paymentId), {
        status: 'ESCROWED',
        escrowReleasesAt,
        updatedAt: timestamp,
      });
    }

    batch.update(db.collection('orders').doc(refund.orderId), {
      refundStatus: 'RESOLVED_REPLACED',
      updatedAt: timestamp,
    });

    await batch.commit();
    res.json({ success: true, status: 'RESOLVED_REPLACED' });
  } catch (err) {
    console.error('Customer confirm error:', err);
    res.status(500).json({ error: 'Failed to confirm replacement' });
  }
});

// ──────────────────────────────────────────────────────────────
// GET /refunds/customer — Customer's own refund requests
// ──────────────────────────────────────────────────────────────
router.get('/customer', auth, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const snap = await db.collection('refundRequests')
      .where('customerId', '==', req.user.id)
      .get();

    const refunds = snap.docs.map(d => d.data())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(refunds);
  } catch (err) {
    console.error('Customer refunds error:', err);
    res.status(500).json({ error: 'Failed to fetch refunds' });
  }
});

// ──────────────────────────────────────────────────────────────
// GET /refunds/vendor — Vendor's incoming refund claims
// ──────────────────────────────────────────────────────────────
router.get('/vendor', auth, requireRole('VENDOR'), async (req, res) => {
  try {
    const vendorId = await getVendorId(req.user.id);
    if (!vendorId) return res.status(404).json({ error: 'Vendor not found' });

    const snap = await db.collection('refundRequests')
      .where('vendorId', '==', vendorId)
      .get();

    const refunds = snap.docs.map(d => d.data())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    for (const refund of refunds) {
      const userDoc = await db.collection('users').doc(refund.customerId).get();
      if (userDoc.exists) {
        const u = userDoc.data();
        refund.customer = { name: u.name, email: u.email };
      }
    }

    res.json(refunds);
  } catch (err) {
    console.error('Vendor refunds error:', err);
    res.status(500).json({ error: 'Failed to fetch refunds' });
  }
});

module.exports = router;
