/**
 * Controlled Pilot Load Testing Simulation (150-Participant Capacity)
 * Simulates concurrent candidate assessment journeys:
 * Auth -> Session Start -> 6-Question Adaptive MCQ -> Proctoring Telemetry -> Voice Evaluation -> Final Submission
 */

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const connectDB = require("../config/db");
const User = require("../models/User");

const BASE_URL = process.env.LOAD_TEST_URL || "http://localhost:5000";
const CONCURRENCY_LEVELS = [10, 25, 50, 100, 150];

let globalAdminToken = null;

function calculatePercentile(latencies, percentile) {
    if (!latencies || latencies.length === 0) return 0;
    const sorted = [...latencies].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return Math.round(sorted[Math.max(0, index)]);
}

async function initializeAdmin() {
    let admin = await User.findOne({ role: "admin" });
    if (!admin) {
        admin = await User.create({
            name: "Master Benchmark Admin",
            email: `admin_bench_${Date.now()}@univ.edu`,
            password: "AdminPassword123!",
            role: "admin",
            accountStatus: "active"
        });
    }
    const secret = process.env.JWT_SECRET || "default_development_secret_key_32chars_min";
    globalAdminToken = jwt.sign(
        { id: admin._id.toString(), role: "admin", email: admin.email },
        secret,
        { expiresIn: "5h" }
    );
    console.log("✓ Benchmark supervisor initialized with verified examiner privileges");
}

