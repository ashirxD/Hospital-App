const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose"); 
const moment = require("moment");
const User = require("../models/User");
// AppointmentRequest model removed, use Appointment only
const Notification = require("../models/Notification");
const Appointment = require("../models/Appointment");
const Review = require("../models/Review");

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
const handleMulterError = (err, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error("[multerError]", {
      message: err.message,
      code: err.code,
      field: err.field,
      timestamp: new Date().toISOString(),
    });
    return res.status(400).json({ message: err.message });
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
    const user = await User.findById(req.user.id).select("-passwordHash -otp -otpExpires");
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
    } else if (req.body.profilePicture === "null") {
      updateData.profilePicture = null;
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
    ).select("-passwordHash -otp -otpExpires");

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
    console.log("[GET /doctors/:id] Fetching doctor:", doctorId, { timestamp: new Date().toISOString() });

    if (!doctorId.match(/^[0-9a-fA-F]{24}$/)) {
      console.error("[GET /doctors/:id] Invalid ObjectId format:", doctorId, { timestamp: new Date().toISOString() });
      return res.status(400).json({ message: "Invalid doctor ID format" });
    }

    const doctor = await User.findById(doctorId).select(
      "name specialization profilePicture availability role"
    );
    if (!doctor || doctor.role !== "doctor") {
      console.error("[GET /doctors/:id] Doctor not found:", doctorId, { timestamp: new Date().toISOString() });
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

// Get available slots for a doctor
router.get("/doctors/:id/slots", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[GET /doctors/:id/slots] Unauthorized: No user ID", { timestamp: new Date().toISOString() });
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }

    const doctorId = req.params.id;
    const { date } = req.query;
    console.log("[GET /doctors/:id/slots] Fetching slots:", { doctorId, date, timestamp: new Date().toISOString() });

    if (!doctorId.match(/^[0-9a-fA-F]{24}$/)) {
      console.error("[GET /doctors/:id/slots] Invalid doctorId format:", doctorId, { timestamp: new Date().toISOString() });
      return res.status(400).json({ message: "Invalid doctor ID format" });
    }

    if (!date || !moment(date, "YYYY-MM-DD", true).isValid()) {
      console.error("[GET /doctors/:id/slots] Invalid date format:", date, { timestamp: new Date().toISOString() });
      return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
    }

    // Only allow today or future dates for slots
    const today = moment().startOf("day");
    const selectedDate = moment(date, "YYYY-MM-DD");
    if (selectedDate.isBefore(today, 'day')) {
      console.warn("[GET /doctors/:id/slots] Attempt to fetch slots for past date:", { date, today: today.format("YYYY-MM-DD") });
      return res.status(400).json({ message: "Cannot fetch slots for past dates" });
    }


    const doctor = await User.findById(doctorId).select("availability role");
    if (!doctor || doctor.role !== "doctor") {
      console.error("[GET /doctors/:id/slots] Doctor not found:", doctorId, { timestamp: new Date().toISOString() });
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Check if doctor is available on the selected day
    const dayOfWeek = selectedDate.format("dddd");
    if (!doctor.availability.days?.includes(dayOfWeek)) {
      console.log("[GET /doctors/:id/slots] Doctor not available on:", dayOfWeek, { timestamp: new Date().toISOString() });
      return res.json([]); // Return empty array if doctor not available
    }

    // Generate slots based on doctor's availability
    const startTime = moment(`${date} ${doctor.availability.startTime}`, "YYYY-MM-DD HH:mm");
    const endTime = moment(`${date} ${doctor.availability.endTime}`, "YYYY-MM-DD HH:mm");
    const slots = [];
    const slotDuration = 30; // 30 minutes per slot

    let currentTime = startTime.clone();
    while (currentTime.add(slotDuration, "minutes").isSameOrBefore(endTime)) {
      const slotStart = currentTime.clone().subtract(slotDuration, "minutes");
      const slotEnd = currentTime.clone();

      // Check if slot is already booked
      const bookedAppointment = await Appointment.findOne({
        doctor: doctorId,
        date: selectedDate.format("YYYY-MM-DD"),
        time: slotStart.format("HH:mm"),
        status: "accepted",
      });

      if (!bookedAppointment) {
        slots.push({
          start: slotStart.format("HH:mm"),
          end: slotEnd.format("HH:mm"),
        });
      }
    }

    console.log("[GET /doctors/:id/slots] Generated slots:", {
      count: slots.length,
      date,
      doctorId,
      timestamp: new Date().toISOString(),
    });
    res.json(slots);
  } catch (err) {
    console.error("[GET /doctors/:id/slots] Error:", {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    });
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
    if (!doctor.availability.days?.includes(dayOfWeek)) {
      console.error("[POST /appointment/request] Doctor not available on:", dayOfWeek, { timestamp: new Date().toISOString() });
      return res.status(400).json({ message: `Doctor not available on ${dayOfWeek}` });
    }

    // Check if time is within doctor's availability
    const startTime = moment(`${date} ${doctor.availability.startTime}`, "YYYY-MM-DD HH:mm");
    const endTime = moment(`${date} ${doctor.availability.endTime}`, "YYYY-MM-DD HH:mm");
    const requestedTime = moment(`${date} ${time}`, "YYYY-MM-DD HH:mm");
    const slotEndTime = requestedTime.clone().add(30, "minutes");

    if (!requestedTime.isValid() || !requestedTime.isSameOrAfter(startTime) || !slotEndTime.isSameOrBefore(endTime)) {
      console.error("[POST /appointment/request] Time outside availability:", {
        requestedTime: time,
        startTime: doctor.availability.startTime,
        endTime: doctor.availability.endTime,
        timestamp: new Date().toISOString(),
      });
      return res.status(400).json({ message: "Requested time is outside doctor's availability" });
    }

    // Check if the slot is already booked
    const bookedAppointment = await Appointment.findOne({
      doctor: doctorId,
      date: selectedDate.format("YYYY-MM-DD"),
      time,
      status: "accepted",
    });

    if (bookedAppointment) {
      console.error("[POST /appointment/request] Slot already booked:", {
        doctorId,
        date,
        time,
        timestamp: new Date().toISOString(),
      });
      return res.status(400).json({ message: "This time slot is already booked" });
    }

    const patient = await User.findById(req.user.id).select("name");
    if (!patient) {
      console.error("[POST /appointment/request] Patient not found:", req.user.id, { timestamp: new Date().toISOString() });
      return res.status(404).json({ message: "Patient not found" });
    }

    const appointment = new Appointment({
      patient: req.user.id,
      doctor: doctorId,
      date: selectedDate.format("YYYY-MM-DD"),
      time,
      reason,
      status: "pending",
    });

    const savedRequest = await appointment.save();

    // Handle notifications in a try-catch block to prevent 500 errors
    try {
      const io = req.app.get("io");
      const Notification = req.app.get("Notification");

      // Create notification for doctor
      const doctorNotification = new Notification({
        userId: doctorId,
        message: `New appointment request from ${patient.name}`,
        appointmentId: savedRequest._id,
        type: "appointment_request",
      });
      await doctorNotification.save();

      // Emit to doctor
      console.log("[Socket.IO] Emitting newAppointmentRequest to doctor:", {
        doctorId,
        notificationId: doctorNotification._id,
        timestamp: new Date().toISOString(),
      });
      io.to(doctorId.toString()).emit("newAppointmentRequest", {
        _id: savedRequest._id,
        patient: { name: patient.name },
        date,
        time,
        reason,
        appointmentId: savedRequest._id,
        notificationId: doctorNotification._id,
        createdAt: doctorNotification.createdAt,
      });

      // Create notification for patient
      const patientNotification = new Notification({
        userId: req.user.id,
        message: `Your appointment request to Dr. ${doctor.name} has been sent`,
        appointmentId: savedRequest._id,
        type: "appointment_request_sent",
      });
      await patientNotification.save();

      // Emit to patient
      console.log("[Socket.IO] Emitting appointmentRequestSent to patient:", {
        patientId: req.user.id,
        notificationId: patientNotification._id,
        timestamp: new Date().toISOString(),
      });
      io.to(req.user.id.toString()).emit("appointmentRequestSent", {
        _id: savedRequest._id,
        message: `Appointment request sent to Dr. ${doctor.name}`,
        appointmentId: savedRequest._id,
        notificationId: patientNotification._id,
        createdAt: patientNotification.createdAt,
      });
    } catch (notificationError) {
      // Log notification error but don't fail the request
      console.error("[POST /appointment/request] Notification error:", {
        message: notificationError.message,
        stack: notificationError.stack,
        timestamp: new Date().toISOString(),
      });
    }

    console.log("[POST /appointment/request] Success:", {
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
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/appointments", async (req, res) => {
    try {
      // Parse filters from query params
      const { timeFilter, statusFilter, doctorFilter, specificDate } = req.query;
      if (!req.user || !req.user.id) {
        console.error("[GET /patient/appointments] Unauthorized: No user ID", {
          timestamp: new Date().toISOString(),
        });
        return res.status(401).json({ message: "Unauthorized: No user ID" });
      }

      // Build MongoDB query
      const query = { patient: req.user.id };
      // Status filter
      if (statusFilter && statusFilter !== "") {
        query.status = statusFilter;
      }
      // Doctor filter
      if (doctorFilter && doctorFilter !== "") {
        query.doctor = doctorFilter;
      }
      // Specific date filter (takes precedence over timeFilter)
      if (specificDate && specificDate !== "") {
        // Expecting format YYYY-MM-DD
        query.date = {
          $gte: new Date(specificDate + 'T00:00:00.000Z'),
          $lte: new Date(specificDate + 'T23:59:59.999Z')
        };
      } else if (timeFilter && timeFilter !== "") {
        const now = new Date();
        let fromDate;
        switch (timeFilter) {
          case "3days":
            fromDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
            break;
          case "week":
            fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "15days":
            fromDate = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
            break;
          case "month":
            fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            fromDate = null;
        }
        if (fromDate) {
          // Appointment date is stored as Date, so compare as Date
          query.date = { $gte: fromDate };
        }
      }

      console.log("[GET /patient/appointments] Fetching appointments for user:", {
        userId: req.user.id,
        query,
        timestamp: new Date().toISOString(),
      });

      const appointments = await Appointment.find(query)
        .populate("patient", "name")
        .populate("doctor", "name specialization")
        .lean();

      console.log("[GET /patient/appointments] Success:", {
        userId: req.user.id,
        count: appointments.length,
        timestamp: new Date().toISOString(),
      });
      return res.json(appointments);
    } catch (err) {
      console.error("[GET /patient/appointments] Error:", {
        message: err.message,
        stack: err.stack,
        userId: req.user?.id,
        timestamp: new Date().toISOString(),
      });
      return res.status(500).json({ message: "Server error" });
    }
  });

// Get specific appointment by ID
router.get("/appointments/:id", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[GET /patient/appointments/:id] Unauthorized: No user ID", {
        timestamp: new Date().toISOString(),
      });
      return res.status(401).json({ message: "Unauthorized: No user ID" });
    }

    const appointmentId = req.params.id;
    console.log("[GET /patient/appointments/:id] Fetching appointment:", {
      appointmentId,
      userId: req.user.id,
      timestamp: new Date().toISOString(),
    });

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      console.error("[GET /patient/appointments/:id] Invalid appointment ID format:", {
        appointmentId,
        userId: req.user.id,
        timestamp: new Date().toISOString(),
      });
      return res.status(400).json({ message: "Invalid appointment ID format" });
    }

    // Fetch appointment with populated fields
    const appointment = await Appointment.findOne({
      _id: appointmentId,
      patient: req.user.id,
    })
      .populate("patient", "name")
      .populate("doctor", "name specialization")
      .lean();

    if (!appointment) {
      console.error("[GET /patient/appointments/:id] Appointment not found:", {
        appointmentId,
        userId: req.user.id,
        timestamp: new Date().toISOString(),
      });
      return res.status(404).json({
        message: `Appointment with ID ${appointmentId} not found`,
        errorCode: "APPOINTMENT_NOT_FOUND",
      });
    }

    // Fetch review if it exists
    const review = await Review.findOne({ appointment: appointmentId })
      .populate("reviewer", "name")
      .lean();

    // Add review to appointment object if it exists
    const appointmentWithReview = {
      ...appointment,
      review: review || null
    };

    // Return appointment data with review
    console.log("[GET /patient/appointments/:id] Success:", {
      appointmentId: appointment._id,
      patientId: req.user.id,
      status: appointment.status,
      hasPrescriptions: appointment.prescriptions?.length > 0,
      hasReview: !!review,
      timestamp: new Date().toISOString(),
    });
    return res.json(appointmentWithReview);
  } catch (err) {
    console.error("[GET /patient/appointments/:id] Error:", {
      message: err.message,
      stack: err.stack,
      appointmentId: req.params.id,
      userId: req.user?.id,
      timestamp: new Date().toISOString(),
    });
    if (err.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid appointment ID format" });
    }
    return res.status(500).json({
      message: process.env.NODE_ENV === "development" ? err.message : "Server error",
      errorCode: "APPOINTMENT_FETCH_FAILED",
    });
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
  
      if (!Types.ObjectId.isValid(appointmentId)) {
        console.error("[PUT /appointments/:id/status] Invalid appointmentId format:", appointmentId, { timestamp: new Date().toISOString() });
        return res.status(400).json({ message: "Invalid appointment ID format" });
      }
  
      if (!["accepted", "rejected", "Attended", "Cancelled", "Absent"].includes(status)) {
        console.error("[PUT /appointments/:id/status] Invalid status:", status, { timestamp: new Date().toISOString() });
        return res.status(400).json({ message: "Invalid status. Use: accepted, rejected, Attended, Cancelled, Absent" });
      }
  
      const appointmentRequest = await AppointmentRequest.findById(appointmentId)
        .populate("doctor", "name")
        .populate("patient", "name");
  
      if (!appointmentRequest) {
        console.error("[PUT /appointments/:id/status] Appointment request not found:", appointmentId, { timestamp: new Date().toISOString() });
        return res.status(404).json({ message: "Appointment request not found" });
      }
  
      // Ensure only the assigned doctor can update status
      if (req.user.role !== "doctor" || appointmentRequest.doctor._id.toString() !== req.user.id) {
        console.error("[PUT /appointments/:id/status] Unauthorized: Not the assigned doctor:", {
          userId: req.user.id,
          role: req.user.role,
          doctorId: appointmentRequest.doctor._id,
          timestamp: new Date().toISOString(),
        });
        return res.status(403).json({ message: "Unauthorized: Only the assigned doctor can update this appointment" });
      }
  
      // Update appointment request status
      appointmentRequest.status = status;
      const updatedRequest = await appointmentRequest.save();
  
      // Handle appointment creation/update
      let appointment = await Appointment.findOne({ appointmentRequest: appointmentId });
      if (status === "accepted" && !appointment) {
        // Create new appointment when accepted
        appointment = new Appointment({
          patient: appointmentRequest.patient._id,
          doctor: appointmentRequest.doctor._id,
          date: appointmentRequest.date,
          time: appointmentRequest.time,
          reason: appointmentRequest.reason,
          status: "accepted",
          prescriptions: [], // Initialize empty prescriptions array
          appointmentRequest: appointmentId,
        });
      } else if (["Attended", "Cancelled", "Absent"].includes(status)) {
        if (!appointment) {
          // Create new appointment if it doesn't exist
          appointment = new Appointment({
            patient: appointmentRequest.patient._id,
            doctor: appointmentRequest.doctor._id,
            date: appointmentRequest.date,
            time: appointmentRequest.time,
            reason: appointmentRequest.reason,
            status,
            prescriptions: [], // Initialize empty prescriptions array
            appointmentRequest: appointmentId,
          });
        } else {
          // Update existing appointment status
          appointment.status = status;
        }
      }
  
      if (appointment) {
        await appointment.save();
        console.log("[PUT /appointments/:id/status] Updated/Created appointment:", {
          appointmentId: appointment._id,
          status,
          timestamp: new Date().toISOString(),
        });
      }
  
      // Create notification for patient
      const patientNotification = new Notification({
        userId: appointmentRequest.patient._id,
        message: `Your appointment with Dr. ${appointmentRequest.doctor.name} has been ${status}`,
        appointmentId: appointmentId,
        type: `appointment_${status.toLowerCase()}`,
      });
      await patientNotification.save();
  
      // Emit to patient
      const io = req.app.get("io");
      console.log("[Socket.IO] Emitting appointmentUpdate to patient:", {
        patientId: appointmentRequest.patient._id,
        notificationId: patientNotification._id,
        timestamp: new Date().toISOString(),
      });
      io.to(appointmentRequest.patient._id.toString()).emit("appointmentUpdate", {
        _id: updatedRequest._id,
        status,
        message: `Appointment with Dr. ${appointmentRequest.doctor.name} ${status}`,
        appointmentId: updatedRequest._id,
        notificationId: patientNotification._id,
        createdAt: patientNotification.createdAt,
      });
  
      console.log("[PUT /appointments/:id/status] Success:", {
        appointmentId: updatedRequest._id,
        status,
        doctorId: req.user.id,
        timestamp: new Date().toISOString(),
      });
      res.json({ message: "Appointment status updated successfully", appointment: updatedRequest });
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

// Submit review for an appointment
router.post("/appointments/:id/review", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[POST /appointments/:id/review] Unauthorized", {
        timestamp: new Date().toISOString(),
      });
      return res.status(401).json({ message: "Unauthorized" });
    }

    const appointmentId = req.params.id;
    const { rating, comment } = req.body;
    console.log("[POST /appointments/:id/review] Attempting to submit review:", {
      appointmentId,
      rating,
      commentLength: comment?.length,
      userId: req.user.id,
      timestamp: new Date().toISOString(),
    });

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      console.error("[POST /appointments/:id/review] Invalid appointment ID format:", {
        appointmentId,
        userId: req.user.id,
        timestamp: new Date().toISOString(),
      });
      return res.status(400).json({ message: "Invalid appointment ID format" });
    }

    if (!rating || rating < 1 || rating > 5) {
      console.error("[POST /appointments/:id/review] Invalid rating:", rating, {
        appointmentId,
        userId: req.user.id,
        timestamp: new Date().toISOString(),
      });
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    if (!comment || !comment.trim()) {
      console.error("[POST /appointments/:id/review] Comment required", {
        appointmentId,
        userId: req.user.id,
        timestamp: new Date().toISOString(),
      });
      return res.status(400).json({ message: "Comment is required" });
    }

    // Find the appointment
    const appointment = await Appointment.findOne({
      _id: appointmentId,
      patient: req.user.id,
    }).populate("doctor", "name");

    if (!appointment) {
      console.error("[POST /appointments/:id/review] Appointment not found", {
        appointmentId,
        userId: req.user.id,
        timestamp: new Date().toISOString(),
      });
      return res.status(404).json({ message: "Appointment not found" });
    }

    // Check if appointment is completed
    if (appointment.status !== "attended" && appointment.status !== "completed") {
      console.error("[POST /appointments/:id/review] Appointment not completed", {
        appointmentId,
        status: appointment.status,
        userId: req.user.id,
        timestamp: new Date().toISOString(),
      });
      return res.status(400).json({ 
        message: "Reviews can only be submitted for completed appointments",
        status: appointment.status 
      });
    }

    // Check if review already exists
    const existingReview = await Review.findOne({ appointment: appointmentId });
    if (existingReview) {
      console.error("[POST /appointments/:id/review] Review already exists", {
        appointmentId,
        userId: req.user.id,
        timestamp: new Date().toISOString(),
      });
      return res.status(400).json({ message: "A review has already been submitted for this appointment" });
    }

    // Create new review
    const review = new Review({
      appointment: appointmentId,
      reviewer: req.user.id,
      reviewee: appointment.doctor._id,
      rating: parseInt(rating),
      comment: comment.trim(),
      createdAt: new Date()
    });

    // Save the review
    await review.save();

    // Update appointment with review reference
    appointment.review = review._id;
    await appointment.save();

    // Handle notifications
    try {
      const io = req.app.get("io");
      const Notification = req.app.get("Notification");

      // Notify doctor
      const doctorNotification = new Notification({
        userId: appointment.doctor._id,
        message: `Patient submitted a ${rating}-star review for your appointment`,
        type: 'review_added',
        appointmentId: appointment._id,
      });
      await doctorNotification.save();

      io.to(appointment.doctor._id.toString()).emit("reviewAdded", {
        appointmentId: appointment._id,
        rating,
        comment,
        message: doctorNotification.message,
        notificationId: doctorNotification._id,
        timestamp: new Date().toISOString(),
      });

      // Notify patient
      const patientNotification = new Notification({
        userId: req.user.id,
        message: `You submitted a ${rating}-star review for your appointment with Dr. ${appointment.doctor.name}`,
        type: 'review_added',
        appointmentId: appointment._id,
      });
      await patientNotification.save();

      io.to(req.user.id.toString()).emit("reviewAdded", {
        appointmentId: appointment._id,
        rating,
        comment,
        message: patientNotification.message,
        notificationId: patientNotification._id,
        timestamp: new Date().toISOString(),
      });
    } catch (notificationError) {
      console.error("[POST /appointments/:id/review] Notification error:", {
        message: notificationError.message,
        stack: notificationError.stack,
        timestamp: new Date().toISOString(),
      });
    }

    console.log('[POST /appointments/:id/review] Success:', {
      appointmentId: appointment._id,
      rating,
      comment,
      userId: req.user.id,
      doctorId: appointment.doctor._id,
      timestamp: new Date().toISOString(),
    });

    // Return success response with the review data
    return res.status(201).json({ 
      message: 'Review submitted successfully', 
      review: {
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt
      }
    });
  } catch (err) {
    console.error('[POST /appointments/:id/review] Error:', {
      message: err.message,
      stack: err.stack,
      appointmentId: req.params.id,
      userId: req.user?.id,
      timestamp: new Date().toISOString(),
    });
    if (err.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid appointment ID format' });
    }
    return res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
});

