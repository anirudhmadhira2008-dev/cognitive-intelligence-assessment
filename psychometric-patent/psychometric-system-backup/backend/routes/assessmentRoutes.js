const express = require("express");
const router = express.Router();

const assessmentController = require("../controllers/assessmentController");
const authMiddleware = require("../middleware/authMiddleware");

// Assessment session lifecycle endpoints
router.post("/start", authMiddleware, assessmentController.startSession);
router.get("/next-question", authMiddleware, assessmentController.getNextQuestion);
router.post("/answer", authMiddleware, assessmentController.recordAnswer);
router.post("/progress", authMiddleware, assessmentController.recordProgress);
router.post("/verify-answer", authMiddleware, assessmentController.verifyAnswer);
router.get("/voice-questions", authMiddleware, assessmentController.getVoicePrompts);

// Submission and session history
router.post("/submit", authMiddleware, assessmentController.submitSession);
router.post("/sessions", authMiddleware, assessmentController.submitSession);
router.get("/sessions/my", authMiddleware, assessmentController.getMySessions);
router.get("/sessions/:id", authMiddleware, assessmentController.getSessionById);

// Test Definitions & Aggregate Analytics (Phase-3)
router.get("/tests", authMiddleware, assessmentController.getTestDefinitions);
router.get("/tests/:testId", authMiddleware, assessmentController.getTestDefinitionById);
router.post("/tests", authMiddleware, assessmentController.createOrUpdateTestDefinition);
router.get("/aggregate/:testId", authMiddleware, assessmentController.getTestAggregateResults);

// Backward compatibility route
router.get("/sessions", authMiddleware, (req, res) => {
    return assessmentController.getMySessions(req, res);
});

module.exports = router;

