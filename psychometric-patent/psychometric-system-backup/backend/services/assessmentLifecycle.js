/**
 * Assessment session lifecycle: start, answer (idempotent), progress, finalize.
 * Server is the source of truth for correctness and scores.
 */

const AssessmentSession = require("../models/AssessmentSession");
const Result = require("../models/Result");
const Enrollment = require("../models/Enrollment");
const SignedReport = require("../models/SignedReport");
const jwt = require("jsonwebtoken");
const identityService = require("./identityVerificationService");
const { generateFinalReport } = require("./psychometricEngine");
const { evaluateIntegrityStream } = require("./proctoringService");
const adaptiveEngine = require("./adaptiveEngine");

const ACTIVE_STATUSES = ["STARTED", "IN_PROGRESS", "PAUSED", "INTERRUPTED", "in-progress"];
const TARGET_MCQ_COUNT = 6;

const memorySessions = [];

const upsertMemory = (session) => {
    const idx = memorySessions.findIndex((s) => s._id === session._id);
    if (idx >= 0) memorySessions[idx] = session;
    else memorySessions.unshift(session);
    if (memorySessions.length > 500) memorySessions.pop();
    return session;
};

const candidateFromUser = (user, setup = {}) => ({
    name: user?.name || "Candidate",
    email: user?.email || "",
    rollNumber: user?.rollNumber || "",
    college: user?.college || "",
    branch: user?.branch || "",
    ...((setup && setup.candidate) || {})
});

const stripVerifyPayload = (verification, nextDifficulty) => ({
    valid: verification.valid,
    isCorrect: verification.isCorrect,
    nextDifficulty,
    difficulty: verification.difficulty,
    competency: verification.competency,
    concepts: verification.concepts
});

const verifyAndNormalizeResponses = (responses = []) => {
    const verified = [];
    const seen = new Set();

    for (const raw of responses) {
        const questionId = raw.questionId;
        if (!questionId || seen.has(questionId)) continue;
        const result = adaptiveEngine.verifyAnswer(questionId, raw.choice ?? raw.choiceIndex);
        if (!result.valid) continue;
        seen.add(questionId);
        verified.push({
            questionId,
            domain: raw.domain || "",
            difficulty: result.difficulty,
            bloom: raw.bloom || "",
            competency: result.competency || raw.competency || "",
            choice: Number(raw.choice ?? raw.choiceIndex),
            correct: result.isCorrect,
            responseMs: Number(raw.responseMs) || 0
        });
    }

    return verified;
};

const buildReportFromSession = (session, extras = {}) => {
    const responses = extras.responses || session.responses || [];
    const correctCount = responses.filter((r) => r.correct).length;
    const first = responses.slice(0, 3).filter((r) => r.correct).length;
    const last = responses.slice(-3).filter((r) => r.correct).length;
    const integrityEvaluation = extras.integrityEvaluation
        || evaluateIntegrityStream(session.monitoring?.events || []);

    return generateFinalReport({
        mcq: {
            correct: correctCount,
            total: responses.length || 1,
            partialReasoning: Math.round((correctCount / Math.max(1, responses.length)) * 85),
            improvement: (last - first) * 8
        },
        voice: extras.voice || session.voice || {},
        monitoring: {
            riskScore: integrityEvaluation.riskScore,
            attentionIndex: integrityEvaluation.attentionIndex
        },
        baseline: extras.baseline || session.baseline || {},
        device: extras.device || session.device || {},
        difficultyReached: extras.difficultyReached || session.adaptiveState?.currentDifficulty || 1
    });
};

