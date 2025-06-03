const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: Date, required: true },
  time: { type: String, required: true, match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"] },
  reason: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ["pending", "accepted", "attended", "cancelled", "absent", "rejected", "completed"],
    default: "pending",
  },
  prescriptions: [
    {
      medicineName: { type: String, required: true },
      frequency: {
        morning: { type: Number, min: 0, max: 10, default: 0 },
        afternoon: { type: Number, min: 0, max: 10, default: 0 },
        evening: { type: Number, min: 0, max: 10, default: 0 },
        night: { type: Number, min: 0, max: 10, default: 0 }
      },
      durationDays: { type: Number, required: true },
      prescribedAt: { type: Date, default: Date.now },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports =
  mongoose.models.Appointment ||
  mongoose.model("Appointment", appointmentSchema);
