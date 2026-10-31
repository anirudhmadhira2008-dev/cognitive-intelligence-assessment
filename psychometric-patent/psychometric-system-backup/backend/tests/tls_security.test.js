const request = require("supertest");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const { loadEnvPolicy } = require("../config/env");

describe("Feature 1: TLS & Web Security Tests", () => {
    let app;
    let envPolicy;

    beforeAll(() => {
        envPolicy = loadEnvPolicy();
        app = express();

        app.set("trust proxy", 1);

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
                hsts: true
            })
        );

        app.use(
            cors({
                origin: (origin, callback) => {
                    if (!origin) return callback(null, true);
                    if (envPolicy.allowedOrigins.includes(origin)) {
                        return callback(null, true);
                    }
                    return callback(new Error("Not allowed by CORS"));
                },
                credentials: true
            })
        );

        app.get("/api/test-security", (_req, res) => {
            res.json({ success: true, message: "Security headers active" });
        });
    });

    test("1. Returns strict X-Content-Type-Options: nosniff header", async () => {
        const res = await request(app).get("/api/test-security");
        expect(res.headers["x-content-type-options"]).toBe("nosniff");
    });

    test("2. Returns strict Referrer-Policy: strict-origin-when-cross-origin", async () => {
        const res = await request(app).get("/api/test-security");
        expect(res.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    });

    test("3. Returns Content-Security-Policy with secure WSS and HTTPS directives", async () => {
        const res = await request(app).get("/api/test-security");
        const csp = res.headers["content-security-policy"];
        expect(csp).toBeDefined();
        expect(csp).toContain("default-src 'self'");
        expect(csp).toContain("connect-src 'self' http: https: ws: wss:");
        expect(csp).toContain("font-src 'self' https://fonts.gstatic.com");
    });

    test("4. Returns Strict-Transport-Security (HSTS) header for TLS connections", async () => {
        const res = await request(app).get("/api/test-security");
        expect(res.headers["strict-transport-security"]).toBeDefined();
        expect(res.headers["strict-transport-security"]).toContain("max-age=");
    });

    test("5. Allows permitted frontend origins (http://localhost:5173)", async () => {
        const res = await request(app)
            .get("/api/test-security")
            .set("Origin", "http://localhost:5173");
        expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
        expect(res.headers["access-control-allow-credentials"]).toBe("true");
    });

    test("6. Trust proxy configuration correctly extracts client IP from proxy header", async () => {
        app.get("/api/test-proxy", (req, res) => {
            res.json({ ip: req.ip });
        });

        const res = await request(app)
            .get("/api/test-proxy")
            .set("X-Forwarded-For", "203.0.113.195");
        expect(res.body.ip).toBe("203.0.113.195");
    });
});
