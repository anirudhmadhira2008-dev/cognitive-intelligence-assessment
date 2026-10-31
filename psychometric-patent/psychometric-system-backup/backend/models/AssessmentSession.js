const mongoose = require("mongoose");

const assessmentSessionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Assessment session must be linked to a User"],
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
            default: 1,
            min: 1
        },

        isSynthetic: {
            type: Boolean,
            default: false,
            index: true
        },

        enrollmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Enrollment",
            index: true
        },

        candidate: {
            name: { type: String, default: "" },
            email: { type: String, default: "" },
            rollNumber: { type: String, default: "" },
            college: { type: String, default: "" },
            branch: { type: String, default: "" }
        },

        identity: {
            verified: { type: Boolean, default: false },
            faceCount: { type: Number, default: 0 },
            confidence: { type: Number, default: 0 },
            livenessCheck: { type: String, default: "camera-presence" },
            verifiedAt: { type: Date, default: null }
        },

        device: {
            checks: {
                camera: { type: Boolean, default: false },
                microphone: { type: Boolean, default: false },
                secureContext: { type: Boolean, default: false },
                storage: { type: Boolean, default: false },
                network: { type: Boolean, default: false },
                screen: { type: Boolean, default: false }
            },
            score: { type: Number, default: 0 }
        },

        baseline: {
            mouseSpeed: { type: Number, default: 0 },
            reactionTimeMs: { type: Number, default: 0 },
            typingRate: { type: Number, default: 0 },
            facePresence: { type: Number, default: 100 },
            baselineQuality: { type: Number, default: 0 }
        },

        setup: {
            role: { type: String, default: "Software Developer" },
            startingDifficulty: { type: Number, default: 2 },
            language: { type: String, default: "English" },
            blueprint: {
                Knowledge: { type: Number, default: 35 },
                Reasoning: { type: Number, default: 25 },
                Communication: { type: Number, default: 15 },
                Behavior: { type: Number, default: 10 },
                Integrity: { type: Number, default: 15 }
            }
        },

        responses: [
            {
                questionId: { type: String, required: true },
                domain: { type: String, default: "" },
                difficulty: { type: Number, default: 1 },
                bloom: { type: String, default: "" },
                competency: { type: String, default: "" },
                choice: { type: Number, default: -1 },
                correct: { type: Boolean, default: false },
                responseMs: { type: Number, default: 0 }
            }
        ],

        monitoring: {
            riskScore: { type: Number, default: 0, min: 0, max: 100 },
            attentionIndex: { type: Number, default: 90, min: 0, max: 100 },
            events: [
                {
                    type: { type: String, required: true },
                    time: { type: String, default: "" },
                    timestamp: { type: Date, default: Date.now },
                    severity: { type: String, enum: ["low", "medium", "high"], default: "medium" },
                    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
                }
            ]
        },

        voice: {
            communication: { type: Number, default: 0 },
            confidence: { type: Number, default: 0 },
            keywordCoverage: { type: Number, default: 0 },
            wordsSpoken: { type: Number, default: 0 },
            overallScore: { type: Number, default: 0 },
            evaluationSource: { 
                type: String, 
                enum: ["OPENAI", "GEMINI", "RULES_BASED_FALLBACK", "HUMAN_OVERRIDE"],
                default: "RULES_BASED_FALLBACK" 
            },
            rubric: {
                problemAnalysis: { type: Number, default: 0 },
                technicalDepth: { type: Number, default: 0 },
                practicality: { type: Number, default: 0 },
                communication: { type: Number, default: 0 },
                adaptability: { type: Number, default: 0 },
                ethicalJudgment: { type: Number, default: 0 }
            },
            evidenceQuotes: [{ type: String }],
            feedback: { type: String, default: "" },
            humanOverride: {
                isOverridden: { type: Boolean, default: false },
                reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                reviewerRole: { type: String, default: "" },
                timestamp: { type: Date },
                originalScores: { type: mongoose.Schema.Types.Mixed },
                revisedScores: { type: mongoose.Schema.Types.Mixed },
                reasoning: { type: String, default: "" }
            },
            responses: [
                {
                    question: { type: String, default: "" },
                    transcript: { type: String, default: "" },
                    keywordCoverage: { type: Number, default: 0 },
                    communication: { type: Number, default: 0 },
                    confidence: { type: Number, default: 0 },
                    words: { type: Number, default: 0 }
                }
            ]
        },

        report: {
            knowledge: { type: Number, default: 0 },
            reasoning: { type: Number, default: 0 },
            communication: { type: Number, default: 0 },
            confidence: { type: Number, default: 0 },
            integrity: { type: Number, default: 100 },
            adaptability: { type: Number, default: 0 },
            cognitive: { type: Number, default: 0 },
            readiness: { type: Number, default: 0 },
            learningPotential: { type: Number, default: 0 },
            decision: { type: String, default: "Under Review" },
            difficultyReached: { type: Number, default: 1 },
            roles: [{ type: String }],
            strengths: [{ type: String }],
            gaps: [{ type: String }],
            roadmap: [
                {
                    week: { type: String, default: "" },
                    focus: { type: String, default: "" },
                    task: { type: String, default: "" }
                }
            ]
        },

        adaptiveState: {
            currentDifficulty: { type: Number, default: 2, min: 1, max: 3 },
            attemptedQuestionIds: [{ type: String }],
            lastQuestionId: { type: String, default: null }
        },

        status: {
            type: String,
            enum: [
                "STARTED",
                "IN_PROGRESS",
                "PAUSED",
                "INTERRUPTED",
                "SUBMITTED",
                "PROCESSING",
                "COMPLETED",
                "ABANDONED",
                "in-progress",
                "completed",
                "aborted"
            ],
            default: "IN_PROGRESS",
            index: true
        },

        startedAt: { type: Date, default: Date.now },
        completedAt: { type: Date, default: null },

        examinerReview: {
            status: { 
                type: String, 
                enum: ["Pending", "Approved", "Rejected", "Manual Review Required"], 
                default: "Pending" 
            },
            notes: { type: String, default: "" },
            reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            reviewedAt: { type: Date }
        }
    },
    {
        timestamps: true
    }
);

// Compound indexes for user session lookup, dual-test tracking, and examiner reporting
assessmentSessionSchema.index({ userId: 1, testId: 1, attemptNumber: 1 });
assessmentSessionSchema.index({ testId: 1, status: 1, createdAt: -1 });
assessmentSessionSchema.index({ cohortId: 1, testId: 1 });
assessmentSessionSchema.index({ isSynthetic: 1, createdAt: -1 });
assessmentSessionSchema.index({ userId: 1, createdAt: -1 });
assessmentSessionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("AssessmentSession", assessmentSessionSchema);
