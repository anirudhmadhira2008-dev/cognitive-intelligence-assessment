const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const identityService = require("../services/identityVerificationService");
const identityStorageService = require("../services/identityStorageService");
const { logAuditEvent } = require("../services/auditLogger");

// Admin, Evaluator, or System creates a candidate assessment enrollment with reference image
const createEnrollment = async (req, res) => {
    try {
        const { candidateId, assessmentId, title, roleTarget, referenceImage, consent } = req.body;

        if (!candidateId) {
            return res.status(400).json({ success: false, message: "candidateId is required" });
        }

        // Authorization: Students can only create their own enrollment; Admins/Evaluators can create for any candidate
        if (req.user && req.user.role !== "admin" && req.user.role !== "evaluator") {
            if (String(candidateId) !== String(req.user.id)) {
                return res.status(403).json({
                    success: false,
                    message: "Forbidden: Candidates can only create their own assessment enrollment"
                });
            }
        }

        let candidate = null;
        if (req.app.locals.dbConnected) {
            candidate = await User.findById(candidateId);
            if (!candidate) {
                return res.status(404).json({ success: false, message: "Candidate user not found" });
            }
        }

        // Validate and store reference face image if provided
        let imageMetaData = {
            referenceImageId: "",
            secureStorageKey: "",
            referenceImage: "",
            mimetype: "image/jpeg",
            size: 0
        };

        if (referenceImage) {
            const storeRes = await identityStorageService.storeReferencePhoto(referenceImage);
            if (!storeRes.success) {
                return res.status(400).json({
                    success: false,
                    message: `Identity Enrollment Failed: ${storeRes.error}`
                });
            }
            imageMetaData = {
                referenceImageId: storeRes.referenceImageId,
                secureStorageKey: storeRes.secureStorageKey,
                referenceImage: `/api/enrollment/reference-image/${storeRes.secureStorageKey}`,
                mimetype: storeRes.mimetype,
                size: storeRes.size
            };
        }

        const enrollmentPayload = {
            candidateId,
            assessmentId: assessmentId || "default-psychometric-v1",
            title: title || "AI Multimodal Psychometric Engineering Assessment",
            roleTarget: roleTarget || "Software Developer",
            enrollmentStatus: "ENROLLED",
            identityEnrollment: {
                ...imageMetaData,
                consent: Boolean(consent),
                consentTimestamp: consent ? new Date() : null,
                enrolledAt: new Date(),
                uploadedAt: new Date(),
                enrolledBy: req.user ? req.user.id : candidateId,
                verificationStatus: "PENDING",
                verificationAttempts: 0
            }
        };

        let enrollment = null;
        if (req.app.locals.dbConnected) {
            enrollment = await Enrollment.create(enrollmentPayload);
        } else {
            enrollment = {
                _id: `dev-enroll-${Date.now()}`,
                ...enrollmentPayload,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            identityService.upsertMemoryEnrollment(enrollment);
        }

        await logAuditEvent({
            req,
            action: "CANDIDATE_ENROLLED",
            resource: "Enrollment",
            resourceId: enrollment._id,
            metadata: { candidateId, title: enrollmentPayload.title, referenceImageId: imageMetaData.referenceImageId }
        });

        return res.status(201).json({
            success: true,
            message: "Candidate assessment and identity enrollment created successfully",
            enrollment
        });
    } catch (error) {
        console.error("Create enrollment error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create assessment enrollment",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// Candidate or Admin uploads/updates identity reference photo for an enrollment
const uploadIdentityPhoto = async (req, res) => {
    try {
        const { id } = req.params;
        let { referenceImage, consent } = req.body;

        // If file uploaded via multipart/form-data
        if (req.file) {
            referenceImage = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
        }

        if (!referenceImage) {
            return res.status(400).json({
                success: false,
                message: "Reference image photo is required for identity enrollment"
            });
        }

        let enrollment = null;
        if (req.app.locals.dbConnected) {
            enrollment = await Enrollment.findById(id);
        } else {
            enrollment = identityService.memoryEnrollments.find((e) => String(e._id) === String(id));
        }

        if (!enrollment) {
            return res.status(404).json({ success: false, message: "Enrollment not found" });
        }

        // Authorization check: Only assigned candidate or admin/evaluator can update reference image
        if (req.user.role !== "admin" && req.user.role !== "evaluator") {
            const candId = enrollment.candidateId?._id || enrollment.candidateId;
            if (String(candId) !== String(req.user.id)) {
                return res.status(403).json({ success: false, message: "Forbidden: You cannot modify another candidate's reference identity" });
            }
        }

        // Store and deduplicate reference photo
        const storeRes = await identityStorageService.storeReferencePhoto(referenceImage);
        if (!storeRes.success) {
            return res.status(400).json({
                success: false,
                message: `Photo Upload Failed: ${storeRes.error}`
            });
        }

        enrollment.identityEnrollment = {
            ...(enrollment.identityEnrollment || {}),
            referenceImageId: storeRes.referenceImageId,
            secureStorageKey: storeRes.secureStorageKey,
            referenceImage: `/api/enrollment/reference-image/${storeRes.secureStorageKey}`,
            mimetype: storeRes.mimetype,
            size: storeRes.size,
            uploadedAt: new Date(),
            consent: consent !== undefined ? Boolean(consent) : (enrollment.identityEnrollment?.consent || true),
            consentTimestamp: new Date(),
            verificationStatus: "PENDING"
        };

        if (req.app.locals.dbConnected) {
            await enrollment.save();
        } else {
            identityService.upsertMemoryEnrollment(enrollment);
        }

        await logAuditEvent({
            req,
            action: "IDENTITY_PHOTO_ENROLLED",
            resource: "Enrollment",
            resourceId: enrollment._id,
            metadata: { referenceImageId: storeRes.referenceImageId, size: storeRes.size }
        });

        return res.json({
            success: true,
            message: "Reference identity photo uploaded and enrolled successfully",
            enrollmentId: enrollment._id,
            referenceImageId: storeRes.referenceImageId,
            secureStorageKey: storeRes.secureStorageKey,
            verificationStatus: "PENDING"
        });
    } catch (error) {
        console.error("Upload identity photo error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to upload reference photo",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// Secure, authenticated retrieval of reference identity image (with IDOR protection)
const getReferenceImage = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const { key } = req.params;
        if (!key) {
            return res.status(400).json({ success: false, message: "Storage key required" });
        }

        // Verify key format to prevent directory traversal
        if (!/^[a-fA-F0-9]{64}\.(jpg|jpeg|png|webp)$/.test(key)) {
            return res.status(400).json({ success: false, message: "Invalid image storage key" });
        }

        // IDOR Prevention: Check ownership of the enrollment containing this storage key
        let enrollment = null;
        if (req.app.locals.dbConnected) {
            enrollment = await Enrollment.findOne({ "identityEnrollment.secureStorageKey": key });
        } else {
            enrollment = identityService.memoryEnrollments.find(
                (e) => e.identityEnrollment?.secureStorageKey === key
            );
        }

        if (enrollment && req.user.role !== "admin" && req.user.role !== "evaluator") {
            const ownerId = enrollment.candidateId?._id || enrollment.candidateId;
            if (String(ownerId) !== String(req.user.id)) {
                return res.status(403).json({
                    success: false,
                    message: "Forbidden: You are not authorized to view another candidate's reference photo"
                });
            }
        }

        let buffer = await identityStorageService.getStoredReferenceBuffer(key);
        if (!buffer && req.app.locals.dbConnected) {
            // Self-healing: Restore reference image from persistent MongoDB Atlas backup
            let base64 = enrollment?.identityEnrollment?.referenceImageData;
            if (!base64) {
                const User = require("../models/User");
                const matchedUser = await User.findOne({
                    $or: [
                        { profilePhoto: `/api/enrollment/reference-image/${key}` },
                        { profilePhoto: key },
                        { _id: req.user.id }
                    ]
                });
                base64 = matchedUser?.profilePhotoData;
            }
            if (base64 && typeof base64 === "string") {
                const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, "");
                buffer = Buffer.from(cleanBase64, "base64");
                // Cache back to disk
                const filePath = path.join(identityStorageService.storageDir, key);
                fs.promises.writeFile(filePath, buffer).catch(() => {});
            }
        }

        if (!buffer) {
            return res.status(404).json({ success: false, message: "Reference image file not found" });
        }

        const ext = key.split(".").pop().toLowerCase();
        const mimeMap = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
        const mime = mimeMap[ext] || "image/jpeg";

        res.setHeader("Content-Type", mime);
        res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
        return res.send(buffer);
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to retrieve reference photo" });
    }
};

// Candidate retrieves their active enrollments
const getMyEnrollments = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        if (req.app.locals.dbConnected) {
            let enrollments = await Enrollment.find({ candidateId: req.user.id }).sort({ createdAt: -1 });
            if (enrollments.length === 0) {
                const user = await User.findById(req.user.id);
                const newEnrollment = await Enrollment.create({
                    candidateId: req.user.id,
                    assessmentId: "default-psychometric-v1",
                    title: "AI Multimodal Psychometric Engineering Assessment",
                    roleTarget: user?.branch ? `${user.branch} Engineer` : "Software Developer",
                    enrollmentStatus: "ENROLLED",
                    identityEnrollment: {
                        referenceImage: user?.profilePhoto || "",
                        consent: true,
                        consentTimestamp: new Date(),
                        enrolledAt: new Date(),
                        uploadedAt: new Date(),
                        enrolledBy: req.user.id,
                        verificationStatus: "PENDING",
                        verificationAttempts: 0
                    }
                });
                enrollments = [newEnrollment];
            }
            return res.json({ success: true, count: enrollments.length, enrollments });
        }

        let filtered = identityService.memoryEnrollments.filter(
            (e) => String(e.candidateId) === String(req.user.id)
        );
        if (filtered.length === 0) {
            const demoEnrollment = {
                _id: `dev-enroll-${Date.now()}`,
                candidateId: req.user.id,
                assessmentId: "default-psychometric-v1",
                title: "AI Multimodal Psychometric Engineering Assessment",
                roleTarget: "Software Developer",
                enrollmentStatus: "ENROLLED",
                identityEnrollment: {
                    referenceImage: "",
                    consent: true,
                    consentTimestamp: new Date(),
                    enrolledAt: new Date(),
                    verificationStatus: "PENDING",
                    verificationAttempts: 0
                }
            };
            identityService.upsertMemoryEnrollment(demoEnrollment);
            filtered = [demoEnrollment];
        }
        return res.json({ success: true, count: filtered.length, enrollments: filtered, isSandbox: true });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch candidate enrollments",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// Get single enrollment detail
const getEnrollmentById = async (req, res) => {
    try {
        const { id } = req.params;
        let enrollment = null;

        if (req.app.locals.dbConnected) {
            enrollment = await Enrollment.findById(id).populate("candidateId", "name email rollNumber college branch");
        } else {
            enrollment = identityService.memoryEnrollments.find((e) => String(e._id) === String(id));
        }

        if (!enrollment) {
            return res.status(404).json({ success: false, message: "Enrollment not found" });
        }

        if (req.user.role !== "admin" && req.user.role !== "evaluator") {
            const candId = enrollment.candidateId?._id || enrollment.candidateId;
            if (String(candId) !== String(req.user.id)) {
                return res.status(403).json({ success: false, message: "Forbidden: Access denied to another candidate's enrollment" });
            }
        }

        return res.json({ success: true, enrollment });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching enrollment",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// Candidate performs server-authoritative identity verification
const verifyIdentity = async (req, res) => {
    try {
        const { id } = req.params;
        const { liveImage, livenessScore, faceCount, consentGiven, prohibitedObjects, faceSimilarity } = req.body;

        const result = await identityService.verifyCandidateIdentity({
            req,
            enrollmentId: id,
            liveImage,
            livenessScore,
            faceCount,
            consentGiven,
            prohibitedObjects,
            faceSimilarity,
            dbConnected: req.app.locals.dbConnected
        });

        if (!result.success) {
            return res.status(result.status || 400).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error("Identity verification error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error during identity verification",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// Administrator / Evaluator manual identity verification approval
const approveEnrollment = async (req, res) => {
    try {
        if (!req.user || (req.user.role !== "admin" && req.user.role !== "evaluator")) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: Only administrators or evaluators can manually approve identity verification"
            });
        }

        const { id } = req.params;
        let enrollment = null;
        if (req.app.locals.dbConnected) {
            enrollment = await Enrollment.findById(id);
        } else {
            enrollment = identityService.memoryEnrollments.find((e) => String(e._id) === String(id));
        }

        if (!enrollment) {
            return res.status(404).json({ success: false, message: "Enrollment not found" });
        }

        const jwt = require("jsonwebtoken");
        const verificationToken = jwt.sign(
            {
                enrollmentId: enrollment._id,
                candidateId: enrollment.candidateId,
                verifiedAt: new Date().toISOString(),
                matchScore: 100,
                livenessPassed: true,
                verificationMethod: "manual_administrator_approval",
                approvedBy: req.user.id
            },
            process.env.JWT_SECRET || "default_development_secret_key_32chars_min",
            { expiresIn: "4h" }
        );

        enrollment.enrollmentStatus = "VERIFIED";
        enrollment.identityEnrollment.verificationStatus = "VERIFIED";
        enrollment.identityEnrollment.verificationMetadata = {
            verifiedAt: new Date(),
            matchScore: 100,
            verificationMethod: "manual_administrator_approval",
            approvedBy: req.user.id
        };
        enrollment.verificationSession = {
            verifiedAt: new Date(),
            verificationToken,
            faceMatchScore: 100,
            livenessPassed: true,
            verifiedByServer: true,
            verificationMethod: "manual_administrator_approval"
        };

        if (req.app.locals.dbConnected) {
            await enrollment.save();
        } else {
            identityService.upsertMemoryEnrollment(enrollment);
        }

        await logAuditEvent({
            req,
            action: "IDENTITY_MANUALLY_APPROVED",
            resource: "Enrollment",
            resourceId: enrollment._id,
            status: "SUCCESS",
            metadata: { approvedBy: req.user.id }
        });

        return res.json({
            success: true,
            message: "Candidate identity verification manually approved by administrator",
            enrollmentId: enrollment._id,
            verificationToken,
            verificationStatus: "VERIFIED"
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to approve enrollment", error: error.message });
    }
};

module.exports = {
    createEnrollment,
    uploadIdentityPhoto,
    getReferenceImage,
    getMyEnrollments,
    getEnrollmentById,
    verifyIdentity,
    approveEnrollment
};
