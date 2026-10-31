const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Enrollment = require("../models/Enrollment");
const identityStorageService = require("../services/identityStorageService");
const identityService = require("../services/identityVerificationService");
const { sandboxAllowed } = require("../config/env");

// Helper to sign JWT token
const signToken = (user) => {
    return jwt.sign(
        {
            id: user._id.toString(),
            role: user.role,
            email: user.email,
            name: user.name
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || "24h"
        }
    );
};

// ==========================================
// REGISTER
// ==========================================
const register = async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            rollNumber,
            college,
            course,
            branch,
            year,
            phone,
            photo,
            profilePhoto,
            referenceImage
        } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email, and password are required fields"
            });
        }

        if (name.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: "Name must contain at least 2 characters"
            });
        }

        const emailRegex = /^\S+@\S+\.\S+$/;
        if (!emailRegex.test(email.trim())) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Process profile / reference photo if supplied
        const rawPhoto = profilePhoto || referenceImage || photo || "";
        let storedPhotoPath = "";
        let imageMetaData = null;

        if (rawPhoto) {
            try {
                const storeRes = await identityStorageService.storeReferencePhoto(rawPhoto);
                if (storeRes.success) {
                    storedPhotoPath = `/api/enrollment/reference-image/${storeRes.secureStorageKey}`;
                    imageMetaData = {
                        referenceImageId: storeRes.referenceImageId,
                        secureStorageKey: storeRes.secureStorageKey,
                        referenceImage: storedPhotoPath,
                        mimetype: storeRes.mimetype,
                        size: storeRes.size
                    };
                }
            } catch (photoErr) {
                console.warn("Reference photo storage warning during registration:", photoErr.message);
            }
        }

        // Check if database is connected
        if (req.app.locals.dbConnected) {
            const existingUser = await User.findOne({ email: normalizedEmail });
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: "An account with this email address already exists"
                });
            }

            const passwordHash = await bcrypt.hash(password, 12);

            // Public registration always assigns the student role
            const user = await User.create({
                name: name.trim(),
                email: normalizedEmail,
                password: passwordHash,
                role: "student",
                rollNumber: rollNumber ? rollNumber.trim() : "",
                college: college ? college.trim() : "",
                course: course ? course.trim() : "B.Tech",
                branch: branch ? branch.trim() : "",
                year: year ? year.trim() : "",
                phone: phone ? phone.trim() : "",
                profilePhoto: storedPhotoPath || rawPhoto || "",
                profilePhotoData: rawPhoto || "",
                isActive: true,
                accountStatus: "active"
            });

            // Automatically create candidate assessment enrollment with enrolled reference photo
            try {
                await Enrollment.create({
                    candidateId: user._id,
                    assessmentId: "default-psychometric-v1",
                    title: "AI Multimodal Psychometric Engineering Assessment",
                    roleTarget: branch ? `${branch.trim()} Engineer` : "Software Developer",
                    enrollmentStatus: "ENROLLED",
                    identityEnrollment: {
                        ...(imageMetaData || {
                            referenceImage: storedPhotoPath || rawPhoto || "",
                            referenceImageId: `ref-${Date.now()}`
                        }),
                        referenceImageData: rawPhoto || "",
                        consent: true,
                        consentTimestamp: new Date(),
                        enrolledAt: new Date(),
                        uploadedAt: new Date(),
                        enrolledBy: user._id,
                        verificationStatus: "PENDING",
                        verificationAttempts: 0
                    }
                });
            } catch (enrollErr) {
                console.warn("Auto enrollment creation notice:", enrollErr.message);
            }

            const token = signToken(user);

            return res.status(201).json({
                success: true,
                message: "Registration successful",
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    rollNumber: user.rollNumber,
                    college: user.college,
                    course: user.course,
                    branch: user.branch,
                    year: user.year,
                    profilePhoto: user.profilePhoto
                }
            });
        } else if (sandboxAllowed(req)) {
            const demoId = `dev-user-${Date.now()}`;
            const token = jwt.sign(
                { id: demoId, role: "student", email: normalizedEmail, name: name.trim() },
                process.env.JWT_SECRET,
                { expiresIn: "24h" }
            );

            // Store in sandbox memory enrollments
            identityService.upsertMemoryEnrollment({
                _id: `dev-enroll-${Date.now()}`,
                candidateId: demoId,
                assessmentId: "default-psychometric-v1",
                title: "AI Multimodal Psychometric Engineering Assessment",
                roleTarget: branch ? `${branch} Engineer` : "Software Developer",
                enrollmentStatus: "ENROLLED",
                identityEnrollment: {
                    referenceImage: storedPhotoPath || rawPhoto || "",
                    referenceImageId: `ref-${Date.now()}`,
                    consent: true,
                    consentTimestamp: new Date(),
                    enrolledAt: new Date(),
                    verificationStatus: "PENDING",
                    verificationAttempts: 0
                }
            });

            return res.status(201).json({
                success: true,
                message: "Registered in development sandbox mode",
                token,
                user: {
                    id: demoId,
                    name: name.trim(),
                    email: normalizedEmail,
                    role: "student",
                    rollNumber: rollNumber || "",
                    college: college || "",
                    course: course || "B.Tech",
                    branch: branch || "",
                    year: year || "",
                    profilePhoto: storedPhotoPath || rawPhoto || ""
                }
            });
        }

        return res.status(503).json({
            success: false,
            message: "Registration is unavailable because the database is not connected"
        });
    } catch (error) {
        console.error("Registration error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error during registration",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// ==========================================
// LOGIN
// ==========================================
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        if (req.app.locals.dbConnected) {
            const user = await User.findOne({ email: normalizedEmail }).select("+password");

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid email or password"
                });
            }

            if (!user.isActive || user.accountStatus === "suspended") {
                return res.status(403).json({
                    success: false,
                    message: "Account has been deactivated or suspended. Please contact the administrator."
                });
            }

            const passwordMatch = await bcrypt.compare(password, user.password);

            if (!passwordMatch) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid email or password"
                });
            }

            user.lastLogin = new Date();
            await user.save();

            const token = signToken(user);

            return res.status(200).json({
                success: true,
                message: "Login successful",
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    rollNumber: user.rollNumber,
                    college: user.college,
                    course: user.course,
                    branch: user.branch,
                    year: user.year,
                    profilePhoto: user.profilePhoto,
                    isActive: user.isActive,
                    lastLogin: user.lastLogin
                }
            });
        } else if (sandboxAllowed(req)) {
            const demoId = `dev-user-${Date.now()}`;
            const token = jwt.sign(
                { id: demoId, role: "student", email: normalizedEmail, name: "Candidate" },
                process.env.JWT_SECRET,
                { expiresIn: "24h" }
            );

            return res.status(200).json({
                success: true,
                message: "Logged in via development sandbox",
                token,
                user: {
                    id: demoId,
                    name: "Candidate",
                    email: normalizedEmail,
                    role: "student",
                    rollNumber: "DEMO-001",
                    college: "Engineering Institute",
                    course: "B.Tech",
                    branch: "Computer Science",
                    year: "4"
                }
            });
        }

        return res.status(503).json({
            success: false,
            message: "Login is unavailable because the database is not connected"
        });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error during login",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// ==========================================
