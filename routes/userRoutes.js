import express from 'express';
import { requestSignup, verifyAndSignup, login, getProfile, updateProfile } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import upload from '../middleware/multer.js'; // multer middleware for file uploads

const router = express.Router();

router.post('/signup', requestSignup);    // sends PIN
router.post('/verify-signup', verifyAndSignup);   // verifies and creates user
router.post('/login', login); 

router.get('/profile', authenticate, getProfile);
router.put('/update-profile', authenticate, upload.single('profilImage'), updateProfile);

export default router;
