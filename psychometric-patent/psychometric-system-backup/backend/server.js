require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const { loadEnvPolicy } = require("./config/env");
const connectDB = require("./config/db");
const { notFoundHandler, globalErrorHandler } = require("./middleware/errorMiddleware");

const envPolicy = loadEnvPolicy();

// Route handlers
const http = require("http");
const https = require("https");
const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
const enrollmentRoutes = require("./routes/enrollmentRoutes");
const assessmentRoutes = require("./routes/assessmentRoutes");
const resultRoutes = require("./routes/resultRoutes");
const reportRoutes = require("./routes/reportRoutes");
const adminRoutes = require("./routes/adminRoutes");
const voiceRoutes = require("./routes/voiceRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const complianceRoutes = require("./routes/complianceRoutes");

const { initRealtimeSockets } = require("./services/realtimeSocketService");
const { initRedis } = require("./services/redisService");
const { startMediaRetentionSweeper } = require("./services/mediaRetentionService");

// Adaptive Question Seeder
const Question = require("./models/Question");
const { QUESTION_BANK } = require("./services/adaptiveEngine");

const app = express();
const PORT = process.env.PORT || 5000;

// Reverse Proxy & Production Trust Settings
app.set("trust proxy", 1);

app.locals.allowSandbox = envPolicy.allowSandbox;
app.locals.envPolicy = envPolicy;

// Advanced TLS & Web Security Headers
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com"],
                imgSrc: ["'self'", "data:", "blob:"],
                mediaSrc: ["'self'", "blob:"],
                connectSrc: ["'self'", "http:", "https:", "ws:", "wss:"]
            }
        },
        referrerPolicy: { policy: "strict-origin-when-cross-origin" },
        hsts: envPolicy.isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false
    })
);

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            const isVercel = origin.endsWith(".vercel.app") || origin === "https://cognitive-intelligence-assessment.vercel.app";
            if (envPolicy.allowedOrigins.includes(origin) || envPolicy.allowedOrigins.includes("*") || isVercel) {
                return callback(null, true);
            }
            if (!envPolicy.isProd) {
                return callback(null, true);
            }
            return callback(new Error("Not allowed by CORS"));
        },
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true
    })
);

if (!envPolicy.isTest) {
    const apiLimiter = rateLimit({
        windowMs: envPolicy.rateLimitWindowMs,
        max: envPolicy.rateLimitMax,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            success: false,
            message: "Too many requests from this IP. Please try again later."
        }
    });
    app.use("/api", apiLimiter);
}

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Static uploads directory
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// ==========================================
// ROUTES
// ==========================================
app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/enrollment", enrollmentRoutes);
app.use("/api/assessment", assessmentRoutes);
app.use("/api/results", resultRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/report", reportRoutes); // Alias for singular route compatibility
app.use("/api/admin", adminRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/compliance", complianceRoutes);

// Root greeting
app.get("/", (_req, res) => {
    res.json({
        success: true,
        service: "Multimodal Psychometric Assessment API",
        version: "2.0.0",
        patent: "System and Method for Multimodal Psychometric Assessment",
        status: "operational",
        mode: app.locals.dbConnected ? "MongoDB Atlas" : "Development Sandbox"
    });
});

// Centralized 404 and Error Middleware
app.use(notFoundHandler);
app.use(globalErrorHandler);

// ==========================================
// SERVER INITIALIZATION & LIFECYCLE
// ==========================================
let server;

// Native TLS / HTTPS Configuration Support
const tlsCertPath = process.env.TLS_CERT_PATH || process.env.SSL_CERT_PATH;
const tlsKeyPath = process.env.TLS_KEY_PATH || process.env.SSL_KEY_PATH;
const isNativeTls = Boolean(tlsCertPath && tlsKeyPath && fs.existsSync(tlsCertPath) && fs.existsSync(tlsKeyPath));

let serverProtocol = "http";
let primaryServer;

if (isNativeTls) {
    const tlsOptions = {
        key: fs.readFileSync(tlsKeyPath),
        cert: fs.readFileSync(tlsCertPath),
        minVersion: "TLSv1.2"
    };
    primaryServer = https.createServer(tlsOptions, app);
    serverProtocol = "https";
} else {
    primaryServer = http.createServer(app);
}

const startServer = async () => {
    try {
        const connection = await connectDB();
        app.locals.dbConnected = Boolean(connection);
        if (envPolicy.isProd && !app.locals.dbConnected) {
            throw new Error("CRITICAL: Production cannot start without MongoDB");
        }

        // Initialize Redis Client
        initRedis();

        // Initialize Real-time Socket.IO WebSockets
        initRealtimeSockets(primaryServer, envPolicy.allowedOrigins);

        // Feature 4: Initialize Ephemeral Media Retention Sweeper (Zero-Biometric-Persistence)
        startMediaRetentionSweeper();

        // Seed question bank if database is connected and empty
        if (app.locals.dbConnected) {
            try {
                const count = await Question.countDocuments();
                if (count === 0) {
                    await Question.insertMany(QUESTION_BANK);
                    console.log(`🌱 Seeded ${QUESTION_BANK.length} psychometric assessment questions into MongoDB`);
                }
            } catch (seedErr) {
                console.warn("Question seeding check warning:", seedErr.message);
            }
        }

        server = primaryServer.listen(PORT, () => {
            console.log(`====================================================`);
            console.log(`🚀 Psychometric Backend Server Running on ${serverProtocol.toUpperCase()}: Port ${PORT}`);
            console.log(`📡 Environment: ${process.env.NODE_ENV || "development"}`);
            console.log(`🗄️ Database Mode: ${app.locals.dbConnected ? "MongoDB Connected" : "Local Sandbox Mode"}`);
            console.log(`🔌 WebSockets: Socket.IO initialized`);
            console.log(`🛡️ Security: Helmet | CORS ${envPolicy.isProd ? "strict" : "dev-permissive"} | Rate-limit ${envPolicy.isTest ? "off(test)" : "on"} | RBAC`);
            console.log(`====================================================`);
        });

    } catch (error) {
        console.error("FATAL: Server startup aborted due to critical initialization error:", error.message);
        process.exit(1);
    }
};

// Graceful shutdown
const gracefulShutdown = (signal) => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    if (server) {
        server.close(async () => {
            console.log("HTTP server closed.");
            try {
                if (mongoose.connection.readyState !== 0) {
                    await mongoose.connection.close();
                    console.log("MongoDB connection closed.");
                }
            } catch (err) {
                console.warn("MongoDB shutdown warning:", err.message);
            }
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Start server if executed directly
if (require.main === module) {
    startServer();
}

module.exports = app;