const express = require('express');
const multer = require('multer');
const { auth, requireRole } = require('../middleware/auth');
const { db } = require('../lib/firebase');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const NodeStl = require('node-stl');

const router = express.Router();

const os = require('os');
const { storage } = require('../lib/firebase');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.stl', '.obj'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .stl and .obj files are allowed'));
    }
  },
});

// POST /design/upload
router.post('/upload', auth, requireRole('CUSTOMER'), upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    const bucket = storage.bucket();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = `designs/design-${uniqueSuffix}${fileExt}`;
    const file = bucket.file(filename);

    await file.save(req.file.buffer, {
      metadata: { contentType: req.file.mimetype || 'application/octet-stream' },
    });

    try {
      await file.makePublic();
    } catch (e) {
      // Ignore if bucket doesn't support makePublic
    }

    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filename)}?alt=media`;

    // Parse geometry mathematically with node-stl using a temporary file
    let volumeCm3 = 0, areaCm2 = 0, boundingBoxCm = { length: 0, width: 0, height: 0 };
    if (fileExt === '.stl' || fileExt === '.obj') {
      let tmpPath;
      try {
        tmpPath = path.join(os.tmpdir(), uuidv4() + fileExt);
        fs.writeFileSync(tmpPath, req.file.buffer);
        const stl = new NodeStl(tmpPath, { density: 1.0 });
        
        // node-stl divides its calculated volume by 1000 natively. We reverse it to get original raw cubic units.
        const rawVolume = stl.volume * 1000; 
        const rawArea = stl.area;
        const bb = stl.boundingBox;
        
        let maxDim = Math.max(
          isNaN(bb[0]) ? 0 : bb[0], 
          isNaN(bb[1]) ? 0 : bb[1], 
          isNaN(bb[2]) ? 0 : bb[2]
        );
        
        // Auto-Scaling Heuristic (like Ultimaker Cura)
        let scaleToMm = 1.0;
        if (maxDim > 0 && maxDim < 0.1) {
          scaleToMm = 1000.0; // Likely Meters -> render as mm
        } else if (maxDim > 0 && maxDim < 5.0) {
          scaleToMm = 25.4; // Likely Inches -> render as mm
        } else if (maxDim > 0 && maxDim < 10.0) {
          scaleToMm = 10.0; // Likely Centimeters -> render as mm
        }

        // Convert the aligned millimeter scale into cm scale for Density Math
        const scaleToCm = scaleToMm / 10.0;
        
        volumeCm3 = rawVolume * Math.pow(scaleToCm, 3);
        areaCm2 = rawArea * Math.pow(scaleToCm, 2);
        
        boundingBoxCm = {
          length: (isNaN(bb[0]) ? 0 : bb[0]) * scaleToCm,
          width:  (isNaN(bb[1]) ? 0 : bb[1]) * scaleToCm,
          height: (isNaN(bb[2]) ? 0 : bb[2]) * scaleToCm
        };
      } catch (parseErr) {
        console.error('Failed to parse STL geometry:', parseErr);
      } finally {
        if (tmpPath && fs.existsSync(tmpPath)) {
          fs.unlinkSync(tmpPath);
        }
      }
    }

    const fileId = uuidv4();
    const designData = {
      id: fileId,
      userId: req.user.id,
      fileName: req.file.originalname,
      fileUrl: publicUrl,
      fileType: fileExt.replace('.', ''),
      fileSizeBytes: req.file.size,
      volumeCm3,
      areaCm2,
      boundingBoxCm,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save metadata to Firestore
    await db.collection('designFiles').doc(fileId).set(designData);

    res.status(201).json(designData);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

// GET /design/my-files
router.get('/my-files', auth, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const snapshot = await db.collection('designFiles')
      .where('userId', '==', req.user.id)
      .get();
      
    const files = snapshot.docs.map(doc => doc.data()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(files);
  } catch (err) {
    console.error('Fetch designs error:', err);
    res.status(500).json({ error: 'Failed to fetch designs' });
  }
});

// DELETE /design/my-files/:id
router.delete('/my-files/:id', auth, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const docRef = db.collection('designFiles').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists || doc.data().userId !== req.user.id) {
      return res.status(404).json({ error: 'Design not found' });
    }

    const data = doc.data();
    if (data.fileUrl && data.fileUrl.includes('firebasestorage.googleapis.com')) {
      try {
        const bucket = storage.bucket();
        // Extract filename from URL: .../o/designs%2Fdesign-123.stl?alt=media
        const urlParts = new URL(data.fileUrl);
        const pathPart = urlParts.pathname.split('/o/')[1];
        if (pathPart) {
          const filePath = decodeURIComponent(pathPart);
          const file = bucket.file(filePath);
          await file.delete();
        }
      } catch (err) {
        console.error('Failed to delete file from Firebase Storage:', err);
      }
    }

    await docRef.delete();
    res.json({ success: true });
  } catch (err) {
    console.error('Delete design error:', err);
    res.status(500).json({ error: 'Failed to delete design' });
  }
});

module.exports = router;
