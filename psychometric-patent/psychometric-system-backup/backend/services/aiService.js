/**
 * Provider-Independent AI Service Gateway
 * 
 * Supports external providers (OpenAI / Gemini) with an offline,
 * deterministic semantic evaluation engine as a guaranteed fallback.
 * All API keys remain strictly server-side.
 */

const axios = require("axios");
const { evaluateVoiceTranscript } = require("./psychometricEngine");

// Sanitize user text to prevent prompt injection
const sanitizeText = (text = "") => {
    return String(text)
        .replace(/[<>{}[\]\\]/g, "")
        .trim()
        .slice(0, 2000);
};

/**
 * Extracts 1-2 representative quotes directly from candidate transcript
 */
function extractEvidenceQuotes(transcript = "") {
    if (!transcript || typeof transcript !== "string") return [];
    const sentences = transcript
        .split(/(?<=[.?!])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 15 && s.length <= 160);

    if (sentences.length === 0) {
        const words = transcript.trim().split(/\s+/);
        if (words.length >= 5) {
            return [words.slice(0, Math.min(20, words.length)).join(" ") + "..."];
        }
        return [];
    }
    return sentences.slice(0, 2);
}

/**
 * Evaluates candidate's verbal transcript across 6 structured rubric dimensions:
 * 1. Problem Analysis (1-10)
 * 2. Technical Depth (1-10)
 * 3. Practicality (1-10)
 * 4. Communication (1-10)
 * 5. Adaptability (1-10)
 * 6. Ethical Judgment (1-10)
 */
