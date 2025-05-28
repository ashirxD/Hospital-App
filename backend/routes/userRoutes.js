const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get Authenticated User Data
router.get('/user', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('[GET /api/user] Fetching user:', userId);
    const user = await User.findById(userId).select('name role profilePicture specialization twoFAEnabled availability');
    if (!user) {
      console.error('[GET /api/user] User not found:', userId);
      return res.status(404).json({ message: 'User not found' });
    }
    console.log('[GET /api/user] Success:', { name: user.name, role: user.role });
    res.json({
      _id: user._id,
      name: user.name,
      role: user.role,
      profilePicture: user.profilePicture,
      specialization: user.specialization,
      twoFAEnabled: user.twoFAEnabled,
      availability: user.availability,
    });
  } catch (err) {
    console.error('[GET /api/user] Error:', {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: 'Server error' });
  }
});

// Get User Data by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;
    console.log('[GET /api/user/:id] Fetching user:', userId);
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.error('[GET /api/user/:id] Invalid user ID:', userId);
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    const user = await User.findById(userId).select('name profilePicture role');
    if (!user) {
      console.error('[GET /api/user/:id] User not found:', userId);
      return res.status(404).json({ message: 'User not found' });
    }
    console.log('[GET /api/user/:id] Success:', { name: user.name, role: user.role });
    res.json({
      _id: user._id,
      name: user.name,
      profilePicture: user.profilePicture,
      role: user.role,
    });
  } catch (err) {
    console.error('[GET /api/user/:id] Error:', {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;