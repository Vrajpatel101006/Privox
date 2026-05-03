const express = require("express");
const { body, validationResult } = require("express-validator");
const { auth, requireRole } = require("../middleware/auth");
const { quoteLimiter } = require("../middleware/rateLimiter");
const { calculateQuote } = require("../services/quoteCalculator");
const { db } = require("../lib/firebase");
const { v4: uuidv4 } = require("uuid");
const { classifyAndEstimate } = require("../lib/classification");

const router = express.Router();

// Helper to fetch user details
async function getUserBasicInfo(userId) {
  if (!userId) return { name: "Unknown User" };
  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) return { name: "Unknown User" };
  const data = userDoc.data();
  return { id: data.id, name: data.name, email: data.email };
}

// POST /quotes/request — Customer requests a quote from a specific vendor
router.post(
  "/request",
  auth,
  requireRole("CUSTOMER"),
  quoteLimiter,
  body("designId").notEmpty(),
  body("vendorId").notEmpty(),
  body("material").notEmpty(),
  body("infillDensity").isInt({ min: 1, max: 100 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { designId, vendorId, material, infillDensity, notes, city, state, pincode, deliveryAddress } = req.body;

    try {
      // Verify design belongs to customer
      const designDoc = await db.collection("designFiles").doc(designId).get();
      if (!designDoc.exists || designDoc.data().userId !== req.user.id) {
        return res.status(404).json({ error: "Design not found" });
      }

      // Verify vendor exists
      const vendorDoc = await db.collection("vendors").doc(vendorId).get();
      if (!vendorDoc.exists) {
        return res.status(404).json({ error: "Vendor not found" });
      }
      const vendorData = vendorDoc.data();

      const designData = designDoc.data();

      // Automatically estimate weight and calculate the tier + commission fee
      const estimation = classifyAndEstimate(
        designData.volumeCm3 || 0,
        designData.areaCm2 || 0,
        designData.boundingBoxCm || {},
        material,
        parseInt(infillDensity, 10),
      );

      const requestId = uuidv4();
      const quoteRequestData = {
        id: requestId,
        designId,
        customerId: req.user.id,
        vendorId,
        material,
        infillDensity: parseInt(infillDensity, 10),
        estimatedWeightGrams: estimation.weightGrams,
        category: estimation.category,
        commissionRate: estimation.commissionRate,
        notes: notes || "",
        deliveryAddress: deliveryAddress || "",
        city: city || "",
        state: state || "",
        pincode: pincode || "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.collection("quoteRequests").doc(requestId).set(quoteRequestData);

      // Construct response object resembling old Prisma structure
      const vendorUser = await getUserBasicInfo(vendorData.userId);
      const responseData = {
        ...quoteRequestData,
        design: designDoc.data(),
        vendor: { ...vendorData, user: { name: vendorUser.name } },
      };

      // Emit socket event to vendor
      const io = req.app.get("io");
      if (io) {
        io.to(`vendor:${vendorId}`).emit(
          "quote:request_received",
          responseData,
        );
      }

      res.status(201).json(responseData);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create quote request" });
    }
  },
);

// GET /quotes/vendor-requests — Vendor sees all their pending requests
router.get(
  "/vendor-requests",
  auth,
  requireRole("VENDOR"),
  async (req, res) => {
    try {
      const vendorSnap = await db
        .collection("vendors")
        .where("userId", "==", req.user.id)
        .limit(1)
        .get();
      if (vendorSnap.empty)
        return res.status(404).json({ error: "Vendor profile not found" });
      const vendorId = vendorSnap.docs[0].id;

      // Fetch quote requests without orderBy to avoid needing a Firebase Composite Index
      const snapshot = await db
        .collection("quoteRequests")
        .where("vendorId", "==", vendorId)
        .get();

      const requests = snapshot.docs.map((doc) => doc.data());

      // Sort manually in memory
      requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Enrich with relations (design, customer, quote)
      for (let reqData of requests) {
        const designDoc = await db
          .collection("designFiles")
          .doc(reqData.designId)
          .get();
        reqData.design = designDoc.exists ? designDoc.data() : null;

        const customer = await getUserBasicInfo(reqData.customerId);
        reqData.customer = customer;

        const quoteSnap = await db
          .collection("quotes")
          .where("requestId", "==", reqData.id)
          .limit(1)
          .get();
        reqData.quote = quoteSnap.empty ? null : quoteSnap.docs[0].data();
      }


      const showAll = req.query.showAll === 'true';
      let active = [];
      let history = [];

      requests.forEach(reqData => {
        if (!reqData.quote || reqData.quote.status === 'PENDING') {
          active.push(reqData);
        } else {
          history.push(reqData);
        }
      });

      let finalRequests = active.concat(showAll ? history : history.slice(0, 15));
      const hasMoreHistory = !showAll && history.length > 15;

      res.json({ requests: finalRequests, hasMoreHistory });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch quote requests" });
    }
  },
);

// POST /quotes/submit — Vendor submits a quote with pricing breakdown
router.post(
  "/submit",
  auth,
  requireRole("VENDOR"),
  body("requestId").notEmpty(),
  body("materialCost").isFloat({ min: 0 }),
  body("machineCost").isFloat({ min: 0 }),
  body("laborCost").isFloat({ min: 0 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { requestId, materialCost, machineCost, laborCost, notes } = req.body;
    console.log(
      `[Quote Submit] Attempting to submit quote for Request ID: ${requestId}`,
    );

    try {
      const vendorSnap = await db
        .collection("vendors")
        .where("userId", "==", req.user.id)
        .limit(1)
        .get();
      if (vendorSnap.empty)
        return res.status(404).json({ error: "Vendor profile not found" });
      const vendorId = vendorSnap.docs[0].id;

      const requestDoc = await db
        .collection("quoteRequests")
        .doc(requestId)
        .get();
      if (!requestDoc.exists)
        return res.status(404).json({ error: "Quote request not found" });

      const quoteRequestData = requestDoc.data();
      if (quoteRequestData.vendorId !== vendorId) {
        return res.status(403).json({ error: "Not your quote request" });
      }

      // Check if quote already submitted
      const existingQuoteSnap = await db
        .collection("quotes")
        .where("requestId", "==", requestId)
        .limit(1)
        .get();
      if (!existingQuoteSnap.empty) {
        return res
          .status(409)
          .json({ error: "Quote already submitted for this request" });
      }

      const pricing = calculateQuote({
        materialCost: parseFloat(materialCost),
        machineCost: parseFloat(machineCost),
        laborCost: parseFloat(laborCost),
        platformFeeRate: quoteRequestData.commissionRate || 0.1,
      });
      console.log(`[Quote Submit] Calculated pricing:`, pricing);

      const quoteId = uuidv4();
      const quoteData = {
        id: quoteId,
        requestId,
        vendorId,
        materialCost: pricing.materialCost,
        machineCost: pricing.machineCost,
        laborCost: pricing.laborCost,
        totalCost: pricing.totalPrice,
        status: "PENDING",
        notes: notes || "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      console.log(`[Quote Submit] Saving quote to Firestore:`, quoteData);
      await db.collection("quotes").doc(quoteId).set(quoteData);

      // Build relation tree for response
      const customer = await getUserBasicInfo(quoteRequestData.customerId);
      const responseData = {
        ...quoteData,
        request: {
          ...quoteRequestData,
          customer: { id: customer.id, name: customer.name },
        },
      };

      // Notify customer via socket
      const io = req.app.get("io");
      if (io) {
        io.to(`user:${quoteRequestData.customerId}`).emit(
          "quote:received",
          responseData,
        );
      }

      res.status(201).json(responseData);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to submit quote" });
    }
  },
);

// GET /quotes/customer — Customer sees all their received quotes
router.get("/customer", auth, requireRole("CUSTOMER"), async (req, res) => {
  try {
    const requestsSnap = await db
      .collection("quoteRequests")
      .where("customerId", "==", req.user.id)
      .get();
    console.log(
      `[Customer Quotes] Found ${requestsSnap.size} quote requests for customer ${req.user.id}`,
    );
    if (requestsSnap.empty) return res.json([]);

    // Create lookup map
    const requestsMap = {};
    for (const doc of requestsSnap.docs) {
      const data = doc.data();
      const designDoc = await db
        .collection("designFiles")
        .doc(data.designId)
        .get();
      data.design = designDoc.exists ? designDoc.data() : null;
      requestsMap[data.id] = data;
    }

    const requestIds = Object.keys(requestsMap);
    console.log(`[Customer Quotes] Unique Request IDs:`, requestIds);

    // 2. Fetch quotes for these requests (limit batches if > 10, but okay for MVP)
    const quotes = [];
    if (requestIds.length > 0) {
      for (let i = 0; i < requestIds.length; i += 10) {
        const batchIds = requestIds.slice(i, i + 10);

        if (batchIds.length === 0) continue;

        const quotesSnap = await db
          .collection("quotes")
          .where("requestId", "in", batchIds)
          .get(); // No orderBy to avoid index crash
        console.log(
          `[Customer Quotes] Fetched ${quotesSnap.size} quotes for batch:`,
          batchIds,
        );

        for (const qDoc of quotesSnap.docs) {
          const qData = qDoc.data();

          // Attach vendor details
          if (qData.vendorId) {
            const vendorDoc = await db
              .collection("vendors")
              .doc(qData.vendorId)
              .get();
            if (vendorDoc.exists) {
              const vData = vendorDoc.data();
              const vUser = await getUserBasicInfo(vData.userId);
              qData.vendor = { ...vData, user: { name: vUser.name } };
            }
          }

          const reqData = requestsMap[qData.requestId];
          if (reqData) {
            reqData.customer = { id: req.user.id, name: req.user.name };
          }

          // Re-calculate the dynamically injected GST and Platform fee for the UI
          const subtotal =
            (qData.materialCost || 0) +
            (qData.machineCost || 0) +
            (qData.laborCost || 0);
          qData.gst = subtotal * 0.18;
          qData.platformFee = subtotal * (reqData?.commissionRate || 0.1);

          qData.request = reqData;
          quotes.push(qData);
        }
      }
    }

    // Filter out deleted quotes and partition
    let active = [];
    let history = [];
    const showAll = req.query.showAll === 'true';

    quotes.forEach(q => {
      if (q.customerDeleted) return;
      if (['REJECTED', 'ACCEPTED'].includes(q.status)) {
        history.push(q);
      } else {
        active.push(q);
      }
    });

    active.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    let finalQuotes = active.concat(showAll ? history : history.slice(0, 15));
    const hasMoreHistory = !showAll && history.length > 15;

    res.json({ quotes: finalQuotes, hasMoreHistory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch quotes" });
  }
});

// POST /quotes/reject — Customer rejects a quote
router.post(
  "/reject",
  auth,
  requireRole("CUSTOMER"),
  body("quoteId").notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { quoteId } = req.body;

    try {
      const quoteRef = db.collection("quotes").doc(quoteId);
      const quoteDoc = await quoteRef.get();

      if (!quoteDoc.exists)
        return res.status(404).json({ error: "Quote not found" });
      const quote = quoteDoc.data();

      // Ensure customer owns the request
      const requestDoc = await db
        .collection("quoteRequests")
        .doc(quote.requestId)
        .get();
      if (!requestDoc.exists || requestDoc.data().customerId !== req.user.id) {
        return res.status(403).json({ error: "Not your quote" });
      }

      if (quote.status !== "PENDING") {
        return res.status(400).json({ error: "Quote already processed" });
      }

      await quoteRef.update({
        status: "REJECTED",
        updatedAt: new Date().toISOString(),
      });

      const updatedQuote = (await quoteRef.get()).data();
      res.json(updatedQuote);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to reject quote" });
    }
  },
);

// POST /quotes/:id/customer-hide — Customer soft-deletes a quote
router.post(
  "/:id/customer-hide",
  auth,
  requireRole("CUSTOMER"),
  async (req, res) => {
    try {
      const quoteRef = db.collection("quotes").doc(req.params.id);
      const quoteDoc = await quoteRef.get();

      if (!quoteDoc.exists)
        return res.status(404).json({ error: "Quote not found" });

      const quote = quoteDoc.data();

      // Ensure customer owns the request
      const requestDoc = await db
        .collection("quoteRequests")
        .doc(quote.requestId)
        .get();
      if (!requestDoc.exists || requestDoc.data().customerId !== req.user.id) {
        return res.status(403).json({ error: "Not your quote" });
      }

      await quoteRef.update({
        customerDeleted: true,
      });

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to hide quote" });
    }
  },
);

module.exports = router;
