const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, requireRole } = require('../middleware/auth');
const { db } = require('../lib/firebase');
const { uploadToSupabase } = require('../lib/supabase');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.jpeg', '.jpg', '.png', '.webp', '.gif'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only standard images (JPG, PNG, WEBP, GIF) are mathematically authorized.'));
    }
  }
});

// POST /products/upload-image
router.post('/upload-image', auth, requireRole('VENDOR'), upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No payload detected.' });
  try {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = `products/product-${uniqueSuffix}${path.extname(req.file.originalname).toLowerCase()}`;
    
    const publicUrl = await uploadToSupabase('uploads', filename, req.file.buffer, req.file.mimetype);
    
    res.json({ imageUrl: publicUrl });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'System failed to cache binary image frame.' });
  }
});

// POST /products/create
router.post('/create',
  auth, requireRole('VENDOR'),
  body('name').trim().notEmpty(),
  body('price').isFloat({ min: 0 }),
  body('stock').isInt({ min: 0 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, description, price, stock, imageUrl, category } = req.body;

    try {
      const vendorSnap = await db.collection('vendors').where('userId', '==', req.user.id).limit(1).get();
      if (vendorSnap.empty) return res.status(404).json({ error: 'Vendor profile not found' });
      const vendorId = vendorSnap.docs[0].id;

      const PLATFORM_FEE_RATE = 0.10; // 10% Prinvox commission
      const vendorPrice = parseFloat(price);
      const finalPrice = parseFloat((vendorPrice * (1 + PLATFORM_FEE_RATE)).toFixed(2));

      const productId = uuidv4();
      const productData = {
        id: productId,
        vendorId,
        name,
        description: description || '',
        vendorPrice,                    // what vendor earns
        price: finalPrice,              // what customer pays (includes 10% platform fee)
        platformFeeRate: PLATFORM_FEE_RATE,
        stock: parseInt(stock, 10),
        imageUrl: imageUrl || '',
        category: category || '',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.collection('products').doc(productId).set(productData);
      res.status(201).json(productData);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create product' });
    }
  }
);

// PUT /products/:id — Update a product
router.put('/:id',
  auth, requireRole('VENDOR'),
  async (req, res) => {
    try {
      const vendorSnap = await db.collection('vendors').where('userId', '==', req.user.id).limit(1).get();
      if (vendorSnap.empty) return res.status(404).json({ error: 'Vendor not found' });
      const vendorId = vendorSnap.docs[0].id;

      const productRef = db.collection('products').doc(req.params.id);
      const productDoc = await productRef.get();
      if (!productDoc.exists) return res.status(404).json({ error: 'Product not found' });
      const product = productDoc.data();
      if (product.vendorId !== vendorId) return res.status(403).json({ error: 'Not your product or access denied' });

      const { name, description, price, stock, imageUrl, category, status } = req.body;

      const PLATFORM_FEE_RATE = 0.10;
      const updates = { updatedAt: new Date().toISOString() };
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (price !== undefined) {
        const vendorPrice = parseFloat(price);
        updates.vendorPrice = vendorPrice;
        updates.price = parseFloat((vendorPrice * (1 + PLATFORM_FEE_RATE)).toFixed(2));
        updates.platformFeeRate = PLATFORM_FEE_RATE;
      }
      if (stock !== undefined) updates.stock = parseInt(stock, 10);
      if (imageUrl !== undefined) updates.imageUrl = imageUrl;
      if (category !== undefined) updates.category = category;
      if (status !== undefined) updates.status = status;

      await productRef.update(updates);
      const updatedProduct = (await productRef.get()).data();
      res.json(updatedProduct);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update product' });
    }
  }
);

// PATCH /products/:id/restock — Add stock on top of existing amount
router.patch('/:id/restock', auth, requireRole('VENDOR'), async (req, res) => {
  try {
    const { quantity } = req.body;
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number' });
    }

    const vendorSnap = await db.collection('vendors').where('userId', '==', req.user.id).limit(1).get();
    if (vendorSnap.empty) return res.status(404).json({ error: 'Vendor not found' });
    const vendorId = vendorSnap.docs[0].id;

    const productRef = db.collection('products').doc(req.params.id);
    const productDoc = await productRef.get();
    if (!productDoc.exists) return res.status(404).json({ error: 'Product not found' });
    if (productDoc.data().vendorId !== vendorId) return res.status(403).json({ error: 'Not your product' });

    // Atomic increment — safe against race conditions
    const { FieldValue } = require('firebase-admin/firestore');
    await productRef.update({
      stock: FieldValue.increment(qty),
      updatedAt: new Date().toISOString(),
    });

    const updated = (await productRef.get()).data();
    res.json({ success: true, newStock: updated.stock });
  } catch (err) {
    console.error('Restock error:', err);
    res.status(500).json({ error: 'Failed to restock product' });
  }
});

