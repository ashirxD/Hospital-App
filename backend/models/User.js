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
    slotDuration: { 
      type: Number, 
      default: 30,
      enum: [30, 45, 60, 75, 90, 105, 120], // Duration in minutes with 15-min increments
      required: function() { return this.role === 'doctor'; }
    },
    breakTime: {
      type: Number,
      default: 0,
      min: 0,
      max: 30,
      validate: {
        validator: function(v) {
          return v % 5 === 0; // Only allow multiples of 5
        },
        message: 'Break time must be a multiple of 5 minutes'
      }
    },
    vacations: [{
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      reason: { type: String, default: "" }
    }]
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