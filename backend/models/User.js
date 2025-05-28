const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["doctor", "patient"], required: true },
  specialization: { type: String },
  profilePicture: { type: String, default: null },
  isEmailVerified: { type: Boolean, default: false },
  otp: { type: String },
  otpExpires: { type: Date },
  twoFAEnabled: { type: Boolean, default: true },
  twoFASecret: { type: String },
  // phoneNumber: {
  //   type: String,
  //   unique: true,
  //   sparse: true, // Allows multiple null/undefined values
  //   match: [
  //     /^\+?\d{1,4}[-.\s]?\(?\d{1,3}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}$/,
  //     "Invalid phone number format (e.g., +1234567890, 123-456-7890)",
  //   ],
  //   default: null,
  // },
  availability: {
    startTime: { type: String, default: "" },
    endTime: { type: String, default: "" },
    days: { type: [String], default: [] },
  },
}, { timestamps: true });

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  console.log("[User] Hashing password for:", this.email);
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

module.exports = mongoose.model("User", userSchema);