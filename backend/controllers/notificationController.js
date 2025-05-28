// // In controllers/notificationController.js
// const Notification = require('../models/Notification');

// exports.clearReadNotifications = async (req, res) => {
//   try {
//     const userId = req.user.id; // assuming auth middleware sets req.user
//     const result = await Notification.deleteMany({ user: userId, read: true });
//     res.json({ success: true, deletedCount: result.deletedCount });
//   } catch (err) {
//     console.error('[clearReadNotifications] Error:', err);
//     res.status(500).json({ success: false, message: 'Failed to clear read notifications' });
//   }
// };