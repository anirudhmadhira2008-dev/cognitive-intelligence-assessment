const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

router.get("/health", (req, res) => {
    res.json({
        success: true,
        status: "healthy",
        service: "ai-psychometric-backend",
        version: "2.0.0",
        environment: process.env.NODE_ENV || "development",
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

router.get("/health/db", (req, res) => {
    const dbState = mongoose.connection.readyState;
    const states = {
        0: "disconnected",
        1: "connected",
        2: "connecting",
        3: "disconnecting"
    };

    const isConnected = dbState === 1 || Boolean(req.app.locals.dbConnected);

    res.status(isConnected ? 200 : 503).json({
        success: isConnected,
        database: {
            status: states[dbState] || "unknown",
            host: mongoose.connection.host ? "configured" : "unconfigured",
            name: mongoose.connection.name || "psychometric_assessment"
        },
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
