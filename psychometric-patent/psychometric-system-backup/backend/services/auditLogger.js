const AuditLog = require("../models/AuditLog");

const auditMemoryLog = [];

const logAuditEvent = async ({ req, action, resource, resourceId, status = "SUCCESS", metadata = {} }) => {
    try {
        const actor = req?.user ? {
            id: req.user.id || req.user._id,
            email: req.user.email,
            role: req.user.role
        } : { email: "system/unauthenticated", role: "anonymous" };

        const ipAddress = req?.ip || req?.headers?.["x-forwarded-for"] || "127.0.0.1";

        const logDoc = {
            actor,
            action,
            resource,
            resourceId: resourceId ? String(resourceId) : undefined,
            status,
            ipAddress,
            metadata,
            timestamp: new Date()
        };

        if (req?.app?.locals?.dbConnected) {
            await AuditLog.create(logDoc);
        } else {
            auditMemoryLog.unshift(logDoc);
            if (auditMemoryLog.length > 200) auditMemoryLog.pop();
        }
    } catch (err) {
        console.warn("Audit logging warning:", err.message);
    }
};

const getMemoryAuditLogs = () => auditMemoryLog;

module.exports = {
    logAuditEvent,
    getMemoryAuditLogs
};
