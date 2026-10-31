/**
 * Cryptographic Digital Signature Service for Assessment Reports
 * 
 * Implements RSA-PSS with SHA-256 digital signatures with RFC 8785-compliant
 * deterministic JSON canonicalization and key rotation support.
 * 
 * SECURITY BOUNDARY:
 * - Private signing keys are stored securely server-side and NEVER exposed in API responses or downloads.
 * - Digital signatures guarantee report integrity and authenticity of the issuing platform.
 * - Signatures do NOT assert clinical diagnostic validity or absolute truthfulness of self-reported candidate data.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const KEYS_DIR = path.resolve(__dirname, "..", "config", "keys");
const ACTIVE_KEY_ID = process.env.REPORT_SIGNING_KEY_ID || "psychometric-key-2026-v1";
const ALGORITHM = "RSA-PSS-SHA256";

// In-memory key store supporting multiple key IDs for rotation
const keyStore = {
    keys: new Map(), // kid -> { privateKeyPem, publicKeyPem, createdAt }
    activeKeyId: ACTIVE_KEY_ID
};

/**
 * Ensures key storage directory exists with strict local permissions
 */
function ensureKeysDirectory() {
    if (!fs.existsSync(KEYS_DIR)) {
        fs.mkdirSync(KEYS_DIR, { recursive: true, mode: 0o700 });
    }
    const gitignorePath = path.join(KEYS_DIR, ".gitignore");
    if (!fs.existsSync(gitignorePath)) {
        fs.writeFileSync(gitignorePath, "*\n!.gitignore\n", "utf8");
    }
}

/**
 * Initializes or loads RSA key pairs for digital signing
 */
function initializeSigningKeys() {
    ensureKeysDirectory();

    const activeKid = keyStore.activeKeyId;
    const privPath = path.join(KEYS_DIR, `${activeKid}.priv.pem`);
    const pubPath = path.join(KEYS_DIR, `${activeKid}.pub.pem`);

    let privPem = process.env.REPORT_SIGNING_PRIVATE_KEY;
    let pubPem = process.env.REPORT_SIGNING_PUBLIC_KEY;

    if (!privPem || !pubPem) {
        if (fs.existsSync(privPath) && fs.existsSync(pubPath)) {
            privPem = fs.readFileSync(privPath, "utf8");
            pubPem = fs.readFileSync(pubPath, "utf8");
        } else {
            // Generate standard 2048-bit RSA key pair for development / standalone deployment
            const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
                modulusLength: 2048,
                publicKeyEncoding: { type: "spki", format: "pem" },
                privateKeyEncoding: { type: "pkcs8", format: "pem" }
            });
            privPem = privateKey;
            pubPem = publicKey;
            fs.writeFileSync(privPath, privPem, { mode: 0o600 });
            fs.writeFileSync(pubPath, pubPem, { mode: 0o644 });
        }
    }

    keyStore.keys.set(activeKid, {
        kid: activeKid,
        privateKeyPem: privPem,
        publicKeyPem: pubPem,
        algorithm: ALGORITHM,
        createdAt: new Date().toISOString()
    });

    // Also load any older rotated public keys from disk
    const diskFiles = fs.readdirSync(KEYS_DIR);
    for (const f of diskFiles) {
        if (f.endsWith(".pub.pem")) {
            const kid = f.replace(".pub.pem", "");
            if (!keyStore.keys.has(kid)) {
                const pubKeyContent = fs.readFileSync(path.join(KEYS_DIR, f), "utf8");
                keyStore.keys.set(kid, {
                    kid,
                    publicKeyPem: pubKeyContent,
                    algorithm: ALGORITHM,
                    createdAt: new Date().toISOString()
                });
            }
        }
    }
}

// Initialize on module load
try {
    initializeSigningKeys();
} catch (err) {
    console.error("⚠️ Failed to initialize digital signature keys:", err.message);
}

/**
 * Deterministic JSON Canonicalization (RFC 8785 principles)
 * Recursively sorts object keys and formats values consistently.
 */
function canonicalizeJson(obj) {
    if (obj === null || typeof obj !== "object") {
        if (typeof obj === "number") {
            if (!Number.isFinite(obj)) return "null";
            return String(obj);
        }
        return JSON.stringify(obj);
    }

    if (Array.isArray(obj)) {
        const elements = obj.map((item) => canonicalizeJson(item));
        return `[${elements.join(",")}]`;
    }

    const sortedKeys = Object.keys(obj).sort();
    const pairs = sortedKeys.map((key) => {
        const valStr = canonicalizeJson(obj[key]);
        return `${JSON.stringify(key)}:${valStr}`;
    });

    return `{${pairs.join(",")}}`;
}

