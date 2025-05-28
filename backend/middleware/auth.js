const jwt = require("jsonwebtoken");

const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  console.log("[AUTH] Token:", token ? token.slice(0, 20) + "..." : "No token");
  if (!token) {
    console.error("[AUTH] No token provided");
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("[AUTH] Decoded:", decoded);
    req.user = decoded; // { id, role }
    console.log("[AUTH] Set req.user:", req.user);
    if (!req.user.id) {
      console.error("[AUTH] req.user.id missing:", req.user);
      return res.status(401).json({ message: "Invalid token: missing user ID" });
    }
    next();
  } catch (err) {
    console.error("[AUTH] Invalid token:", err.message);
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

module.exports = { authenticateToken };


// const authenticateToken = (req, res, next) => {
//   console.log("[AUTH] Mocking authentication for testing");
//   req.user = {
//     id: "6821f1a1519b027cd6049668", // P1's ID
//     role: "patient",
//   };
//   console.log("[AUTH] Set req.user:", req.user);
//   next();
// };

// module.exports = { authenticateToken };