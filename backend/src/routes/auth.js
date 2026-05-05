const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { db, admin } = require('../lib/firebase');

const router = express.Router();

// Helper to generate UUIDs since we lost Prisma's auto-generation
const { v4: uuidv4 } = require('uuid');

// POST /auth/register
router.post('/register',
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['CUSTOMER', 'VENDOR']).withMessage('Role must be CUSTOMER or VENDOR'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, role, companyName, location } = req.body;

    try {
      const usersRef = db.collection('users');
      // Check if email exists
      const snapshot = await usersRef.where('email', '==', email).limit(1).get();
      if (!snapshot.empty) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const userId = uuidv4();
      
      const userData = {
        id: userId,
        name,
        email,
        passwordHash,
        role,
        city: req.body.city || '',
        pincode: req.body.pincode || '',
        deliveryAddress: '',
        createdAt: new Date().toISOString(),
      };

      let vendorId = null;
      let vendorData = null;

      // Handle vendor specific creation
      if (role === 'VENDOR') {
        vendorId = uuidv4();
        vendorData = {
          id: vendorId,
          userId: userId,
          companyName: companyName || name,
          location: location || '',
          rating: 0,
          bio: '',
          createdAt: new Date().toISOString(),
        };
      }

      // Run as Firestore batch
      const batch = db.batch();
      batch.set(usersRef.doc(userId), userData);
      if (vendorData) {
        batch.set(db.collection('vendors').doc(vendorId), vendorData);
      }
      await batch.commit();

      const token = jwt.sign(
        { id: userId, email, role, name },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      res.status(201).json({
        token,
        user: {
          id: userId,
          name,
          email,
          role,
          vendorId,
        },
      });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// POST /auth/login
router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      const usersRef = db.collection('users');
      const snapshot = await usersRef.where('email', '==', email).limit(1).get();

      if (snapshot.empty) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const userDoc = snapshot.docs[0];
      const user = userDoc.data();

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      let vendorId = null;
      if (user.role === 'VENDOR') {
        const vendorSnap = await db.collection('vendors').where('userId', '==', user.id).limit(1).get();
        if (!vendorSnap.empty) {
          vendorId = vendorSnap.docs[0].id;
        }
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, name: user.name },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          vendorId,
        },
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// POST /auth/google
router.post('/google',
  body('idToken').notEmpty().withMessage('ID token is required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { idToken, role, companyName } = req.body;

    try {
      // Verify the Firebase ID token
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const email = decodedToken.email;
      let name = decodedToken.name || email.split('@')[0];

      const usersRef = db.collection('users');
      const snapshot = await usersRef.where('email', '==', email).limit(1).get();

      let userId;
      let userRole = role || 'CUSTOMER'; // Default to CUSTOMER if not provided
      let vendorId = null;

      if (snapshot.empty) {
        // User does not exist, create a new one
        userId = uuidv4();
        
        const userData = {
          id: userId,
          name,
          email,
          passwordHash: '', // No password for Google auth
          role: userRole,
          city: '',
          pincode: '',
          deliveryAddress: '',
          createdAt: new Date().toISOString(),
        };

        const batch = db.batch();
        batch.set(usersRef.doc(userId), userData);

        if (userRole === 'VENDOR') {
          vendorId = uuidv4();
          const vendorData = {
            id: vendorId,
            userId: userId,
            companyName: companyName || name,
            location: '',
            rating: 0,
            bio: '',
            createdAt: new Date().toISOString(),
          };
          batch.set(db.collection('vendors').doc(vendorId), vendorData);
        }

        await batch.commit();
      } else {
        // User exists, log them in
        const userDoc = snapshot.docs[0];
        const user = userDoc.data();
        userId = user.id;
        userRole = user.role;
        name = user.name || name;

        if (userRole === 'VENDOR') {
          const vendorSnap = await db.collection('vendors').where('userId', '==', userId).limit(1).get();
          if (!vendorSnap.empty) {
            vendorId = vendorSnap.docs[0].id;
          }
        }
      }

      const token = jwt.sign(
        { id: userId, email, role: userRole, name },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      res.json({
        token,
        user: {
          id: userId,
          name,
          email,
          role: userRole,
          vendorId,
        },
      });
    } catch (err) {
      console.error('Google auth error:', err);
      res.status(401).json({ error: 'Invalid Google token' });
    }
  }
);

// GET /auth/me
router.get('/me', require('../middleware/auth').auth, async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.user.id).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });
    
    const user = userDoc.data();
    delete user.passwordHash;

    if (user.role === 'VENDOR') {
      const vendorSnap = await db.collection('vendors').where('userId', '==', user.id).limit(1).get();
      if (!vendorSnap.empty) {
        user.vendor = vendorSnap.docs[0].data();
      }
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /auth/profile — Update user profile fields
router.put('/profile', require('../middleware/auth').auth, async (req, res) => {
  try {
    const { city, deliveryAddress, pincode, avatarUrl, state } = req.body;
    const updateData = { updatedAt: new Date().toISOString() };
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (deliveryAddress !== undefined) updateData.deliveryAddress = deliveryAddress;
    if (pincode !== undefined) updateData.pincode = String(pincode);
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

    await db.collection('users').doc(req.user.id).update(updateData);
    const updated = (await db.collection('users').doc(req.user.id).get()).data();
    delete updated.passwordHash;
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// POST /auth/upload-avatar — Upload user profile photo
const multer = require('multer');
const path = require('path');
const { storage } = require('../lib/firebase');

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) cb(null, true);
    else cb(new Error('Only JPG, PNG, WEBP, GIF allowed'));
  }
});

router.post('/upload-avatar', require('../middleware/auth').auth, avatarUpload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const bucket = storage.bucket();
    const ext = path.extname(req.file.originalname).toLowerCase();
    const filename = `avatars/avatar-${req.user?.id || Date.now()}-${Date.now()}${ext}`;
    const file = bucket.file(filename);

    await file.save(req.file.buffer, {
      metadata: { contentType: req.file.mimetype },
    });
    
    try {
      await file.makePublic();
    } catch (e) {
      // Ignore if bucket doesn't support makePublic
    }

    const avatarUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filename)}?alt=media`;
    
    await db.collection('users').doc(req.user.id).update({ avatarUrl, updatedAt: new Date().toISOString() });
    res.json({ avatarUrl });
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(500).json({ error: 'Avatar upload failed' });
  }
});

module.exports = router;
