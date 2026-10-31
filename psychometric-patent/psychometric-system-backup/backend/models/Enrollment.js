const mongoose = require("mongoose");

const enrollmentSchema = new mongoose.Schema({
    candidateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    assessmentId: {
        type: String,
        required: true,
        default: "default-psychometric-v1"
    },
    title: {
        type: String,
        default: "AI Multimodal Psychometric Engineering Assessment"
    },
    roleTarget: {
        type: String,
        default: "Software Developer"
    },
    enrollmentStatus: {
        type: String,
        enum: ["ENROLLED", "VERIFYING", "VERIFIED", "IN_PROGRESS", "COMPLETED", "REVOKED"],
        default: "ENROLLED",
        index: true
    },
    identityEnrollment: {
        referenceImageId: { type: String, default: "" },
        secureStorageKey: { type: String, default: "" },
        referenceImage: { type: String, default: "" }, // Base64 or secure reference path
        referenceImageData: { type: String, default: "" }, // Persistent base64 backup
        mimetype: { type: String, default: "image/jpeg" },
        size: { type: Number, default: 0 },
        uploadedAt: { type: Date, default: Date.now },
        consent: { type: Boolean, default: false },
        consentTimestamp: { type: Date },
        enrolledAt: { type: Date, default: Date.now },
        enrolledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        verificationStatus: {
            type: String,
            enum: ["PENDING", "VERIFIED", "FAILED"],
            default: "PENDING"
        },
        verificationAttempts: { type: Number, default: 0 },
        verificationMetadata: { type: mongoose.Schema.Types.Mixed, default: {} }
    },
    verificationSession: {
        verifiedAt: { type: Date },
        verificationToken: { type: String },
        faceMatchScore: { type: Number, default: 0 },
        livenessPassed: { type: Boolean, default: false },
        verifiedByServer: { type: Boolean, default: false }
    },
    assessmentSessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AssessmentSession"
    },
    proctoringSummary: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    resultId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Result"
    }
}, {
    timestamps: true
});

module.exports = mongoose.model("Enrollment", enrollmentSchema);
