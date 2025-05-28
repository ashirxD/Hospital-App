// routes/authRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const transporter = require('../config/nodemailer');
const { generateOTP } = require('../utils/otpUtils');

const router = express.Router();

// Signup Route
router.post('/signup', async (req, res) => {
  const { name, email, password, role, specialization } = req.body;

  try {
    console.log('[Signup] Received:', { name, email, role, specialization });

    // Validate input
    if (!name || name.trim().length === 0) {
      console.log('[Signup] Missing name');
      return res.status(400).json({ message: 'Name is required' });
    }
    if (!email || !password || !role) {
      console.log('[Signup] Missing required fields');
      return res.status(400).json({ message: 'Email, password, and role are required' });
    }
    if (!['doctor', 'patient'].includes(role)) {
      console.log('[Signup] Invalid role:', role);
      return res.status(400).json({ message: 'Role must be either "doctor" or "patient"' });
    }
    if (role === 'doctor' && (!specialization || specialization.trim().length === 0)) {
      console.log('[Signup] Missing specialization for doctor');
      return res.status(400).json({ message: 'Specialization is required for doctors' });
    }

    // Check for existing user
    let user = await User.findOne({ email });
    if (user) {
      console.log('[Signup] User exists:', email);
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user (pass plain password)
    user = new User({
      name,
      email,
      password, // Pass plain password; pre-save hook will hash it
      role,
      specialization: role === 'doctor' ? specialization : undefined,
      isEmailVerified: false,
    });

    // Generate OTP
    const otp = generateOTP();
    const otpExpires = Date.now() + 10 * 60 * 1000;
    user.otp = otp;
    user.otpExpires = otpExpires;

    // Save user (pre-save hook hashes password)
    await user.save();
    console.log('[Signup] User created:', user.email);

    // Send OTP email
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Email Verification OTP',
        text: `Your OTP for email verification is: ${otp}. It is valid for 10 minutes.`,
      };
      const info = await transporter.sendMail(mailOptions);
      console.log('[Signup] OTP email sent:', info.messageId);
    } catch (emailErr) {
      console.error('[Signup] Email sending error:', emailErr);
      return res.status(500).json({ message: 'Failed to send verification email', error: emailErr.message });
    }

    res.status(201).json({ message: 'User created. Please verify your email with the OTP sent.' });
  } catch (err) {
    console.error('[Signup] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Signin Route (with enhanced logging)
router.post('/signin', async (req, res) => {
  const { email, password } = req.body;
  console.log('[Signin] Request received:', { body: req.body, headers: req.headers });

  try {
    // Validate input
    if (!email || !password) {
      console.log('[Signin] Missing fields:', { email: !!email, password: !!password });
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      console.log('[Signin] User not found:', email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check email verification
    if (!user.isEmailVerified) {
      console.log('[Signin] Email not verified:', email);
      return res.status(400).json({ message: 'Please verify your email before signing in' });
    }

    // Compare password
    console.log('[Signin] Comparing password for:', email);
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('[Signin] Password mismatch:', email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    console.log('[Signin] User authenticated:', { email, twoFAEnabled: user.twoFAEnabled });

    // Handle 2FA
    if (user.twoFAEnabled) {
      const otp = generateOTP();
      const otpExpires = Date.now() + 10 * 60 * 1000;
      user.otp = otp;
      user.otpExpires = otpExpires;
      await user.save();

      const pendingToken = jwt.sign(
        { id: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '10m' }
      );

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: '2FA OTP for Sign In',
        text: `Your OTP for signing in is: ${otp}. It is valid for 10 minutes.`,
      };
      try {
        const info = await transporter.sendMail(mailOptions);
        console.log('[Signin] OTP email sent:', info.messageId);
        return res.json({ pendingToken, message: 'OTP sent to your email' });
      } catch (emailErr) {
        console.error('[Signin] OTP email error:', {
          message: emailErr.message,
          code: emailErr.code,
          response: emailErr.response,
        });
        return res.status(500).json({ message: 'Failed to send OTP email', error: emailErr.message });
      }
    } else {
      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      console.log('[Signin] Issued JWT for user:', user._id);
      return res.json({ token, role: user.role, message: 'Signin successful' });
    }
  } catch (err) {
    console.error('[Signin] Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify OTP Route
router.post('/verify-otp', async (req, res) => {
  const { email, otp, pendingToken } = req.body;
  try {
    let decoded;
    try {
      decoded = jwt.verify(pendingToken, process.env.JWT_SECRET);
    } catch (err) {
      console.log('[Verify OTP] Invalid pending token');
      return res.status(400).json({ message: 'Invalid or expired session' });
    }
    

    const userId = decoded.id;
    if (!userId) {
      console.log('[Verify OTP] Missing userId in token');
      return res.status(400).json({ message: 'Invalid pending token' });
    }

    const user = await User.findById(userId);
    if (!user || user.email !== email) {
      console.log('[Verify OTP] User not found:', { userId, email });
      return res.status(400).json({ message: 'User not found' });
    }

    if (user.otp !== otp || user.otpExpires < Date.now()) {
      console.log('[Verify OTP] Invalid or expired OTP');
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Clear OTP
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log('[Verify OTP] OTP verified, issued JWT for user:', user._id);

    res.json({ token, role: user.role, message: 'Signin successful' });
  } catch (err) {
    console.error('[Verify OTP] Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;