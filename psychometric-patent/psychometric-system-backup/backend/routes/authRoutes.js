const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

// Rate limiter for authentication endpoints (calibrated for 150 campus pilot candidates sharing a single NAT IP)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 2000, // Accommodates 150+ concurrent campus candidates
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many authentication attempts from this IP. Please try again after 15 minutes."
    }
});

// Public endpoints
router.post("/register", authLimiter, authController.register);
router.post("/login", authLimiter, authController.login);

// Authenticated user endpoints
router.get("/me", authMiddleware, authController.getMe);
router.put("/profile", authMiddleware, authController.updateProfile);
router.post("/change-password", authMiddleware, authController.changePassword);

module.exports = router;