// GET CURRENT USER (/me)
// ==========================================
const getMe = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Not authenticated"
            });
        }

        if (req.app.locals.dbConnected) {
            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User profile not found"
                });
            }

            return res.status(200).json({
                success: true,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    rollNumber: user.rollNumber,
                    college: user.college,
                    course: user.course,
                    branch: user.branch,
                    year: user.year,
                    phone: user.phone,
                    profilePhoto: user.profilePhoto,
                    accountStatus: user.accountStatus,
                    lastLogin: user.lastLogin,
                    createdAt: user.createdAt
                }
            });
        }

        return res.status(200).json({
            success: true,
            user: req.user
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching user details",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// ==========================================
// UPDATE PROFILE
// ==========================================
const updateProfile = async (req, res) => {
    try {
        const {
            name,
            rollNumber,
            college,
            course,
            branch,
            year,
            phone
        } = req.body;

        if (req.app.locals.dbConnected) {
            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }

            // Update only permitted fields (no privilege escalation)
            if (name && name.trim().length >= 2) user.name = name.trim();
            if (rollNumber !== undefined) user.rollNumber = rollNumber.trim();
            if (college !== undefined) user.college = college.trim();
            if (course !== undefined) user.course = course.trim();
            if (branch !== undefined) user.branch = branch.trim();
            if (year !== undefined) user.year = year.trim();
            if (phone !== undefined) user.phone = phone.trim();

            if (req.body.profilePhoto && typeof req.body.profilePhoto === "string") {
                const photoInput = req.body.profilePhoto;
                try {
                    const storeRes = await identityStorageService.storeReferencePhoto(photoInput);
                    if (storeRes.success) {
                        user.profilePhoto = `/api/enrollment/reference-image/${storeRes.secureStorageKey}`;
                    } else {
                        user.profilePhoto = photoInput;
                    }
                    user.profilePhotoData = photoInput;
                    // Also update any active enrollment for this candidate
                    await Enrollment.updateMany(
                        { candidateId: user._id },
                        { 
                            $set: { 
                                "identityEnrollment.referenceImage": user.profilePhoto,
                                "identityEnrollment.referenceImageData": photoInput,
                                "identityEnrollment.uploadedAt": new Date()
                            } 
                        }
                    ).catch(() => {});
                } catch (photoErr) {
                    console.warn("Profile photo update warning:", photoErr.message);
                }
            }

            await user.save();

            return res.status(200).json({
                success: true,
                message: "Profile updated successfully",
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    rollNumber: user.rollNumber,
                    college: user.college,
                    course: user.course,
                    branch: user.branch,
                    year: user.year,
                    phone: user.phone,
                    profilePhoto: user.profilePhoto
                }
            });
        }

        if (!sandboxAllowed(req)) {
            return res.status(503).json({
                success: false,
                message: "Profile update is unavailable because the database is not connected"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Profile updated (development sandbox only)",
            user: {
                id: req.user.id,
                name: name && name.trim().length >= 2 ? name.trim() : req.user.name,
                email: req.user.email,
                role: req.user.role,
                rollNumber: rollNumber !== undefined ? String(rollNumber).trim() : req.user.rollNumber,
                college: college !== undefined ? String(college).trim() : req.user.college,
                course: course !== undefined ? String(course).trim() : req.user.course,
                branch: branch !== undefined ? String(branch).trim() : req.user.branch,
                year: year !== undefined ? String(year).trim() : req.user.year,
                phone: phone !== undefined ? String(phone).trim() : req.user.phone
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Profile update failed",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// ==========================================
// CHANGE PASSWORD
// ==========================================
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Current password and new password are required"
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: "New password must contain at least 8 characters"
            });
        }

        if (req.app.locals.dbConnected) {
            const user = await User.findById(req.user.id).select("+password");
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }

            const match = await bcrypt.compare(currentPassword, user.password);
            if (!match) {
                return res.status(401).json({
                    success: false,
                    message: "Current password is incorrect"
                });
            }

            user.password = await bcrypt.hash(newPassword, 12);
            await user.save();

            return res.status(200).json({
                success: true,
                message: "Password changed successfully"
            });
        }

        if (!sandboxAllowed(req)) {
            return res.status(503).json({
                success: false,
                message: "Password change is unavailable because the database is not connected"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Password changed successfully (development sandbox only)"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Password change failed",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

module.exports = {
    register,
    login,
    getMe,
    updateProfile,
    changePassword
};