// GET /products — Public listing

router.get('/', async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice, page = 1, limit = 20 } = req.query;
    
    // Firebase limits inequality operators without predefined composite indexes.
    // We will fetch all ACTIVE products and filter them natively in fast JS memory.
    const snapshot = await db.collection('products').where('status', '==', 'ACTIVE').get();
    let products = snapshot.docs.map(doc => doc.data());

    // In-memory active threshold and category filter
    products = products.filter(p => p.stock > 0);
    if (category) {
      products = products.filter(p => p.category === category);
    }
    
    // Sort array descending
    products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // In-memory filters for range and text search
    if (minPrice) {
      const min = parseFloat(minPrice);
      products = products.filter(p => p.price >= min);
    }
    if (maxPrice) {
      const max = parseFloat(maxPrice);
      products = products.filter(p => p.price <= max);
    }
    if (search) {
      const s = search.toLowerCase();
      products = products.filter(p => 
        p.name.toLowerCase().includes(s) || 
        (p.description && p.description.toLowerCase().includes(s))
      );
    }

    // Attach vendor details
    const vendorIds = [...new Set(products.map(p => p.vendorId))];
    const vendorsMap = {};
    
    // Process vendor fetching in batches of 10 for Firestore 'in' query limits
    for (let i = 0; i < vendorIds.length; i += 10) {
      const batchIds = vendorIds.slice(i, i + 10);
      const vendorsSnap = await db.collection('vendors').where('id', 'in', batchIds).get();
      vendorsSnap.docs.forEach(doc => {
        vendorsMap[doc.id] = doc.data();
      });
    }

    products = products.map(p => {
      const v = vendorsMap[p.vendorId] || {};
      return {
        ...p,
        vendor: {
          id: v.id,
          companyName: v.companyName || 'Unknown Vendor',
          rating: v.rating,
          location: v.location
        }
      };
    });

    const total = products.length;
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const paginatedProducts = products.slice(startIndex, startIndex + parseInt(limit));

    res.json({ 
      products: paginatedProducts, 
      total, 
      page: parseInt(page), 
      pages: Math.ceil(total / parseInt(limit)) 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /products/vendor — Vendor's own products (for inventory management)
router.get('/vendor/inventory', auth, requireRole('VENDOR'), async (req, res) => {
  try {
    const vendorSnap = await db.collection('vendors').where('userId', '==', req.user.id).limit(1).get();
    if (vendorSnap.empty) return res.status(404).json({ error: 'Vendor not found' });
    const vendorId = vendorSnap.docs[0].id;

    const snapshot = await db.collection('products')
      .where('vendorId', '==', vendorId)
      .get();
      
    const products = snapshot.docs.map(doc => doc.data()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// GET /products/:id
router.get('/:id', async (req, res) => {
  try {
    const productDoc = await db.collection('products').doc(req.params.id).get();
    if (!productDoc.exists) return res.status(404).json({ error: 'Product not found' });
    
    const product = productDoc.data();
    
    // Attach vendor details
    const vendorDoc = await db.collection('vendors').doc(product.vendorId).get();
    if (vendorDoc.exists) {
      const v = vendorDoc.data();
      product.vendor = {
        id: v.id,
        companyName: v.companyName,
        rating: v.rating,
        location: v.location,
        bio: v.bio
      };
    } else {
      product.vendor = { companyName: 'Unknown Vendor' };
    }

    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

const { supabase } = require('../lib/supabase');

// DELETE /products/:id — Remove a product from inventory
router.delete('/:id', auth, requireRole('VENDOR'), async (req, res) => {
  try {
    const vendorSnap = await db.collection('vendors').where('userId', '==', req.user.id).limit(1).get();
    if (vendorSnap.empty) return res.status(404).json({ error: 'Vendor not found' });
    const vendorId = vendorSnap.docs[0].id;

    const productRef = db.collection('products').doc(req.params.id);
    const productDoc = await productRef.get();
    
    if (!productDoc.exists) return res.status(404).json({ error: 'Product not found' });
    const product = productDoc.data();
    
    if (product.vendorId !== vendorId) {
      return res.status(403).json({ error: 'Not authorized to delete this product' });
    }

    // Optional: Delete image from Supabase Storage
    if (product.imageUrl && product.imageUrl.includes('supabase.co')) {
      try {
        const urlParts = new URL(product.imageUrl);
        const pathPart = urlParts.pathname.split('/public/uploads/')[1];
        if (pathPart) {
          const filePath = decodeURIComponent(pathPart);
          await supabase.storage.from('uploads').remove([filePath]);
          console.log(`✅ Deleted product image from storage: ${filePath}`);
        }
      } catch (storageErr) {
        console.error('Failed to delete product image from Supabase:', storageErr);
      }
    }

    await productRef.delete();
    res.json({ success: true, message: 'Product removed from inventory' });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;
