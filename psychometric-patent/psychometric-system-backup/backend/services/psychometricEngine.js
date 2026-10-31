/**
 * Multimodal Psychometric Assessment Engine
 * 
 * Implements transparent, explainable feature extraction, normalization, and scoring
 * in accordance with the patent:
 * "System and Method for Multimodal Psychometric Assessment to improve Engineering Student’s
 * Interview Confidence through AI-Based Adaptive Cognitive Intelligence Assessment Using
 * Behavioral, Knowledge and Integrity Analysis"
 * 
 * SCIENTIFIC & LEGAL BOUNDARY:
 * This engine produces rules-based educational and professional readiness indicators.
 * It is NOT a clinical psychological diagnostic tool and makes no medical determinations.
 */

const clamp = (value, min = 0, max = 100) => {
    return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
};

/**
 * Calculates device trust index based on required hardware/environment checks
 */
const calculateDeviceScore = (checks = {}) => {
    const checkList = [
        Boolean(checks.camera),
        Boolean(checks.microphone),
        Boolean(checks.secureContext),
        Boolean(checks.storage),
        Boolean(checks.network),
        Boolean(checks.screen)
    ];
    const passedCount = checkList.filter(Boolean).length;
    return clamp((passedCount / checkList.length) * 100);
};

/**
 * Normalizes behavioral baseline samples (mouse speed, typing rate, reaction time)
 */
