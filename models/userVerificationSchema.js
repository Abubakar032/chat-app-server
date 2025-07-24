import mongoose from 'mongoose';

const verificationSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  pin: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  fullName: { type: String, required: true },
  password: { type: String, required: true }  // ← Add this line
});

export default mongoose.model('Verification', verificationSchema);
