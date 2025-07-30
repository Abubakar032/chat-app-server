import express from "express";
import { authenticate } from "../middleware/auth.js";
import upload from "../middleware/multer.js"; // multer middleware for file uploads
import {
  getUsersForSidebar,
  getMessages,
  markMessageAsSeen,
  sendMessage,
} from "../controllers/messageController.js";

const router = express.Router();
router.get("/getUsersSidebar", authenticate, getUsersForSidebar);
router.get("/getMessages/:id", authenticate, getMessages);
router.put("/markSeen/:id", authenticate, markMessageAsSeen);
router.post("/message/send", authenticate, upload.single("image"), sendMessage);

export default router;
