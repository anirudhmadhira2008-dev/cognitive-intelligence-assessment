const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController");
const authMiddleware = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/rbacMiddleware");

// All admin routes strictly require authentication and admin or evaluator role
router.use(authMiddleware);
router.use(authorize("admin", "evaluator"));

router.get("/overview", adminController.getOverview);
router.get("/candidates", adminController.getCandidates);
router.get("/sessions", adminController.getSessions);
router.get("/sessions/:id", adminController.getSessionDetail);

// Research & Cohort Analytics (Phase 6)
router.get("/analytics/cohorts", adminController.getCohortAnalytics);
router.get("/analytics/proctoring", adminController.getProctoringAnalytics);
router.get("/export", adminController.exportResearchData);
router.get("/examiner/attempts", adminController.getExaminerAttempts);
router.post("/examiner/attempt/:id/review", adminController.reviewExaminerAttempt);

// Admin-only actions
router.patch("/candidates/:id/status", authorize("admin"), adminController.updateCandidateStatus);
router.post("/seed-questions", authorize("admin"), adminController.seedQuestions);
router.get("/questions", adminController.listQuestions);
router.post("/questions", authorize("admin"), adminController.createQuestion);
router.get("/audit-logs", adminController.getAuditLogs);

module.exports = router;

