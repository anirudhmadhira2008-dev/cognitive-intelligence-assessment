/**
 * Database Migration Script: Dual-Test Architecture & Index Provisioning (Phase-3)
 * Safely updates historical records in-place without data loss.
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");

const AssessmentSession = require("../models/AssessmentSession");
const Result = require("../models/Result");
const SignedReport = require("../models/SignedReport");
const TestDefinition = require("../models/TestDefinition");

async function runMigration() {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/testing";
    console.log(`Connecting to database for Phase-3 migration: ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log("Connected successfully. Analyzing existing records...\n");

    // 1. Migrate AssessmentSession records
    const sessionRes = await AssessmentSession.updateMany(
        { testId: { $exists: false } },
        {
            $set: {
                testId: "TEST_1",
                testVersion: "1.0.0",
                cohortId: "DEFAULT",
                attemptNumber: 1,
                isSynthetic: false
            }
        }
    );
    console.log(`1. Migrated ${sessionRes.modifiedCount} AssessmentSession record(s) to versioned schema.`);

    // 2. Migrate Result records
    const resultRes = await Result.updateMany(
        { testId: { $exists: false } },
        {
            $set: {
                testId: "TEST_1",
                testVersion: "1.0.0",
                cohortId: "DEFAULT",
                attemptNumber: 1,
                isSynthetic: false
            }
        }
    );
    console.log(`2. Migrated ${resultRes.modifiedCount} Result record(s) to versioned schema.`);

    // 3. Migrate SignedReport records
    const reportRes = await SignedReport.updateMany(
        { testId: { $exists: false } },
        {
            $set: {
                testId: "TEST_1",
                cohortId: "DEFAULT",
                attemptNumber: 1,
                isSynthetic: false
            }
        }
    );
    console.log(`3. Migrated ${reportRes.modifiedCount} SignedReport record(s) to versioned schema.`);

    // 4. Seed Standard Test Definitions (TEST_1 and TEST_2)
    const test1 = await TestDefinition.findOneAndUpdate(
        { testId: "TEST_1" },
        {
            $set: {
                version: "1.0.0",
                title: "Multimodal Psychometric Engineering Assessment — Round 1 (Pre-Assessment)",
                description: "Evaluates baseline cognitive knowledge, analytical reasoning, and verbal communication.",
                cohortId: "DEFAULT",
                timeLimitMinutes: 45,
                targetQuestionCount: 6,
                isActive: true
            }
        },
        { upsert: true, new: true }
    );

    const test2 = await TestDefinition.findOneAndUpdate(
        { testId: "TEST_2" },
        {
            $set: {
                version: "1.0.0",
                title: "Multimodal Psychometric Engineering Assessment — Round 2 (Post-Assessment)",
                description: "Evaluates longitudinal cognitive progression, interview readiness, and adaptability development.",
                cohortId: "DEFAULT",
                timeLimitMinutes: 45,
                targetQuestionCount: 6,
                isActive: true
            }
        },
        { upsert: true, new: true }
    );

    console.log(`4. Seeded/Synchronized Test Definitions: ${test1.testId} and ${test2.testId}.`);

    // 5. Ensure indexes
    await AssessmentSession.syncIndexes();
    await Result.syncIndexes();
    await SignedReport.syncIndexes();
    await TestDefinition.syncIndexes();
    console.log("5. Synchronized all compound database indexes.");

    console.log("\n=== Phase-3 Database Migration Completed Successfully ===");
    await mongoose.disconnect();
}

if (require.main === module) {
    runMigration().catch((err) => {
        console.error("Migration failed:", err);
        process.exit(1);
    });
}

module.exports = { runMigration };
