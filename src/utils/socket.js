let io;

const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

export const initSocket = async (server) => {
  // Vercel serverless does not support persistent WebSocket connections
  if (isVercel) {
    console.log('⚠️ Skipping Socket.io init — serverless environment');
    return null;
  }

  try {
    const { Server } = await import('socket.io');
    io = new Server(server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS
          ? process.env.ALLOWED_ORIGINS.split(',')
          : ['http://localhost:3000', 'https://timso.vercel.app'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['polling', 'websocket']
    });

    io.on('connection', (socket) => {
      console.log('🔌 Socket connected:', socket.id);

      socket.on('join-room', (roomId) => {
        socket.join(roomId);
      });

      socket.on('disconnect', () => {
        console.log('🔌 Socket disconnected:', socket.id);
      });
    });

    return io;
  } catch (error) {
    console.error('⚠️ Socket.io init failed:', error.message);
    return null;
  }
};

export const getIO = () => io || null;

export const emitToUser = (userId, event, data) => {
  if (io) io.to(`user_${userId}`).emit(event, data);
};

export const emitToCompany = (companyId, event, data) => {
  if (io) io.to(`company_${companyId}`).emit(event, data);
};
