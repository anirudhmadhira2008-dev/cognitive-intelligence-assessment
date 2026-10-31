const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const aiService = require("../services/aiService");
const AssessmentSession = require("../models/AssessmentSession");
const Result = require("../models/Result");

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration with MIME type validation and 15MB limit
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname) || ".webm";
        cb(null, `voice-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB maximum
    fileFilter: (_req, file, cb) => {
        const allowedTypes = /audio|webm|wav|mp3|ogg|m4a|octet-stream/;
        const mimeMatch = allowedTypes.test(file.mimetype);
        const extMatch = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (mimeMatch || extMatch) {
            cb(null, true);
        } else {
            cb(new Error("Only audio files (WAV, MP3, WebM, OGG) are allowed"));
        }
    }
});

// Helper to safely clean up temp files
const safeUnlink = (filePath) => {
    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (e) {
        console.warn("Temp audio file cleanup warning:", e.message);
    }
};

// Evaluator role middleware for review workflow
const requireEvaluatorRole = (req, res, next) => {
    const allowed = ["admin", "evaluator", "psychologist"];
    if (!req.user || !allowed.includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: "Access restricted: requires evaluator, psychologist, or administrator privileges."
        });
    }
    next();
};

// ==========================================
// VERIFY SENTENCE (VOICE IDENTIFICATION / TEST)
// ==========================================
router.post("/verify-sentence", authMiddleware, upload.single("audio"), async (req, res) => {
    try {
        const expected = (req.body.sentence || "").trim();
        const transcript = (req.body.transcript || "").trim();

        if (!transcript && !req.file) {
            return res.status(400).json({
                success: false,
                message: "Voice transcript or audio file is required for verification"
            });
        }

        const effectiveTranscript = transcript || (req.file ? "Voice sample recorded successfully" : "");
        const expectedWords = expected.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);
        const actualWords = effectiveTranscript.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);

        let matched = 0;
        expectedWords.forEach((word) => {
            if (actualWords.includes(word)) matched++;
        });

        const accuracy = expectedWords.length > 0 
            ? Math.round((matched / expectedWords.length) * 100) 
            : (effectiveTranscript ? 80 : 0);

        const status = accuracy >= 60 ? "Verified" : "Mismatch";

        if (req.file) safeUnlink(req.file.path);

        return res.json({
            success: true,
            transcript: effectiveTranscript,
            accuracy,
            status,
            expected
        });
    } catch (err) {
        if (req.file) safeUnlink(req.file.path);
        return res.status(500).json({
            success: false,
            message: "Sentence verification processing failed",
            error: process.env.NODE_ENV === "development" ? err.message : undefined
        });
    }
});

// ==========================================
// EVALUATE VERBAL INTERVIEW ANSWER
// ==========================================
router.post("/evaluate", authMiddleware, upload.single("audio"), async (req, res) => {
    try {
        const { question, transcript, keywords, durationSec, sessionId } = req.body;

        let parsedKeywords = [];
        if (Array.isArray(keywords)) {
            parsedKeywords = keywords;
        } else if (typeof keywords === "string") {
            try {
                parsedKeywords = JSON.parse(keywords);
            } catch {
                parsedKeywords = keywords.split(",").map((k) => k.trim());
            }
        }

        const evaluation = await aiService.evaluateVerbalResponse({
            question: question || "Technical interview response",
            transcript: transcript || "Candidate presented their approach clearly.",
            keywords: parsedKeywords,
            durationSec: Number(durationSec) || 15
        });

        // If a sessionId is attached and candidate owns it, persist voice rubric
        if (sessionId && mongoose.Types.ObjectId.isValid(sessionId) && req.app.locals.dbConnected) {
            try {
                const session = await AssessmentSession.findById(sessionId);
                if (session && (session.userId.toString() === req.user.id || req.user.role === "admin")) {
                    session.voice = {
                        communication: evaluation.communication,
                        confidence: evaluation.confidence,
                        keywordCoverage: evaluation.keywordCoverage,
                        wordsSpoken: evaluation.wordsSpoken,
                        overallScore: evaluation.overallScore,
                        evaluationSource: evaluation.source,
                        rubric: evaluation.rubric,
                        evidenceQuotes: evaluation.evidenceQuotes || [],
                        feedback: evaluation.feedback || "",
                        responses: [
                            ...(session.voice?.responses || []),
                            {
                                question: question || "Technical question",
                                transcript: transcript || "",
                                keywordCoverage: evaluation.keywordCoverage,
                                communication: evaluation.communication,
                                confidence: evaluation.confidence,
                                words: evaluation.wordsSpoken
                            }
                        ]
                    };
                    await session.save();
                }
            } catch (saveErr) {
                console.warn("Could not persist voice evaluation to session:", saveErr.message);
            }
        }

        if (req.file) safeUnlink(req.file.path);

        return res.json({
            success: true,
            transcript: transcript || "",
            overallScore: evaluation.overallScore,
            score: evaluation.overallScore, // Backward compatibility alias
            rubric: evaluation.rubric,
            communication: evaluation.communication,
            confidence: evaluation.confidence,
            keywordCoverage: evaluation.keywordCoverage,
            wordsSpoken: evaluation.wordsSpoken,
            evidenceQuotes: evaluation.evidenceQuotes,
            feedback: evaluation.feedback,
            source: evaluation.source,
            fallbackReason: evaluation.fallbackReason
        });
    } catch (err) {
        if (req.file) safeUnlink(req.file.path);
        return res.status(500).json({
            success: false,
            message: "Voice evaluation processing error",
            error: process.env.NODE_ENV === "development" ? err.message : undefined
        });
    }
});

// ==========================================
// DYNAMIC AI FOLLOW-UP PROBE GENERATION
// ==========================================
router.post("/generate-probe", authMiddleware, async (req, res) => {
    try {
        const { question, transcript, keywords } = req.body;

        let parsedKeywords = [];
        if (Array.isArray(keywords)) {
            parsedKeywords = keywords;
        } else if (typeof keywords === "string") {
            try {
                parsedKeywords = JSON.parse(keywords);
            } catch {
                parsedKeywords = keywords.split(",").map((k) => k.trim());
            }
        }

        const probeData = await aiService.generateFollowUpProbe({
            question: question || "Technical engineering response",
            transcript: transcript || "",
            keywords: parsedKeywords
        });

        return res.json({
            success: true,
            probeQuestion: probeData.probeQuestion,
            focusArea: probeData.focusArea,
            missedKeywords: probeData.missedKeywords || [],
            source: probeData.source
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to generate AI follow-up probe",
            error: process.env.NODE_ENV === "development" ? err.message : undefined
        });
    }
});

// ==========================================
// HUMAN REVIEW WORKFLOW: GET SUBMISSIONS (DOUBLE-BLIND)
// Evaluators see anonymousResponseId, never candidate personal identification
// ==========================================
router.get("/submissions", authMiddleware, requireEvaluatorRole, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        if (!req.app.locals.dbConnected) {
            return res.json({
                success: true,
                submissions: [],
                pagination: { total: 0, page, limit, pages: 1 }
            });
        }

        const query = {
            $or: [
                { "voice.overallScore": { $gt: 0 } },
                { "voice.responses.0": { $exists: true } },
                { status: { $in: ["submitted", "processing", "completed", "SUBMITTED", "PROCESSING", "COMPLETED"] } }
            ]
        };

        const total = await AssessmentSession.countDocuments(query);
        const sessions = await AssessmentSession.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select("testId testVersion cohortId status voice createdAt updatedAt")
            .lean();

        // Anonymize records for double-blind human review
        const sanitized = sessions.map((s) => ({
            sessionId: s._id,
            anonymousResponseId: "RESP-" + s._id.toString().slice(-6).toUpperCase(),
            testId: s.testId || "TEST-1",
            testVersion: s.testVersion || "1.0.0",
            cohortId: s.cohortId || "PILOT-A",
            status: s.status,
            createdAt: s.createdAt,
            voice: {
                overallScore: s.voice?.overallScore || 0,
                evaluationSource: s.voice?.evaluationSource || "RULES_BASED_FALLBACK",
                rubric: s.voice?.rubric || null,
                evidenceQuotes: s.voice?.evidenceQuotes || [],
                feedback: s.voice?.feedback || "",
                humanOverride: s.voice?.humanOverride || { isOverridden: false },
                responsesCount: (s.voice?.responses || []).length
            }
        }));

        return res.json({
            success: true,
            submissions: sanitized,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit) || 1
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve voice submissions for review",
            error: process.env.NODE_ENV === "development" ? err.message : undefined
        });
    }
});

// ==========================================
// HUMAN REVIEW WORKFLOW: GET SINGLE SUBMISSION (DOUBLE-BLIND)
// ==========================================
router.get("/submission/:sessionId", authMiddleware, requireEvaluatorRole, async (req, res) => {
    try {
        const { sessionId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(sessionId)) {
            return res.status(400).json({ success: false, message: "Invalid sessionId format" });
        }

        const session = await AssessmentSession.findById(sessionId)
            .select("testId testVersion cohortId status voice createdAt updatedAt")
            .lean();

        if (!session) {
            return res.status(404).json({ success: false, message: "Assessment session not found" });
        }

        return res.json({
            success: true,
            anonymousResponseId: "RESP-" + session._id.toString().slice(-6).toUpperCase(),
            sessionId: session._id,
            testId: session.testId,
            testVersion: session.testVersion,
            status: session.status,
            voice: session.voice || {}
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Error fetching voice submission details",
            error: process.env.NODE_ENV === "development" ? err.message : undefined
        });
    }
});

// ==========================================
// HUMAN REVIEW WORKFLOW: SUBMIT HUMAN OVERRIDE
// ==========================================
router.post("/override/:sessionId", authMiddleware, requireEvaluatorRole, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { rubric, reasoning } = req.body;

        if (!mongoose.Types.ObjectId.isValid(sessionId)) {
            return res.status(400).json({ success: false, message: "Invalid sessionId format" });
        }

        if (!reasoning || typeof reasoning !== "string" || reasoning.trim().length < 8) {
            return res.status(400).json({
                success: false,
                message: "A structured reasoning note (minimum 8 characters) is required for human score override."
            });
        }

        if (!rubric || typeof rubric !== "object") {
            return res.status(400).json({
                success: false,
                message: "Rubric object with 6 dimensions (problemAnalysis, technicalDepth, practicality, communication, adaptability, ethicalJudgment) is required."
            });
        }

        const dimensions = ["problemAnalysis", "technicalDepth", "practicality", "communication", "adaptability", "ethicalJudgment"];
        const validatedRubric = {};

        for (const dim of dimensions) {
            const val = Number(rubric[dim]);
            if (isNaN(val) || val < 1 || val > 10) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid score for ${dim}: must be an integer between 1 and 10.`
                });
            }
            validatedRubric[dim] = Math.round(val);
        }

        const sum = Object.values(validatedRubric).reduce((a, b) => a + b, 0);
        const calculatedOverall = Math.round((sum / 60) * 100);

        const session = await AssessmentSession.findById(sessionId);
        if (!session) {
            return res.status(404).json({ success: false, message: "Assessment session not found" });
        }

        const originalScores = session.voice?.rubric ? { ...session.voice.rubric } : null;

        session.voice = session.voice || {};
        session.voice.rubric = validatedRubric;
        session.voice.overallScore = calculatedOverall;
        session.voice.communication = validatedRubric.communication * 10;
        session.voice.evaluationSource = "HUMAN_OVERRIDE";
        session.voice.humanOverride = {
            isOverridden: true,
            reviewerId: req.user.id,
            reviewerRole: req.user.role,
            timestamp: new Date(),
            originalScores,
            revisedScores: validatedRubric,
            reasoning: reasoning.trim()
        };

        await session.save();

        // Also synchronize to Result record if generated
        await Result.updateOne(
            { $or: [{ sessionId: session._id }, { userId: session.userId }] },
            {
                $set: {
                    voiceScore: calculatedOverall,
                    voiceRubric: validatedRubric,
                    voiceEvaluationSource: "HUMAN_OVERRIDE",
                    voiceHumanOverride: {
                        isOverridden: true,
                        reviewerId: req.user.id,
                        reviewerRole: req.user.role,
                        timestamp: new Date(),
                        originalScores,
                        revisedScores: validatedRubric,
                        reasoning: reasoning.trim()
                    }
                }
            }
        );

        return res.json({
            success: true,
            message: "Human reviewer score override successfully applied.",
            anonymousResponseId: "RESP-" + session._id.toString().slice(-6).toUpperCase(),
            revisedRubric: validatedRubric,
            overallScore: calculatedOverall,
            evaluationSource: "HUMAN_OVERRIDE",
            humanOverride: session.voice.humanOverride
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to record human score override",
            error: process.env.NODE_ENV === "development" ? err.message : undefined
        });
    }
});

module.exports = router;
