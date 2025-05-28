const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, trim: true, default: "" }, // Default to empty string
  attachment: {
    url: { type: String },
    fileType: { type: String },
    fileName: { type: String },
  },
  createdAt: { type: Date, default: Date.now },
  chatGroupId: { type: mongoose.Schema.Types.ObjectId, ref: "ChatGroup" },
  read: { type: Boolean, default: false },
});

module.exports = mongoose.model("Message", messageSchema);