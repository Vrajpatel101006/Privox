const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { db } = require('../lib/firebase');

const router = express.Router();

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'prinvox_admin_jwt_secret_xyz';

// ── Admin Auth Middleware ──
function adminAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Admin token required' });
  try {
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET);
    if (!decoded.isAdmin) throw new Error('Not admin');
    req.admin = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired admin token' });
  }
}

// ──────────────────────────────────────────────────────────────
// POST /admin/login
// ──────────────────────────────────────────────────────────────
router.post('/login',
  body('email').isEmail(),
  body('password').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;

    if (
      email !== (process.env.ADMIN_EMAIL || 'admin@prinvox.com') ||
      password !== (process.env.ADMIN_PASSWORD || 'admin_super_secret_123')
    ) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    const token = jwt.sign({ isAdmin: true, email }, ADMIN_JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, email });
  }
);

// ──────────────────────────────────────────────────────────────
// GET /admin/disputes — All refunds in ADMIN_REVIEW state
// ──────────────────────────────────────────────────────────────
router.get('/disputes', adminAuth, async (req, res) => {
  try {
    // Get ALL refunds for admin to see full picture; front-end filters by status
    const snap = await db.collection('refundRequests').get();
    const refunds = snap.docs.map(d => d.data())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Enrich each with customer + vendor info
    for (const refund of refunds) {
      const customerDoc = await db.collection('users').doc(refund.customerId).get();
      if (customerDoc.exists) {
        const c = customerDoc.data();
        refund.customer = { name: c.name, email: c.email };
      }

      const vendorDoc = await db.collection('vendors').doc(refund.vendorId).get();
      if (vendorDoc.exists) {
        refund.vendor = { companyName: vendorDoc.data().companyName };
      }

      const orderDoc = await db.collection('orders').doc(refund.orderId).get();
      if (orderDoc.exists) {
        refund.order = { finalAmount: orderDoc.data().finalAmount, status: orderDoc.data().status };
      }
    }

    res.json(refunds);
  } catch (err) {
    console.error('Admin disputes error:', err);
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

// ──────────────────────────────────────────────────────────────
// GET /admin/stats — Platform overview numbers
// ──────────────────────────────────────────────────────────────
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const [ordersSnap, paymentsSnap, refundsSnap, usersSnap, vendorsSnap] = await Promise.all([
      db.collection('orders').get(),
      db.collection('payments').get(),
      db.collection('refundRequests').get(),
      db.collection('users').where('role', '==', 'CUSTOMER').get(),
      db.collection('vendors').get(),
    ]);

    const payments = paymentsSnap.docs.map(d => d.data());
    const totalRevenue = payments
      .filter(p => ['ESCROWED', 'RELEASED'].includes(p.status))
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const totalPlatformFee = payments
      .filter(p => p.status === 'RELEASED')
      .reduce((sum, p) => sum + (p.platformFee || 0), 0);

    const pendingDisputes = refundsSnap.docs
      .filter(d => d.data().status === 'ADMIN_REVIEW').length;

    res.json({
      totalOrders: ordersSnap.size,
      totalCustomers: usersSnap.size,
      totalVendors: vendorsSnap.size,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalPlatformFee: parseFloat(totalPlatformFee.toFixed(2)),
      totalRefunds: refundsSnap.size,
      pendingDisputes,
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /admin/disputes/:id/resolve — Admin makes final decision
//
// REFUND_CUSTOMER: Customer gets 80%. Vendor keeps 12% for production
//   cost. Platform keeps 8% for ops/dispute handling.
//   Refund is scheduled to customer within 12–24h.
//
// RELEASE_TO_VENDOR: Claim was invalid — full payment released to
//   vendor immediately (5-min escrow window).
// ──────────────────────────────────────────────────────────────
router.post('/disputes/:id/resolve', adminAuth,
  body('decision').isIn(['REFUND_CUSTOMER', 'RELEASE_TO_VENDOR']),
  body('notes').optional().trim(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { decision, notes } = req.body;

    try {
      const refundRef = db.collection('refundRequests').doc(req.params.id);
      const refundDoc = await refundRef.get();

      if (!refundDoc.exists) return res.status(404).json({ error: 'Refund not found' });

      const refund = refundDoc.data();
      const timestamp = new Date().toISOString();
      const batch = db.batch();

      if (decision === 'REFUND_CUSTOMER') {
        // Use pre-computed split from refund document (calculated at request time)
        // Fallback: recompute if old refund doc doesn't have the fields
        const totalPaid    = parseFloat(refund.orderAmount || 0);
        const customerRefund = refund.customerRefund  ?? parseFloat((totalPaid * 0.80).toFixed(2));
        const vendorShare    = refund.vendorShare     ?? parseFloat((totalPaid * 0.12).toFixed(2));
        const platformShare  = refund.platformShare   ?? parseFloat((totalPaid * 0.08).toFixed(2));

        // Schedule customer refund to arrive within 12–24h from now
        const refundHoursDelay = 12 + Math.random() * 12;
        const refundScheduledAt = new Date(Date.now() + refundHoursDelay * 60 * 60 * 1000).toISOString();

        batch.update(refundRef, {
          status: 'RESOLVED_REFUNDED',
          adminNotes: notes || '',
          resolvedAt: timestamp,
          updatedAt: timestamp,
          // Lock in final amounts
          customerRefund,
          vendorShare,
          platformShare,
          refundScheduledAt,
        });

        if (refund.paymentId) {
          batch.update(db.collection('payments').doc(refund.paymentId), {
            status: 'REFUND_PENDING',           // Will be processed by scheduler
            refundScheduledAt,                   // Scheduler uses this to time the payout
            refundAmount: customerRefund,         // 80% back to customer
            vendorSettlementAmount: vendorShare,  // 12% stays with vendor
            platformSettlementAmount: platformShare, // 8% stays with platform
            updatedAt: timestamp,
          });
        }

        batch.update(db.collection('orders').doc(refund.orderId), {
          refundStatus: 'RESOLVED_REFUNDED',
          updatedAt: timestamp,
        });

        console.log(`[Admin] Dispute ${req.params.id} resolved: REFUND_CUSTOMER — ₹${customerRefund} to customer, ₹${vendorShare} to vendor, ₹${platformShare} to platform. Scheduled: ${refundScheduledAt}`);

      } else { // RELEASE_TO_VENDOR — claim was invalid
        batch.update(refundRef, {
          status: 'RESOLVED_REJECTED',
          adminNotes: notes || '',
          resolvedAt: timestamp,
          updatedAt: timestamp,
        });

        if (refund.paymentId) {
          // Schedule immediate release to vendor (5 mins)
          const releaseAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
          batch.update(db.collection('payments').doc(refund.paymentId), {
            status: 'ESCROWED',
            escrowReleasesAt: releaseAt,
            updatedAt: timestamp,
          });
        }

        batch.update(db.collection('orders').doc(refund.orderId), {
          refundStatus: 'RESOLVED_REJECTED',
          updatedAt: timestamp,
        });

        console.log(`[Admin] Dispute ${req.params.id} resolved: RELEASE_TO_VENDOR — full amount released to vendor.`);
      }

      await batch.commit();

      // Notify both parties via socket
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${refund.customerId}`).emit('refund:resolved', {
          refundId: req.params.id,
          decision,
          customerRefund: decision === 'REFUND_CUSTOMER' ? refund.customerRefund : 0,
          message: decision === 'REFUND_CUSTOMER'
            ? `Your refund of ₹${refund.customerRefund} (80%) has been approved and will be credited within 12–24 hours.`
            : 'Your refund claim was reviewed and rejected. Payment has been released to the vendor.',
        });
        io.to(`vendor:${refund.vendorId}`).emit('refund:resolved', {
          refundId: req.params.id,
          decision,
          message: decision === 'REFUND_CUSTOMER'
            ? `Refund approved for order. You retain ₹${refund.vendorShare} (12%) as production compensation.`
            : 'Dispute resolved in your favour. Full payment released to your account.',
        });
      }

      res.json({ success: true, decision });
    } catch (err) {
      console.error('Admin resolve error:', err);
      res.status(500).json({ error: 'Failed to resolve dispute' });
    }
  }
);

// ──────────────────────────────────────────────────────────────
// GET /admin/orders — All orders for overview
// ──────────────────────────────────────────────────────────────
router.get('/orders', adminAuth, async (req, res) => {
  try {
    const snap = await db.collection('orders').get();
    const orders = snap.docs.map(d => d.data())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 100); // Cap at 100 for admin view

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

module.exports = router;
