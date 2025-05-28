const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const moment = require("moment");
const User = require("../models/User");
const AppointmentRequest = require("../models/AppointmentRequest");

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
      timestamp: new Date().toISOString(),
    });
    return res.status(400).json({ message: `Multer error: ${err.message}` });
  }
  if (err) {
    console.error("[multerError] File upload error:", {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    });
    return res.status(400).json({ message: err.message });
  }
  next();
};

// Get user data
router.get("/user", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[GET /user] Unauthorized: No user ID", { timestamp: new Date().toISOString() });
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }
    const user = await User.findById(req.user.id).select("-password -otp -otpExpires");
    if (!user) {
      console.error("[GET /user] User not found:", req.user.id, { timestamp: new Date().toISOString() });
      return res.status(404).json({ message: "User not found" });
    }
    if (user.role !== "patient") {
      console.error("[GET /user] Access denied: Not a patient:", user.role, { timestamp: new Date().toISOString() });
      return res.status(403).json({ message: "Access denied: Not a patient" });
    }
    console.log("[GET /user] Fetched user:", {
      id: user._id,
      name: user.name,
      phoneNumber: user.phoneNumber,
      twoFAEnabled: user.twoFAEnabled,
      timestamp: new Date().toISOString(),
    });
    res.json(user);
  } catch (err) {
    console.error("[GET /user] Error:", {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({ message: "Server error" });
  }
});