/**
 * Computes deterministic SHA-256 hex hash of the canonicalized payload
 */
function hashCanonicalPayload(payload) {
    const canonicalString = canonicalizeJson(payload);
    return crypto.createHash("sha256").update(canonicalString, "utf8").digest("hex");
}

/**
 * Signs a canonical report payload using RSA-PSS SHA-256
 * 
 * @param {Object} reportPayload - Plain JS object of report data
 * @param {string} [keyId] - Optional key ID (defaults to active key)
 * @returns {{ canonicalHash: string, signature: string, keyId: string, algorithm: string, signedAt: string }}
 */
function signReportPayload(reportPayload, keyId = keyStore.activeKeyId) {
    const keyData = keyStore.keys.get(keyId);
    if (!keyData || !keyData.privateKeyPem) {
        throw new Error(`Signing private key not available for key ID: ${keyId}`);
    }

    const canonicalString = canonicalizeJson(reportPayload);
    const canonicalHash = hashCanonicalPayload(reportPayload);

    const sign = crypto.createSign("RSA-SHA256");
    sign.update(canonicalString, "utf8");
    sign.end();

    const signature = sign.sign(
        {
            key: keyData.privateKeyPem,
            padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
            saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
        },
        "base64"
    );

    return {
        canonicalHash,
        signature,
        keyId,
        algorithm: ALGORITHM,
        signedAt: new Date().toISOString()
    };
}

/**
 * Verifies a report payload against its digital signature
 * 
 * @param {Object} reportPayload - The payload to verify
 * @param {string} signature - Base64 encoded RSA-PSS signature
 * @param {string} keyId - Key identifier used to sign
 * @returns {{ valid: boolean, status: string, reason?: string, details?: Object }}
 */
function verifyReportPayload(reportPayload, signature, keyId) {
    if (!reportPayload || typeof reportPayload !== "object") {
        return {
            valid: false,
            status: "INVALID_FORMAT",
            reason: "Report payload must be a non-null object."
        };
    }

    if (!signature || typeof signature !== "string") {
        return {
            valid: false,
            status: "INVALID_SIGNATURE",
            reason: "Signature string is missing or invalid."
        };
    }

    const effectiveKid = keyId || keyStore.activeKeyId;
    const keyData = keyStore.keys.get(effectiveKid);

    if (!keyData || !keyData.publicKeyPem) {
        return {
            valid: false,
            status: "UNKNOWN_KEY",
            reason: `Public key for key ID '${effectiveKid}' is not registered with this verifier.`
        };
    }

    try {
        const canonicalString = canonicalizeJson(reportPayload);
        const canonicalHash = hashCanonicalPayload(reportPayload);

        const verify = crypto.createVerify("RSA-SHA256");
        verify.update(canonicalString, "utf8");
        verify.end();

        const isValid = verify.verify(
            {
                key: keyData.publicKeyPem,
                padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
                saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
            },
            Buffer.from(signature, "base64")
        );

        if (isValid) {
            return {
                valid: true,
                status: "VALID",
                reason: "Cryptographic signature is valid. Report content is verified authentic and unaltered.",
                details: {
                    keyId: effectiveKid,
                    algorithm: ALGORITHM,
                    canonicalHash,
                    verifiedAt: new Date().toISOString()
                }
            };
        } else {
            return {
                valid: false,
                status: "TAMPERED_CONTENT",
                reason: "Signature verification failed. The report content has been altered or signed with a different key.",
                details: {
                    keyId: effectiveKid,
                    computedHash: canonicalHash
                }
            };
        }
    } catch (err) {
        return {
            valid: false,
            status: "VERIFICATION_ERROR",
            reason: `Cryptographic verification error: ${err.message}`
        };
    }
}

/**
 * Returns public keys for third-party verification (no private keys!)
 */
function getPublicKeys() {
    const pubKeys = [];
    for (const [kid, data] of keyStore.keys.entries()) {
        pubKeys.push({
            kid,
            algorithm: data.algorithm,
            publicKeyPem: data.publicKeyPem,
            isActive: kid === keyStore.activeKeyId
        });
    }
    return pubKeys;
}

/**
 * Adds a rotated key pair for test or key lifecycle management
 */
function registerRotatedKey(kid, privateKeyPem, publicKeyPem) {
    keyStore.keys.set(kid, {
        kid,
        privateKeyPem,
        publicKeyPem,
        algorithm: ALGORITHM,
        createdAt: new Date().toISOString()
    });
}

module.exports = {
    canonicalizeJson,
    hashCanonicalPayload,
    signReportPayload,
    verifyReportPayload,
    getPublicKeys,
    registerRotatedKey,
    keyStore,
    ALGORITHM
};
