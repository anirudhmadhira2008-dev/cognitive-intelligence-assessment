const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        sessionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AssessmentSession"
        },

        name: {
            type: String,
            default: "Candidate",
            trim: true
        },

        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },

        category: {
            type: String,
            enum: ["assessment_experience", "interface", "ai_clarity", "general"],
            default: "assessment_experience"
        },

        feedback: {
            type: String,
            required: [true, "Feedback comment is required"],
            trim: true,
            maxlength: 2000
        }
    },
    {
        timestamps: true
    }
);

feedbackSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Feedback", feedbackSchema);