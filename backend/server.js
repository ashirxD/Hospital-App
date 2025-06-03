require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Message = require("./models/Message");
const User = require("./models/User");

console.log("Starting server...");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, "Uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("Created uploads directory:", uploadDir);
} else {
  console.log("Uploads directory exists:", uploadDir);
}

// Verify write permissions
try {
  fs.accessSync(uploadDir, fs.constants.W_OK);
  console.log("Uploads directory is writable");
} catch (err) {
  console.error("Uploads directory is not writable:", err);
}

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));
app.use("/uploads", (req, res, next) => {
  console.log("[Static] Accessing uploads:", req.originalUrl);
  next();
}, express.static(uploadDir));
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url}`);
  next();
});
console.log("Serving static files from:", uploadDir);
console.log("Middleware configured");

// Verify environment variables
if (!process.env.MONGODB_URI) {
  console.error("Error: MONGODB_URI is not defined in .env");
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error("Error: JWT_SECRET is not defined in .env");
  process.exit(1);
}
if (!process.env.EMAIL_USER) {
  console.error("Error: EMAIL_USER is not defined in .env");
  process.exit(1);
}
if (!process.env.EMAIL_PASS) {
  console.error("Error: EMAIL_PASS is not defined in .env");
  process.exit(1);
}
console.log("Environment variables loaded:");
console.log("MONGODB_URI:", process.env.MONGODB_URI.replace(/:.*@/, ":****@"));
console.log("PORT:", process.env.PORT || 5000);
console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "**** (hidden)" : "undefined");
console.log("FRONTEND_URL:", process.env.FRONTEND_URL || "http://localhost:5173");

// MongoDB Connection
console.log("Connecting to MongoDB...");
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  family: 4,
}).then(() => {
  console.log("MongoDB connected successfully");
}).catch(err => {
  console.error("MongoDB connection error:", {
    message: err.message,
    code: err.code,
    stack: err.stack,
  });
  process.exit(1);
});

// Notification Schema (import from models/Notification.js)
const Notification = require("./models/Notification");

// Socket.IO Authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  console.log("[Socket.IO] Authenticating:", { token: token?.slice(0, 20) + "...", timestamp: new Date().toISOString() });
  if (!token) {
    console.error("[Socket.IO] No token provided", { timestamp: new Date().toISOString() });
    return next(new Error("Authentication failed"));
  }
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    if (!user.id || !['patient', 'doctor'].includes(user.role)) {
      console.error("[Socket.IO] Invalid user data:", { id: user.id, role: user.role, timestamp: new Date().toISOString() });
      return next(new Error("Invalid user data"));
    }
    socket.userId = user.id;
    socket.role = user.role;
    console.log("[Socket.IO] Authenticated:", { userId: socket.userId, role: socket.role, timestamp: new Date().toISOString() });
    socket.join(socket.userId.toString());
    next();
  } catch (err) {
    console.error("[Socket.IO] Token verification failed:", err.message, { timestamp: new Date().toISOString() });
    return next(new Error("Authentication failed"));
  }
});

// Socket.IO Connection
io.on("connection", (socket) => {
  console.log("[Socket.IO] User connected:", { socketId: socket.id, userId: socket.userId, role: socket.role, timestamp: new Date().toISOString() });
  socket.join(socket.userId.toString());
  console.log("[Socket.IO] Joined room:", socket.userId, { timestamp: new Date().toISOString() });
  console.log("[Socket.IO] Emitting authenticated:", { userId: socket.userId, timestamp: new Date().toISOString() });
  socket.emit("authenticated", { userId: socket.userId });

  socket.on("sendMessage", async (data) => {
    try {
      console.log("[Socket.IO] sendMessage received:", {
        senderId: socket.userId,
        recipientId: data.recipientId,
        content: data.content,
        messageId: data._id,
        timestamp: new Date().toISOString(),
      });

      if (!data.recipientId || !data.content || !data._id) {
        console.error("[Socket.IO] Missing fields:", data);
        socket.emit("error", "Recipient ID, content, and message ID are required");
        return;
      }

      if (data.senderId && data.senderId !== socket.userId) {
        console.error("[Socket.IO] Sender ID mismatch:", {
          provided: data.senderId,
          actual: socket.userId,
        });
        socket.emit("error", "Unauthorized sender");
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(data.recipientId)) {
        console.error("[Socket.IO] Invalid recipient ID:", data.recipientId);
        socket.emit("error", "Invalid recipient ID");
        return;
      }
      const recipient = await User.findById(data.recipientId);
      if (!recipient) {
        console.error("[Socket.IO] Recipient not found:", data.recipientId);
        socket.emit("error", "Recipient not found");
        return;
      }

      const message = await Message.findById(data._id);
      if (!message) {
        console.error("[Socket.IO] Message not found:", data._id);
        socket.emit("error", "Message not found");
        return;
      }
      if (message.senderId.toString() !== socket.userId || message.recipientId.toString() !== data.recipientId) {
        console.error("[Socket.IO] Message data mismatch:", {
          messageSender: message.senderId,
          socketUser: socket.userId,
          messageRecipient: message.recipientId,
          dataRecipient: data.recipientId,
        });
        socket.emit("error", "Message data mismatch");
        return;
      }

      const messageData = {
        _id: message._id,
        senderId: socket.userId,
        recipientId: data.recipientId,
        content: data.content,
        createdAt: message.createdAt,
        read: false,
      };
      console.log("[Socket.IO] Emitting receiveMessage:", {
        messageId: message._id,
        senderId: socket.userId,
        recipientId: data.recipientId,
      });
      io.to(data.recipientId.toString()).emit("receiveMessage", messageData);
      io.to(socket.userId.toString()).emit("receiveMessage", messageData);
    } catch (err) {
      console.error("[Socket.IO] sendMessage Error:", {
        message: err.message,
        stack: err.stack,
        data,
        timestamp: new Date().toISOString(),
      });
      socket.emit("error", `Failed to send message: ${err.message}`);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("[Socket.IO] User disconnected:", { socketId: socket.id, userId: socket.userId, reason, timestamp: new Date().toISOString() });
  });

  socket.on("reconnect_attempt", () => {
    console.log("[Socket.IO] Reconnect attempt:", { socketId: socket.id, userId: socket.userId, timestamp: new Date().toISOString() });
  });

  socket.on("error", (err) => {
    console.error("[Socket.IO] Socket error:", { error: err, socketId: socket.id, userId: socket.userId, timestamp: new Date().toISOString() });
  });

  socket.onAny((event, ...args) => {
    console.log("[Socket.IO] Event emitted:", { event, args, userId: socket.userId, timestamp: new Date().toISOString() });
  });
});

// Routes
try {
  const routes = require("./routes/index");
  app.use("/api", routes);

  const { authenticateToken } = require("./middleware/auth");
  app.get("/api/notifications", authenticateToken, async (req, res) => {
    try {
      const notifications = await Notification.find({ userId: req.user.id })
        .populate("appointmentId", "patient date time reason")
        .sort({ createdAt: -1 });
      res.json(notifications);
    } catch (err) {
      console.error("[GET /api/notifications] Error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/notifications/:id/read", authenticateToken, async (req, res) => {
    try {
      const notification = await Notification.findById(req.params.id);
      if (!notification) return res.status(404).json({ message: "Notification not found" });
      if (notification.userId.toString() !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      notification.read = true;
      await notification.save();
      res.json(notification);
    } catch (err) {
      console.error("[PUT /api/notifications/:id/read] Error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  console.log("Routes loaded successfully");
} catch (err) {
  console.error("Error loading routes:", err);
  process.exit(1);
}

// Make io and Notification model available to routes
app.set("io", io);
app.set("Notification", Notification);

// Catch-all for 404s
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.url}`);
  res.status(404).json({ message: "Route not found" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("[Server error]:", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
  res.status(500).json({ message: "Internal server error" });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});