// Get all appointments for the patient
router.get("/appointments", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[GET /appointments] Unauthorized: No user ID", { timestamp: new Date().toISOString() });
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }

    const { timeFilter, statusFilter, doctorFilter } = req.query;
    console.log("[GET /appointments] Received filters:", {
      timeFilter,
      statusFilter,
      doctorFilter,
      userId: req.user.id,
      timestamp: new Date().toISOString(),
    });

    const query = { patient: req.user.id };

    if (statusFilter) {
      query.status = statusFilter;
    }

    if (doctorFilter && doctorFilter.match(/^[0-9a-fA-F]{24}$/)) {
      query.doctor = doctorFilter;
    }

    if (timeFilter) {
      const now = moment();
      let startDate, endDate;
      switch (timeFilter) {
        case "upcoming":
          startDate = now.startOf("day");
          query.date = { $gte: startDate.format("YYYY-MM-DD") };
          break;
        case "past":
          endDate = now.startOf("day");
          query.date = { $lt: endDate.format("YYYY-MM-DD") };
          break;
        case "today":
          startDate = now.startOf("day");
          endDate = now.endOf("day");
          query.date = {
            $gte: startDate.format("YYYY-MM-DD"),
            $lte: endDate.format("YYYY-MM-DD"),
          };
          break;
        default:
          console.warn("[GET /appointments] Invalid timeFilter:", timeFilter, { timestamp: new Date().toISOString() });
      }
    }

    const appointments = await AppointmentRequest.find(query)
      .populate("doctor", "name specialization")
      .sort({ date: 1, time: 1 });

    console.log("[GET /appointments] Fetched:", {
      count: appointments.length,
      appointmentIds: appointments.map((a) => a._id.toString()),
      timestamp: new Date().toISOString(),
    });
    res.json(appointments);
  } catch (err) {
    console.error("[GET /appointments] Error:", {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({ message: "Server error" });
  }
});

