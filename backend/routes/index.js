// const express = require("express");
// const router = express.Router();
// const emailRoutes = require("./emailRoutes");
// const userRoutes = require("./userRoutes");
// const authRoutes = require("./authRoutes"); // Fixed: Use 'auth' assuming file is auth.js
// const doctorRoutes = require("./doctorRoutes");
// const patientRoutes = require("./patientRoutes");
// const { authenticateToken } = require("../middleware/auth");

// console.log("Mounting routes: auth, email, user, doctor");

// // Public routes
// router.use("/auth", authRoutes);
// router.use("/email", emailRoutes);

// // Protected routes
// router.use("/user", authenticateToken, userRoutes);
// router.use("/doctor", authenticateToken, doctorRoutes);
// router.use("/patient", authenticateToken, patientRoutes);


// router.get("/", (req, res) => {
//   res.send("Auth API root - working!");
// });

// module.exports = router;

const express = require("express");
const router = express.Router();
const emailRoutes = require("./emailRoutes");
const userRoutes = require("./userRoutes");
const authRoutes = require("./authRoutes");
const doctorRoutes = require("./doctorRoutes");
const patientRoutes = require("./patientRoutes");
const messageRoutes = require("./messageRoutes");
const { authenticateToken } = require("../middleware/auth");

console.log("Mounting routes: auth, email, user, doctor, patient, message");

// Public routes
router.use("/auth", authRoutes);
router.use("/email", emailRoutes);

// Protected routes
router.use("/user", authenticateToken, userRoutes);
router.use("/doctor", authenticateToken, doctorRoutes);
router.use("/patient", authenticateToken, patientRoutes);
router.use("/messages", authenticateToken, messageRoutes);

router.get("/", (req, res) => {
  res.send("Auth API root - working!");
});

module.exports = router;