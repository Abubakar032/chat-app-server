import User from "../models/user.js";
import Verification from "../models/userVerificationSchema.js";
import bcrypt from "bcryptjs";
import { sendVerificationEmail } from "../config/sendEmail.js";
import { generateToken, verifyToken } from "../utils/jwt.js";
import cloudinary from "../config/cloudinary.js";
import fs from "fs";

// Step 1 - Request Signup
export const requestSignup = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res
        .status(400)
        .json({ message: "fullName, email, and password are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered." });
    }

    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    const hashedPassword = await bcrypt.hash(password, 10);

    await Verification.findOneAndUpdate(
      { email },
      { pin, expiresAt, fullName, password: hashedPassword },
      { upsert: true, new: true }
    );

    await sendVerificationEmail(email, pin);

    res.status(200).json({ message: "Verification code sent to your email" });
  } catch (err) {
    console.error("Signup request error:", err.message, err);
    res.status(500).json({ message: err.message || "Server error" });
  }
};

// Step 2 - Verify PIN and Signup
export const verifyAndSignup = async (req, res) => {
  try {
    const { email, pin } = req.body;

    const record = await Verification.findOne({ email });
    if (
      !record ||
      record.pin !== pin.toString() ||
      record.expiresAt < new Date()
    ) {
      return res.status(400).json({ message: "Invalid or expired PIN" });
    }

    // Password is already hashed in Verification record
    const newUser = new User({
      fullName: record.fullName,
      email,
      password: record.password,
    });
    await newUser.save();

    await Verification.deleteOne({ email });

    const token = generateToken(newUser._id);
    const verified = verifyToken(token);

    res.status(201).json({
      message: "User registered successfully",
      user: {
        _id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
      },
      token,
      verifiedTokenData: verified,
    });
  } catch (err) {
    console.error("Verify signup error:", err.message, err);
    res.status(500).json({ message: err.message || "Server error" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      message: "Login successful",
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
      },
      token,
    });
  } catch (err) {
    console.error("Login error:", err.message, err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getProfile = async (req, res) => {
  try {
    // req.user me pura user object already middleware se aa raha hai
    res.status(200).json({
      message: "User profile fetched successfully",
      success: true,
      user: req.user,
    });
  } catch (err) {
    console.error("Get profile error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { fullName, bio } = req.body;
    const userId = req.user._id; // From auth middleware
    let imageUrl;

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "profile_pics",
      });
      imageUrl = result.secure_url;

      fs.unlinkSync(req.file.path); // remove temp file
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        fullName,
        bio,
        ...(imageUrl && { profilImage: imageUrl }),
      },
      { new: true }
    );

    res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Cloudinary Upload Error:", error.message);
    res.status(500).json({ message: "Server Error" });
  }
};


