/**
 * Unified Overall Assessment Report Service
 * 
 * Generates, aggregates, finalizes, and digitally signs comprehensive assessment reports.
 * - Server-Authoritative scoring integrity.
 * - Idempotent report generation (prevents duplicated records / double-counting).
 * - Controlled immutable lifecycle: draft -> finalized -> signed.
 * - Cryptographically signed using digitalSignatureService.
 */

const crypto = require("crypto");
const AssessmentSession = require("../models/AssessmentSession");
const Result = require("../models/Result");
const SignedReport = require("../models/SignedReport");
const User = require("../models/User");
const Question = require("../models/Question");
const digitalSignatureService = require("./digitalSignatureService");
const {
    extractDifficultyPerformance,
    extractCompetencyPerformance,
    analyzeHistoricalTrends
} = require("./performanceAnalysisService");

const METHODOLOGY_VERSION = "2.0.0-psychometric-patent";
const SCORING_VERSION = "2026.1";

// In-memory fallback cache for development sandbox
const devSignedReportsMemory = [];

/**
 * Generates a privacy-preserving candidate reference string
 * E.g., "Candidate John D. (STU-***123)"
 */
function createCandidateReference(user = {}, candidate = {}) {
    const name = candidate.name || user.name || "Candidate";
    const roll = candidate.rollNumber || user.rollNumber || user.studentId || "";
    const maskedRoll = roll.length > 4 ? `***${roll.slice(-4)}` : roll || "ID-VERIFIED";
    return `${name} (${maskedRoll})`;
}

/**
 * Builds standard limitations and educational boundary disclosures
 */
function getStandardDisclosures() {
    return [
        "This evaluation represents rules-based educational and professional interview-readiness metrics in engineering domains.",
        "This report is NOT a clinical, medical, or psychiatric diagnostic evaluation.",
        "Scoring is server-authoritative and derived deterministically from persisted responses and authenticated proctoring telemetry.",
        "Cryptographic digital signature guarantees that the report data has not been altered since issuance."
    ];
}

/**
 * Generates and digitally signs a finalized overall assessment report for a session
 * 
 * @param {Object} options
 * @param {string} options.sessionId - Assessment session ID
 * @param {Object} options.user - Authenticated user
 * @param {boolean} options.dbConnected - MongoDB connection status
 * @returns {Promise<Object>} Finalized SignedReport
 */
