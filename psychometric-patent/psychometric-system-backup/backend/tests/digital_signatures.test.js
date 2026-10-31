const crypto = require("crypto");
const digitalSignatureService = require("../services/digitalSignatureService");

describe("Feature 2: Digital Signatures & Cryptographic Report Integrity Tests", () => {
    const sampleReportPayload = {
        reportId: "REP-2026-TEST01",
        sessionId: "session-abc-123",
        candidateReference: "Candidate Jane Doe (STU-***4567)",
        methodologyVersion: "2.0.0-psychometric-patent",
        scoringVersion: "2026.1",
        overallScore: 88,
        totalAvailableScore: 100,
        overallPercentage: 88,
        scoreBreakdown: {
            knowledgeScore: 90,
            reasoningScore: 85,
            communicationScore: 80,
            confidenceScore: 85,
            integrityScore: 98,
            adaptabilityScore: 86,
            cognitiveIndex: 88,
            readinessIndex: 89
        },
        difficultyBreakdown: {
            easy: { earned: 30, available: 30, percentage: 100 },
            medium: { earned: 40, available: 40, percentage: 100 },
            hard: { earned: 18, available: 30, percentage: 60 }
        },
        strengths: ["Algorithms & Data Structures", "High Integrity"],
        areasForImprovement: ["Advanced Concurrency"],
        issuedAt: "2026-10-22T21:00:00.000Z"
    };

    test("1. Deterministic JSON Canonicalization sorts keys and formats consistently", () => {
        const objA = { b: 2, a: 1, c: { z: 9, y: 8 } };
        const objB = { a: 1, c: { y: 8, z: 9 }, b: 2 };

        const canonicalA = digitalSignatureService.canonicalizeJson(objA);
        const canonicalB = digitalSignatureService.canonicalizeJson(objB);

        expect(canonicalA).toBe('{"a":1,"b":2,"c":{"y":8,"z":9}}');
        expect(canonicalA).toBe(canonicalB);
    });

    test("2. Canonical SHA-256 hash is deterministic and invariant to field ordering", () => {
        const hash1 = digitalSignatureService.hashCanonicalPayload(sampleReportPayload);
        
        // Re-order top-level keys
        const reordered = {
            issuedAt: sampleReportPayload.issuedAt,
            overallScore: sampleReportPayload.overallScore,
            reportId: sampleReportPayload.reportId,
            ...sampleReportPayload
        };
        const hash2 = digitalSignatureService.hashCanonicalPayload(reordered);

        expect(hash1).toBe(hash2);
        expect(hash1).toHaveLength(64); // SHA-256 hex string
    });

    test("3. Correctly signed report verifies successfully using RSA-PSS SHA-256", () => {
        const signResult = digitalSignatureService.signReportPayload(sampleReportPayload);

        expect(signResult.signature).toBeDefined();
        expect(signResult.canonicalHash).toBeDefined();
        expect(signResult.algorithm).toBe("RSA-PSS-SHA256");

        const verifyResult = digitalSignatureService.verifyReportPayload(
            sampleReportPayload,
            signResult.signature,
            signResult.keyId
        );

        expect(verifyResult.valid).toBe(true);
        expect(verifyResult.status).toBe("VALID");
        expect(verifyResult.details.canonicalHash).toBe(signResult.canonicalHash);
    });

    test("4. Tampered score invalidates cryptographic verification", () => {
        const signResult = digitalSignatureService.signReportPayload(sampleReportPayload);

        // Tamper with overallScore (e.g. fraudulent score inflation from 88 to 99)
        const tampered = JSON.parse(JSON.stringify(sampleReportPayload));
        tampered.overallScore = 99;

        const verifyResult = digitalSignatureService.verifyReportPayload(
            tampered,
            signResult.signature,
            signResult.keyId
        );

        expect(verifyResult.valid).toBe(false);
        expect(verifyResult.status).toBe("TAMPERED_CONTENT");
    });

    test("5. Tampered candidate reference or timestamp invalidates verification", () => {
        const signResult = digitalSignatureService.signReportPayload(sampleReportPayload);

        // Tamper with candidate identity string
        const tampered = JSON.parse(JSON.stringify(sampleReportPayload));
        tampered.candidateReference = "Imposter Student (STU-***0000)";

        const verifyResult = digitalSignatureService.verifyReportPayload(
            tampered,
            signResult.signature,
            signResult.keyId
        );

        expect(verifyResult.valid).toBe(false);
        expect(verifyResult.status).toBe("TAMPERED_CONTENT");
    });

    test("6. Completely invalid or corrupt signature string is rejected gracefully", () => {
        const corruptSignature = Buffer.from("corrupted-signature-bytes").toString("base64");

        const verifyResult = digitalSignatureService.verifyReportPayload(
            sampleReportPayload,
            corruptSignature,
            digitalSignatureService.keyStore.activeKeyId
        );

        expect(verifyResult.valid).toBe(false);
        expect(["TAMPERED_CONTENT", "VERIFICATION_ERROR"]).toContain(verifyResult.status);
    });

    test("7. Unknown key ID is rejected safely with UNKNOWN_KEY status", () => {
        const signResult = digitalSignatureService.signReportPayload(sampleReportPayload);

        const verifyResult = digitalSignatureService.verifyReportPayload(
            sampleReportPayload,
            signResult.signature,
            "non-existent-kid-999"
        );

        expect(verifyResult.valid).toBe(false);
        expect(verifyResult.status).toBe("UNKNOWN_KEY");
        expect(verifyResult.reason).toContain("non-existent-kid-999");
    });

    test("8. Key rotation preserves verification of older signed reports", () => {
        // Generate an older historical key pair
        const oldKid = "psychometric-key-2025-legacy";
        const { privateKey: oldPriv, publicKey: oldPub } = crypto.generateKeyPairSync("rsa", {
            modulusLength: 2048,
            publicKeyEncoding: { type: "spki", format: "pem" },
            privateKeyEncoding: { type: "pkcs8", format: "pem" }
        });

        // Register legacy key into keyStore
        digitalSignatureService.registerRotatedKey(oldKid, oldPriv, oldPub);

        // Sign report using the legacy key ID
        const legacySignResult = digitalSignatureService.signReportPayload(sampleReportPayload, oldKid);

        // Verify with the legacy key ID
        const verifyResult = digitalSignatureService.verifyReportPayload(
            sampleReportPayload,
            legacySignResult.signature,
            oldKid
        );

        expect(verifyResult.valid).toBe(true);
        expect(verifyResult.status).toBe("VALID");
        expect(verifyResult.details.keyId).toBe(oldKid);
    });

    test("9. Public key export endpoint NEVER exposes private key material", () => {
        const publicKeys = digitalSignatureService.getPublicKeys();

        expect(publicKeys.length).toBeGreaterThan(0);
        publicKeys.forEach((k) => {
            expect(k.kid).toBeDefined();
            expect(k.publicKeyPem).toBeDefined();
            expect(k.publicKeyPem).toContain("BEGIN PUBLIC KEY");
            expect(k.publicKeyPem).not.toContain("PRIVATE KEY");
            expect(k.privateKeyPem).toBeUndefined();
        });
    });
});
