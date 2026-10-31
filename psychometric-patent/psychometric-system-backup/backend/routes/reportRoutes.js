const express = require("express");
const router = express.Router();

const reportController = require("../controllers/reportController");
const authMiddleware = require("../middleware/authMiddleware");

// 1. Digital Signature Verification (Publicly accessible for 3rd-party verification)
router.post("/verify", reportController.verifyReport);
router.get("/public-keys", reportController.getPublicKeys);

// 2. Performance Analysis (Authenticated Candidate / Admin)
router.get("/performance-analysis", authMiddleware, reportController.getPerformanceAnalysis);

// 3. Overall Assessment Report Lifecycle
router.post("/generate/:sessionId", authMiddleware, reportController.generateReport);
router.get("/my", authMiddleware, reportController.getMyReports);
router.get("/:id/download", authMiddleware, reportController.downloadReportJson);
router.get("/:id", authMiddleware, reportController.getReportById);

module.exports = router;
