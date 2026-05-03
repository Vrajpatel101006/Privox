const cron = require('node-cron');
const Razorpay = require('razorpay');
const { db } = require('../lib/firebase');
const path = require('path');
const fs = require('fs');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_PLACEHOLDER',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'PLACEHOLDER_SECRET',
});

const IS_MOCK_MODE = !process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID === 'rzp_test_PLACEHOLDER';

// ──────────────────────────────────────────────────────────────
// JOB 1: Release escrowed payments after 48h window has passed
// Runs every 30 minutes
// ──────────────────────────────────────────────────────────────
async function releaseEscrowedPayments() {
  console.log('[Scheduler] Checking for payments to release...');
  try {
    const now = new Date().toISOString();

    const snap = await db.collection('payments')
      .where('status', '==', 'ESCROWED')
      .get();

    let released = 0;

    for (const doc of snap.docs) {
      const payment = doc.data();

      // Check if escrow window has passed
      if (!payment.escrowReleasesAt || payment.escrowReleasesAt > now) continue;

      // Verify no active refund for this order
      // Avoid Firestore 'not-in' (requires composite index) — filter in JS instead
      const refundSnap = await db.collection('refundRequests')
        .where('orderId', '==', payment.orderId)
        .get();

      const RESOLVED = ['RESOLVED_REPLACED', 'RESOLVED_REFUNDED', 'RESOLVED_REJECTED'];
      const hasActiveRefund = refundSnap.docs.some(d => !RESOLVED.includes(d.data().status));

      if (hasActiveRefund) {
        console.log(`[Scheduler] Payment ${payment.id} has active refund — skipping release`);
        continue;
      }

      // Release payment to vendor
      try {
        if (!IS_MOCK_MODE && payment.vendorBankAccountId) {
          // Real Razorpay Route payout
          await razorpay.payouts.create({
            account_number: process.env.RAZORPAY_ACCOUNT_ID,
            fund_account_id: payment.vendorBankAccountId,
            amount: Math.round((payment.vendorAmount || 0) * 100), // paise
            currency: 'INR',
            mode: 'IMPS',
            purpose: 'payout',
            queue_if_low_balance: true,
            reference_id: `prinvox_payout_${payment.id}`,
            narration: `Prinvox Payout - Order ${payment.orderId}`,
          });
          console.log(`[Scheduler] ✅ Real payout triggered for payment ${payment.id}`);
        } else {
          console.log(`[Scheduler] 🔧 MOCK MODE: Simulating payout for payment ${payment.id} — Amount: ₹${payment.vendorAmount}`);
        }

        // Update payment status to RELEASED
        await doc.ref.update({
          status: 'RELEASED',
          releasedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Update order payment status
        await db.collection('orders').doc(payment.orderId).update({
          paymentStatus: 'RELEASED',
          updatedAt: new Date().toISOString(),
        });

        released++;
      } catch (payoutErr) {
        console.error(`[Scheduler] Failed to release payment ${payment.id}:`, payoutErr.message);
      }
    }

    if (released > 0) {
      console.log(`[Scheduler] ✅ Released ${released} payment(s) to vendors`);
    } else {
      console.log('[Scheduler] No payments ready for release');
    }
  } catch (err) {
    console.error('[Scheduler] Error in escrow release job:', err);
  }
}

// ──────────────────────────────────────────────────────────────
// JOB 2: Auto-approve refunds if vendor doesn't respond in 72h
// Runs every hour
// ──────────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────
// JOB 2: Auto-approve refunds if vendor doesn't respond in 72h
// Runs every hour
// ──────────────────────────────────────────────────────────────
async function autoApproveStaleRefunds() {
  console.log('[Scheduler] Checking for stale refund requests...');
  try {
    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    const snap = await db.collection('refundRequests')
      .where('status', '==', 'PENDING')
      .get();

    let autoApproved = 0;

    for (const doc of snap.docs) {
      const refund = doc.data();

      if (refund.createdAt > cutoff) continue; // Less than 72h old

      const timestamp = new Date().toISOString();
      const batch = db.batch();

      const totalPaid      = parseFloat(refund.orderAmount || 0);
      const customerRefund = refund.customerRefund  ?? parseFloat((totalPaid * 0.80).toFixed(2));
      const vendorShare    = refund.vendorShare     ?? parseFloat((totalPaid * 0.12).toFixed(2));
      const platformShare  = refund.platformShare   ?? parseFloat((totalPaid * 0.08).toFixed(2));

      // Schedule customer refund to arrive within 12–24h from now
      const refundHoursDelay = 12 + Math.random() * 12;
      const refundScheduledAt = new Date(Date.now() + refundHoursDelay * 60 * 60 * 1000).toISOString();

      batch.update(doc.ref, {
        status: 'RESOLVED_REFUNDED',
        adminNotes: 'Auto-approved: Vendor did not respond within 72 hours.',
        resolvedAt: timestamp,
        updatedAt: timestamp,
        customerRefund,
        vendorShare,
        platformShare,
        refundScheduledAt,
      });

      if (refund.paymentId) {
        batch.update(db.collection('payments').doc(refund.paymentId), {
          status: 'REFUND_PENDING',
          refundScheduledAt,
          refundAmount: customerRefund,
          vendorSettlementAmount: vendorShare,
          platformSettlementAmount: platformShare,
          updatedAt: timestamp,
        });
      }

      batch.update(db.collection('orders').doc(refund.orderId), {
        refundStatus: 'RESOLVED_REFUNDED',
        updatedAt: timestamp,
      });

      await batch.commit();
      autoApproved++;
      console.log(`[Scheduler] ✅ Auto-approved refund ${refund.id} for order ${refund.orderId}`);
    }

    if (autoApproved > 0) {
      console.log(`[Scheduler] Auto-approved ${autoApproved} stale refund(s)`);
    }
  } catch (err) {
    console.error('[Scheduler] Error in auto-approve job:', err);
  }
}

// ──────────────────────────────────────────────────────────────
// JOB 2.5: Process Scheduled Refunds (80/12/8 split)
// Runs every 15 minutes
// ──────────────────────────────────────────────────────────────
async function processScheduledRefunds() {
  console.log('[Scheduler] Checking for scheduled refunds to process...');
  try {
    const now = new Date().toISOString();

    const snap = await db.collection('payments')
      .where('status', '==', 'REFUND_PENDING')
      .get();

    let processed = 0;

    for (const doc of snap.docs) {
      const payment = doc.data();

      // Check if scheduled time has passed
      if (!payment.refundScheduledAt || payment.refundScheduledAt > now) continue;

      try {
        if (!IS_MOCK_MODE) {
          // In a real scenario, we would trigger a Razorpay refund to the customer
          // and a separate payout to the vendor for their 12% cut
          
          if (payment.razorpayPaymentId && payment.refundAmount > 0) {
            await razorpay.payments.refund(payment.razorpayPaymentId, {
              amount: Math.round(payment.refundAmount * 100),
              notes: { reason: 'Prinvox Dispute Resolution' }
            });
            console.log(`[Scheduler] ✅ Real refund triggered for customer on payment ${payment.id}`);
          }

          if (payment.vendorBankAccountId && payment.vendorSettlementAmount > 0) {
             await razorpay.payouts.create({
               account_number: process.env.RAZORPAY_ACCOUNT_ID,
               fund_account_id: payment.vendorBankAccountId,
               amount: Math.round(payment.vendorSettlementAmount * 100),
               currency: 'INR',
               mode: 'IMPS',
               purpose: 'payout',
               queue_if_low_balance: true,
               reference_id: `prinvox_vendor_cut_${payment.id}`,
               narration: `Prinvox Dispute Retain - Order ${payment.orderId}`,
             });
             console.log(`[Scheduler] ✅ Real vendor payout (12% cut) triggered for payment ${payment.id}`);
          }
        } else {
          console.log(`[Scheduler] 🔧 MOCK MODE: Simulating refund of ₹${payment.refundAmount} to customer and ₹${payment.vendorSettlementAmount} to vendor for payment ${payment.id}`);
        }

        // Update payment status to REFUNDED
        await doc.ref.update({
          status: 'REFUNDED',
          refundedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Update order payment status
        await db.collection('orders').doc(payment.orderId).update({
          paymentStatus: 'REFUNDED',
          updatedAt: new Date().toISOString(),
        });

        processed++;
      } catch (refundErr) {
        console.error(`[Scheduler] Failed to process scheduled refund for payment ${payment.id}:`, refundErr.message);
      }
    }

    if (processed > 0) {
      console.log(`[Scheduler] ✅ Processed ${processed} scheduled refund(s)`);
    } else {
      console.log('[Scheduler] No scheduled refunds ready for processing');
    }
  } catch (err) {
    console.error('[Scheduler] Error in scheduled refund job:', err);
  }
}

// ──────────────────────────────────────────────────────────────
// JOB 3: Clean up vendor packing videos that have no active dispute (after 48h)
// Runs every 6 hours
// ──────────────────────────────────────────────────────────────
async function cleanupPackingVideos() {
  console.log('[Scheduler] Cleaning up old packing videos...');

  try {
    const uploadDir = path.join(__dirname, '../../uploads/packing-videos');
    if (!fs.existsSync(uploadDir)) return;

    const files = fs.readdirSync(uploadDir);
    const cutoffTime = Date.now() - 48 * 60 * 60 * 1000; // 48h ago

    // Get all orders with active refunds — avoid 'not-in' (requires composite index)
    const allRefunds = await db.collection('refundRequests').get();
    const RESOLVED_S = ['RESOLVED_REPLACED', 'RESOLVED_REFUNDED', 'RESOLVED_REJECTED'];
    const activeOrderIds = new Set(
      allRefunds.docs
        .filter(d => !RESOLVED_S.includes(d.data().status))
        .map(d => d.data().orderId)
    );

    for (const file of files) {
      const filePath = path.join(uploadDir, file);
      const stats = fs.statSync(filePath);

      if (stats.mtimeMs < cutoffTime) {
        // Extract order ID from filename pattern: packing-{orderId}-{timestamp}.ext
        const parts = file.split('-');
        const orderId = parts[1]; // simplified extraction

        if (!activeOrderIds.has(orderId)) {
          fs.unlinkSync(filePath);
          console.log(`[Scheduler] 🗑️ Deleted old packing video: ${file}`);
        }
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error in video cleanup job:', err);
  }
}

// ──────────────────────────────────────────────────────────────
// Start all cron jobs
// ──────────────────────────────────────────────────────────────
function startScheduler() {
  console.log('⏰ Payout scheduler started');

  // Release escrowed payments — every 30 minutes
  cron.schedule('*/30 * * * *', releaseEscrowedPayments);

  // Auto-approve stale refunds — every hour
  cron.schedule('0 * * * *', autoApproveStaleRefunds);

  // Process scheduled refunds — every 15 minutes
  cron.schedule('*/15 * * * *', processScheduledRefunds);

  // Clean up packing videos — every 6 hours
  cron.schedule('0 */6 * * *', cleanupPackingVideos);

  // Run immediately on startup to catch any missed windows
  releaseEscrowedPayments();
  autoApproveStaleRefunds();
  processScheduledRefunds();
}

module.exports = { startScheduler };
