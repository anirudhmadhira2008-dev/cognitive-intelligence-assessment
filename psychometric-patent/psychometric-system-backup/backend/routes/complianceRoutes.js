const express = require("express");
const router = express.Router();
const { getComplianceAudit, purgeOldUploads } = require("../services/mediaRetentionService");
const authMiddleware = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/rbacMiddleware");

/**
 * Public/Candidate Compliance Audit Endpoint
 * Verifies Zero-Data-Egress and EU AI Act Compliance
 */
router.get("/privacy-audit", (_req, res) => {
    try {
        const audit = getComplianceAudit();
        return res.status(200).json(audit);
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve privacy compliance audit",
            error: process.env.NODE_ENV === "development" ? err.message : undefined
        });
    }
});

/**
 * Admin On-Demand Biometric Purge Trigger
 */
router.post("/purge-ephemeral", authMiddleware, authorize("admin"), (_req, res) => {
    try {
        const result = purgeOldUploads();
        return res.status(200).json({
            success: true,
            message: "Ephemeral biometric media purge executed successfully",
            filesPurged: result.purged
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Purge execution failed"
        });
    }
});

module.exports = router;
