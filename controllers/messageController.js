import User from "../models/user.js";
import Message from "../models/messages.js";
import cloudinary from "../config/cloudinary.js";
import fs from "fs";
import { io, onlineUsers } from "../sockets/socket.js"; // <-- import io and onlineUsers
import mongoose from "mongoose";

export const getUsersForSidebar = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all users except the current one
    const filteredUsers = await User.find({ _id: { $ne: userId } }).select(
      "-password"
    );

    // Count number of unseen messages per user
    const unseenMessages = {};

    const promises = filteredUsers.map(async (user) => {
      const messages = await Message.find({
        senderId: user._id,
        receiverId: userId,
        seen: false,
      });

      if (messages.length > 0) {
        unseenMessages[user._id] = messages.length;
      }
    });

    await Promise.all(promises);

    res.json({
      success: true,
      users: filteredUsers,
      unseenMessages,
    });
  } catch (error) {
    console.log("Error in getUsersForSidebar:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


export const getMessages = async (req, res) => {
  try {
    const { id: selectedUserId } = req.params;
    const myId = req.user._id;

    // ✅ Validate selectedUserId
    if (!selectedUserId || !mongoose.Types.ObjectId.isValid(selectedUserId)) {
      return res.status(400).json({ success: false, message: "Invalid selected user ID" });
    }

    // ✅ Debug logs (optional)
    console.log("getMessages - myId:", myId);
    console.log("getMessages - selectedUserId:", selectedUserId);

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: selectedUserId },
        { senderId: selectedUserId, receiverId: myId },
      ],
    });

    // ✅ Mark messages as seen
    await Message.updateMany(
      { senderId: selectedUserId, receiverId: myId },
      { seen: true }
    );

    res.json({ success: true, messages });
  } catch (error) {
    console.log("getMessages error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};


export const markMessageAsSeen = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const myId = req.user._id;

    await Message.findByIdAndUpdate(messageId, { seen: true });
    res.json({ success: true, message: "Mark Message Seen succes" });
  } catch (error) {
    console.log("markMessageAsSeen error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const senderId = req.user._id;
    const receiverId = req.query.receiverId;
    const { text, image } = req.body;

    if (!receiverId) {
      return res.status(400).json({ success: false, message: 'receiverId is required in query params' });
    }

    let imageUrl = '';
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path);
      imageUrl = result.secure_url;
      fs.unlinkSync(req.file.path);
    } else if (image) {
      imageUrl = image;
    }

    const newMessage = await Message.create({
      senderId,
      receiverId,
      text,
      image: imageUrl,
    });

    // 🔥 Real-time emit via Socket.IO
    const toSocket = global.onlineUsers?.get(receiverId); // Depends how you stored onlineUsers
    const fromSocket = global.onlineUsers?.get(senderId);

    if (toSocket) {
      req.io.to(toSocket).emit('receive-message', newMessage);
    }

    if (fromSocket) {
      req.io.to(fromSocket).emit('message-sent', newMessage);
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: newMessage,
    });
  } catch (error) {
    console.error('sendMessage error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


