import User from "../models/user.js";
import Message from "../models/messages.js";
import cloudinary from "../config/cloudinary.js";
import fs from "fs";
import { io, onlineUsers } from "../sockets/socket.js"; // <-- import io and onlineUsers

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

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: selectedUserId },
        { senderId: selectedUserId, receiverId: myId },
      ],
    });

    // Mark selected user's messages as seen
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
    const receiverId = req.query.receiverId; // query se receiverId lo
    const { text, image } = req.body;

    if (!receiverId) {
      return res
        .status(400)
        .json({
          success: false,
          message: "receiverId is required in query params",
        });
    }

    let imageUrl = "";

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
      message: text,
      image: imageUrl,
    });

    // Socket notification
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId && io) {
      io.to(receiverSocketId).emit("receiveMessage", {
        senderId,
        receiverId,
        message: newMessage.message,
        image: newMessage.image,
        _id: newMessage._id,
        createdAt: newMessage.createdAt,
      });
    }

    res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: newMessage,
    });
  } catch (error) {
    console.error("sendMessage error:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
