const express = require("express");
const router = express.Router();

const resultController = require("../controllers/resultController");
const authMiddleware = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/rbacMiddleware");

// Candidate personal results
router.get("/my", authMiddleware, resultController.getMyResults);
router.get("/detail/:id", authMiddleware, resultController.getResultById);
router.get("/performance-analysis", authMiddleware, require("../controllers/reportController").getPerformanceAnalysis);

// Compatibility add endpoint
router.post("/add", authMiddleware, resultController.addResult);

// Administrative / Evaluator access to all results
router.get("/all", authMiddleware, authorize("admin", "evaluator"), resultController.getAllResults);

// Legacy GET / route
router.get("/", authMiddleware, (req, res) => {
    if (req.user.role === "admin" || req.user.role === "evaluator") {
        return resultController.getAllResults(req, res);
    }
    return resultController.getMyResults(req, res);
});

module.exports = router;
