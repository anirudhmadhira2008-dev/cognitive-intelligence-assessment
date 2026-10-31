const express = require("express");
const multer = require("multer");
const router = express.Router();

const enrollmentController = require("../controllers/enrollmentController");
const authMiddleware = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/rbacMiddleware");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

router.use(authMiddleware);

// Candidate & Assessment Enrollment routes
router.get("/my", enrollmentController.getMyEnrollments);
router.get("/my-enrollments", enrollmentController.getMyEnrollments);
router.get("/reference-image/:key", enrollmentController.getReferenceImage);
router.get("/:id", enrollmentController.getEnrollmentById);
router.post("/:id/identity-photo", upload.single("photo"), enrollmentController.uploadIdentityPhoto);
router.post("/:id/verify-identity", enrollmentController.verifyIdentity);
router.post("/:id/manual-approve", authorize("admin", "evaluator"), enrollmentController.approveEnrollment);

// Candidate or Admin assessment enrollment creation
router.post("/create", enrollmentController.createEnrollment);

module.exports = router;
