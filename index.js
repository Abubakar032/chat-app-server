import fs from "fs";
import path from "path";
import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import userRoutes from "./routes/userRoutes.js";
import messageRoutes from "./routes/messageRoute.js";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { initSocket } from "./sockets/socket.js"; // ✅

dotenv.config();
connectDB();

const app = express();
app.use(express.json());
app.use(cors());

// Create uploads folder if not exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
  console.log("Uploads folder created");
}

// Routes
app.use("/api/auth", userRoutes);
app.use("/api/messages", messageRoutes);

// Create HTTP server
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  pingTimeout: 60000,
  cors: {
    origin: "http://localhost:3000",
  },
});

initSocket(io); // ✅ Initialize Socket.IO

const PORT = process.env.PORT || 6363;
server.listen(PORT, () =>
  console.log(`Server + Socket.IO running on port ${PORT}`)
);