async function startSession({ user, setup = {}, enrollmentId, verificationToken, assessmentId, testId, cohortId, isSynthetic = false, dbConnected }) {
    if (!user || !user.id) {
        return { success: false, status: 401, code: "UNAUTHORIZED", message: "Authentication required to start assessment." };
    }

    const targetTestId = (testId || setup.testId || "TEST_1").trim();
    const targetCohortId = (cohortId || setup.cohortId || "DEFAULT").trim();
    const targetVersion = (setup.testVersion || "1.0.0").trim();

    // 1. Locate Candidate Assessment Enrollment
    let enrollment = null;
    const targetEnrollmentId = enrollmentId || setup.enrollmentId;

    if (dbConnected) {
        if (targetEnrollmentId && String(targetEnrollmentId).match(/^[a-fA-F0-9]{24}$/)) {
            enrollment = await Enrollment.findById(targetEnrollmentId);
        } else {
            enrollment = await Enrollment.findOne({ candidateId: user.id }).sort({ createdAt: -1 });
        }
    } else {
        if (targetEnrollmentId) {
            enrollment = identityService.memoryEnrollments.find((e) => String(e._id) === String(targetEnrollmentId));
        } else {
            enrollment = identityService.memoryEnrollments.find((e) => String(e.candidateId) === String(user.id));
        }
    }

    if (!enrollment) {
        return { 
            success: false, 
            status: 403, 
            code: "NO_ENROLLMENT", 
            message: "Candidate has no assessment enrollment record. Academic & identity enrollment required." 
        };
    }

    // 2. IDOR check: Enforce candidate identity ownership
    const candId = enrollment.candidateId?._id || enrollment.candidateId;
    if (String(candId) !== String(user.id)) {
        return {
            success: false,
            status: 403,
            code: "ENROLLMENT_MISMATCH",
            message: "Forbidden: Cannot start an assessment using another candidate's enrollment."
        };
    }

    // 3. Verify Reference Identity Photo exists
    const hasPhoto = enrollment.identityEnrollment?.secureStorageKey || 
                     enrollment.identityEnrollment?.referenceImageId || 
                     enrollment.identityEnrollment?.referenceImage;
    if (!hasPhoto) {
        return {
            success: false,
            status: 403,
            code: "MISSING_REFERENCE_PHOTO",
            message: "Assessment locked: Candidate identity reference photo is required before starting."
        };
    }

    // 4. Verify Identity Verification Status on Server
    const isVerifiedStatus = enrollment.enrollmentStatus === "VERIFIED" || enrollment.identityEnrollment?.verificationStatus === "VERIFIED";
    
    // Validate JWT verificationToken provided in request payload
    const tokenToVerify = verificationToken || setup.verificationToken;
    let tokenValid = false;
    
    if (tokenToVerify) {
        try {
            const secret = process.env.JWT_SECRET || "default_development_secret_key_32chars_min";
            const decoded = jwt.verify(tokenToVerify, secret);
            if (String(decoded.candidateId) === String(user.id) && String(decoded.enrollmentId) === String(enrollment._id) && decoded.livenessPassed) {
                tokenValid = true;
            }
        } catch (tErr) {
            tokenValid = false;
        }
    }

    if (!isVerifiedStatus || !tokenValid) {
        return {
            success: false,
            status: 403,
            code: "IDENTITY_UNVERIFIED",
            message: "Assessment locked: Complete camera face detection & identity verification before starting."
        };
    }

    // 5. Verify Assigned Assessment ID authorization
    const requestedAssessmentId = assessmentId || setup.assessmentId || "default-psychometric-v1";
    if (enrollment.assessmentId && enrollment.assessmentId !== requestedAssessmentId) {
        return {
            success: false,
            status: 403,
            code: "UNASSIGNED_ASSESSMENT",
            message: `Forbidden: Candidate is not authorized for assessment '${requestedAssessmentId}'.`
        };
    }

    const adaptiveState = {
        currentDifficulty: Number(setup.startingDifficulty) || 2,
        attemptedQuestionIds: [],
        lastQuestionId: null
    };

    if (!dbConnected) {
        const existing = memorySessions.find(
            (s) => s.userId === user.id && (s.testId || "TEST_1") === targetTestId && ACTIVE_STATUSES.includes(s.status)
        );
        if (existing) {
            return { success: true, session: existing, resumed: true, isSandbox: true };
        }
        const previousAttempts = memorySessions.filter(
            (s) => s.userId === user.id && (s.testId || "TEST_1") === targetTestId
        ).length;
        const attemptNumber = previousAttempts + 1;

        const session = {
            _id: `dev-session-${Date.now()}`,
            userId: user.id,
            testId: targetTestId,
            testVersion: targetVersion,
            cohortId: targetCohortId,
            attemptNumber,
            isSynthetic: Boolean(isSynthetic || setup.isSynthetic),
            candidate: candidateFromUser(user),
            setup,
            responses: [],
            monitoring: { riskScore: 0, attentionIndex: 90, events: [] },
            adaptiveState,
            status: "IN_PROGRESS",
            startedAt: new Date(),
            createdAt: new Date()
        };
        upsertMemory(session);
        return { success: true, session, resumed: false, isSandbox: true };
    }

    const existing = await AssessmentSession.findOne({
        userId: user.id,
        testId: targetTestId,
        status: { $in: ACTIVE_STATUSES }
    }).sort({ createdAt: -1 });

    if (existing) {
        return { success: true, session: existing, resumed: true };
    }

    const previousAttempts = await AssessmentSession.countDocuments({
        userId: user.id,
        testId: targetTestId
    });
    const attemptNumber = previousAttempts + 1;

    const created = await AssessmentSession.create({
        userId: user.id,
        testId: targetTestId,
        testVersion: targetVersion,
        cohortId: targetCohortId,
        attemptNumber,
        isSynthetic: Boolean(isSynthetic || setup.isSynthetic),
        candidate: candidateFromUser(user),
        setup,
        adaptiveState,
        status: "IN_PROGRESS",
        startedAt: new Date()
    });

    return { success: true, session: created, resumed: false };
}

