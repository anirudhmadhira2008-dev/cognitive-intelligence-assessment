const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
    {
        questionId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true
        },

        domain: {
            type: String,
            required: true,
            trim: true,
            index: true
        },

        difficulty: {
            type: Number,
            required: true,
            min: 1,
            max: 3,
            index: true
        },

        type: {
            type: String,
            enum: ["mcq", "voice"],
            default: "mcq",
            index: true
        },

        bloom: {
            type: String,
            enum: ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"],
            default: "Understand"
        },

        competency: {
            type: String,
            required: true,
            trim: true
        },

        question: {
            type: String,
            required: true,
            trim: true
        },

        options: [{ type: String }],

        answer: {
            type: Number,
            default: 0
        },

        concepts: [{ type: String }],

        keywords: [{ type: String }],

        explanation: {
            type: String,
            default: ""
        },

        isActive: {
            type: Boolean,
            default: true,
            index: true
        }
    },
    {
        timestamps: true
    }
);

questionSchema.index({ type: 1, difficulty: 1, domain: 1 });

module.exports = mongoose.model("Question", questionSchema);