// Get notifications for the patient
router.get("/notifications", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[GET /notifications] Unauthorized: No user ID", { timestamp: new Date().toISOString() });
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }

    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);

    console.log("[GET /notifications] Fetched:", {
      count: notifications.length,
      notificationIds: notifications.map((n) => n._id.toString()),
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

// Mark notification as read
router.put("/notifications/:id/read", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("[PUT /notifications/:id/read] Unauthorized: No user ID", { timestamp: new Date().toISOString() });
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }

    const notificationId = req.params.id;
    console.log("[PUT /notifications/:id/read] Marking as read:", notificationId, { timestamp: new Date().toISOString() });

    if (!notificationId.match(/^[0-9a-fA-F]{24}$/)) {
      console.error("[PUT /notifications/:id/read] Invalid notification ID format:", notificationId, { timestamp: new Date().toISOString() });
      return res.status(400).json({ message: "Invalid notification ID format" });
    }

    const notification = await Notification.findById(notificationId);
    if (!notification) {
      console.error("[PUT /notifications/:id/read] Notification not found:", notificationId, { timestamp: new Date().toISOString() });
      return res.status(404).json({ message: "Notification not found" });
    }

    if (notification.userId.toString() !== req.user.id) {
      console.error("[PUT /notifications/:id/read] Unauthorized: User does not own this notification:", {
        userId: req.user.id,
        notificationId,
        timestamp: new Date().toISOString(),
      });
      return res.status(403).json({ message: "Unauthorized: You do not have access to this notification" });
    }

    notification.read = true;
    await notification.save();

    console.log("[PUT /notifications/:id/read] Success:", {
      notificationId,
      userId: req.user.id,
      timestamp: new Date().toISOString(),
    });
    res.json({ message: "Notification marked as read" });
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

    console.log("[PUT /notifications/read-all] Marking all as read for user:", req.user.id, { timestamp: new Date().toISOString() });

    // First, get count of unread notifications
    const unreadCount = await Notification.countDocuments({ userId: req.user.id, read: false });
    console.log("[PUT /notifications/read-all] Found unread notifications:", unreadCount, { timestamp: new Date().toISOString() });

    if (unreadCount === 0) {
      console.log("[PUT /notifications/read-all] No unread notifications found", { timestamp: new Date().toISOString() });
      return res.json({ message: "No unread notifications to mark as read" });
    }

    // Update all unread notifications
    const result = await Notification.updateMany(
      { userId: req.user.id, read: false },
      { $set: { read: true } }
    );

    console.log("[PUT /notifications/read-all] Success:", {
      userId: req.user.id,
      modifiedCount: result.modifiedCount,
      timestamp: new Date().toISOString(),
    });

    res.json({ 
      message: "All notifications marked as read",
      modifiedCount: result.modifiedCount
    });
  } catch (err) {
    console.error("[PUT /notifications/read-all] Error:", {
      message: err.message,
      stack: err.stack,
      userId: req.user?.id,
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({ 
      message: "Server error",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;