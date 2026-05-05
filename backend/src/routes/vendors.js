const express = require('express');
const { db } = require('../lib/firebase');

const router = express.Router();

// GET /vendors — Public list of all vendors (optionally sorted by city match)
router.get('/', async (req, res) => {
  try {
    const { city } = req.query; // optional: customer's city for local-first sorting
    const snapshot = await db.collection('vendors').get();
    
    if (snapshot.empty) {
      console.log('⚠️ No vendor documents found in Firestore vendors collection');
      return res.json([]);
    }

    console.log(`✅ Found ${snapshot.size} vendor documents`);
    const vendors = [];

    for (const doc of snapshot.docs) {
      try {
        const vendorData = doc.data();
        console.log(`Processing vendor doc: ${doc.id}, userId: ${vendorData.userId}, companyName: ${vendorData.companyName}`);
        
        // Fetch user name
        let userName = 'Unknown User';
        if (vendorData.userId) {
          const userDoc = await db.collection('users').doc(vendorData.userId).get();
          userName = userDoc.exists ? userDoc.data().name : 'Unknown User';
        }

        const vendorCity = (vendorData.location || '').toLowerCase().trim();
        const customerCity = (city || '').toLowerCase().trim();
        const isLocal = customerCity && vendorCity && vendorCity.includes(customerCity);

        vendors.push({
          id: doc.id,
          companyName: vendorData.companyName || 'Unnamed Vendor',
          rating: vendorData.rating || 0,
          location: vendorData.location || '',
          pincode: vendorData.pincode || '',
          bio: vendorData.bio || '',
          capabilities: vendorData.capabilities || [],
          isLocal: !!isLocal,
          user: { name: userName }
        });
      } catch (docErr) {
        console.error(`Error processing vendor doc ${doc.id}:`, docErr.message);
        // Skip this doc but continue with others
      }
    }

    // Local vendors first, then sort by rating
    vendors.sort((a, b) => {
      if (a.isLocal && !b.isLocal) return -1;
      if (!a.isLocal && b.isLocal) return 1;
      return (b.rating || 0) - (a.rating || 0);
    });

    console.log(`✅ Returning ${vendors.length} vendors`);
    res.json(vendors);
  } catch (err) {
    console.error('Fetch vendors error:', err);
    res.status(500).json({ error: 'Failed to fetch vendors', detail: err.message });
  }
});

// PUT /vendors/me — Update vendor profile
const { auth, requireRole } = require('../middleware/auth');
router.put('/me', auth, requireRole('VENDOR'), async (req, res) => {
  try {
    const { capabilities, city, pincode, bio, companyName, state } = req.body;
    const vendorSnap = await db.collection('vendors').where('userId', '==', req.user.id).limit(1).get();
    if (vendorSnap.empty) return res.status(404).json({ error: 'Vendor profile not found' });
    
    const vendorRef = db.collection('vendors').doc(vendorSnap.docs[0].id);
    const updateData = { updatedAt: new Date().toISOString() };
    
    if (Array.isArray(capabilities)) updateData.capabilities = capabilities;
    if (city !== undefined) updateData.location = city;
    if (state !== undefined) updateData.state = state;
    if (pincode !== undefined) updateData.pincode = String(pincode);
    if (bio !== undefined) updateData.bio = bio;
    if (companyName !== undefined) updateData.companyName = companyName;

    await vendorRef.update(updateData);
    const updated = (await vendorRef.get()).data();
    res.json(updated);
  } catch (err) {
    console.error('Update vendor profile error:', err);
    res.status(500).json({ error: 'Failed to update vendor profile' });
  }
});

