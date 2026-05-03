const express = require('express');
const multer = require('multer');
const { auth, requireRole } = require('../middleware/auth');
const { db } = require('../lib/firebase');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const NodeStl = require('node-stl');

const router = express.Router();

// Define local upload directory (relative to backend root)
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename to prevent collisions
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/[^a-zA-Z0-9.]/g, '_'));
  }
});

const upload = multer({
  storage: storage,
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
    
    // The public URL assumes your backend is serving the /uploads folder statically
    // e.g., app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
    const publicUrl = `${process.env.BACKEND_URL || 'http://localhost:5000'}/uploads/${req.file.filename}`;

    // Parse geometry mathematically with node-stl
    let volumeCm3 = 0, areaCm2 = 0, boundingBoxCm = { length: 0, width: 0, height: 0 };
    if (fileExt === '.stl' || fileExt === '.obj') {
      try {
        const stl = new NodeStl(req.file.path, { density: 1.0 });
        
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
    // Attempt to clean up the uploaded file if an error occurred after saving
    try { if (req.file?.path) fs.unlinkSync(req.file.path); } catch {}
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

    // Try to remove the file from disk
    const data = doc.data();
    if (data.fileUrl) {
      // Assuming fileUrl looks like /uploads/filename.stl
      const filename = data.fileUrl.split('/').pop();
      const localPath = path.join(__dirname, '../../uploads', filename);
      try {
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      } catch (err) {
        console.error('Failed to unlink file on delete:', err);
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