function assertSessionOwner(session, user) {
    if (!session) return { ok: false, status: 404, message: "Assessment session not found" };
    const privileged = user.role === "admin" || user.role === "evaluator";
    const ownerId = session.userId?.toString?.() || String(session.userId);
    if (!privileged && ownerId !== String(user.id)) {
        return { ok: false, status: 403, message: "Forbidden: You cannot access this assessment session" };
    }
    return { ok: true };
}

async function loadSession(sessionId, dbConnected) {
    if (!sessionId) return null;
    if (!dbConnected) {
        return memorySessions.find((s) => s._id === sessionId) || null;
    }
    if (!sessionId.match(/^[a-fA-F0-9]{24}$/)) return null;
    return AssessmentSession.findById(sessionId);
}

async function persistSession(session, dbConnected) {
    if (!dbConnected) return upsertMemory(session);
    await session.save();
    return session;
}

function selectQuestionForSession(session) {
    const attempted = session.adaptiveState?.attemptedQuestionIds || session.responses.map((r) => r.questionId);
    const targetDifficulty = session.adaptiveState?.currentDifficulty || 2;
    const question = adaptiveEngine.selectNextQuestion({
        targetDifficulty,
        attemptedQuestionIds: attempted
    });
    return question;
}

async function recordAnswer({ session, questionId, choiceIndex, responseMs, confidence, allowUpdate, dbConnected }) {
    if (["SUBMITTED", "PROCESSING", "COMPLETED", "completed"].includes(session.status)) {
        return { error: { status: 409, message: "This assessment is already submitted" } };
    }

    const verification = adaptiveEngine.verifyAnswer(questionId, choiceIndex);
    if (!verification.valid) {
        return { error: { status: 404, message: verification.error || "Question not found" } };
    }

    const existing = (session.responses || []).find((r) => r.questionId === questionId);
    if (existing) {
        if (allowUpdate) {
            // Candidate is deliberately changing their answer to an already answered question
            existing.choice = Number(choiceIndex);
            existing.correct = verification.isCorrect;
            if (responseMs) existing.responseMs = Number(responseMs);

            const currentDifficulty = session.adaptiveState?.currentDifficulty || existing.difficulty || 2;
            const nextDifficulty = adaptiveEngine.calculateNextDifficulty(
                currentDifficulty,
                verification.isCorrect,
                Number(responseMs) || 0,
                Number(confidence) || 65
            );

            session.adaptiveState = session.adaptiveState || {};
            session.adaptiveState.currentDifficulty = nextDifficulty;
            session.adaptiveState.lastQuestionId = questionId;

            await persistSession(session, dbConnected);

            return {
                updated: true,
                duplicate: true,
                isCorrect: verification.isCorrect,
                nextDifficulty,
                completedMcq: session.responses.length >= TARGET_MCQ_COUNT
            };
        }

        // Standard idempotent response when allowUpdate is not explicitly requested
        return {
            duplicate: true,
            isCorrect: existing.correct,
            nextDifficulty: session.adaptiveState?.currentDifficulty || 2,
            completedMcq: (session.responses || []).length >= TARGET_MCQ_COUNT
        };
    }

    const currentDifficulty = session.adaptiveState?.currentDifficulty || verification.difficulty || 2;
    const nextDifficulty = adaptiveEngine.calculateNextDifficulty(
        currentDifficulty,
        verification.isCorrect,
        Number(responseMs) || 0,
        Number(confidence) || 65
    );

    session.responses = session.responses || [];
    session.responses.push({
        questionId,
        domain: "",
        difficulty: verification.difficulty,
        bloom: "",
        competency: verification.competency || "",
        choice: Number(choiceIndex),
        correct: verification.isCorrect,
        responseMs: Number(responseMs) || 0
    });

    session.adaptiveState = session.adaptiveState || {};
    session.adaptiveState.currentDifficulty = nextDifficulty;
    session.adaptiveState.lastQuestionId = questionId;
    const attempted = new Set(session.adaptiveState.attemptedQuestionIds || []);
    attempted.add(questionId);
    session.adaptiveState.attemptedQuestionIds = [...attempted];
    session.status = "IN_PROGRESS";

    await persistSession(session, dbConnected);

    return {
        duplicate: false,
        isCorrect: verification.isCorrect,
        nextDifficulty,
        completedMcq: session.responses.length >= TARGET_MCQ_COUNT
    };
}

