const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Name is required"],
            trim: true,
            minlength: [2, "Name must be at least 2 characters"],
            maxlength: [100, "Name cannot exceed 100 characters"]
        },

        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
            match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"]
        },

        password: {
            type: String,
            required: [true, "Password is required"],
            minlength: [8, "Password must be at least 8 characters"],
            select: false
        },

        role: {
            type: String,
            enum: {
                values: ["admin", "psychologist", "evaluator", "student"],
                message: "{VALUE} is not a supported role"
            },
            default: "student",
            index: true
        },

        rollNumber: {
            type: String,
            trim: true,
            default: ""
        },

        college: {
            type: String,
            trim: true,
            default: ""
        },

        course: {
            type: String,
            trim: true,
            default: "B.Tech"
        },

        branch: {
            type: String,
            trim: true,
            default: ""
        },

        year: {
            type: String,
            trim: true,
            default: ""
        },

        phone: {
            type: String,
            trim: true,
            default: ""
        },

        profilePhoto: {
            type: String,
            default: ""
        },

        profilePhotoData: {
            type: String,
            default: ""
        },

        isActive: {
            type: Boolean,
            default: true,
            index: true
        },

        accountStatus: {
            type: String,
            enum: ["active", "suspended", "pending_review"],
            default: "active",
            index: true
        },

        lastLogin: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

// Compound index for role-based student queries
userSchema.index({ role: 1, createdAt: -1 });

module.exports = mongoose.model("User", userSchema);