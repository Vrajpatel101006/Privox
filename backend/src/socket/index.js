const { Server } = require('socket.io');

let io;

const setupSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Join a user's personal room for notifications
    socket.on('join:user', (userId) => {
      socket.join(`user:${userId}`);
      console.log(`User ${userId} joined their room`);
    });

    // Join a vendor's room for quote requests and orders
    socket.on('join:vendor', (vendorId) => {
      socket.join(`vendor:${vendorId}`);
      console.log(`Vendor ${vendorId} joined their room`);
    });

    // Join the admin room for escalated disputes and platform overviews
    socket.on('join:admin', () => {
      socket.join('admin');
      console.log(`Admin joined the global admin room`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => io;

module.exports = { setupSocket, getIO };
