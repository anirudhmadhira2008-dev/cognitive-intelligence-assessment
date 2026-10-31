/**
 * Evidence-Based Proctoring & Integrity Service
 * 
 * Records, aggregates, and scores real-time proctoring telemetry.
 * Avoids absolute claims ("cheating detected") and produces probabilistic,
 * explainable incident timelines with confidence metrics.
 */

const SEVERITY_WEIGHTS = {
    FACE_MISSING: { points: 10, severity: "medium", desc: "Candidate face not detected in video frame" },
    FACE_ABSENT: { points: 10, severity: "medium", desc: "Candidate face not detected in video frame" },
    MULTIPLE_FACE: { points: 20, severity: "high", desc: "Multiple faces observed in camera feed" },
    MULTIPLE_FACES: { points: 20, severity: "high", desc: "Multiple faces observed in camera feed" },
    IDENTITY_MISMATCH: { points: 25, severity: "critical", desc: "Candidate face identity does not match enrolled reference" },
    LIVENESS_WARNING: { points: 15, severity: "medium", desc: "Liveness verification failed or artificial feed suspected" },
    PHONE_DETECTED: { points: 25, severity: "critical", desc: "Prohibited mobile phone detected in examination area" },
    EARBUD_DETECTED: { points: 20, severity: "high", desc: "Prohibited earbud audio device detected on candidate" },
    HEADPHONE_DETECTED: { points: 20, severity: "high", desc: "Prohibited headphone audio device detected on candidate" },
    CAMERA_DISABLED: { points: 25, severity: "critical", desc: "Camera video feed interrupted or permission disabled" },
    TAB_SWITCH: { points: 12, severity: "high", desc: "Browser tab or application lost focus (visibilitychange)" },
    WINDOW_BLUR: { points: 5, severity: "low", desc: "Assessment window blur or split-screen interaction" },
    NETWORK_INTERRUPTION: { points: 8, severity: "medium", desc: "Network connection interruption or high latency spike" },
    MICROPHONE_MUTED: { points: 10, severity: "medium", desc: "Microphone stream interrupted or muted" },
    ABNORMAL_INTERACTION: { points: 8, severity: "medium", desc: "Anomalous mouse teleportation or automated keystroke burst" },
    // Novel Feature 2: Cognitive Load & Reflective Telemetry (Zero Penalty)
    COGNITIVE_REFLECTION: { points: 0, severity: "low", desc: "Deep reflective problem-solving gaze shift during advanced challenge" },
    DEEP_THINKING_PAUSE: { points: 0, severity: "low", desc: "Thoughtful formulation pause during high-difficulty challenge" },
    GAZE_DEVIATION: { points: 4, severity: "low", desc: "Lateral gaze deviation from primary screen" }
};

/**
 * Novel Feature 2: Multi-Signal "Cognitive Load vs. Dishonesty" Contextualizer
 * Correlates gaze shifts and pauses with Bloom's Taxonomy and Question Difficulty
 * Differentiates reflective problem-solving from unauthorized external assistance
 */
const contextualizeProctoringIncident = (eventData = {}, context = {}) => {
    const rawType = eventData.type || "WINDOW_BLUR";
    const difficulty = Number(context.difficulty || eventData.metadata?.difficulty) || 2;
    const bloom = String(context.bloom || eventData.metadata?.bloom || "").toLowerCase();
    
    // Check if challenge is analytically demanding (Bloom Level 4+: Analyze, Evaluate, Create, or Level 3 Difficulty)
    const isDemandingQuestion = difficulty >= 3 || bloom.includes("analyz") || bloom.includes("evaluat") || bloom.includes("creat");
    const isBenignGazeShift = rawType === "GAZE_DEVIATION" || rawType === "WINDOW_BLUR" || rawType === "FACE_MISSING" || rawType === "FACE_ABSENT";
    const hasExternalTabViolation = eventData.metadata?.tabSwitched || eventData.metadata?.blurred;

    // SCENARIO A: Reflective problem-solving on high-cognitive challenge
    if (isDemandingQuestion && isBenignGazeShift && !hasExternalTabViolation) {
        return {
            type: "COGNITIVE_REFLECTION",
            description: "Deep reflective problem-solving gaze shift during advanced engineering challenge",
            severity: "low",
            points: 0,
            isReflective: true,
            timestamp: eventData.timestamp || new Date(),
            time: eventData.time || new Date().toLocaleTimeString(),
            confidence: 95,
            metadata: {
                ...eventData.metadata,
                cognitiveLoad: "High",
                contextualTier: `Bloom Tier Level ${difficulty} Reflection`
            }
        };
    }

    // SCENARIO B: Standard event rule evaluation
    const rule = SEVERITY_WEIGHTS[rawType] || { points: 5, severity: "low", desc: "Unclassified interaction event" };

    return {
        type: rawType,
        description: rule.desc,
        severity: rule.severity,
        points: rule.points,
        timestamp: eventData.timestamp || new Date(),
        time: eventData.time || new Date().toLocaleTimeString(),
        confidence: Math.min(100, Math.max(50, Number(eventData.confidence) || 90)),
        metadata: eventData.metadata || {}
    };
};

/**
 * Validates and processes an incoming proctoring event
 */
const processProctoringEvent = (eventData = {}, context = {}) => {
    return contextualizeProctoringIncident(eventData, context);
};

/**
 * Calculates cumulative integrity risk and attention index from an event stream
 */
const evaluateIntegrityStream = (events = [], context = {}) => {
    if (!Array.isArray(events) || events.length === 0) {
        return {
            riskScore: 0,
            integrityScore: 100,
            attentionIndex: 95,
            flaggedCount: 0,
            summary: "Continuous candidate presence verified with zero security anomalies.",
            timeline: []
        };
    }

    let cumulativeRisk = 0;
    const processedEvents = events.map((ev) => processProctoringEvent(ev, context));

    processedEvents.forEach((ev) => {
        cumulativeRisk += ev.points;
    });

    // Clamp risk to max 100
    const finalRisk = Math.min(100, cumulativeRisk);
    const integrityScore = Math.max(0, 100 - finalRisk);
    const attentionIndex = Math.max(25, Math.min(100, Math.round(100 - finalRisk * 0.6)));

    // Categorize summary
    let summary = "High integrity: negligible environmental or focus variance.";
    if (finalRisk >= 50) {
        summary = "Integrity Review Required: Multiple high-severity focus shifts or face-presence irregularities recorded.";
    } else if (finalRisk >= 25) {
        summary = "Moderate integrity variance: Isolated window blur or momentary face absence detected.";
    }

    return {
        riskScore: finalRisk,
        integrityScore,
        attentionIndex,
        flaggedCount: processedEvents.length,
        summary,
        timeline: processedEvents
    };
};

module.exports = {
    SEVERITY_WEIGHTS,
    processProctoringEvent,
    contextualizeProctoringIncident,
    evaluateIntegrityStream
};
