const mongoose = require("mongoose");

const signedReportSchema = new mongoose.Schema(
    {
        reportId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true
        },

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Report must be linked to a candidate"],
            index: true
        },

        sessionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AssessmentSession",
            required: [true, "Report must be linked to an assessment session"],
            unique: true,
            index: true
        },

        resultId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Result",
            index: true
        },

        testId: {
            type: String,
            default: "TEST_1",
            trim: true,
            index: true
        },

        cohortId: {
            type: String,
            default: "DEFAULT",
            trim: true,
            index: true
        },

        attemptNumber: {
            type: Number,
            default: 1
        },

        isSynthetic: {
            type: Boolean,
            default: false,
            index: true
        },

        candidateReference: {
            type: String,
            required: true,
            trim: true
        },

        methodologyVersion: {
            type: String,
            default: "2.0.0-psychometric-patent"
        },

        scoringVersion: {
            type: String,
            default: "2026.1"
        },

        overallScore: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },

        totalAvailableScore: {
            type: Number,
            default: 100
        },

        overallPercentage: {
            type: Number,
            min: 0,
            max: 100
        },

        scoreBreakdown: {
            knowledgeScore: { type: Number, default: 0 },
            reasoningScore: { type: Number, default: 0 },
            communicationScore: { type: Number, default: 0 },
            confidenceScore: { type: Number, default: 0 },
            integrityScore: { type: Number, default: 100 },
            adaptabilityScore: { type: Number, default: 0 },
            cognitiveIndex: { type: Number, default: 0 },
            readinessIndex: { type: Number, default: 0 },
            learningPotential: { type: Number, default: 0 }
        },

        difficultyBreakdown: {
            easy: {
                earned: { type: Number, default: 0 },
                available: { type: Number, default: 0 },
                percentage: { type: Number, default: null }
            },
            medium: {
                earned: { type: Number, default: 0 },
                available: { type: Number, default: 0 },
                percentage: { type: Number, default: null }
            },
            hard: {
                earned: { type: Number, default: 0 },
                available: { type: Number, default: 0 },
                percentage: { type: Number, default: null }
            }
        },

        competencyScores: {
            type: Map,
            of: {
                earned: { type: Number, default: 0 },
                available: { type: Number, default: 0 },
                percentage: { type: Number, default: 0 },
                questionsCount: { type: Number, default: 0 }
            },
            default: {}
        },

        strengths: [{ type: String }],
        areasForImprovement: [{ type: String }],
        recommendations: [{ type: String }],
        limitations: [{ type: String }],
        disclaimers: [{ type: String }],

        status: {
            type: String,
            enum: ["draft", "finalized", "signed"],
            default: "signed",
            index: true
        },

        // Cryptographic Digital Signature Metadata
        signedPayload: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        },

        canonicalHash: {
            type: String,
            required: true,
            index: true
        },

        signature: {
            type: String,
            required: true
        },

        keyId: {
            type: String,
            required: true
        },

        algorithm: {
            type: String,
            default: "RSA-PSS-SHA256"
        },

        issuedAt: {
            type: Date,
            default: Date.now
        },

        signedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

signedReportSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("SignedReport", signedReportSchema);