// GET /vendors/:id — Public vendor profile
router.get('/:id', async (req, res) => {
  try {
    const vendorDoc = await db.collection('vendors').doc(req.params.id).get();
    if (!vendorDoc.exists) return res.status(404).json({ error: 'Vendor not found' });
    const vData = vendorDoc.data();
    const userDoc = await db.collection('users').doc(vData.userId).get();
    const userName = userDoc.exists ? userDoc.data().name : 'Unknown';

    // Fetch recent ratings
    const ratingsSnap = await db.collection('vendorRatings')
      .where('vendorId', '==', req.params.id)
      .get();
    const ratings = ratingsSnap.docs.map(d => d.data()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      id: vendorDoc.id, // Always use Firestore doc ID as source of truth
      companyName: vData.companyName,
      bio: vData.bio || '',
      location: vData.location || '',
      pincode: vData.pincode || '',
      rating: vData.rating || 0,
      totalRatings: ratings.length,
      capabilities: vData.capabilities || [],
      logoUrl: vData.logoUrl || '',
      user: { name: userName },
      recentRatings: ratings.slice(0, 5),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vendor profile' });
  }
});

// POST /vendors/:id/rate — Customer rates a vendor
router.post('/:id/rate', auth, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const stars = parseInt(rating);
    if (isNaN(stars) || stars < 1 || stars > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const vendorDoc = await db.collection('vendors').doc(req.params.id).get();
    if (!vendorDoc.exists) return res.status(404).json({ error: 'Vendor not found' });

    // Upsert: one rating per customer per vendor
    const existingSnap = await db.collection('vendorRatings')
      .where('vendorId', '==', req.params.id)
      .where('customerId', '==', req.user.id)
      .limit(1).get();

    const { v4: uuidv4 } = require('uuid');
    const ratingData = {
      vendorId: req.params.id,
      customerId: req.user.id,
      customerName: req.user.name,
      rating: stars,
      comment: comment || '',
      createdAt: new Date().toISOString(),
    };

    if (!existingSnap.empty) {
      await existingSnap.docs[0].ref.update(ratingData);
    } else {
      const id = uuidv4();
      await db.collection('vendorRatings').doc(id).set({ id, ...ratingData });
    }

    // Recalculate average rating
    const allRatings = await db.collection('vendorRatings').where('vendorId', '==', req.params.id).get();
    const avg = allRatings.docs.reduce((sum, d) => sum + d.data().rating, 0) / allRatings.size;
    await db.collection('vendors').doc(req.params.id).update({
      rating: parseFloat(avg.toFixed(1)),
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, newAverage: parseFloat(avg.toFixed(1)) });
  } catch (err) {
    console.error('Rate vendor error:', err);
    res.status(500).json({ error: 'Failed to submit rating' });
  }
});

// POST /vendors/upload-logo — Upload vendor company logo/photo
const multer = require('multer');
const path = require('path');
const { storage } = require('../lib/firebase');

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) cb(null, true);
    else cb(new Error('Only JPG, PNG, WEBP, GIF allowed'));
  }
});

router.post('/upload-logo', auth, requireRole('VENDOR'), logoUpload.single('logo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const bucket = storage.bucket();
    const ext = path.extname(req.file.originalname).toLowerCase();
    const filename = `vendors/logo-${req.user?.id || Date.now()}-${Date.now()}${ext}`;
    const file = bucket.file(filename);

    await file.save(req.file.buffer, {
      metadata: { contentType: req.file.mimetype },
    });
    
    try {
      await file.makePublic();
    } catch (e) {
      // Ignore if bucket doesn't support makePublic
    }

    const logoUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filename)}?alt=media`;
    
    const vendorSnap = await db.collection('vendors').where('userId', '==', req.user.id).limit(1).get();
    if (vendorSnap.empty) return res.status(404).json({ error: 'Vendor not found' });
    await vendorSnap.docs[0].ref.update({ logoUrl, updatedAt: new Date().toISOString() });
    res.json({ logoUrl });
  } catch (err) {
    console.error('Logo upload error:', err);
    res.status(500).json({ error: 'Logo upload failed' });
  }
});

module.exports = router;
