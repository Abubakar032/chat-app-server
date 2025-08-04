import { Server } from "socket.io";
import User from "../models/user.js";
import Message from "../models/messages.js";
export let io = null;
export let onlineUsers = new Map();

export const initSocket = (ioInstance) => {
  io = ioInstance;

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("register", async (userId) => {
      socket.userId = userId;
      onlineUsers.set(userId, socket.id);
      await User.findByIdAndUpdate(userId, { isOnline: true });

      // Notify everyone that this user is online
      io.emit("user-status", { userId, isOnline: true });
      console.log(`User ${userId} is online`);

      // ✅ Send currently online users to the newly connected user only
      const onlineUserIds = Array.from(onlineUsers.keys());
      io.to(socket.id).emit("initial-online-users", onlineUserIds);
    });

    socket.on("typing", ({ from, to }) => {
      const toSocket = onlineUsers.get(to);
      if (toSocket) {
        io.to(toSocket).emit("typing", { from });
      }
    });

    socket.on("send-message", async ({ sender, receiver, text, image }) => {
      try {
        let message;
        if (!image) {
          message = await Message.create({
            senderId: sender,
            receiverId: receiver,
            text: text || "",
            image: image || "", // <- this will be base64 string
          });
        } else {
          message = {
            senderId: sender,
            receiverId: receiver,
            text: text || "",
            image: image || "",
          };
        }

        const toSocket = onlineUsers.get(receiver);
        const fromSocket = onlineUsers.get(sender);
        if (toSocket) {
          io.to(toSocket).emit("receive-message", message);

          // 🔔 Notify receiver of unseen message
          io.to(toSocket).emit("unseen-message", {
            senderId: sender,
            receiverId: receiver,
          });
        }

        // ✅ Confirm to sender
        if (fromSocket) io.to(fromSocket).emit("message-sent", message);
      } catch (err) {
        console.error("Socket send-message error:", err.message);
      }
    });

    socket.on("mark-seen", async ({ senderId, receiverId }) => {
      try {
        // ✅ Update unseen messages from sender to receiver
        await Message.updateMany(
          { senderId, receiverId, seen: false },
          { $set: { seen: true } }
        );

        // 🔄 Notify sender in real-time
        const toSocket = onlineUsers.get(senderId);
        if (toSocket) {
          io.to(toSocket).emit("messages-seen", { by: receiverId });
        }
      } catch (error) {
        console.error("Error marking messages as seen:", error.message);
      }
    });

    socket.on("call-user", ({ to, offer }) => {
      const toSocket = onlineUsers.get(to);
      if (toSocket) {
        io.to(toSocket).emit("call-made", { offer, from: socket.userId });
      }
    });

    // Callee sends answer to caller
    socket.on("make-answer", ({ to, answer }) => {
      const toSocket = onlineUsers.get(to);
      if (toSocket) {
        io.to(toSocket).emit("answer-made", { answer, from: socket.userId });
      }
    });

    // ICE candidates exchange
    socket.on("ice-candidate", ({ to, candidate }) => {
      const toSocket = onlineUsers.get(to);
      if (toSocket) {
        io.to(toSocket).emit("ice-candidate", {
          candidate,
          from: socket.userId,
        });
      }
    });

    // ✅ Add this for rejecting call
    socket.on("reject-call", ({ to }) => {
      const toSocket = onlineUsers.get(to);
      if (toSocket) {
        io.to(toSocket).emit("call-rejected", { from: socket.userId });
      }
    });

    // ✅ Add this for cancelling outgoing call
    socket.on("cancel-call", ({ to }) => {
      const toSocket = onlineUsers.get(to);
      if (toSocket) {
        io.to(toSocket).emit("call-cancelled", { from: socket.userId });
      }
    });

    socket.on("disconnect", async () => {
      const userId = socket.userId; // <-- directly access attached userId
      if (userId) {
        onlineUsers.delete(userId);
        await User.findByIdAndUpdate(userId, { isOnline: false });
        io.emit("user-status", { userId, isOnline: false });
        console.log(`User ${userId} went offline`);
      }
      console.log("Disconnect hua:", socket.id);
      console.log("Online Users map:", onlineUsers);
    });
  });
};
