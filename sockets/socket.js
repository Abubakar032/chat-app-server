import { Server } from "socket.io";

export let io = null;
export let onlineUsers = new Map();

export const initSocket = (ioInstance) => {
  io = ioInstance;

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    socket.on('join', (userId) => {
      onlineUsers.set(userId, socket.id);
      console.log(`User ${userId} joined as ${socket.id}`);
    });

    socket.on('sendMessage', ({ senderId, receiverId, message }) => {
      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('receiveMessage', {
          senderId,
          message,
        });
      }
    });

    socket.on('disconnect', () => {
      for (const [userId, socketId] of onlineUsers) {
        if (socketId === socket.id) {
          onlineUsers.delete(userId);
          break;
        }
      }
      console.log('Socket disconnected:', socket.id);
    });
  });
};