const evaluateVerbalResponse = async ({
    question = "",
    transcript = "",
    keywords = [],
    durationSec = 10
}) => {
    const cleanTranscript = sanitizeText(transcript);
    const cleanQuestion = sanitizeText(question);
    const words = cleanTranscript.split(/\s+/).filter(Boolean);
    const lowerTranscript = cleanTranscript.toLowerCase();

    // 1. If external AI provider key is configured and active
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith("sk-")) {
        try {
            const prompt = `You are a Senior Technical Evaluator assessing an engineering candidate's verbal response.
Question: "${cleanQuestion}"
Candidate Transcript: "${cleanTranscript}"
Target Keywords / Concepts: ${keywords.join(", ")}

Evaluate the candidate on a 1-10 integer scale for each of the 6 rubric dimensions:
1. problemAnalysis: Understanding and structured decomposition of the problem.
2. technicalDepth: Correct use of domain principles, algorithms, and technical concepts.
3. practicality: Feasibility, real-world constraints, implementation viability.
4. communication: Clarity, fluency, coherence, and professional terminology.
5. adaptability: Handling trade-offs, alternative approaches, and edge conditions.
6. ethicalJudgment: Security, data privacy, fairness, integrity, or fault tolerance.

Extract 1-2 direct quote strings from the candidate's speech as evidence.
Provide 1-2 sentences of constructive feedback.

Return STRICT JSON only:
{
  "rubric": {
    "problemAnalysis": (1-10),
    "technicalDepth": (1-10),
    "practicality": (1-10),
    "communication": (1-10),
    "adaptability": (1-10),
    "ethicalJudgment": (1-10)
  },
  "overallScore": (0-100),
  "evidenceQuotes": ["quote 1", "quote 2"],
  "feedback": "constructive feedback"
}`;

            const response = await axios.post(
                "https://api.openai.com/v1/chat/completions",
                {
                    model: "gpt-3.5-turbo",
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.2,
                    max_tokens: 300
                },
                {
                    headers: {
                        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                        "Content-Type": "application/json"
                    },
                    timeout: 6000
                }
            );

            const content = response.data.choices[0].message.content;
            const parsed = JSON.parse(content);

            const clamp10 = (n) => Math.min(10, Math.max(1, Math.round(Number(n) || 5)));
            const rubric = {
                problemAnalysis: clamp10(parsed.rubric?.problemAnalysis),
                technicalDepth: clamp10(parsed.rubric?.technicalDepth),
                practicality: clamp10(parsed.rubric?.practicality),
                communication: clamp10(parsed.rubric?.communication),
                adaptability: clamp10(parsed.rubric?.adaptability),
                ethicalJudgment: clamp10(parsed.rubric?.ethicalJudgment)
            };

            const sum = Object.values(rubric).reduce((a, b) => a + b, 0);
            const calculatedOverall = Math.round((sum / 60) * 100);

            return {
                source: "OPENAI",
                fallbackReason: null,
                rubric,
                overallScore: parsed.overallScore !== undefined ? Math.min(100, Math.max(0, Math.round(parsed.overallScore))) : calculatedOverall,
                communication: rubric.communication * 10,
                confidence: Math.round(calculatedOverall * 0.9),
                keywordCoverage: Math.round((rubric.technicalDepth / 10) * 100),
                wordsSpoken: words.length,
                evidenceQuotes: Array.isArray(parsed.evidenceQuotes) && parsed.evidenceQuotes.length > 0 
                    ? parsed.evidenceQuotes.slice(0, 2) 
                    : extractEvidenceQuotes(cleanTranscript),
                feedback: parsed.feedback || "Articulate technical reasoning with balanced conceptual coverage."
            };
        } catch (err) {
            console.warn("OpenAI API call failed or timed out. Falling back to local semantic engine:", err.message);
        }
    }

    // 2. Deterministic Rule-Based Semantic Engine Fallback
    const baseEval = evaluateVoiceTranscript(cleanTranscript, keywords, durationSec);

    // Dimension 1: Problem Analysis (1-10)
    let problemAnalysis = 4;
    if (words.length >= 15) problemAnalysis += 2;
    if (words.length >= 35) problemAnalysis += 1;
    const analysisTokens = ["first", "problem", "requirement", "because", "analyze", "scenario", "cause", "approach", "objective", "step"];
    analysisTokens.forEach((tok) => {
        if (lowerTranscript.includes(tok)) problemAnalysis += 0.5;
    });
    problemAnalysis = Math.min(10, Math.max(1, Math.round(problemAnalysis)));

    // Dimension 2: Technical Depth (1-10)
    let technicalDepth = 3;
    if (baseEval.keywordCoverage >= 70) technicalDepth = 9;
    else if (baseEval.keywordCoverage >= 40) technicalDepth = 7;
    else if (baseEval.keywordCoverage >= 20) technicalDepth = 5;
    const techTokens = ["algorithm", "complexity", "structure", "latency", "index", "memory", "cache", "query", "thread", "concurrency", "distributed"];
    techTokens.forEach((tok) => {
        if (lowerTranscript.includes(tok)) technicalDepth += 0.4;
    });
    technicalDepth = Math.min(10, Math.max(1, Math.round(technicalDepth)));

    // Dimension 3: Practicality (1-10)
    let practicality = 4;
    const practicalTokens = ["deploy", "production", "cache", "database", "latency", "test", "scale", "performance", "monitor", "real-time", "efficient"];
    practicalTokens.forEach((tok) => {
        if (lowerTranscript.includes(tok)) practicality += 0.7;
    });
    if (words.length >= 25) practicality += 1;
    practicality = Math.min(10, Math.max(1, Math.round(practicality)));

    // Dimension 4: Communication (1-10)
    let communication = Math.min(10, Math.max(1, Math.round((baseEval.communication || 50) / 10)));
    const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
    const lexicalDiversity = words.length > 0 ? uniqueWords.size / words.length : 0.5;
    if (lexicalDiversity > 0.65 && words.length >= 20) communication = Math.min(10, communication + 1);

    // Dimension 5: Adaptability (1-10)
    let adaptability = 4;
    const adaptTokens = ["alternative", "trade-off", "tradeoff", "fallback", "balance", "instead", "however", "adapt", "different", "versus", "option"];
    adaptTokens.forEach((tok) => {
        if (lowerTranscript.includes(tok)) adaptability += 1.2;
    });
    adaptability = Math.min(10, Math.max(1, Math.round(adaptability)));

    // Dimension 6: Ethical Judgment (1-10)
    let ethicalJudgment = 5; // Default neutral baseline
    const ethicalTokens = ["security", "privacy", "compliance", "integrity", "fairness", "bias", "safe", "consent", "protect", "sanitize", "audit", "validation"];
    ethicalTokens.forEach((tok) => {
        if (lowerTranscript.includes(tok)) ethicalJudgment += 1.2;
    });
    ethicalJudgment = Math.min(10, Math.max(1, Math.round(ethicalJudgment)));

    const rubric = {
        problemAnalysis,
        technicalDepth,
        practicality,
        communication,
        adaptability,
        ethicalJudgment
    };

    const sum = Object.values(rubric).reduce((a, b) => a + b, 0);
    const overallScore = Math.min(100, Math.max(10, Math.round((sum / 60) * 100)));

    // Formulate constructive feedback highlighting strongest & weakest dimension
    const dimensionsSorted = Object.entries(rubric).sort((a, b) => a[1] - b[1]);
    const weakest = dimensionsSorted[0][0].replace(/([A-Z])/g, " $1").toLowerCase();
    const strongest = dimensionsSorted[dimensionsSorted.length - 1][0].replace(/([A-Z])/g, " $1").toLowerCase();

    let feedback = `Demonstrated solid ${strongest} with structured reasoning. For future interviews, elevate ${weakest} with concrete industry examples and trade-off analysis.`;
    if (overallScore >= 80) {
        feedback = `Articulate, highly competent response with exceptional ${strongest} and well-calibrated technical terminology.`;
    } else if (overallScore < 50) {
        feedback = `Basic comprehension expressed, but requires deeper elaboration on ${weakest} and relevant architectural principles.`;
    }

    return {
        source: "RULES_BASED_FALLBACK",
        fallbackReason: "AI_SERVICE_UNAVAILABLE",
        rubric,
        overallScore,
        communication: communication * 10,
        confidence: baseEval.confidence || Math.round(overallScore * 0.9),
        keywordCoverage: baseEval.keywordCoverage,
        wordsSpoken: words.length,
        evidenceQuotes: extractEvidenceQuotes(cleanTranscript),
        feedback
    };
};

