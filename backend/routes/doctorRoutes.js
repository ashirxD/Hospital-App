const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const User = require("../models/User");
const AppointmentRequest = require("../models/AppointmentRequest");
const Appointment = require("../models/Appointment");

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

    // If a new profile picture is uploaded, delete the old one
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

// Get appointment requests
router.get("/appointment/requests", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[GET /appointment/requests] Unauthorized: No user ID");
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }

    const requests = await AppointmentRequest.find({
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
        match: { _id: { $exists: true } }, // Ensure patient exists
      })
      .sort({ date: 1, time: 1 });

    // Filter out appointments with null patient (in case populate fails)
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

// Accept appointment request
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

    // Validate ObjectId format
    if (!requestId.match(/^[0-9a-fA-F]{24}$/)) {
      console.error("[POST /appointment/accept] Invalid request ID format:", requestId);
      return res.status(400).json({ message: "Invalid request ID format" });
    }

    // Fetch doctor details to get the name
    const doctor = await User.findById(req.user.id).select("name");
    if (!doctor) {
      console.error("[POST /appointment/accept] Doctor not found:", req.user.id);
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Atomically find and update the request to prevent race conditions
    const request = await AppointmentRequest.findOneAndUpdate(
      { _id: requestId, doctor: req.user.id, status: "pending" },
      { status: "accepted" },
      { new: true }
    ).populate("patient", "name");

    if (!request) {
      const existingRequest = await AppointmentRequest.findById(requestId);
      if (!existingRequest) {
        console.error("[POST /appointment/accept] Request not found:", requestId);
        return res.status(404).json({ message: "Appointment request not found" });
      }
      if (existingRequest.doctor.toString() !== req.user.id) {
        console.error("[POST /appointment/accept] Unauthorized: Not your request:", requestId);
        return res.status(403).json({ message: "Unauthorized: Not your request" });
      }
      console.error("[POST /appointment/accept] Invalid status:", existingRequest.status);
      return res.status(400).json({ message: "Request is not pending" });
    }

    // Check for time slot conflicts
    const existingAppointment = await Appointment.findOne({
      doctor: req.user.id,
      date: request.date,
      time: request.time,
    });
    if (existingAppointment) {
      // Revert the status change if there's a conflict
      request.status = "pending";
      await request.save();
      console.error("[POST /appointment/accept] Time slot already booked:", {
        date: request.date,
        time: request.time,
      });
      return res.status(400).json({ message: "This time slot is already booked" });
    }

    // Create the appointment
    const appointment = new Appointment({
      patient: request.patient,
      doctor: request.doctor,
      date: request.date,
      time: request.time,
      reason: request.reason,
    });
    await appointment.save();

    // Create notifications
    const Notification = req.app.get("Notification");
    const io = req.app.get("io");

    // Notify patient
    const patientNotification = new Notification({
      userId: request.patient,
      message: `Dr. ${doctor.name} accepted your appointment request`,
      type: "appointment_accepted",
      appointmentId: request._id,
    });
    await patientNotification.save();

    io.to(request.patient.toString()).emit("appointmentUpdate", {
      requestId,
      status: "accepted",
      message: patientNotification.message,
      notificationId: patientNotification._id,
    });

    // Notify doctor
    const doctorNotification = new Notification({
      userId: req.user.id,
      message: `You accepted an appointment with ${request.patient.name}`,
      type: "appointment_accepted",
      appointmentId: request._id,
    });
    await patientNotification.save();

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
      patientName: request.patient.name,
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

// Reject appointment request
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

    // Validate ObjectId format
    if (!requestId.match(/^[0-9a-fA-F]{24}$/)) {
      console.error("[POST /appointment/reject] Invalid request ID format:", requestId);
      return res.status(400).json({ message: "Invalid request ID format" });
    }

    // Fetch doctor details to ensure consistency (name may be used in future enhancements)
    const doctor = await User.findById(req.user.id).select("name");
    if (!doctor) {
      console.error("[POST /appointment/reject] Doctor not found:", req.user.id);
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Atomically find and update the request to prevent race conditions
    const request = await AppointmentRequest.findOneAndUpdate(
      { _id: requestId, doctor: req.user.id, status: "pending" },
      { status: "rejected" },
      { new: true }
    ).populate("patient", "name");

    if (!request) {
      const existingRequest = await AppointmentRequest.findById(requestId);
      if (!existingRequest) {
        console.error("[POST /appointment/reject] Request not found:", requestId);
        return res.status(404).json({ message: "Appointment request not found" });
      }
      if (existingRequest.doctor.toString() !== req.user.id) {
        console.error("[POST /appointment/reject] Unauthorized: Not your request:", requestId);
        return res.status(403).json({ message: "Unauthorized: Not your request" });
      }
      console.error("[POST /appointment/reject] Invalid status:", existingRequest.status);
      return res.status(400).json({ message: "Request is not pending" });
    }

    // Create notifications
    const Notification = req.app.get("Notification");
    const io = req.app.get("io");

    // Notify patient
    const patientNotification = new Notification({
      userId: request.patient,
      message: `Dr. ${doctor.name} rejected your appointment request`,
      type: "appointment_rejected",
      appointmentId: require._id,
    });
    await patientNotification.save();

    io.to(request.patient.toString()).emit("appointmentUpdate", {
      requestId,
      status: "rejected",
      message: patientNotification.message,
      notificationId: patientNotification._id,
    });

    // Notify doctor
    const doctorNotification = new Notification({
      userId: req.user.id,
      message: `You rejected an appointment request from ${request.patient.name}`,
      type: "appointment_rejected",
      appointmentId: request._id,
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
      patientName: request.patient.name,
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



module.exports = router;