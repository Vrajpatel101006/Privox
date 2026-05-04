require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { setupSocket } = require('./socket');

const authRoutes = require('./routes/auth');
const designRoutes = require('./routes/design');
const quoteRoutes = require('./routes/quotes');
const orderRoutes = require('./routes/orders');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const vendorRoutes = require('./routes/vendors');
const paymentRoutes = require('./routes/payments');
const refundRoutes = require('./routes/refunds');
const cancellationRoutes = require('./routes/cancellations');
const adminRoutes = require('./routes/admin');
const { startScheduler } = require('./jobs/payoutScheduler');


const app = express();
const server = http.createServer(app);

// Socket.IO
const io = setupSocket(server);
app.set('io', io);


// Middleware
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5173'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // Allow any Netlify preview or your main frontend URL
    if (allowedOrigins.includes(origin) || origin.endsWith('.netlify.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the uploads directory
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/auth', authRoutes);
app.use('/design', designRoutes);
app.use('/quotes', quoteRoutes);
app.use('/orders', orderRoutes);
app.use('/products', productRoutes);
app.use('/cart', cartRoutes);
app.use('/vendors', vendorRoutes);
app.use('/payments', paymentRoutes);
app.use('/refunds', refundRoutes);
app.use('/cancellations', cancellationRoutes);
app.use('/admin', adminRoutes);

// Start background jobs
startScheduler();


// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Prinvox API running on http://localhost:${PORT}`);
});
