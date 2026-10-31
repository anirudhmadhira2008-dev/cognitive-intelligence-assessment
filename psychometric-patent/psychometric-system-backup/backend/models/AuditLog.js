const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({
    actor: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        email: { type: String },
        role: { type: String }
    },
    action: {
        type: String,
        required: true,
        index: true
    },
    resource: {
        type: String,
        required: true
    },
    resourceId: {
        type: String
    },
    status: {
        type: String,
        enum: ["SUCCESS", "FAILED", "WARNING"],
        default: "SUCCESS"
    },
    ipAddress: {
        type: String
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
});

module.exports = mongoose.model("AuditLog", auditLogSchema);
