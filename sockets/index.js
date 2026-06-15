const socketIO = require('socket.io');

const initSockets = (server) => {
  // Use same CORS origin as the HTTP server — never allow wildcard in production
  const allowedOrigin = process.env.FRONTEND_ORIGIN
    ? process.env.FRONTEND_ORIGIN.split(',').map(o => o.trim())
    : ['http://localhost:5173'];

  const io = socketIO(server, {
    cors: {
      origin: allowedOrigin,
      methods: ['GET', 'POST', 'PUT'],
      credentials: true,
    },
  });


  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Client can join a specific room for a donation to receive real-time updates
    socket.on('join-donation', (donationId) => {
      socket.join(donationId);
      console.log(`Socket ${socket.id} joined donation room: ${donationId}`);
    });

    socket.on('leave-donation', (donationId) => {
      socket.leave(donationId);
      console.log(`Socket ${socket.id} left donation room: ${donationId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

module.exports = initSockets;