async function generateAndSignReport({ sessionId, user, dbConnected = true }) {
    if (!sessionId) {
        throw new Error("sessionId is required to generate report");
    }

    // 1. Check if report already exists for this session (idempotency / duplicate prevention)
    if (dbConnected) {
        const existing = await SignedReport.findOne({ sessionId });
        if (existing) {
            return {
                report: existing,
                alreadySigned: true,
                isSandbox: false
            };
        }
    } else {
        const memMatch = devSignedReportsMemory.find((r) => String(r.sessionId) === String(sessionId));
        if (memMatch) {
            return {
                report: memMatch,
                alreadySigned: true,
                isSandbox: true
            };
        }
    }

    // 2. Load AssessmentSession and Result
    let session = null;
    let result = null;

    if (dbConnected) {
        session = await AssessmentSession.findById(sessionId).lean();
        if (!session) {
            throw new Error(`Assessment session '${sessionId}' not found.`);
        }
        result = await Result.findOne({ sessionId }).lean();
    } else {
        // Dev fallback
        session = {
            _id: sessionId,
            userId: user.id || "dev-user",
            candidate: { name: user.name || "Test Student", rollNumber: "STU-1001" },
            setup: { role: "Software Developer" },
            responses: [],
            report: {
                knowledge: 85,
                reasoning: 80,
                communication: 75,
                confidence: 80,
                integrity: 95,
                adaptability: 82,
                cognitive: 82,
                readiness: 84,
                learningPotential: 81,
                decision: "Recommended",
                strengths: ["Algorithms & Problem Solving", "Systematic Analysis"],
                gaps: ["Advanced Distributed Systems"]
            },
            status: "COMPLETED",
            completedAt: new Date()
        };
    }

    // Authorization check
    if (user.role !== "admin" && user.role !== "evaluator") {
        if (session.userId && String(session.userId) !== String(user.id)) {
            const err = new Error("Forbidden: You are not authorized to generate a report for this session");
            err.status = 403;
            throw err;
        }
    }

    // 3. Extract questions map if needed for accurate difficulty and competency analysis
    const questionsMap = new Map();
    if (dbConnected && session.responses && session.responses.length > 0) {
        const qIds = session.responses.map((r) => r.questionId).filter(Boolean);
        if (qIds.length > 0) {
            const qDocs = await Question.find({ questionId: { $in: qIds } }).lean();
            qDocs.forEach((q) => questionsMap.set(q.questionId, q));
        }
    }

    // 4. Calculate difficulty and competency performance
    const difficultyBreakdown = extractDifficultyPerformance(session.responses || [], questionsMap);
    const competencyScores = extractCompetencyPerformance(session.responses || [], questionsMap, session.voice || {});

    // 5. Gather historical context if student has completed multiple assessments
    let previousSessions = [];
    if (dbConnected) {
        previousSessions = await AssessmentSession.find({
            userId: session.userId,
            status: { $in: ["COMPLETED", "completed", "SUBMITTED"] },
            _id: { $ne: session._id }
        })
            .sort({ createdAt: 1 })
            .lean();
    }

    const allSessions = [...previousSessions, session];
    const historicalTrends = allSessions.length > 1 ? analyzeHistoricalTrends(
        allSessions.map((s, idx) => ({
            sessionId: s._id,
            attemptNumber: idx + 1,
            label: `Attempt ${idx + 1}`,
            date: s.completedAt || s.createdAt,
            overallScore: s.report?.readiness || s.report?.cognitive || 75,
            difficulties: extractDifficultyPerformance(s.responses || [], questionsMap),
            competencies: extractCompetencyPerformance(s.responses || [], questionsMap, s.voice || {})
        }))
    ) : null;

    // 6. Assemble Final Overall Score Metrics
    const rep = session.report || {};
    const overallScore = Number(rep.readiness) || Number(rep.cognitive) || Number(result?.score) || 75;
    const totalAvailableScore = 100;
    const overallPercentage = Math.round((overallScore / totalAvailableScore) * 100);

    const reportId = `REP-${new Date().getFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const candidateRef = createCandidateReference(user, session.candidate);

    // 7. Assemble Canonical Report Data Payload to be Digitally Signed
    const canonicalPayload = {
        reportId,
        sessionId: String(session._id),
        candidateReference: candidateRef,
        methodologyVersion: METHODOLOGY_VERSION,
        scoringVersion: SCORING_VERSION,
        overallScore,
        totalAvailableScore,
        overallPercentage,
        scoreBreakdown: {
            knowledgeScore: rep.knowledge || 0,
            reasoningScore: rep.reasoning || 0,
            communicationScore: rep.communication || 0,
            confidenceScore: rep.confidence || 0,
            integrityScore: rep.integrity !== undefined ? rep.integrity : 100,
            adaptabilityScore: rep.adaptability || 0,
            cognitiveIndex: rep.cognitive || 0,
            readinessIndex: rep.readiness || 0,
            learningPotential: rep.learningPotential || 0
        },
        difficultyBreakdown: {
            easy: difficultyBreakdown.easy,
            medium: difficultyBreakdown.medium,
            hard: difficultyBreakdown.hard
        },
        competencyScores: Object.fromEntries(
            Object.entries(competencyScores).map(([k, v]) => [k, {
                earned: v.earned,
                available: v.available,
                percentage: v.percentage,
                questionsCount: v.questionsCount
            }])
        ),
        strengths: rep.strengths && rep.strengths.length > 0 ? rep.strengths : ["Demonstrated solid foundational reasoning"],
        areasForImprovement: rep.gaps && rep.gaps.length > 0 ? rep.gaps : ["Continue advanced problem solving practice"],
        recommendations: [
            "Review targeted competency gaps highlighted in the breakdown.",
            "Practice hard-difficulty cognitive challenges to broaden adaptability range.",
            "Maintain verified integrity practices in collaborative engineering workflows."
        ],
        limitations: getStandardDisclosures(),
        issuedAt: new Date().toISOString()
    };

    // 8. Sign the canonical payload using RSA-PSS SHA-256
    const signatureMetadata = digitalSignatureService.signReportPayload(canonicalPayload);

    // 9. Persist SignedReport model
    const reportData = {
        reportId,
        userId: session.userId,
        sessionId: session._id,
        resultId: result?._id || null,
        testId: session.testId || "TEST_1",
        cohortId: session.cohortId || "DEFAULT",
        attemptNumber: session.attemptNumber || 1,
        isSynthetic: Boolean(session.isSynthetic),
        candidateReference: candidateRef,
        methodologyVersion: METHODOLOGY_VERSION,
        scoringVersion: SCORING_VERSION,
        overallScore,
        totalAvailableScore,
        overallPercentage,
        scoreBreakdown: canonicalPayload.scoreBreakdown,
        difficultyBreakdown: canonicalPayload.difficultyBreakdown,
        competencyScores,
        strengths: canonicalPayload.strengths,
        areasForImprovement: canonicalPayload.areasForImprovement,
        recommendations: canonicalPayload.recommendations,
        limitations: canonicalPayload.limitations,
        disclaimers: getStandardDisclosures(),
        status: "signed",
        signedPayload: canonicalPayload,
        canonicalHash: signatureMetadata.canonicalHash,
        signature: signatureMetadata.signature,
        keyId: signatureMetadata.keyId,
        algorithm: signatureMetadata.algorithm,
        issuedAt: new Date(canonicalPayload.issuedAt),
        signedAt: new Date(signatureMetadata.signedAt)
    };

    let savedReport = null;
    if (dbConnected) {
        savedReport = await SignedReport.create(reportData);
    } else {
        savedReport = { ...reportData, _id: `signed-rep-${Date.now()}` };
        devSignedReportsMemory.unshift(savedReport);
    }

    return {
        report: savedReport,
        historicalTrends,
        alreadySigned: false,
        isSandbox: !dbConnected
    };
}

/**
 * Retrieves a signed report by reportId or sessionId
 */
async function getSignedReport(id, user, dbConnected = true) {
    let report = null;

    if (dbConnected) {
        if (id.startsWith("REP-")) {
            report = await SignedReport.findOne({ reportId: id });
        } else {
            report = await SignedReport.findOne({
                $or: [{ _id: id }, { sessionId: id }]
            });
        }
    } else {
        report = devSignedReportsMemory.find(
            (r) => r.reportId === id || String(r._id) === String(id) || String(r.sessionId) === String(id)
        );
    }

    if (!report) {
        return null;
    }

    // Ownership check for non-admins
    if (user && user.role !== "admin" && user.role !== "evaluator") {
        if (report.userId && String(report.userId) !== String(user.id)) {
            const err = new Error("Forbidden: You are not authorized to view this signed report");
            err.status = 403;
            throw err;
        }
    }

    return report;
}

/**
 * Retrieves all signed reports owned by a student
 */
async function getMySignedReports(userId, dbConnected = true) {
    if (dbConnected) {
        return await SignedReport.find({ userId }).sort({ createdAt: -1 });
    }
    return devSignedReportsMemory.filter((r) => String(r.userId) === String(userId));
}

module.exports = {
    generateAndSignReport,
    getSignedReport,
    getMySignedReports,
    METHODOLOGY_VERSION,
    SCORING_VERSION,
    devSignedReportsMemory
};
