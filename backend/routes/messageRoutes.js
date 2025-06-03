const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const Message = require("../models/Message");
const User = require("../models/User");
const ChatGroup = require("../models/ChatGroup");
const { authenticateToken } = require("../middleware/auth");

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Ensure this directory exists
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "application/pdf", "application/doc" , "application/docx"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, and PDF files are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Get available users
router.get("/available-users", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("[GET /api/messages/available-users] Fetching for user:", userId);

    const user = await User.findById(userId);
    if (!user) {
      console.error("[GET /api/messages/available-users] User not found:", userId);
      return res.status(404).json({ error: "User not found" });
    }

    let availableUsers = [];
    if (user.role === "patient") {
      availableUsers = await User.find({ role: "doctor" }, "name profilePicture role _id").lean();
      console.log("[GET /api/messages/available-users] Fetched doctors:", availableUsers.length);
    } else if (user.role === "doctor") {
      availableUsers = await User.find({ role: "patient" }, "name profilePicture role _id").lean();
      console.log("[GET /api/messages/available-users] Fetched patients:", availableUsers.length);
    }

    if (availableUsers.length === 0) {
      console.log("[GET /api/messages/available-users] No available users found for user:", userId);
      return res.status(200).json([]);
    }

    const usersWithLastMessage = await Promise.all(
      availableUsers.map(async (availableUser) => {
        const participants = [userId, availableUser._id.toString()].sort();
        const chatGroup = await ChatGroup.findOne({
          participants: { $all: participants, $size: participants.length },
        }).populate("lastMessage").lean();
        return {
          _id: availableUser._id.toString(),
          name: availableUser.name,
          profilePicture: availableUser.profilePicture || "/default-avatar.jpg",
          role: availableUser.role,
          lastMessage: chatGroup?.lastMessage || null,
          chatGroupId: chatGroup?._id.toString() || null,
        };
      })
    );

    console.log("[GET /api/messages/available-users] Fetched:", { count: usersWithLastMessage.length });
    res.status(200).json(usersWithLastMessage);
  } catch (err) {
    console.error("[GET /api/messages/available-users] Error:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: `Server error: ${err.message}` });
  }
});