async function simulateCandidateJourney(userIndex) {
    const candidateLatencies = [];
    const recordTime = async (fn) => {
        const start = Date.now();
        const res = await fn();
        const duration = Date.now() - start;
        candidateLatencies.push(duration);
        return { res, duration };
    };

    try {
        const unique = `load_${Date.now()}_${userIndex}_${Math.floor(Math.random() * 10000)}`;
        const testId = userIndex % 2 === 0 ? "TEST-1" : "TEST-2";

        // 1. Candidate Registration / Auth
        const authRes = await recordTime(() =>
            axios.post(`${BASE_URL}/api/auth/register`, {
                name: `Synthetic Candidate ${userIndex}`,
                email: `${unique}@pilot-loadtest.edu`,
                password: "SecureLoadPassword123!",
                rollNumber: `PILOT-${userIndex.toString().padStart(3, "0")}`
            })
        );
        const token = authRes.res.data.token;
        const candidateId = authRes.res.data.user?.id || authRes.res.data.user?._id;
        const headers = { Authorization: `Bearer ${token}` };

        // 2. Identity Enrollment & Verification Gate
        const dummyBuffer = Buffer.concat([Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBD"), Buffer.alloc(3000, "b")]);
        const dummyPhoto = "data:image/jpeg;base64," + dummyBuffer.toString("base64");
        const enrollRes = await recordTime(() =>
            axios.post(
                `${BASE_URL}/api/enrollment/create`,
                {
                    candidateId,
                    title: "Dual Test Evaluation",
                    referenceImage: dummyPhoto,
                    consent: true
                },
                { headers }
            )
        );
        const enrollmentId = enrollRes.res.data.enrollment?._id || enrollRes.res.data.enrollmentId;

        // Fast manual approval for synthetic benchmark candidates
        const approveRes = await recordTime(() =>
            axios.post(
                `${BASE_URL}/api/enrollment/${enrollmentId}/manual-approve`,
                { notes: "Benchmark automated approval" },
                { headers: { Authorization: `Bearer ${globalAdminToken}` } }
            )
        );
        const verificationToken = approveRes.res.data.verificationToken;

        // 3. Start Assessment Session
        const startRes = await recordTime(() =>
            axios.post(
                `${BASE_URL}/api/assessment/start`,
                { testId, cohortId: "PILOT-150-LOAD", role: "Software Developer", verificationToken, enrollmentId },
                { headers }
            )
        );
        const sessionId = startRes.res.data.sessionId || startRes.res.data.session?._id;

        // 4. 6 Adaptive Question Cycles
        let currentDifficulty = 2;
        let attempted = [];

        for (let q = 0; q < 6; q++) {
            // 4a. Get next adaptive question
            const qRes = await recordTime(() =>
                axios.get(
                    `${BASE_URL}/api/assessment/next-question?difficulty=${currentDifficulty}&attempted=${attempted.join(",")}&sessionId=${sessionId}`,
                    { headers }
                )
            );

            const servedQuestion = qRes.res.data.question;
            if (!servedQuestion) break;
            const qId = servedQuestion.questionId;

            // 4b. Record Answer
            const answerRes = await recordTime(() =>
                axios.post(
                    `${BASE_URL}/api/assessment/answer`,
                    {
                        sessionId,
                        questionId: qId,
                        choiceIndex: q % 4,
                        responseMs: 1200 + Math.random() * 800,
                        confidence: 75
                    },
                    { headers }
                )
            );

            currentDifficulty = answerRes.res.data.nextDifficulty || currentDifficulty;
            attempted.push(qId);

            // 4c. Send proctoring telemetry
            await recordTime(() =>
                axios.post(
                    `${BASE_URL}/api/assessment/progress`,
                    {
                        sessionId,
                        events: [{ type: "FOCUS_VERIFIED", time: "10:00:00", severity: "low" }]
                    },
                    { headers }
                )
            );
        }

        // 5. Voice Evaluation
        await recordTime(() =>
            axios.post(
                `${BASE_URL}/api/voice/evaluate`,
                {
                    sessionId,
                    question: "Explain database indexing and concurrency control",
                    transcript: "We use B-tree indices for fast lookup and transactions with MVCC for concurrency.",
                    keywords: ["indexing", "concurrency", "database"],
                    durationSec: 15
                },
                { headers }
            )
        );

        // 6. Finalize Session & Generate Report
        await recordTime(() =>
            axios.post(
                `${BASE_URL}/api/assessment/submit`,
                {
                    sessionId,
                    device: {
                        checks: {
                            camera: true,
                            microphone: true,
                            secureContext: true,
                            storage: true,
                            network: true,
                            screen: true
                        }
                    }
                },
                { headers }
            )
        );

        return { success: true, latencies: candidateLatencies };
    } catch (err) {
        if (userIndex <= 2) {
            console.error(`ERROR USER ${userIndex}:`, err.response?.status, err.response?.data || err.message);
        }
        return {
            success: false,
            error: err.response?.data?.message || err.message,
            latencies: candidateLatencies
        };
    }
}

async function runBenchmarkTier(concurrentUsers) {
    console.log(`\n======================================================`);
    console.log(`🚀 RUNNING LOAD TIER: ${concurrentUsers} CONCURRENT PARTICIPANTS`);
    console.log(`======================================================`);

    const startTime = Date.now();
    const tasks = Array.from({ length: concurrentUsers }, (_, idx) => simulateCandidateJourney(idx + 1));
    const results = await Promise.all(tasks);
    const totalElapsedSec = (Date.now() - startTime) / 1000;

    let totalRequests = 0;
    const allLatencies = [];
    let successes = 0;
    let failures = 0;

    for (const r of results) {
        totalRequests += r.latencies.length;
        allLatencies.push(...r.latencies);
        if (r.success) successes++;
        else failures++;
    }

    const p50 = calculatePercentile(allLatencies, 50);
    const p95 = calculatePercentile(allLatencies, 95);
    const p99 = calculatePercentile(allLatencies, 99);
    const rps = Math.round((totalRequests / totalElapsedSec) * 10) / 10;
    const errorRate = Math.round((failures / concurrentUsers) * 1000) / 10;

    console.log(`✓ Completed in:       ${totalElapsedSec.toFixed(2)}s`);
    console.log(`✓ Total HTTP Requests: ${totalRequests}`);
    console.log(`✓ Throughput:         ${rps} req/sec`);
    console.log(`✓ Success Rate:       ${((successes / concurrentUsers) * 100).toFixed(1)}%`);
    console.log(`✓ Error Rate:         ${errorRate}%`);
    console.log(`✓ Latency p50:        ${p50}ms`);
    console.log(`✓ Latency p95:        ${p95}ms`);
    console.log(`✓ Latency p99:        ${p99}ms`);

    return {
        concurrency: concurrentUsers,
        totalRequests,
        elapsedSec: totalElapsedSec,
        throughputRps: rps,
        successRate: ((successes / concurrentUsers) * 100).toFixed(1) + "%",
        errorRate: errorRate + "%",
        p50,
        p95,
        p99
    };
}

async function main() {
    await connectDB();
    await initializeAdmin();
    console.log("Starting Controlled 150-Participant Pilot Load Benchmark...");
    const reportData = [];

    for (const concurrency of CONCURRENCY_LEVELS) {
        const tierSummary = await runBenchmarkTier(concurrency);
        reportData.push(tierSummary);
    }

    console.log("\n======================================================");
    console.log("📊 LOAD BENCHMARK SUMMARY TABLE");
    console.log("======================================================");
    console.table(reportData);

    const outPath = path.join(__dirname, "../load_benchmark_results.json");
    fs.writeFileSync(outPath, JSON.stringify(reportData, null, 2));
    console.log(`\nSaved benchmark metrics to ${outPath}`);
    process.exit(0);
}

main().catch((err) => {
    console.error("Benchmark execution error:", err);
    process.exit(1);
});