const processBaselineSamples = (samples = {}) => {
    const avg = (arr) => (Array.isArray(arr) && arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

    const mouseSpeeds = samples.mouseSpeeds || [];
    const reactionTimes = samples.reactionTimes || [];
    const typingRates = samples.typingRates || [];
    const facePresence = samples.facePresence || [1];

    const mouseSpeed = clamp(avg(mouseSpeeds), 0, 100);
    const reactionTimeMs = Math.round(avg(reactionTimes) || 900);
    const typingRate = Math.round(avg(typingRates) || 0);
    const facePresenceScore = clamp(avg(facePresence) * 100);
    const baselineQuality = clamp(55 + mouseSpeeds.length * 3 + reactionTimes.length * 5);

    return {
        mouseSpeed,
        reactionTimeMs,
        typingRate,
        facePresence: facePresenceScore,
        baselineQuality
    };
};

/**
 * Evaluates a voice transcript against target keywords and delivery speed
 */
const evaluateVoiceTranscript = (transcript = "", keywords = [], durationSec = 1) => {
    const normalized = (transcript || "").toLowerCase();
    const cleanWords = normalized.trim() ? normalized.trim().split(/\s+/).filter(Boolean) : [];
    const wordCount = cleanWords.length;

    let keywordMatches = 0;
    if (Array.isArray(keywords) && keywords.length > 0) {
        keywords.forEach((kw) => {
            if (normalized.includes(kw.toLowerCase())) {
                keywordMatches++;
            }
        });
    }

    const keywordCoverage = keywords.length > 0 
        ? (keywordMatches / keywords.length) 
        : Math.min(1, wordCount / 25);

    const duration = Math.max(1, durationSec);
    const fluency = Math.min(1, wordCount / Math.max(20, duration * 1.3));

    const communication = clamp(keywordCoverage * 65 + fluency * 35);
    const confidence = clamp(45 + Math.min(wordCount, 50) * 0.7);

    return {
        transcript,
        wordsSpoken: wordCount,
        keywordCoverage: clamp(keywordCoverage * 100),
        communication,
        confidence
    };
};

/**
 * Multimodal score aggregation and explainable final report generation
 */
const generateFinalReport = ({
    mcq = {},
    voice = {},
    monitoring = {},
    baseline = {},
    device = {},
    difficultyReached = 1
}) => {
    const totalQuestions = Math.max(1, mcq.total || 1);
    const correctCount = mcq.correct || 0;

    // 1. Knowledge Score (MCQ correctness)
    const knowledge = clamp((correctCount / totalQuestions) * 100);

    // 2. Reasoning Score (Knowledge blended with analytical partial reasoning)
    const partialReasoning = mcq.partialReasoning || Math.round(knowledge * 0.85);
    const reasoning = clamp(knowledge * 0.65 + partialReasoning * 0.35);

    // 3. Communication Score
    const communication = clamp(voice.communication || 0);

    // 4. Interview Confidence Score (Voice confidence blended with attention)
    const attention = clamp(monitoring.attentionIndex !== undefined ? monitoring.attentionIndex : 85);
    const confidence = clamp((voice.confidence || 50) * 0.7 + attention * 0.3);

    // 5. Integrity Score (Inverse of monitored proctoring risk)
    const integrityRisk = clamp(monitoring.riskScore || 0);
    const integrity = clamp(100 - integrityRisk);

    // 6. Adaptability Score (Reflects difficulty level reached and improvement trajectory)
    const improvement = mcq.improvement || 0;
    const adaptability = clamp(45 + difficultyReached * 14 + improvement);

    // 7. Overall Cognitive Index
    const cognitive = clamp(
        knowledge * 0.35 +
        reasoning * 0.25 +
        adaptability * 0.20 +
        communication * 0.20
    );

    // 8. Professional Readiness Index
    const readiness = clamp(
        cognitive * 0.45 +
        communication * 0.20 +
        confidence * 0.15 +
        integrity * 0.20
    );

    // 9. Learning Potential
    const learningPotential = clamp(adaptability * 0.55 + reasoning * 0.45);

    // 10. Explainable Decision Recommendation
    let decision = "Needs Improvement";
    if (readiness >= 85 && integrity >= 75) {
        decision = "Highly Recommended";
    } else if (readiness >= 70 && integrity >= 65) {
        decision = "Recommended";
    } else if (readiness >= 55 && integrity >= 55) {
        decision = "Conditionally Recommended";
    }
    if (integrity < 50) {
        decision = "Review Required";
    }

    // Role recommendations based on profile strengths
    const roles = knowledge >= 75
        ? ["Software Development Engineer", "Data & ML Engineer", "Systems Architect Associate"]
        : ["Associate Software Developer", "Technical Solutions Specialist", "Graduate Engineering Trainee"];

    // Identify strengths and development areas
    const dimensionScores = {
        Knowledge: knowledge,
        Reasoning: reasoning,
        Communication: communication,
        Confidence: confidence,
        Adaptability: adaptability,
        Integrity: integrity
    };

    const strengths = Object.entries(dimensionScores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([dim]) => dim);

    const gaps = Object.entries(dimensionScores)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 2)
        .map(([dim]) => dim);

    // Personalized improvement roadmap
    const roadmap = [
        {
            week: "Week 1",
            focus: `Strengthen ${gaps[0] || "Foundational Knowledge"}`,
            task: "Review core computer science principles, complete concept quizzes, and solve 10 targeted problems."
        },
        {
            week: "Week 2",
            focus: `Improve ${gaps[1] || "Verbal Communication"}`,
            task: "Practice structured technical verbal explanations using the STAR method; conduct timed mock interview responses."
        },
        {
            week: "Week 3",
            focus: "Adaptive Problem-Solving & Interview Simulations",
            task: "Attempt full-length adaptive assessments under live proctoring conditions to refine speed and focus."
        }
    ];

    return {
        knowledge,
        reasoning,
        communication,
        confidence,
        integrity,
        adaptability,
        cognitive,
        readiness,
        learningPotential,
        decision,
        difficultyReached,
        deviceTrust: device.score || 0,
        baselineQuality: baseline.baselineQuality || 0,
        roles,
        strengths,
        gaps,
        roadmap,
        disclaimer: "Scores represent transparent educational and cognitive readiness indicators calculated for engineering interview preparation. Not a clinical psychological diagnosis."
    };
};

module.exports = {
    clamp,
    calculateDeviceScore,
    processBaselineSamples,
    evaluateVoiceTranscript,
    generateFinalReport
};
