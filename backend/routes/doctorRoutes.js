const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const User = require("../models/User");
const Appointment = require("../models/Appointment");
const Review = require("../models/Review");
const mongoose = require("mongoose");

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, "../Uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("[init] Created uploads directory:", uploadDir);
} else {
  console.log("[init] Uploads directory exists:", uploadDir);
}

// Verify write permissions
try {
  fs.accessSync(uploadDir, fs.constants.W_OK);
  console.log("[init] Uploads directory is writable");
} catch (err) {
  console.error("[init] Uploads directory is not writable:", err);
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log("[multer] Destination:", uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const filename = `${Date.now()}-${file.originalname}`;
    console.log("[multer] Saving file to:", path.join(uploadDir, filename));
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== ".jpg" && ext !== ".jpeg" && ext !== ".png") {
      return cb(new Error("Only images are allowed (.jpg, .jpeg, .png)"));
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("profilePicture");

// Middleware to handle Multer errors
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error("[multerError] Multer error:", {
      message: err.message,
      code: err.code,
      field: err.field,
    });
    return res.status(400).json({ message: `Multer error: ${err.message}` });
  }
  if (err) {
    console.error("[multerError] File upload error:", {
      message: err.message,
      stack: err.stack,
    });
    return res.status(400).json({ message: err.message });
  }
  next();
};

// Get user data
router.get("/user", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[GET /user] Unauthorized: No user ID");
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }
    const user = await User.findById(req.user.id).select("-password -otp -otpExpires");
    if (!user) {
      console.error("[GET /user] User not found:", req.user.id);
      return res.status(404).json({ message: "User not found" });
    }
    if (user.role !== "doctor") {
      console.error("[GET /user] Access denied: Not a doctor:", user.role);
      return res.status(403).json({ message: "Access denied: Not a doctor" });
    }
    console.log("[GET /user] Fetched user:", {
      id: user._id,
      name: user.name,
      specialization: user.specialization,
      twoFAEnabled: user.twoFAEnabled,
    });
    res.json(user);
  } catch (err) {
    console.error("[GET /user] Error:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error" });
  }
});

// Update user profile
router.put("/profile", upload, handleMulterError, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[PUT /profile] Unauthorized: No user ID");
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }

    const { name, specialization, twoFAEnabled, startTime, endTime, days } = req.body;
    console.log("[PUT /profile] Received:", {
      name,
      specialization,
      twoFAEnabled,
      startTime,
      endTime,
      days,
      file: req.file ? req.file.filename : null,
    });

    if (!name || name.trim().length === 0) {
      console.error("[PUT /profile] Validation failed: Name required");
      return res.status(400).json({ message: "Name is required" });
    }

    const updateData = {
      name: name.trim(),
      specialization: specialization ? specialization.trim() : "",
      twoFAEnabled: twoFAEnabled === "true" || twoFAEnabled === true,
      availability: {
        startTime: startTime || "",
        endTime: endTime || "",
        days: days ? JSON.parse(days) : [],
      },
    };

    if (req.file) {
      updateData.profilePicture = `/Uploads/${req.file.filename}`;
      console.log("[PUT /profile] Updated profilePicture:", updateData.profilePicture);
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      console.error("[PUT /profile] User not found:", req.user.id);
      return res.status(404).json({ message: "User not found" });
    }

    if (req.file && user.profilePicture) {
      const oldPicturePath = path.join(__dirname, "..", user.profilePicture);
      try {
        if (fs.existsSync(oldPicturePath)) {
          fs.unlinkSync(oldPicturePath);
          console.log("[PUT /profile] Deleted old profile picture:", oldPicturePath);
        }
      } catch (err) {
        console.error("[PUT /profile] Error deleting old picture:", err);
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password -otp -otpExpires");

    if (!updatedUser) {
      console.error("[PUT /profile] Failed to update user:", req.user.id);
      return res.status(500).json({ message: "Failed to update profile" });
    }

    console.log("[PUT /profile] Profile updated:", {
      id: updatedUser._id,
      name: updatedUser.name,
      specialization: updatedUser.specialization,
      profilePicture: updatedUser.profilePicture,
      twoFAEnabled: updatedUser.twoFAEnabled,
      availability: updatedUser.availability,
    });
    res.json({ user: updatedUser });
  } catch (err) {
    console.error("[PUT /profile] Error:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error" });
  }
});

