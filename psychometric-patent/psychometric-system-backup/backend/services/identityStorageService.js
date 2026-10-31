const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const storageDir = path.join(__dirname, "..", "uploads", "identity_references");
if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
}

/**
 * Validates and stores identity reference face photo securely.
 * Deduplicates identical files using SHA-256 content hashes.
 * Ensures images are stored outside open public static directories.
 */
const storeReferencePhoto = async (imageInput) => {
    try {
        if (!imageInput || typeof imageInput !== "string") {
            return { success: false, error: "Missing or invalid image input" };
        }

        let buffer = null;
        let mimetype = "image/jpeg";

        if (imageInput.startsWith("data:image/")) {
            const matches = imageInput.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
            if (!matches || matches.length < 3) {
                return { success: false, error: "Invalid base64 image encoding" };
            }
            mimetype = matches[1];
            buffer = Buffer.from(matches[2], "base64");
        } else if (imageInput.length > 100) {
            buffer = Buffer.from(imageInput, "base64");
        } else {
            return { success: false, error: "Invalid reference photo data provided" };
        }

        const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
        if (!allowedMimes.includes(mimetype.toLowerCase())) {
            return { success: false, error: "Unsupported image format. Allowed formats: JPEG, PNG, WEBP." };
        }

        const maxSizeBytes = 5 * 1024 * 1024; // 5MB limit
        if (buffer.length > maxSizeBytes) {
            return { success: false, error: "Image file exceeds maximum 5MB size limit." };
        }

        if (buffer.length < 1000) {
            return { success: false, error: "Image size too small or corrupted photo." };
        }

        // Deduplication using content SHA-256 hash
        const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");
        const ext = mimetype.split("/")[1] || "jpg";
        const secureStorageKey = `${contentHash}.${ext}`;
        const filePath = path.join(storageDir, secureStorageKey);

        // Only write to disk if file does not already exist (deduplication)
        if (!fs.existsSync(filePath)) {
            await fs.promises.writeFile(filePath, buffer);
        }

        const referenceImageId = `ref-${contentHash.substring(0, 16)}`;

        return {
            success: true,
            referenceImageId,
            secureStorageKey,
            mimetype,
            size: buffer.length,
            filePath
        };
    } catch (err) {
        console.error("Identity storage error:", err);
        return { success: false, error: "Failed to store identity reference photo" };
    }
};

const getStoredReferenceBuffer = async (secureStorageKey) => {
    try {
        if (!secureStorageKey) return null;
        const filePath = path.join(storageDir, secureStorageKey);
        if (!fs.existsSync(filePath)) return null;
        return await fs.promises.readFile(filePath);
    } catch (err) {
        return null;
    }
};

module.exports = {
    storeReferencePhoto,
    getStoredReferenceBuffer,
    storageDir
};
