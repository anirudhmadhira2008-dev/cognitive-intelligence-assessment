const EventEmitter = require("events");
const { emitToEvaluators, emitToSession } = require("./realtimeSocketService");

class AssessmentEventBus extends EventEmitter {}

const eventBus = new AssessmentEventBus();

// Registered Event Workers
// 1. Proctoring Worker
eventBus.on("PROCTORING_TELEMETRY", async (payload) => {
    try {
        const { sessionId, event } = payload;
        emitToSession(sessionId, "telemetry_update", event);
        emitToEvaluators("live_proctoring_event", { sessionId, ...event });
    } catch (err) {
        console.warn("Proctoring worker error:", err.message);
    }
});

// 2. AI Worker for Asynchronous Voice & Evaluation Processing
eventBus.on("AI_PROCESS_VOICE", async (payload) => {
    try {
        const { sessionId, audioPath, textTranscript } = payload;
        // Asynchronous AI task execution offloaded from API HTTP request thread
        console.log(`🤖 AI Worker processing voice payload for session ${sessionId}...`);
    } catch (err) {
        console.warn("AI worker error:", err.message);
    }
});

// 3. Analytics & Audit Worker
eventBus.on("ANALYTICS_EVENT", async (payload) => {
    try {
        const { eventName, metadata } = payload;
        // Asynchronous analytics logging
    } catch (err) {
        console.warn("Analytics worker error:", err.message);
    }
});

module.exports = {
    eventBus
};