async function recordProgress({ session, events = [], status, dbConnected }) {
    if (["SUBMITTED", "PROCESSING", "COMPLETED", "completed"].includes(session.status)) {
        return { error: { status: 409, message: "Cannot update a completed assessment" } };
    }

    if (Array.isArray(events) && events.length) {
        const integrity = evaluateIntegrityStream([
            ...(session.monitoring?.events || []),
            ...events
        ]);
        session.monitoring = session.monitoring || {};
        session.monitoring.events = integrity.timeline;
        session.monitoring.riskScore = integrity.riskScore;
        session.monitoring.attentionIndex = integrity.attentionIndex;
    }

    if (status && ["PAUSED", "INTERRUPTED", "IN_PROGRESS"].includes(status)) {
        session.status = status;
    }

    await persistSession(session, dbConnected);
    return { session };
}

async function finalizeSession({
    session,
    user,
    body = {},
    dbConnected
}) {
    if (session && ["SUBMITTED", "PROCESSING", "COMPLETED", "completed"].includes(session.status) && session.report?.readiness) {
        let existingResultId = null;
        let existingSignedReportId = null;
        try {
            if (dbConnected) {
                const existingRes = await Result.findOne({ sessionId: session._id });
                existingResultId = existingRes?._id || null;
                const existingReport = await SignedReport.findOne({ sessionId: session._id });
                existingSignedReportId = existingReport?.reportId || null;
            } else {
                const { devSignedReportsMemory } = require("./overallReportService");
                const existingReport = (devSignedReportsMemory || []).find((r) => String(r.sessionId) === String(session._id));
                existingSignedReportId = existingReport?.reportId || null;
            }
        } catch (_) {}

        return {
            session,
            report: session.report,
            resultId: existingResultId,
            signedReportId: existingSignedReportId,
            alreadyFinalized: true
        };
    }

    const dbResponses = session?.responses?.length ? session.responses : [];
    const clientResponses = Array.isArray(body.responses) ? body.responses : [];
    const mergedSource = dbResponses.length ? dbResponses : clientResponses;
    const verifiedResponses = verifyAndNormalizeResponses(mergedSource);

    const rawEvents = [
        ...(session?.monitoring?.events || []),
        ...(body.monitoring?.events || [])
    ];
    const integrityEvaluation = evaluateIntegrityStream(rawEvents);

    const report = generateFinalReport({
        mcq: {
            correct: verifiedResponses.filter((r) => r.correct).length,
            total: verifiedResponses.length || 1,
            partialReasoning: Math.round(
                (verifiedResponses.filter((r) => r.correct).length / Math.max(1, verifiedResponses.length)) * 85
            ),
            improvement: 0
        },
        voice: body.voice || session?.voice || {},
        monitoring: {
            riskScore: integrityEvaluation.riskScore,
            attentionIndex: integrityEvaluation.attentionIndex
        },
        baseline: body.baseline || session?.baseline || {},
        device: body.device || session?.device || {},
        difficultyReached: body.difficultyReached
            || session?.adaptiveState?.currentDifficulty
            || 1
    });

    const payloadUpdates = {
        candidate: {
            name: user?.name || body.candidate?.name || session?.candidate?.name || "Candidate",
            email: user?.email || body.candidate?.email || session?.candidate?.email || "",
            rollNumber: user?.rollNumber || body.candidate?.rollNumber || session?.candidate?.rollNumber || "",
            college: user?.college || body.candidate?.college || session?.candidate?.college || "",
            branch: user?.branch || body.candidate?.branch || session?.candidate?.branch || ""
        },
        identity: {
            verified: false,
            faceCount: Number(body.identity?.faceCount || session?.identity?.faceCount || 0),
            confidence: Number(body.identity?.confidence || session?.identity?.confidence || 0),
            livenessCheck: "not_performed",
            verifiedAt: new Date()
        },
        device: {
            checks: body.device?.checks || session?.device?.checks || { camera: true, microphone: true, secureContext: true },
            score: report.deviceTrust || 100
        },
        baseline: body.baseline || session?.baseline || {},
        setup: body.setup || session?.setup || {},
        responses: verifiedResponses,
        monitoring: {
            riskScore: integrityEvaluation.riskScore,
            attentionIndex: integrityEvaluation.attentionIndex,
            events: integrityEvaluation.timeline
        },
        voice: {
            communication: report.communication,
            confidence: report.confidence,
            keywordCoverage: body.voice?.keywordCoverage || session?.voice?.keywordCoverage || 0,
            wordsSpoken: body.voice?.wordsSpoken || session?.voice?.wordsSpoken || 0,
            responses: body.voice?.responses || session?.voice?.responses || []
        },
        report,
        status: "COMPLETED",
        completedAt: new Date()
    };

    if (!dbConnected) {
        const finalized = {
            ...(session || {}),
            ...payloadUpdates,
            userId: user.id,
            _id: session?._id || `dev-session-${Date.now()}`,
            createdAt: session?.createdAt || new Date()
        };
        upsertMemory(finalized);
        let signedReport = null;
        try {
            const overallReportService = require("./overallReportService");
            const signedRes = await overallReportService.generateAndSignReport({
                sessionId: finalized._id,
                user,
                dbConnected: false
            });
            signedReport = signedRes?.report || null;
        } catch (e) {}
        return { session: finalized, report, resultId: null, isSandbox: true, signedReportId: signedReport?.reportId };
    }

    let savedSession = session;
    if (savedSession) {
        Object.assign(savedSession, payloadUpdates);
        savedSession.userId = user.id;
        await savedSession.save();
    } else {
        savedSession = await AssessmentSession.create({
            userId: user.id,
            ...payloadUpdates,
            startedAt: body.startedAt ? new Date(body.startedAt) : new Date()
        });
    }

    const resultDoc = await Result.create({
        userId: user.id,
        sessionId: savedSession._id,
        testId: savedSession.testId || "TEST_1",
        testVersion: savedSession.testVersion || "1.0.0",
        cohortId: savedSession.cohortId || "DEFAULT",
        attemptNumber: savedSession.attemptNumber || 1,
        isSynthetic: Boolean(savedSession.isSynthetic),
        name: payloadUpdates.candidate.name,
        role: payloadUpdates.setup.role || "Software Developer",
        knowledgeScore: report.knowledge,
        reasoningScore: report.reasoning,
        communicationScore: report.communication,
        confidenceScore: report.confidence,
        integrityScore: report.integrity,
        adaptabilityScore: report.adaptability,
        cognitiveIndex: report.cognitive,
        professionalReadiness: report.readiness,
        learningPotential: report.learningPotential,
        score: verifiedResponses.filter((r) => r.correct).length,
        total: verifiedResponses.length,
        cheatScore: integrityEvaluation.riskScore,
        voiceScore: report.communication,
        decision: report.decision,
        difficultyReached: report.difficultyReached,
        strengths: report.strengths,
        gaps: report.gaps,
        recommendedRoles: report.roles
    });

    let signedReport = null;
    try {
        const overallReportService = require("./overallReportService");
        const signedRes = await overallReportService.generateAndSignReport({
            sessionId: savedSession._id,
            user,
            dbConnected
        });
        signedReport = signedRes?.report || null;
    } catch (signErr) {
        console.warn("⚠️ Automatic digital signing notice:", signErr.message);
    }

    return { session: savedSession, report, resultId: resultDoc._id, signedReportId: signedReport?.reportId };
}

module.exports = {
    TARGET_MCQ_COUNT,
    ACTIVE_STATUSES,
    memorySessions,
    startSession,
    loadSession,
    assertSessionOwner,
    selectQuestionForSession,
    recordAnswer,
    recordProgress,
    finalizeSession,
    stripVerifyPayload,
    verifyAndNormalizeResponses,
    buildReportFromSession
};
