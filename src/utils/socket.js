import { Server } from 'socket.io';

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*", // Adjust this for production security
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('🔌 New socket connection:', socket.id);

    socket.on('join-room', (roomId) => {
      socket.join(roomId);
      console.log(`👤 User ${socket.id} joined room: ${roomId}`);
    });

    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected:', socket.id);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

export const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user_${userId}`).emit(event, data);
  }
};

export const emitToCompany = (companyId, event, data) => {
  if (io) {
    io.to(`company_${companyId}`).emit(event, data);
  }
};
