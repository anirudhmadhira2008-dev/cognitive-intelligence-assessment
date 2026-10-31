const mongoose = require("mongoose");

const testDefinitionSchema = new mongoose.Schema(
    {
        testId: {
            type: String,
            required: [true, "testId is required (e.g. TEST_1, TEST_2)"],
            unique: true,
            trim: true,
            index: true
        },
        version: {
            type: String,
            required: true,
            default: "1.0.0"
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            default: ""
        },
        cohortId: {
            type: String,
            default: "DEFAULT",
            index: true
        },
        blueprint: {
            Knowledge: { type: Number, default: 35 },
            Reasoning: { type: Number, default: 25 },
            Communication: { type: Number, default: 15 },
            Behavior: { type: Number, default: 10 },
            Integrity: { type: Number, default: 15 }
        },
        rubricVersion: {
            type: String,
            default: "1.0"
        },
        scoringVersion: {
            type: String,
            default: "2.0"
        },
        timeLimitMinutes: {
            type: Number,
            default: 45
        },
        targetQuestionCount: {
            type: Number,
            default: 6
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        },
        allowedRoles: {
            type: [String],
            default: ["student"]
        },
        isSynthetic: {
            type: Boolean,
            default: false,
            index: true
        }
    },
    {
        timestamps: true
    }
);

testDefinitionSchema.index({ cohortId: 1, isActive: 1 });

module.exports = mongoose.model("TestDefinition", testDefinitionSchema);