// Get appointment requests (pending appointments)
router.get("/appointment/requests", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[GET /appointment/requests] Unauthorized: No user ID");
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }

    const requests = await Appointment.find({
      doctor: req.user.id,
      status: "pending",
    })
      .populate("patient", "name profilePicture")
      .sort({ date: 1, time: 1 });
    console.log("[GET /appointment/requests] Fetched:", requests.length);
    res.json(requests);
  } catch (err) {
    console.error("[GET /appointment/requests] Error:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error" });
  }
});

// Get upcoming appointments
router.get("/appointments", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[GET /appointments] Unauthorized: No user ID");
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }

    const appointments = await Appointment.find({ doctor: req.user.id })
      .populate({
        path: "patient",
        select: "name phoneNumber email profilePicture",
        match: { _id: { $exists: true } },
      })
      .sort({ date: 1, time: 1 });

    const validAppointments = appointments.filter((appt) => appt.patient !== null);

    console.log("[GET /appointments] Populated patients:", validAppointments.map(appt => ({
      patientId: appt.patient?._id,
      name: appt.patient?.name,
      email: appt.patient?.email,
      phoneNumber: appt.patient?.phoneNumber,
      profilePicture: appt.patient?.profilePicture || "null"
    })));

    res.json(validAppointments);
  } catch (err) {
    console.error("[GET /appointments] Error:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error" });
  }
});