/**
 * Generates dynamic AI follow-up probe based on candidate's verbal transcript
 */
const generateFollowUpProbe = async ({ question = "", transcript = "", keywords = [] }) => {
    const cleanTranscript = sanitizeText(transcript);
    const cleanQuestion = sanitizeText(question);

    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith("sk-")) {
        try {
            const prompt = `You are a Senior Principal Interviewer at a top tech company.
The candidate was asked: "${cleanQuestion}"
The candidate just responded verbally with: "${cleanTranscript}"
Target concepts for this topic: ${keywords.join(", ")}

Generate ONE incisive, direct follow-up probe question (max 25 words) that tests their technical depth on something they mentioned or a critical edge-case / trade-off they glossed over.
Return JSON: { "probeQuestion": "...", "focusArea": "..." }`;

            const response = await axios.post(
                "https://api.openai.com/v1/chat/completions",
                {
                    model: "gpt-3.5-turbo",
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.5,
                    max_tokens: 100
                },
                {
                    headers: {
                        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                        "Content-Type": "application/json"
                    },
                    timeout: 5000
                }
            );

            const parsed = JSON.parse(response.data.choices[0].message.content);
            if (parsed.probeQuestion) {
                return {
                    source: "OPENAI",
                    probeQuestion: parsed.probeQuestion,
                    focusArea: parsed.focusArea || "Technical Depth"
                };
            }
        } catch (err) {
            console.warn("OpenAI probe generation skipped/failed:", err.message);
        }
    }

    // Deterministic Rule-Based Adaptive Follow-Up Engine
    const lowerTranscript = cleanTranscript.toLowerCase();
    const words = cleanTranscript.split(/\s+/).filter(Boolean);

    const missedKeywords = keywords.filter((k) => !lowerTranscript.includes(k.toLowerCase()));

    let probeQuestion = "";
    let focusArea = "Technical Depth & Trade-offs";

    if (words.length < 20) {
        probeQuestion = "Could you walk through the concrete implementation steps and trade-offs you considered in your approach?";
        focusArea = "Elaboration & Completeness";
    } else if (missedKeywords.length > 0) {
        const targetConcept = missedKeywords[0];
        probeQuestion = `You provided a good overview. How does ${targetConcept} specifically impact the scalability and reliability of your approach?`;
        focusArea = `Deep Dive: ${targetConcept}`;
    } else if (lowerTranscript.includes("database") || lowerTranscript.includes("sql") || lowerTranscript.includes("data")) {
        probeQuestion = "How did you optimize query latency and handle concurrency or cache invalidation in that scenario?";
        focusArea = "Data Scaling & Concurrency";
    } else if (lowerTranscript.includes("api") || lowerTranscript.includes("service") || lowerTranscript.includes("backend")) {
        probeQuestion = "What error handling, circuit breaking, or retry strategies did you implement to guard against cascading failures?";
        focusArea = "Fault Tolerance & Resilience";
    } else {
        probeQuestion = "What was the most challenging edge case you faced in that implementation, and what metric proved your solution worked?";
        focusArea = "Edge Cases & Validation";
    }

    return {
        source: "RULES_BASED_FALLBACK",
        probeQuestion,
        focusArea,
        missedKeywords
    };
};

/**
 * Generates personalized cognitive summary and developmental advice
 */
const generateCognitiveAdvice = ({ readiness, strengths = [], gaps = [], role = "Software Developer" }) => {
    const topStrength = strengths[0] || "Knowledge";
    const primaryGap = gaps[0] || "Communication";

    return {
        headline: `Candidate profile indicates ${readiness >= 75 ? "strong" : "developing"} alignment with ${role} competencies.`,
        strengthNote: `Your highest demonstrated cognitive competence is in ${topStrength}. Leverage this strength during technical interviews.`,
        growthNote: `Focus interview preparation on improving ${primaryGap} to achieve balanced multimodal performance.`
    };
};

module.exports = {
    sanitizeText,
    extractEvidenceQuotes,
    evaluateVerbalResponse,
    generateFollowUpProbe,
    generateCognitiveAdvice
};
