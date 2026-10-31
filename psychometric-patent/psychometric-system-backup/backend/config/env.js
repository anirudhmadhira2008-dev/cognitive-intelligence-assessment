/**
 * Environment policy. Production must fail closed; development/test may use sandbox.
 */

const INSECURE_SECRET_MARKERS = [
    "replace_with",
    "must_be_overridden",
    "dev_secret",
    "dev-only",
    "prod_secret_must"
];

function loadEnvPolicy() {
    const nodeEnv = process.env.NODE_ENV || "development";
    const isProd = nodeEnv === "production";
    const isTest = nodeEnv === "test";
    const secret = process.env.JWT_SECRET || "";

    if (isProd) {
        if (!process.env.MONGO_URI) {
            throw new Error("CRITICAL: MONGO_URI is required in production");
        }
        if (secret.length < 32) {
            throw new Error("CRITICAL: JWT_SECRET must be at least 32 characters in production");
        }
        if (INSECURE_SECRET_MARKERS.some((marker) => secret.toLowerCase().includes(marker))) {
            throw new Error("CRITICAL: JWT_SECRET appears to be a placeholder and cannot be used in production");
        }
    } else if (!secret) {
        process.env.JWT_SECRET = "dev-only-insecure-jwt-secret-key-32ch";
        console.warn("⚠️ JWT_SECRET missing; using a development-only default. Never deploy this value.");
    }

    const rawClientUrls = process.env.CLIENT_URL || "http://localhost:3000,http://localhost:5173";
    const allowedOrigins = rawClientUrls.split(",").map((url) => url.trim()).filter(Boolean);

    return {
        nodeEnv,
        isProd,
        isTest,
        allowSandbox: !isProd,
        allowedOrigins,
        rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
        rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 5000 // Accommodates 150 campus pilot candidates sharing a single NAT gateway
    };
}

function sandboxAllowed(req) {
    return Boolean(req.app?.locals?.allowSandbox) && !req.app?.locals?.dbConnected;
}

module.exports = {
    loadEnvPolicy,
    sandboxAllowed
};
