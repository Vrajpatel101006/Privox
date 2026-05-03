const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, requireRole } = require('../middleware/auth');
const { db } = require('../lib/firebase');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Helper to fetch user details
async function getUserBasicInfo(userId) {
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) return { name: 'Unknown User' };
  const data = userDoc.data();
  return { id: data.id, name: data.name, email: data.email };
}

// POST /cart/add
router.post('/add',
  auth, requireRole('CUSTOMER'),
  body('productId').notEmpty(),
  body('quantity').isInt({ min: 1 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { productId, quantity } = req.body;
    const qty = parseInt(quantity, 10);

    try {
      const productRef = db.collection('products').doc(productId);
      const productDoc = await productRef.get();
      
      if (!productDoc.exists) {
        return res.status(404).json({ error: 'Product not found or unavailable' });
      }
      const product = productDoc.data();
      if (product.status === 'INACTIVE') {
        return res.status(404).json({ error: 'Product not found or unavailable' });
      }
      if (product.stock < qty) {
        return res.status(400).json({ error: `Only ${product.stock} items in stock` });
      }

      // Check if item already in cart
      const cartRef = db.collection('cartItems');
      const existingSnap = await cartRef
        .where('userId', '==', req.user.id)
        .where('productId', '==', productId)
        .limit(1)
        .get();

      let cartItemData;
      if (!existingSnap.empty) {
        // Update existing
        const docId = existingSnap.docs[0].id;
        cartItemData = { ...existingSnap.docs[0].data(), quantity: qty };
        await cartRef.doc(docId).update({ quantity: qty, updatedAt: new Date().toISOString() });
      } else {
        // Create new
        const id = uuidv4();
        cartItemData = {
          id,
          userId: req.user.id,
          productId,
          quantity: qty,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await cartRef.doc(id).set(cartItemData);
      }

      // Construct response
      const vendorDoc = await db.collection('vendors').doc(product.vendorId).get();
      const vendorName = vendorDoc.exists ? vendorDoc.data().companyName : 'Unknown';
      
      res.json({
        ...cartItemData,
        product: { ...product, vendor: { companyName: vendorName } }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to add to cart' });
    }
  }
);

// GET /cart
router.get('/', auth, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const snapshot = await db.collection('cartItems').where('userId', '==', req.user.id).get();
    
    if (snapshot.empty) return res.json({ items: [], subtotal: 0 });

    const items = [];
    let subtotal = 0;
    const vendorIds = new Set();

    for (const doc of snapshot.docs) {
      const itemData = doc.data();
      
      // Fetch product
      const productDoc = await db.collection('products').doc(itemData.productId).get();
      if (productDoc.exists) {
        const productData = productDoc.data();
        
        // Fetch vendor
        const vendorDoc = await db.collection('vendors').doc(productData.vendorId).get();
        productData.vendor = { 
          companyName: vendorDoc.exists ? vendorDoc.data().companyName : 'Unknown Vendor' 
        };
        
        itemData.product = productData;
        subtotal += productData.price * itemData.quantity;
        vendorIds.add(productData.vendorId);
        items.push(itemData);
      } else {
        // Product was deleted, ignore in cart view
        items.push({ ...itemData, product: { name: 'Item unavailable', price: 0, vendor: {} } });
      }
    }

    const shippingPerVendor = 50;
    const shippingTotal = vendorIds.size * shippingPerVendor;
    const finalTotal = subtotal + shippingTotal;

    res.json({ 
      items, 
      subtotal: parseFloat(subtotal.toFixed(2)),
      shipping: parseFloat(shippingTotal.toFixed(2)),
      total: parseFloat(finalTotal.toFixed(2))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

// DELETE /cart/:itemId
router.delete('/:itemId', auth, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const itemRef = db.collection('cartItems').doc(req.params.itemId);
    const itemDoc = await itemRef.get();
    
    if (!itemDoc.exists || itemDoc.data().userId !== req.user.id) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    await itemRef.delete();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

// DELETE /cart/clear
router.delete('/all/clear', auth, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const snapshot = await db.collection('cartItems').where('userId', '==', req.user.id).get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

// PUT /cart/:itemId
router.put('/:itemId', auth, requireRole('CUSTOMER'), body('quantity').isInt({ min: 1 }), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const qty = parseInt(req.body.quantity, 10);
    const itemRef = db.collection('cartItems').doc(req.params.itemId);
    const itemDoc = await itemRef.get();

    if (!itemDoc.exists || itemDoc.data().userId !== req.user.id) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    const productDoc = await db.collection('products').doc(itemDoc.data().productId).get();
    if (!productDoc.exists || productDoc.data().stock < qty) {
      return res.status(400).json({ error: `Only ${productDoc.data()?.stock || 0} items in stock` });
    }

    await itemRef.update({ quantity: qty, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update quantity' });
  }
});

// POST /cart/checkout — Mock checkout, creates orders for each vendor
router.post('/checkout', auth, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const snapshot = await db.collection('cartItems').where('userId', '==', req.user.id).get();
    if (snapshot.empty) return res.status(400).json({ error: 'Cart is empty' });

    const items = [];
    for (const doc of snapshot.docs) {
      const itemData = doc.data();
      const productDoc = await db.collection('products').doc(itemData.productId).get();
      if (productDoc.exists) {
        itemData.product = productDoc.data();
        items.push(itemData);
      }
    }

    if (items.length === 0) return res.status(400).json({ error: 'Cart items are unavailable' });

    // Group items by vendor
    const vendorGroups = {};
    for (const item of items) {
      const vendorId = item.product.vendorId;
      if (!vendorGroups[vendorId]) vendorGroups[vendorId] = [];
      vendorGroups[vendorId].push(item);
    }

    // Process checkout atomically
    const batch = db.batch();
    const orders = [];
    const timestamp = new Date().toISOString();

    const SHIPPING_PER_VENDOR = 50;

    for (const [vendorId, vendorItems] of Object.entries(vendorGroups)) {
      const itemTotal = vendorItems.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
      const total = itemTotal + SHIPPING_PER_VENDOR;
      const orderId = uuidv4();
      const eventId = uuidv4();

      const orderData = {
        id: orderId,
        customerId: req.user.id,
        vendorId,
        finalAmount: parseFloat(total.toFixed(2)),
        shippingFee: SHIPPING_PER_VENDOR,
        deliveryAddress: req.body.deliveryAddress || '',
        city: req.body.city || '',
        state: req.body.state || '',
        pincode: req.body.pincode || '',
        status: 'NOT_STARTED',
        quoteId: null, // This is a marketplace order, not a quote order
        createdAt: timestamp,
        updatedAt: timestamp
      };

      const eventData = {
        id: eventId,
        orderId,
        status: 'NOT_STARTED',
        note: 'Marketplace order placed',
        createdAt: timestamp,
        updatedAt: timestamp
      };

      batch.set(db.collection('orders').doc(orderId), orderData);
      batch.set(db.collection('orderTrackings').doc(eventId), eventData);

      // Decrement stock
      for (const item of vendorItems) {
        const newStock = Math.max(0, item.product.stock - item.quantity);
        batch.update(db.collection('products').doc(item.productId), { 
          stock: newStock,
          updatedAt: timestamp
        });
      }

      orders.push({ ...orderData, trackingEvents: [eventData] });
    }

    // Clear cart
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    res.json({ success: true, orders });
  } catch (err) {
    console.error('Checkout failed:', err);
    res.status(500).json({ error: 'Checkout failed' });
  }
});

module.exports = router;
