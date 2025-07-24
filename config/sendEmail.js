import nodemailer from 'nodemailer';

import dotenv from 'dotenv';
dotenv.config();  // ye sabse upar hona chahiye


const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,      // smtp.gmail.com
  port: Number(process.env.EMAIL_PORT), // 587
  secure: false,                     // for 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendVerificationEmail = async (email, pin) => {
  try {
    await transporter.sendMail({
      from: `"Chat App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your Verification Code",
      text: `Your verification code is: ${pin}`,
    });
    console.log(`Verification email sent to ${email}`);
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw error;  // ya apne hisaab se handle kar sakte hain
  }
};





