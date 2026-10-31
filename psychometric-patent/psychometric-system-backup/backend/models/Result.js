const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Result must be associated with a user"],
            index: true
        },

        sessionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AssessmentSession",
            index: true
        },

        testId: {
            type: String,
            default: "TEST_1",
            trim: true,
            index: true
        },

        testVersion: {
            type: String,
            default: "1.0.0"
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

        name: {
            type: String,
            required: true,
            trim: true
        },

        role: {
            type: String,
            default: "Software Developer"
        },

        // Core score metrics
        knowledgeScore: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },

        reasoningScore: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },

        communicationScore: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },

        confidenceScore: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },

        integrityScore: {
            type: Number,
            default: 100,
            min: 0,
            max: 100
        },

        adaptabilityScore: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },

        cognitiveIndex: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },

        professionalReadiness: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },

        learningPotential: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },

        // Legacy compatibility fields
        score: {
            type: Number,
            default: 0
        },

        total: {
            type: Number,
            default: 0
        },

        cheatScore: {
            type: Number,
            default: 0
        },

        voiceScore: {
            type: Number,
            default: 0
        },

        voiceRubric: {
            problemAnalysis: { type: Number, default: 0 },
            technicalDepth: { type: Number, default: 0 },
            practicality: { type: Number, default: 0 },
            communication: { type: Number, default: 0 },
            adaptability: { type: Number, default: 0 },
            ethicalJudgment: { type: Number, default: 0 }
        },

        voiceEvaluationSource: {
            type: String,
            enum: ["OPENAI", "GEMINI", "RULES_BASED_FALLBACK", "HUMAN_OVERRIDE"],
            default: "RULES_BASED_FALLBACK"
        },

        voiceHumanOverride: {
            isOverridden: { type: Boolean, default: false },
            reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            reviewerRole: { type: String, default: "" },
            timestamp: { type: Date },
            originalScores: { type: mongoose.Schema.Types.Mixed },
            revisedScores: { type: mongoose.Schema.Types.Mixed },
            reasoning: { type: String, default: "" }
        },

        decision: {
            type: String,
            enum: ["Highly Recommended", "Recommended", "Conditionally Recommended", "Needs Improvement", "Review Required", "Under Review"],
            default: "Under Review",
            index: true
        },

        difficultyReached: {
            type: Number,
            default: 1
        },

        strengths: [{ type: String }],
        gaps: [{ type: String }],
        recommendedRoles: [{ type: String }]
    },
    {
        timestamps: true
    }
);

resultSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Result", resultSchema);