// Get appointment details
router.get("/appointment/:id", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[GET /appointment/:id] Unauthorized: No user ID");
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }

    const { id } = req.params;
    console.log("[GET /appointment/:id] Received:", { id });

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      console.error("[GET /appointment/:id] Invalid appointment ID format:", id);
      return res.status(400).json({ message: "Invalid appointment ID format" });
    }

    const appointment = await Appointment.findOne({
      _id: id,
      doctor: req.user.id,
    }).populate({
      path: "patient",
      select: "name email phoneNumber profilePicture medicalDescription",
    });

    if (!appointment) {
      console.error("[GET /appointment/:id] Appointment not found:", id);
      return res.status(404).json({ message: "Appointment not found" });
    }

    // Fetch the reviews for this appointment
    const reviews = await Review.find({ appointment: id })
      .populate("reviewer", "name profilePicture")
      .sort({ createdAt: -1 });

    // Add the reviews to the appointment object
    const appointmentWithReviews = {
      ...appointment.toObject(),
      reviews: reviews
    };

    console.log("[GET /appointment/:id] Fetched:", {
      appointmentId: appointment._id,
      patientName: appointment.patient?.name,
      reviewCount: reviews.length,
      timestamp: new Date().toISOString()
    });
    res.json(appointmentWithReviews);
  } catch (err) {
    console.error("[GET /appointment/:id] Error:", {
      message: err.message,
      stack: err.stack,
    });
    if (err.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid appointment ID format" });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// Accept appointment request (update status to accepted)
router.post("/appointment/accept", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[POST /appointment/accept] Unauthorized: No user ID");
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }

    const { requestId } = req.body;
    console.log("[POST /appointment/accept] Received:", { requestId });

    if (!requestId) {
      console.error("[POST /appointment/accept] Validation failed: Request ID required");
      return res.status(400).json({ message: "Request ID is required" });
    }

    if (!requestId.match(/^[0-9a-fA-F]{24}$/)) {
      console.error("[POST /appointment/accept] Invalid request ID format:", requestId);
      return res.status(400).json({ message: "Invalid request ID format" });
    }

    const doctor = await User.findById(req.user.id).select("name");
    if (!doctor) {
      console.error("[POST /appointment/accept] Doctor not found:", req.user.id);
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Find the appointment with status pending
    const appointment = await Appointment.findOne({
      _id: requestId,
      doctor: req.user.id,
      status: "pending",
    }).populate("patient", "name");

    if (!appointment) {
      const existingAppointment = await Appointment.findById(requestId);
      if (!existingAppointment) {
        console.error("[POST /appointment/accept] Appointment not found:", requestId);
        return res.status(404).json({ message: "Appointment not found" });
      }
      if (existingAppointment.doctor.toString() !== req.user.id) {
        console.error("[POST /appointment/accept] Unauthorized: Not your appointment:", requestId);
        return res.status(403).json({ message: "Unauthorized: Not your appointment" });
      }
      console.error("[POST /appointment/accept] Invalid status:", existingAppointment.status);
      return res.status(400).json({ message: "Appointment is not pending" });
    }

    // Check for slot double-booking (should not happen, but for safety)
    const slotConflict = await Appointment.findOne({
      doctor: req.user.id,
      date: appointment.date,
      time: appointment.time,
      status: "accepted",
      _id: { $ne: appointment._id },
    });
    if (slotConflict) {
      console.error("[POST /appointment/accept] Time slot already booked:", {
        date: appointment.date,
        time: appointment.time,
      });
      return res.status(400).json({ message: "This time slot is already booked" });
    }

    appointment.status = "accepted";
    await appointment.save();

    const Notification = req.app.get("Notification");
    const io = req.app.get("io");

    const patientNotification = new Notification({
      userId: appointment.patient._id,
      message: `Dr. ${doctor.name} accepted your appointment request`,
      type: "appointment_accepted",
      appointmentId: appointment._id,
    });
    await patientNotification.save();

    io.to(appointment.patient._id.toString()).emit("appointmentUpdate", {
      requestId,
      status: "accepted",
      message: patientNotification.message,
      notificationId: patientNotification._id,
    });

    const doctorNotification = new Notification({
      userId: req.user.id,
      message: `You accepted an appointment with ${appointment.patient.name}`,
      type: "appointment_accepted",
      appointmentId: appointment._id,
    });
    await doctorNotification.save();

    io.to(req.user.id.toString()).emit("appointmentUpdate", {
      requestId,
      status: "accepted",
      message: doctorNotification.message,
      notificationId: doctorNotification._id,
    });

    console.log("[POST /appointment/accept] Accepted:", {
      appointmentId: appointment._id,
      requestId,
      doctorName: doctor.name,
      patientName: appointment.patient.name,
    });
    res.json({ message: "Appointment request accepted successfully" });
  } catch (err) {
    console.error("[POST /appointment/accept] Error:", {
      message: err.message,
      stack: err.stack,
    });
    if (err.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid request ID format" });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// Reject appointment request (update status to rejected)
router.post("/appointment/reject", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[POST /appointment/reject] Unauthorized: No user ID");
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }

    const { requestId } = req.body;
    console.log("[POST /appointment/reject] Received:", { requestId });

    if (!requestId) {
      console.error("[POST /appointment/reject] Validation failed: Request ID required");
      return res.status(400).json({ message: "Request ID is required" });
    }

    if (!requestId.match(/^[0-9a-fA-F]{24}$/)) {
      console.error("[POST /appointment/reject] Invalid request ID format:", requestId);
      return res.status(400).json({ message: "Invalid request ID format" });
    }

    const doctor = await User.findById(req.user.id).select("name");
    if (!doctor) {
      console.error("[POST /appointment/reject] Doctor not found:", req.user.id);
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Find the appointment with status pending
    const appointment = await Appointment.findOne({
      _id: requestId,
      doctor: req.user.id,
      status: "pending",
    }).populate("patient", "name");

    if (!appointment) {
      const existingAppointment = await Appointment.findById(requestId);
      if (!existingAppointment) {
        console.error("[POST /appointment/reject] Appointment not found:", requestId);
        return res.status(404).json({ message: "Appointment not found" });
      }
      if (existingAppointment.doctor.toString() !== req.user.id) {
        console.error("[POST /appointment/reject] Unauthorized: Not your appointment:", requestId);
        return res.status(403).json({ message: "Unauthorized: Not your appointment" });
      }
      console.error("[POST /appointment/reject] Invalid status:", existingAppointment.status);
      return res.status(400).json({ message: "Appointment is not pending" });
    }

    appointment.status = "rejected";
    await appointment.save();

    const Notification = req.app.get("Notification");
    const io = req.app.get("io");

    const patientNotification = new Notification({
      userId: appointment.patient._id,
      message: `Dr. ${doctor.name} rejected your appointment request`,
      type: "appointment_rejected",
      appointmentId: appointment._id,
    });
    await patientNotification.save();

    io.to(appointment.patient._id.toString()).emit("appointmentUpdate", {
      requestId,
      status: "rejected",
      message: patientNotification.message,
      notificationId: patientNotification._id,
    });

    const doctorNotification = new Notification({
      userId: req.user.id,
      message: `You rejected an appointment request from ${appointment.patient.name}`,
      type: "appointment_rejected",
      appointmentId: appointment._id,
      createdAt: new Date(),
    });
    await doctorNotification.save();

    io.to(req.user.id.toString()).emit("appointmentUpdate", {
      requestId,
      status: "rejected",
      message: doctorNotification.message,
      notificationId: doctorNotification._id,
    });

    console.log("[POST /appointment/reject] Rejected:", {
      requestId,
      doctorName: doctor.name,
      patientName: appointment.patient.name,
    });
    res.json({ message: "Appointment request rejected successfully" });
  } catch (err) {
    console.error("[POST /appointment/reject] Error:", {
      message: err.message,
      stack: err.stack,
    });
    if (err.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid request ID format" });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// Update appointment status
router.put("/appointments/:id/status", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[PUT /appointments/:id/status] Unauthorized: No user ID");
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }

    const { id } = req.params;
    const { status } = req.body;
    console.log("[PUT /appointments/:id/status] Received:", { id, status });

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      console.error("[PUT /appointments/:id/status] Invalid appointment ID format:", id);
      return res.status(400).json({ message: "Invalid appointment ID format" });
    }

    if (!["attended", "cancelled", "absent"].includes(status)) {
      console.error("[PUT /appointments/:id/status] Invalid status:", status);
      return res.status(400).json({ message: "Invalid status. Use attended, cancelled, or absent" });
    }

    const appointment = await Appointment.findOne({
      _id: id,
      doctor: req.user.id,
    }).populate("patient", "name");

    if (!appointment) {
      console.error("[PUT /appointments/:id/status] Appointment not found:", id);
      return res.status(404).json({ message: "Appointment not found" });
    }

    // Prevent updating if status is already set
    if (appointment.status && ["attended", "cancelled", "absent"].includes(appointment.status)) {
      console.error("[PUT /appointments/:id/status] Status already set:", appointment.status);
      return res.status(400).json({ message: `Appointment is already marked as ${appointment.status}` });
    }

    appointment.status = status;
    await appointment.save();

    // Fetch doctor for name
    const doctor = await User.findById(req.user.id).select("name");
    if (!doctor) {
      console.error("[PUT /appointments/:id/status] Doctor not found:", req.user.id);
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Send notifications
    const Notification = req.app.get("Notification");
    const io = req.app.get("io");

    try {
      const patientNotification = new Notification({
        userId: appointment.patient._id,
        message: `Dr. ${doctor.name} marked your appointment as ${status}`,
        type: "appointment_status_updated",
        appointmentId: appointment._id,
      });
      await patientNotification.save();
      io.to(appointment.patient._id.toString()).emit("appointmentStatusUpdated", {
        appointmentId: id,
        status,
        message: patientNotification.message,
        notificationId: patientNotification._id,
      });
    } catch (notificationErr) {
      console.error("[PUT /appointments/:id/status] Patient notification error:", notificationErr.message);
    }

    try {
      const doctorNotification = new Notification({
        userId: req.user.id,
        message: `You marked the appointment with ${appointment.patient.name} as ${status}`,
        type: "appointment_status_updated",
        appointmentId: appointment._id,
      });
      await doctorNotification.save();
      io.to(req.user.id.toString()).emit("appointmentStatusUpdated", {
        appointmentId: id,
        status,
        message: doctorNotification.message,
        notificationId: doctorNotification._id,
      });
    } catch (notificationErr) {
      console.error("[PUT /appointments/:id/status] Doctor notification error:", notificationErr.message);
    }

    console.log("[PUT /appointments/:id/status] Status updated:", {
      appointmentId: id,
      status,
      patientName: appointment.patient.name,
    });
    res.json({ message: `Appointment status updated to ${status}` });
  } catch (err) {
    console.error("[PUT /appointments/:id/status] Error:", {
      message: err.message,
      stack: err.stack,
    });
    if (err.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid appointment ID format" });
    }
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Save prescription for an appointment
router.post("/appointment/:id/prescription", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[POST /appointment/:id/prescription] Unauthorized: No user ID");
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }

    const { id } = req.params;
    const { medicineName, frequency, durationDays } = req.body;
    console.log("[POST /appointment/:id/prescription] Received:", {
      id,
      medicineName,
      frequency,
      durationDays,
    });

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      console.error("[POST /appointment/:id/prescription] Invalid appointment ID format:", id);
      return res.status(400).json({ message: "Invalid appointment ID format" });
    }

    if (!medicineName || !frequency || !durationDays) {
      console.error("[POST /appointment/:id/prescription] Validation failed: Missing fields");
      return res.status(400).json({ message: "Medicine name, frequency, and duration are required" });
    }

    // Validate frequency structure
    const requiredTimes = ['morning', 'afternoon', 'evening', 'night'];
    const hasValidFrequency = requiredTimes.every(time => 
      typeof frequency[time] === 'number' && 
      frequency[time] >= 0 && 
      frequency[time] <= 10
    );

    if (!hasValidFrequency) {
      console.error("[POST /appointment/:id/prescription] Invalid frequency format");
      return res.status(400).json({ 
        message: "Invalid frequency format. Each time of day must be a number between 0 and 10" 
      });
    }

    // Validate that at least one time of day has a dose
    const totalDoses = Object.values(frequency).reduce((sum, dose) => sum + dose, 0);
    if (totalDoses === 0) {
      console.error("[POST /appointment/:id/prescription] No doses specified");
      return res.status(400).json({ message: "At least one dose must be specified" });
    }

    const appointment = await Appointment.findOne({
      _id: id,
      doctor: req.user.id,
    }).populate("patient", "name");

    if (!appointment) {
      console.error("[POST /appointment/:id/prescription] Appointment not found:", id);
      return res.status(404).json({ message: "Appointment not found" });
    }

    const prescription = {
      medicineName: medicineName.trim(),
      frequency: {
        morning: parseInt(frequency.morning) || 0,
        afternoon: parseInt(frequency.afternoon) || 0,
        evening: parseInt(frequency.evening) || 0,
        night: parseInt(frequency.night) || 0
      },
      durationDays: parseInt(durationDays),
      prescribedAt: new Date(),
    };

    appointment.prescriptions.push(prescription);
    await appointment.save();

    // Fetch doctor for name
    const doctor = await User.findById(req.user.id).select("name");
    if (!doctor) {
      console.error("[POST /appointment/:id/prescription] Doctor not found:", req.user.id);
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Create a human-readable frequency description
    const frequencyDesc = Object.entries(prescription.frequency)
      .filter(([_, value]) => value > 0)
      .map(([time, value]) => `${value} dose${value > 1 ? 's' : ''} at ${time}`)
      .join(', ');

    // Send notifications (handle errors gracefully)
    const Notification = req.app.get("Notification");
    const io = req.app.get("io");

    try {
      const patientNotification = new Notification({
        userId: appointment.patient._id,
        message: `Dr. ${doctor.name} prescribed ${medicineName} (${frequencyDesc}) for your appointment`,
        type: "prescription_added",
        appointmentId: appointment._id,
      });
      await patientNotification.save();
      io.to(appointment.patient._id.toString()).emit("prescriptionAdded", {
        appointmentId: id,
        message: patientNotification.message,
        notificationId: patientNotification._id,
      });
    } catch (notificationErr) {
      console.error("[POST /appointment/:id/prescription] Patient notification error:", notificationErr.message);
    }

    try {
      const doctorNotification = new Notification({
        userId: req.user.id,
        message: `You prescribed ${medicineName} (${frequencyDesc}) for ${appointment.patient.name}`,
        type: "prescription_added",
        appointmentId: appointment._id,
      });
      await doctorNotification.save();
      io.to(req.user.id.toString()).emit("prescriptionAdded", {
        appointmentId: id,
        message: doctorNotification.message,
        notificationId: doctorNotification._id,
      });
    } catch (notificationErr) {
      console.error("[POST /appointment/:id/prescription] Doctor notification error:", notificationErr.message);
    }

    console.log("[POST /appointment/:id/prescription] Prescription added:", {
      appointmentId: id,
      medicineName,
      frequency: prescription.frequency,
      patientName: appointment.patient.name,
    });
    res.status(201).json({ prescription });
  } catch (err) {
    console.error("[POST /appointment/:id/prescription] Error:", {
      message: err.message,
      stack: err.stack,
    });
    if (err.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid appointment ID format" });
    }
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Mark all notifications as read
router.put("/notifications/read-all", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[PUT /notifications/read-all] Unauthorized: No user ID");
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }

    const Notification = req.app.get("Notification");
    const io = req.app.get("io");

    const result = await Notification.updateMany(
      { userId: req.user.id, read: false },
      { $set: { read: true } }
    );

    console.log("[PUT /notifications/read-all] Notifications updated:", {
      userId: req.user.id,
      modifiedCount: result.modifiedCount,
    });

    io.to(req.user.id.toString()).emit("notificationsMarkedAsRead", {
      userId: req.user.id,
      timestamp: new Date(),
    });

    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    console.error("[PUT /notifications/read-all] Error:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error" });
  }
});

// Get all patients who have had appointments with the doctor
router.get("/patients", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[GET /patients] Unauthorized: No user ID");
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }

    console.log("[GET /patients] Fetching patients for doctor:", req.user.id);

    // First, check if the doctor exists
    const doctor = await User.findById(req.user.id);
    if (!doctor) {
      console.error("[GET /patients] Doctor not found:", req.user.id);
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Find all appointments for this doctor and populate patient details
    const appointments = await Appointment.find({ doctor: req.user.id })
      .populate({
        path: "patient",
        select: "name email phoneNumber profilePicture",
        match: { _id: { $exists: true } }
      })
      .sort({ date: -1, time: -1 });

    console.log("[GET /patients] Found appointments:", {
      count: appointments.length,
      appointments: appointments.map(a => ({
        id: a._id,
        patientId: a.patient?._id,
        patientName: a.patient?.name,
        date: a.date,
        status: a.status
      }))
    });

    // Filter out appointments with null patients and get unique patients
    const uniquePatients = appointments
      .filter(appt => {
        if (!appt.patient) {
          console.log("[GET /patients] Filtered out appointment with null patient:", appt._id);
          return false;
        }
        return true;
      })
      .reduce((acc, appt) => {
        const patientId = appt.patient._id.toString();
        if (!acc[patientId]) {
          acc[patientId] = {
            ...appt.patient.toObject(),
            lastAppointment: {
              date: appt.date,
              time: appt.time,
              status: appt.status
            }
          };
        }
        return acc;
      }, {});

    const patientsList = Object.values(uniquePatients);

    console.log("[GET /patients] Final patients list:", {
      doctorId: req.user.id,
      count: patientsList.length,
      patients: patientsList.map(p => ({
        id: p._id,
        name: p.name,
        lastAppointment: p.lastAppointment
      }))
    });

    res.json(patientsList);
  } catch (err) {
    console.error("[GET /patients] Error:", {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Get reviews for the doctor
router.get("/reviews", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[GET /reviews] Unauthorized: No user ID");
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }

    const reviews = await Review.find({ reviewee: req.user.id })
      .populate({
        path: "appointment",
        select: "date time reason",
        populate: {
          path: "patient",
          select: "name profilePicture"
        }
      })
      .populate("reviewer", "name profilePicture")
      .sort({ createdAt: -1 });

    console.log("[GET /reviews] Fetched reviews:", {
      count: reviews.length,
      doctorId: req.user.id,
      timestamp: new Date().toISOString()
    });

    res.json(reviews);
  } catch (err) {
    console.error("[GET /reviews] Error:", {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ message: "Server error" });
  }
});

// Get review statistics for the doctor
router.get("/reviews/stats", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[GET /reviews/stats] Unauthorized: No user ID");
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }

    const stats = await Review.aggregate([
      { $match: { reviewee: mongoose.Types.ObjectId(req.user.id) } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
          ratingDistribution: {
            $push: "$rating"
          }
        }
      }
    ]);

    if (stats.length === 0) {
      return res.json({
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0
        }
      });
    }

    const ratingDistribution = stats[0].ratingDistribution.reduce((acc, rating) => {
      acc[rating] = (acc[rating] || 0) + 1;
      return acc;
    }, {});

    const response = {
      averageRating: parseFloat(stats[0].averageRating.toFixed(1)),
      totalReviews: stats[0].totalReviews,
      ratingDistribution: {
        1: ratingDistribution[1] || 0,
        2: ratingDistribution[2] || 0,
        3: ratingDistribution[3] || 0,
        4: ratingDistribution[4] || 0,
        5: ratingDistribution[5] || 0
      }
    };

    console.log("[GET /reviews/stats] Fetched stats:", {
      doctorId: req.user.id,
      stats: response,
      timestamp: new Date().toISOString()
    });

    res.json(response);
  } catch (err) {
    console.error("[GET /reviews/stats] Error:", {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;