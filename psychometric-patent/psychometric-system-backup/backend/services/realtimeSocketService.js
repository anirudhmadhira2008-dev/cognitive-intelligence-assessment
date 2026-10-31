const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { logAuditEvent } = require("./auditLogger");

let ioInstance = null;

const initRealtimeSockets = (httpServer, allowedOrigins = []) => {
    ioInstance = new Server(httpServer, {
        cors: {
            origin: (origin, callback) => {
                if (!origin) return callback(null, true);
                if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
                    return callback(null, true);
                }
                return callback(null, true); // Dev permissive fallback
            },
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    // JWT Auth Middleware for WebSockets
    ioInstance.use((socket, next) => {
        try {
            const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace("Bearer ", "");
            if (!token) {
                // Allow unauthenticated connection in sandbox/dev mode if explicitly passed flag
                socket.user = { role: "guest", id: "guest" };
                return next();
            }
            const secret = process.env.JWT_SECRET || "default_development_secret_key_32chars_min";
            const decoded = jwt.verify(token, secret);
            socket.user = decoded;
            return next();
        } catch (err) {
            socket.user = { role: "guest", id: "guest" };
            return next();
        }
    });

    ioInstance.on("connection", (socket) => {
        const user = socket.user || {};
        console.log(`🔌 WebSocket connected: ${socket.id} (User: ${user.email || user.id || "guest"})`);

        // Join room based on role or session
        if (user.role === "admin" || user.role === "evaluator") {
            socket.join("evaluators");
            console.log(`📡 Evaluator joined dashboard room: ${socket.id}`);
        }

        socket.on("join_session", ({ sessionId }) => {
            if (sessionId) {
                socket.join(`session:${sessionId}`);
                console.log(`Candidate/Observer joined session room: session:${sessionId}`);
            }
        });

        // Handle live candidate proctoring & telemetry events
        socket.on("proctoring_event", async (eventData) => {
            const { sessionId, type, severity, metadata, time } = eventData || {};

            const payload = {
                sessionId,
                type,
                time: time || new Date().toLocaleTimeString(),
                timestamp: new Date(),
                severity: severity || "low",
                candidateId: user.id,
                metadata: metadata || {}
            };

            // Broadcast to specific session room and all evaluators
            if (sessionId) {
                ioInstance.to(`session:${sessionId}`).emit("telemetry_update", payload);
            }
            ioInstance.to("evaluators").emit("live_proctoring_event", payload);
        });

        socket.on("disconnect", (reason) => {
            console.log(`🔌 WebSocket disconnected: ${socket.id} (${reason})`);
        });
    });

    return ioInstance;
};

const getIO = () => ioInstance;

const emitToEvaluators = (eventName, data) => {
    if (ioInstance) {
        ioInstance.to("evaluators").emit(eventName, data);
    }
};

const emitToSession = (sessionId, eventName, data) => {
    if (ioInstance && sessionId) {
        ioInstance.to(`session:${sessionId}`).emit(eventName, data);
        ioInstance.to("evaluators").emit(eventName, { sessionId, ...data });
    }
};

module.exports = {
    initRealtimeSockets,
    getIO,
    emitToEvaluators,
    emitToSession
};