// Create or fetch a chat group
router.post("/create-chat-group", authenticateToken, async (req, res) => {
  try {
    const { recipientId } = req.body;
    const senderId = req.user.id;
    console.log("[POST /api/messages/create-chat-group] Received:", { senderId, recipientId });

    if (!recipientId) {
      console.error("[POST /api/messages/create-chat-group] Missing recipientId");
      return res.status(400).json({ error: "Recipient ID is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
      console.error("[POST /api/messages/create-chat-group] Invalid recipientId:", recipientId);
      return res.status(400).json({ error: "Invalid recipient ID" });
    }

    if (!mongoose.Types.ObjectId.isValid(senderId)) {
      console.error("[POST /api/messages/create-chat-group] Invalid senderId:", senderId);
      return res.status(400).json({ error: "Invalid sender ID" });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      console.error("[POST /api/messages/create-chat-group] Recipient not found:", recipientId);
      return res.status(404).json({ error: "Recipient not found" });
    }

    const sender = await User.findById(senderId);
    if (!sender) {
      console.error("[POST /api/messages/create-chat-group] Sender not found:", senderId);
      return res.status(404).json({ error: "Sender not found" });
    }

    const participants = [
      new mongoose.Types.ObjectId(senderId),
      new mongoose.Types.ObjectId(recipientId),
    ].sort((a, b) => a.toString().localeCompare(b.toString()));

    let chatGroup = await ChatGroup.findOne({
      participants: { $all: participants, $size: participants.length },
    });

    if (!chatGroup) {
      chatGroup = new ChatGroup({
        participants,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await chatGroup.save();
      console.log("[POST /api/messages/create-chat-group] Created chat group:", chatGroup._id.toString());
    } else {
      console.log("[POST /api/messages/create-chat-group] Found existing chat group:", chatGroup._id.toString());
    }

    const io = req.app.get("io");
    const chatGroupData = {
      _id: chatGroup._id.toString(),
      participants: chatGroup.participants.map((id) => id.toString()),
      createdAt: chatGroup.createdAt,
      updatedAt: chatGroup.updatedAt,
      lastMessage: chatGroup.lastMessage || null,
    };
    console.log("[POST /api/messages/create-chat-group] Emitting chatGroupUpdate:", chatGroupData);
    io.to(senderId).emit("chatGroupUpdate", chatGroupData);
    io.to(recipientId).emit("chatGroupUpdate", chatGroupData);

    res.status(200).json({ chatGroupId: chatGroup._id.toString() });
  } catch (err) {
    console.error("[POST /api/messages/create-chat-group] Error:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: `Server error: ${err.message}` });
  }
});

// Get messages for a chat group
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { chatGroupId } = req.query;
    const userId = req.user.id;
    console.log("[GET /api/messages] Fetching:", { userId, chatGroupId });

    if (!chatGroupId) {
      console.error("[GET /api/messages] Missing chatGroupId");
      return res.status(400).json({ error: "Chat group ID is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(chatGroupId)) {
      console.error("[GET /api/messages] Invalid chatGroupId:", chatGroupId);
      return res.status(400).json({ error: "Invalid chat group ID" });
    }

    const chatGroup = await ChatGroup.findById(chatGroupId);
    if (!chatGroup) {
      console.error("[GET /api/messages] Chat group not found:", chatGroupId);
      return res.status(404).json({ error: "Chat group not found" });
    }

    if (!chatGroup.participants.map((id) => id.toString()).includes(userId)) {
      console.error("[GET /api/messages] User not in chat group:", { userId, chatGroupId });
      return res.status(403).json({ error: "Unauthorized" });
    }

    const messages = await Message.find({ chatGroupId })
      .sort({ createdAt: 1 })
      .limit(100)
      .lean();
    console.log("[GET /api/messages] Fetched:", { count: messages.length });

    res.json(messages);
  } catch (err) {
    console.error("[GET /api/messages] Error:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: "Server error" });
  }
});

// Send message with optional file attachment
router.post("/", authenticateToken, upload.single("attachment"), async (req, res) => {
  try {
    const { recipientId, content, chatGroupId } = req.body || {};
    const senderId = req.user?.id;
    console.log("[POST /api/messages] Received:", {
      senderId,
      recipientId,
      chatGroupId,
      content,
      file: req.file ? req.file.filename : "No file",
    });

    // Validate inputs
    if (!senderId) {
      console.error("[POST /api/messages] Error: senderId is undefined");
      return res.status(401).json({ error: "Authentication failed: user not identified" });
    }

    if (!recipientId) {
      console.error("[POST /api/messages] Missing recipientId");
      return res.status(400).json({ error: "Recipient ID is required" });
    }

    if (!chatGroupId) {
      console.error("[POST /api/messages] Missing chatGroupId");
      return res.status(400).json({ error: "Chat group ID is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
      console.error("[POST /api/messages] Invalid recipientId:", recipientId);
      return res.status(400).json({ error: "Invalid recipient ID" });
    }

    if (!mongoose.Types.ObjectId.isValid(senderId)) {
      console.error("[POST /api/messages] Invalid senderId:", senderId);
      return res.status(400).json({ error: "Invalid sender ID" });
    }

    if (!mongoose.Types.ObjectId.isValid(chatGroupId)) {
      console.error("[POST /api/messages] Invalid chatGroupId:", chatGroupId);
      return res.status(400).json({ error: "Invalid chat group ID" });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      console.error("[POST /api/messages] Recipient not found:", recipientId);
      return res.status(404).json({ error: "Recipient not found" });
    }

    const sender = await User.findById(senderId);
    if (!sender) {
      console.error("[POST /api/messages] Sender not found:", senderId);
      return res.status(404).json({ error: "Sender not found" });
    }

    if (!content && !req.file) {
      console.error("[POST /api/messages] No content or file provided");
      return res.status(400).json({ error: "Content or attachment required" });
    }

    // Verify chat group
    let chatGroup = await ChatGroup.findById(chatGroupId);
    if (!chatGroup) {
      console.error("[POST /api/messages] Chat group not found:", chatGroupId);
      return res.status(404).json({ error: "Chat group not found" });
    }

    if (!chatGroup.participants.map((id) => id.toString()).includes(senderId)) {
      console.error("[POST /api/messages] Sender not in chat group:", { senderId, chatGroupId });
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Prepare attachment data
    let attachment = null;
    if (req.file) {
      attachment = {
        url: `/uploads/${req.file.filename}`,
        fileType: req.file.mimetype,
        fileName: req.file.originalname,
      };
    }

    // Create message
    const message = new Message({
      senderId,
      recipientId,
      content: content || "",
      attachment,
      chatGroupId,
      createdAt: new Date(),
      read: false,
    });
    await message.save();
    console.log("[POST /api/messages] Message saved:", message._id.toString());

    // Update chat group with last message
    chatGroup.lastMessage = {
      content: message.content || (attachment ? attachment.fileName : ""),
      senderId: new mongoose.Types.ObjectId(senderId),
      createdAt: message.createdAt,
      attachment,
    };
    chatGroup.updatedAt = message.createdAt;
    await chatGroup.save();
    console.log("[POST /api/messages] ChatGroup updated with lastMessage");

    // Prepare response
    const messageResponse = {
      _id: message._id.toString(),
      senderId: senderId.toString(),
      recipientId: recipientId.toString(),
      content: message.content,
      attachment: message.attachment || null,
      createdAt: message.createdAt,
      read: message.read,
      chatGroupId: chatGroup._id.toString(),
    };

    // Emit via Socket.IO
    const io = req.app.get("io");
    console.log("[POST /api/messages] Emitting receiveMessage:", {
      messageId: messageResponse._id,
      chatGroupId: messageResponse.chatGroupId,
    });
    io.to(messageResponse.recipientId).emit("receiveMessage", messageResponse);
    io.to(messageResponse.senderId).emit("receiveMessage", messageResponse);

    // Emit chat group update
    const updatedChatGroup = {
      _id: chatGroup._id.toString(),
      participants: chatGroup.participants.map((id) => id.toString()),
      lastMessage: messageResponse,
      updatedAt: chatGroup.updatedAt,
    };
    console.log("[POST /api/messages] Emitting chatGroupUpdate:", {
      chatGroupId: updatedChatGroup._id,
    });
    io.to(messageResponse.recipientId).emit("chatGroupUpdate", updatedChatGroup);
    io.to(messageResponse.senderId).emit("chatGroupUpdate", updatedChatGroup);

    res.json(messageResponse);
  } catch (err) {
    console.error("[POST /api/messages] Error:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: `Server error: ${err.message}` });
  }
});

// Get chat groups for a user
router.get("/chat-groups", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("[GET /api/messages/chat-groups] Fetching for user:", userId);

    const chatGroups = await ChatGroup.find({ participants: userId })
      .populate("participants", "name profilePicture role")
      .populate("lastMessage")
      .sort({ updatedAt: -1 })
      .lean();

    const formattedGroups = chatGroups.map((group) => {
      const otherParticipant = group.participants.find((p) => p._id.toString() !== userId);
      return {
        _id: group._id.toString(),
        otherParticipant: otherParticipant
          ? {
              _id: otherParticipant._id.toString(),
              name: otherParticipant.name,
              profilePicture: otherParticipant.profilePicture || "/default-avatar.png",
              role: otherParticipant.role,
            }
          : null,
        lastMessage: group.lastMessage,
        updatedAt: group.updatedAt,
      };
    }).filter((group) => group.otherParticipant);

    console.log("[GET /api/messages/chat-groups] Fetched:", { count: formattedGroups.length });
    res.json(formattedGroups);
  } catch (err) {
    console.error("[GET /api/messages/chat-groups] Error:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;