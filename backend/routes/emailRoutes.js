const express = require('express');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const transporter = require('../config/nodemailer');
const { generateOTP } = require('../utils/otpUtils');

const router = express.Router();

// Test Email Route
// router.get('/test-email', async (req, res) => {
//   try {
//     console.log('Testing email with:', {
//       user: process.env.EMAIL_USER,
//       pass: process.env.EMAIL_PASS ? '**** (hidden)' : 'undefined',
//     });
//     const mailOptions = {
//       from: process.env.EMAIL_USER,
//       to: process.env.EMAIL_USER,
//       subject: 'Test Email from NodeMailer',
//       text: 'This is a test email to verify NodeMailer configuration.',
//     };
//     const info = await transporter.sendMail(mailOptions);
//     console.log('Test email sent:', info);
//     res.json({ message: 'Test email sent successfully', info });
//   } catch (err) {
//     console.error('Test email error:', {
//       message: err.message,
//       code: err.code,
//       response: err.response,
//       responseCode: err.responseCode,
//     });
//     res.status(500).json({ message: 'Failed to send test email', error: err.message });
//   }
// });

// Verify Email Route
router.post('/verify-email', async (req, res) => {
  const { email, otp } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ message: 'Email is already verified' });
    }

    if (user.otp !== otp || user.otpExpires < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.isEmailVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully' });
  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Resend OTP Route
router.post('/resend-otp', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ message: 'Email is already verified' });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    // Send OTP email
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Email Verification OTP',
        text: `Your new OTP for email verification is: ${otp}. It is valid for 10 minutes.`,
      };
      const info = await transporter.sendMail(mailOptions);
      console.log('Resend OTP email sent:', info);
    } catch (emailErr) {
      console.error('Resend OTP email error:', {
        message: emailErr.message,
        code: emailErr.code,
        response: emailErr.response,
      });
      return res.status(500).json({ message: 'Failed to send OTP email', error: emailErr.message });
    }

    res.json({ message: 'A new OTP has been sent to your email' });
  } catch (err) {
    console.error('Resend OTP error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Forgot Password Route
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }
    const otp = generateOTP();
    const otpExpires = Date.now() + 10 * 60 * 1000;
    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset OTP',
      text: `Your OTP for password reset is: ${otp}. It is valid for 10 minutes.`,
    };
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('OTP email sent:', info);
    } catch (emailErr) {
      console.error('Forgot password OTP email error:', {
        message: emailErr.message,
        code: emailErr.code,
        response: emailErr.response,
      });
      return res.status(500).json({ message: 'Failed to send OTP email', error: emailErr.message });
    }
    res.json({ message: 'OTP sent to your email' });
  } catch (err) {
    console.error('Forgot password error:', {
      message: err.message,
      code: err.code,
      response: err.response,
      responseCode: err.responseCode,
    });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Reset Password Route
router.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }
    if (user.otp !== otp || user.otpExpires < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    
    // Set the new password directly (middleware will handle hashing)
    user.password = newPassword;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();
    
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;