// Update user profile
router.put("/profile", upload, handleMulterError, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[PUT /profile] Unauthorized: No user ID", { timestamp: new Date().toISOString() });
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }

    const { name, phoneNumber, twoFAEnabled } = req.body;
    console.log("[PUT /profile] Received:", {
      name,
      phoneNumber,
      twoFAEnabled,
      file: req.file ? req.file.filename : null,
      timestamp: new Date().toISOString(),
    });

    if (!name || name.trim().length === 0) {
      console.error("[PUT /profile] Validation failed: Name required", { timestamp: new Date().toISOString() });
      return res.status(400).json({ message: "Name is required" });
    }

    // Validate phone number if provided
    if (phoneNumber && phoneNumber.trim()) {
      const phoneRegex = /^\+?\d{1,4}[-.\s]?\(?\d{1,3}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}$/;
      if (!phoneRegex.test(phoneNumber.trim())) {
        console.error("[PUT /profile] Validation failed: Invalid phone number format", { timestamp: new Date().toISOString() });
        return res.status(400).json({ message: "Invalid phone number format" });
      }
    }

    const updateData = {
      name: name.trim(),
      phoneNumber: phoneNumber ? phoneNumber.trim() : null,
      twoFAEnabled: twoFAEnabled === "true" || twoFAEnabled === true,
    };

    if (req.file) {
      updateData.profilePicture = `/Uploads/${req.file.filename}`;
      console.log("[PUT /profile] Updated profilePicture:", updateData.profilePicture, { timestamp: new Date().toISOString() });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      console.error("[PUT /profile] User not found:", req.user.id, { timestamp: new Date().toISOString() });
      return res.status(404).json({ message: "User not found" });
    }

    // If a new profile picture is uploaded, delete the old one
    if (req.file && user.profilePicture) {
      const oldPicturePath = path.join(__dirname, "..", user.profilePicture);
      try {
        if (fs.existsSync(oldPicturePath)) {
          fs.unlinkSync(oldPicturePath);
          console.log("[PUT /profile] Deleted old profile picture:", oldPicturePath, { timestamp: new Date().toISOString() });
        }
      } catch (err) {
        console.error("[PUT /profile] Error deleting old picture:", err, { timestamp: new Date().toISOString() });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password -otp -otpExpires");

    if (!updatedUser) {
      console.error("[PUT /profile] Failed to update user:", req.user.id, { timestamp: new Date().toISOString() });
      return res.status(500).json({ message: "Failed to update profile" });
    }

    console.log("[PUT /profile] Profile updated:", {
      id: updatedUser._id,
      name: updatedUser.name,
      phoneNumber: updatedUser.phoneNumber,
      profilePicture: updatedUser.profilePicture,
      twoFAEnabled: updatedUser.twoFAEnabled,
      timestamp: new Date().toISOString(),
    });
    res.json(updatedUser);
  } catch (err) {
    console.error("[PUT /profile] Error:", {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    });
    if (err.code === 11000 && err.keyPattern.phoneNumber) {
      return res.status(400).json({ message: "Phone number is already in use" });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// Get all doctors

router.get("/doctors", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[GET /doctors] Unauthorized: No user ID", { timestamp: new Date().toISOString() });
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }

    const doctors = await User.find({ role: "doctor" }).select(
      "_id name specialization profilePicture availability"
    );
    console.log("[GET /doctors] Fetched:", {
      count: doctors.length,
      ids: doctors.map((d) => d._id.toString()),
      timestamp: new Date().toISOString(),
    });

    if (!doctors || doctors.length === 0) {
      console.warn("[GET /doctors] No doctors found", { timestamp: new Date().toISOString() });
      return res.status(404).json({ message: "No doctors found" });
    }

    res.json(doctors);
  } catch (err) {
    console.error("[GET /doctors] Error:", {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({ message: "Server error" });
  }
});
// Get specific doctor by ID
router.get("/doctors/:id", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[GET /doctors/:id] Unauthorized: No user ID", { timestamp: new Date().toISOString() });
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }

    const doctorId = req.params.id;
    console.log("[GET /doctors/:id] Fetching doctor with ID:", doctorId, { timestamp: new Date().toISOString() });

    // Validate ObjectId format
    if (!doctorId.match(/^[0-9a-fA-F]{24}$/)) {
      console.error("[GET /doctors/:id] Invalid ObjectId format:", doctorId, { timestamp: new Date().toISOString() });
      return res.status(400).json({ message: "Invalid doctor ID format" });
    }

    const doctor = await User.findById(doctorId).select(
      "name specialization profilePicture availability role"
    );
    if (!doctor) {
      console.error("[GET /doctors/:id] Doctor not found for ID:", doctorId, { timestamp: new Date().toISOString() });
      return res.status(404).json({ message: "Doctor not found" });
    }
    if (doctor.role !== "doctor") {
      console.error("[GET /doctors/:id] Not a doctor:", {
        id: doctorId,
        role: doctor.role,
        timestamp: new Date().toISOString(),
      });
      return res.status(404).json({ message: "Doctor not found" });
    }

    console.log("[GET /doctors/:id] Success:", {
      id: doctor._id,
      name: doctor.name,
      timestamp: new Date().toISOString(),
    });
    res.json(doctor);
  } catch (err) {
    console.error("[GET /doctors/:id] Error:", {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    });
    if (err.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid doctor ID format" });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// Send appointment request
router.post("/appointment/request", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[POST /appointment/request] Unauthorized: No user ID", { timestamp: new Date().toISOString() });
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }

    const { doctorId, date, time, reason } = req.body;
    console.log("[POST /appointment/request] Received:", {
      doctorId,
      date,
      time,
      reason,
      patientId: req.user.id,
      timestamp: new Date().toISOString(),
    });

    if (!doctorId || !date || !time || !reason) {
      console.error("[POST /appointment/request] Validation failed: All fields required", { timestamp: new Date().toISOString() });
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!doctorId.match(/^[0-9a-fA-F]{24}$/)) {
      console.error("[POST /appointment/request] Invalid doctorId format:", doctorId, { timestamp: new Date().toISOString() });
      return res.status(400).json({ message: "Invalid doctor ID format" });
    }

    if (!moment(date, "YYYY-MM-DD", true).isValid()) {
      console.error("[POST /appointment/request] Invalid date format:", date, { timestamp: new Date().toISOString() });
      return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
    }

    if (!moment(time, "HH:mm", true).isValid()) {
      console.error("[POST /appointment/request] Invalid time format:", time, { timestamp: new Date().toISOString() });
      return res.status(400).json({ message: "Invalid time format. Use HH:mm" });
    }

    const doctor = await User.findById(doctorId).select("availability role name");
    if (!doctor || doctor.role !== "doctor") {
      console.error("[POST /appointment/request] Doctor not found:", doctorId, { timestamp: new Date().toISOString() });
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Check if doctor is available on the selected day
    const selectedDate = moment(date);
    const dayOfWeek = selectedDate.format("dddd");
    if (!doctor.availability?.days?.includes(dayOfWeek)) {
      console.error("[POST /appointment/request] Doctor not available on:", dayOfWeek, { timestamp: new Date().toISOString() });
      return res.status(400).json({ message: `Doctor not available on ${dayOfWeek}` });
    }

    // Check if time is within doctor's availability
    const startTime = moment(`${date} ${doctor.availability.startTime}`, "YYYY-MM-DD HH:mm");
    const endTime = moment(`${date} ${doctor.availability.endTime}`, "YYYY-MM-DD HH:mm");
    const requestedTime = moment(`${date} ${time}`, "YYYY-MM-DD HH:mm");
    const slotEndTime = requestedTime.clone().add(30, "minutes");

    if (
      !requestedTime.isValid() ||
      !requestedTime.isSameOrAfter(startTime) ||
      !slotEndTime.isSameOrBefore(endTime)
    ) {
      console.error("[POST /appointment/request] Time outside availability:", {
        requestedTime: time,
        startTime: doctor.availability.startTime,
        endTime: doctor.availability.endTime,
        timestamp: new Date().toISOString(),
      });
      return res.status(400).json({ message: "Requested time is outside doctor's availability" });
    }

    // Check if the slot is already booked (has an accepted appointment)
    const existingAppointment = await AppointmentRequest.findOne({
      doctor: doctorId,
      date: selectedDate.format("YYYY-MM-DD"),
      time,
      status: "accepted",
    });

    if (existingAppointment) {
      console.error("[POST /appointment/request] Slot already booked:", { doctorId, date, time, timestamp: new Date().toISOString() });
      return res.status(400).json({ message: "This time slot is already booked" });
    }

    const patient = await User.findById(req.user.id).select("name");
    if (!patient) {
      console.error("[POST /appointment/request] Patient not found:", req.user.id, { timestamp: new Date().toISOString() });
      return res.status(404).json({ message: "Patient not found" });
    }

    const appointmentRequest = new AppointmentRequest({
      patient: req.user.id,
      doctor: doctorId,
      date: selectedDate.format("YYYY-MM-DD"),
      time,
      reason,
      status: "pending",
    });

    const savedRequest = await appointmentRequest.save();

    // Create notification for doctor
    const Notification = req.app.get("Notification");
    const io = req.app.get("io");

    const doctorNotification = new Notification({
      userId: doctorId,
      message: `New appointment request from ${patient.name}`,
      type: "appointment_request",
      appointmentId: savedRequest._id,
    });
    await doctorNotification.save();

    // Emit to doctor
    console.log("[POST /appointment/request] Emitting newAppointmentRequest to doctor:", {
      userId: doctorId,
      notificationId: doctorNotification._id,
      timestamp: new Date().toISOString(),
    });
    io.to(doctorId.toString()).emit("newAppointmentRequest", {
      _id: savedRequest._id,
      patient: { name: patient.name },
      date: savedRequest.date,
      time: savedRequest.time,
      reason: savedRequest.reason,
      notificationId: doctorNotification._id,
    });

    // Create notification for patient
    const patientNotification = new Notification({
      userId: req.user.id,
      message: `Your appointment request to Dr. ${doctor.name} has been sent`,
      type: "appointment_request",
      appointmentId: savedRequest._id,
    });
    await patientNotification.save();

    // Emit to patient
    console.log("[POST /appointment/request] Emitting appointmentRequestSent to patient:", {
      userId: req.user.id,
      notificationId: patientNotification._id,
      timestamp: new Date().toISOString(),
    });
    io.to(req.user.id.toString()).emit("appointmentRequestSent", {
      requestId: savedRequest._id,
      message: patientNotification.message,
      notificationId: patientNotification._id,
      createdAt: patientNotification.createdAt,
    });

    console.log("[POST /appointment/request] Saved:", {
      id: savedRequest._id,
      doctorId,
      patientId: req.user.id,
      status: savedRequest.status,
      timestamp: new Date().toISOString(),
    });
    res.json({ message: "Appointment request sent successfully", requestId: savedRequest._id });
  } catch (err) {
    console.error("[POST /appointment/request] Error:", {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    });
    if (err.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid doctor ID format" });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// Update appointment status (for doctors)
router.put("/appointments/:id/status", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[PUT /appointments/:id/status] Unauthorized: No user ID", { timestamp: new Date().toISOString() });
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }

    const appointmentId = req.params.id;
    const { status } = req.body;
    console.log("[PUT /appointments/:id/status] Received:", {
      appointmentId,
      status,
      userId: req.user.id,
      timestamp: new Date().toISOString(),
    });

    if (!appointmentId.match(/^[0-9a-fA-F]{24}$/)) {
      console.error("[PUT /appointments/:id/status] Invalid appointmentId format:", appointmentId, { timestamp: new Date().toISOString() });
      return res.status(400).json({ message: "Invalid appointment ID format" });
    }

    if (!["accepted", "rejected"].includes(status)) {
      console.error("[PUT /appointments/:id/status] Invalid status:", status, { timestamp: new Date().toISOString() });
      return res.status(400).json({ message: "Invalid status. Use: accepted, rejected" });
    }

    const appointment = await AppointmentRequest.findById(appointmentId).populate("doctor", "name");
    if (!appointment) {
      console.error("[PUT /appointments/:id/status] Appointment not found:", appointmentId, { timestamp: new Date().toISOString() });
      return res.status(404).json({ message: "Appointment not found" });
    }

    // Ensure only the assigned doctor can update status
    if (req.user.role !== "doctor" || appointment.doctor._id.toString() !== req.user.id) {
      console.error("[PUT /appointments/:id/status] Unauthorized: Not the assigned doctor", {
        userId: req.user.id,
        role: req.user.role,
        doctorId: appointment.doctor._id,
        timestamp: new Date().toISOString(),
      });
      return res.status(403).json({ message: "Unauthorized: Only the assigned doctor can update this appointment" });
    }

    appointment.status = status;
    const updatedAppointment = await appointment.save();

    // Create notification for patient
    const Notification = req.app.get("Notification");
    const io = req.app.get("io");

    const patientNotification = new Notification({
      userId: appointment.patient,
      message: `Your appointment with Dr. ${appointment.doctor.name} has been ${status}`,
      type: `appointment_${status}`,
      appointmentId: appointment._id,
    });
    await patientNotification.save();

    // Emit to patient
    console.log("[PUT /appointments/:id/status] Emitting appointmentUpdate to patient:", {
      userId: appointment.patient.toString(),
      notificationId: patientNotification._id,
      status,
      timestamp: new Date().toISOString(),
    });
    io.to(appointment.patient.toString()).emit("appointmentUpdate", {
      notificationId: patientNotification._id,
      requestId: appointment._id,
      status,
      message: patientNotification.message,
      createdAt: patientNotification.createdAt,
    });

    console.log("[PUT /appointments/:id/status] Updated:", {
      id: updatedAppointment._id,
      status: updatedAppointment.status,
      patientId: appointment.patient,
      doctorId: appointment.doctor._id,
      timestamp: new Date().toISOString(),
    });
    res.json(updatedAppointment);
  } catch (err) {
    console.error("[PUT /appointments/:id/status] Error:", {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    });
    if (err.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid appointment ID format" });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// Get all appointment requests for the patient with filters
router.get("/appointments", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[GET /appointments] Unauthorized: No user ID", { timestamp: new Date().toISOString() });
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }

    const { time, status, doctorId } = req.query;
    console.log("[GET /appointments] Query params:", { time, status, doctorId, timestamp: new Date().toISOString() });

    // Build query
    const query = { patient: req.user.id };

    // Time filter
    if (time) {
      let dateThreshold;
      const now = new Date();
      switch (time.toLowerCase()) {
        case "3days":
          dateThreshold = new Date(now.setDate(now.getDate() - 3));
          break;
        case "week":
          dateThreshold = new Date(now.setDate(now.getDate() - 7));
          break;
        case "15days":
          dateThreshold = new Date(now.setDate(now.getDate() - 15));
          break;
        case "month":
          dateThreshold = new Date(now.setMonth(now.getMonth() - 1));
          break;
        default:
          console.warn("[GET /appointments] Invalid time filter:", time, { timestamp: new Date().toISOString() });
          return res.status(400).json({ message: "Invalid time filter. Use: 3days, week, 15days, month" });
      }
      query.createdAt = { $gte: dateThreshold };
      console.log("[GET /appointments] Time filter applied:", { dateThreshold, timestamp: new Date().toISOString() });
    }

    // Status filter
    if (status) {
      if (!["accepted", "rejected", "pending"].includes(status.toLowerCase())) {
        console.warn("[GET /appointments] Invalid status filter:", status, { timestamp: new Date().toISOString() });
        return res.status(400).json({ message: "Invalid status filter. Use: accepted, rejected, pending" });
      }
      query.status = status.toLowerCase();
      console.log("[GET /appointments] Status filter applied:", { status, timestamp: new Date().toISOString() });
    }

    // Doctor filter
    if (doctorId) {
      if (!doctorId.match(/^[0-9a-fA-F]{24}$/)) {
        console.error("[GET /appointments] Invalid doctorId format:", doctorId, { timestamp: new Date().toISOString() });
        return res.status(400).json({ message: "Invalid doctor ID format" });
      }
      query.doctor = doctorId;
      console.log("[GET /appointments] Doctor filter applied:", { doctorId, timestamp: new Date().toISOString() });
    }

    console.log("[GET /appointments] Query:", JSON.stringify(query, null, 2), { timestamp: new Date().toISOString() });

    const appointments = await AppointmentRequest.find(query)
      .populate("doctor", "name")
      .sort({ createdAt: -1 });

    console.log("[GET /appointments] Fetched:", {
      count: appointments.length,
      patientId: req.user.id,
      filters: { time, status, doctorId },
      appointments: appointments.map((a) => ({
        id: a._id,
        status: a.status,
        doctorId: a.doctor?._id,
        doctorName: a.doctor?.name,
        createdAt: a.createdAt,
      })),
      timestamp: new Date().toISOString(),
    });

    res.json(appointments);
  } catch (err) {
    console.error("[GET /appointments] Error:", {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    });
    if (err.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid doctor ID format" });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// Get available slots for a doctor on a specific date
router.get("/doctors/:id/slots", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[GET /doctors/:id/slots] Unauthorized: No user ID", { timestamp: new Date().toISOString() });
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }

    const doctorId = req.params.id;
    const { date } = req.query; // Expect date in YYYY-MM-DD format
    console.log("[GET /doctors/:id/slots] Received:", { doctorId, date, timestamp: new Date().toISOString() });

    if (!date || !moment(date, "YYYY-MM-DD", true).isValid()) {
      console.error("[GET /doctors/:id/slots] Invalid date format:", date, { timestamp: new Date().toISOString() });
      return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
    }

    if (!doctorId.match(/^[0-9a-fA-F]{24}$/)) {
      console.error("[GET /doctors/:id/slots] Invalid doctorId format:", doctorId, { timestamp: new Date().toISOString() });
      return res.status(400).json({ message: "Invalid doctor ID format" });
    }

    const doctor = await User.findById(doctorId).select("availability role name");
    if (!doctor || doctor.role !== "doctor") {
      console.error("[GET /doctors/:id/slots] Doctor not found:", doctorId, { timestamp: new Date().toISOString() });
      return res.status(404).json({ message: "Doctor not found" });
    }

    const selectedDate = moment(date);
    const dayOfWeek = selectedDate.format("dddd");
    if (!doctor.availability?.days?.includes(dayOfWeek)) {
      console.warn("[GET /doctors/:id/slots] Doctor not available on:", dayOfWeek, { timestamp: new Date().toISOString() });
      return res.status(400).json({ message: `Doctor not available on ${dayOfWeek}` });
    }

    // Parse start and end times
    const startTime = moment(`${date} ${doctor.availability.startTime}`, "YYYY-MM-DD HH:mm");
    const endTime = moment(`${date} ${doctor.availability.endTime}`, "YYYY-MM-DD HH:mm");

    if (!startTime.isValid() || !endTime.isValid()) {
      console.error("[GET /doctors/:id/slots] Invalid time format:", {
        startTime: doctor.availability.startTime,
        endTime: doctor.availability.endTime,
        timestamp: new Date().toISOString(),
      });
      return res.status(400).json({ message: "Invalid time format in doctor availability" });
    }

    // Generate 30-minute slots
    const slots = [];
    let currentTime = startTime.clone();
    while (currentTime.isBefore(endTime) && currentTime.clone().add(30, "minutes").isSameOrBefore(endTime)) {
      slots.push({
        start: currentTime.format("HH:mm"),
        end: currentTime.clone().add(30, "minutes").format("HH:mm"),
      });
      currentTime.add(30, "minutes");
    }

    // Fetch booked slots for the doctor on the selected date
    const bookedAppointments = await AppointmentRequest.find({
      doctor: doctorId,
      date: selectedDate.format("YYYY-MM-DD"),
      status: "accepted",
    }).select("time");

    const bookedTimes = bookedAppointments.map((appt) => appt.time);

    // Filter out booked slots
    const availableSlots = slots.filter((slot) => !bookedTimes.includes(slot.start));

    console.log("[GET /doctors/:id/slots] Generated:", {
      doctorId,
      date,
      totalSlots: slots.length,
      availableSlots: availableSlots.length,
      bookedTimes,
      timestamp: new Date().toISOString(),
    });

    res.json(availableSlots);
  } catch (err) {
    console.error("[GET /doctors/:id/slots] Error:", {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    });
    if (err.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid doctor ID format" });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// Get patient notifications
router.get("/notifications", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[GET /notifications] Unauthorized: No user ID", { timestamp: new Date().toISOString() });
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }

    const Notification = req.app.get("Notification");
    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50); // Limit to recent 50 notifications

    console.log("[GET /notifications] Fetched:", {
      count: notifications.length,
      patientId: req.user.id,
      timestamp: new Date().toISOString(),
    });

    res.json(notifications);
  } catch (err) {
    console.error("[GET /notifications] Error:", {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({ message: "Server error" });
  }
});

// Mark a notification as read
router.put("/notifications/:id/read", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[PUT /notifications/:id/read] Unauthorized: No user ID", { timestamp: new Date().toISOString() });
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }

    const notificationId = req.params.id;
    console.log("[PUT /notifications/:id/read] Marking notification as read:", notificationId, { timestamp: new Date().toISOString() });

    // Validate ObjectId format
    if (!notificationId.match(/^[0-9a-fA-F]{24}$/)) {
      console.error("[PUT /notifications/:id/read] Invalid notification ID format:", notificationId, { timestamp: new Date().toISOString() });
      return res.status(400).json({ message: "Invalid notification ID format" });
    }

    const Notification = req.app.get("Notification");
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      console.error("[PUT /notifications/:id/read] Notification not found:", notificationId, { timestamp: new Date().toISOString() });
      return res.status(404).json({ message: "Notification not found" });
    }

    // Ensure the notification belongs to the user
    if (notification.userId.toString() !== req.user.id) {
      console.error("[PUT /notifications/:id/read] Unauthorized: Notification does not belong to user:", {
        notificationId,
        userId: req.user.id,
        timestamp: new Date().toISOString(),
      });
      return res.status(403).json({ message: "Unauthorized: You cannot mark this notification as read" });
    }

    // Check if already read to avoid unnecessary updates
    if (notification.read) {
      console.log("[PUT /notifications/:id/read] Notification already read:", notificationId, { timestamp: new Date().toISOString() });
      return res.json(notification);
    }

    notification.read = true;
    const updatedNotification = await notification.save();

    console.log("[PUT /notifications/:id/read] Notification marked as read:", {
      id: updatedNotification._id,
      userId: req.user.id,
      timestamp: new Date().toISOString(),
    });

    res.json(updatedNotification);
  } catch (err) {
    console.error("[PUT /notifications/:id/read] Error:", {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    });
    if (err.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid notification ID format" });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// Mark all notifications as read
router.put("/notifications/read-all", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[PUT /notifications/read-all] Unauthorized: No user ID", { timestamp: new Date().toISOString() });
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }

    const Notification = req.app.get("Notification");
    const result = await Notification.updateMany(
      { userId: req.user.id, read: false },
      { $set: { read: true } }
    );

    console.log("[PUT /notifications/read-all] Notifications marked as read:", {
      userId: req.user.id,
      modifiedCount: result.modifiedCount,
      timestamp: new Date().toISOString(),
    });

    res.json({ message: `${result.modifiedCount} notifications marked as read` });
  } catch (err) {
    console.error("[PUT /notifications/read-all] Error:", {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({ message: "Server error" });
  }
});




module.exports = router;