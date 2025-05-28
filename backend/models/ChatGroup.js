const mongoose = require("mongoose");

const chatGroupSchema = new mongoose.Schema({
  participants: [
    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  ],
  lastMessage: {
    content: { type: String, default: "" },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date },
    attachment: {
      url: { type: String },
      fileType: { type: String },
      fileName: { type: String },
    },
  },
  updatedAt: { type: Date, default: Date.now },
});

chatGroupSchema.index({ participants: 1 }, { unique: false });

module.exports = mongoose.model("ChatGroup", chatGroupSchema);