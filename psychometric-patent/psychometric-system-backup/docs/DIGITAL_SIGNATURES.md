# Digital Signatures for Assessment Reports & Result Integrity

**Multimodal Psychometric AI Assessment Platform**  
**Specification Version:** 2.4.0  
**Status:** IMPLEMENTED & VERIFIED  

---

## 1. Overview & Architectural Goals

To ensure the non-repudiation, tamper-evidence, and long-term authenticity of candidate evaluation credentials, the platform implements an asymmetric cryptographic signing architecture for finalized assessment reports.

When an assessment session is completed, an immutable overall assessment report is generated, deterministically canonicalized according to **RFC 8785 (JSON Canonicalization Scheme)**, cryptographically hashed using **SHA-256**, and digitally signed using **RSA-PSS with SHA-256**.

Any third party (e.g., academic institution, employer, or auditor) can verify the report's authenticity through a public verification endpoint or UI portal without requiring authenticated access to the student's private records.

---

## 2. Cryptographic Specification

| Cryptographic Component | Specification / Standard | Implementation Details |
| :--- | :--- | :--- |
| **Signature Scheme** | **RSA-PSS (Probabilistic Signature Scheme)** | `crypto.createSign("RSA-SHA256")` with `padding: RSA_PKCS1_PSS_PADDING`, `saltLength: 32` |
| **Hash Function** | **SHA-256** (FIPS 180-4) | Deterministic 256-bit digest over RFC 8785 canonical string |
| **Key Size** | **2048-bit RSA** | Generated using native Node.js `crypto.generateKeyPairSync` |
| **Canonicalization** | **RFC 8785 (JCS)** | Recursive lexicographical key sorting, strict numeric formats, whitespace elimination |
| **Active Key ID** | `psychometric-key-2026-v1` | Dedicated key identifier distinct from JWT secrets |
| **Signature Encoding** | **Base64** | Standard URL-safe compliant Base64 string |

---

## 3. Cryptographic Signing & Verification Architecture

```
                    ┌──────────────────────────────────────────────┐
                    │          Completed Assessment Data           │
                    │   (Score, Competencies, Difficulty, Voice)   │
                    └──────────────────────┬───────────────────────┘
                                           │
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │      Deterministic RFC 8785 Canonicalizer    │
                    │   - Lexicographical recursive key sorting    │
                    │   - Non-essential metadata removal           │
                    │   - ISO 8785 whitespace elimination          │
                    └──────────────────────┬───────────────────────┘
                                           │
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │            SHA-256 Digest Engine             │
                    │        SHA-256(canonicalPayloadJson)        │
                    └──────────────────────┬───────────────────────┘
                                           │
                             Canonical Hash (Hex Digest)
                                           │
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │             RSA-PSS Signing Core             │
                    │   - Algorithm: RSA-PSS-SHA256                │
                    │   - Salt Length: 32 bytes                    │
                    │   - Key: Private Key (Server-Only HSM/Store) │
                    └──────────────────────┬───────────────────────┘
                                           │
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │         Official SignedReport Bundle         │
                    │  - reportId: REP-YYYY-XXXXXXXX               │
                    │  - canonicalHash: <SHA-256 Hex>              │
                    │  - signature: <Base64 RSA-PSS>               │
                    │  - keyId: psychometric-key-2026-v1           │
                    │  - signedAt: ISO 8601 Timestamp              │
                    └──────────────────────────────────────────────┘
```

---

## 4. Report Canonicalization (RFC 8785)

In JavaScript, objects have non-deterministic key orders. To guarantee that identical report data always generates the identical SHA-256 hash across diverse runtimes:

```javascript
function canonicalizeJson(obj) {
    if (obj === null || typeof obj !== "object") {
        return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
        return "[" + obj.map((item) => canonicalizeJson(item)).join(",") + "]";
    }
    const sortedKeys = Object.keys(obj).sort();
    const parts = sortedKeys
        .filter((key) => obj[key] !== undefined)
        .map((key) => JSON.stringify(key) + ":" + canonicalizeJson(obj[key]));
    return "{" + parts.join(",") + "}";
}
```

### What Fields are Covered by the Signature:
The canonical signature payload strictly covers all objective scoring parameters, difficulty metrics, competency distributions, strengths, gaps, and disclaimers:
- `reportId`
- `candidateReference` (e.g. `alex.rivera@test.com` or masked hash)
- `methodologyVersion` & `scoringVersion`
- `overallScore`, `totalAvailableScore`, `overallPercentage`
- `scoreBreakdown` (mcq, voice, integrity)
- `difficultyBreakdown` (easy, medium, hard percentage & earned/available)
- `competencyScores` (10 competencies with evidence count)
- `strengths`, `areasForImprovement`, `recommendations`
- `limitations` & `disclaimers`
- `issuedAt`

Excluded from the signed hash: the `signature` itself, ephemeral database IDs (`_id`, `__v`), and outer transport envelopes.

---

## 5. Key Management & Key Rotation Architecture

1. **Isolation from JWT Secrets:** The signing private key is strictly isolated in `backend/config/keys/` and managed by `digitalSignatureService.js`. It is never combined with or derived from authentication tokens.
2. **Source Control Security:** All files in `backend/config/keys/` are excluded via `.gitignore`.
3. **Key Identifiers (`keyId`):** Every signed report embeds the identifier of the key used to sign it (e.g., `psychometric-key-2026-v1`).
4. **Historical Verifiability:** Older public keys are permanently archived in the key store. When rotating to `psychometric-key-2027-v1`, reports signed under `2026-v1` remain verifiable against the archived `2026-v1` public key.
5. **Public Key Distribution Endpoint:**
   - **Endpoint:** `GET /api/reports/public-keys`
   - **Response:**
     ```json
     {
       "success": true,
       "algorithm": "RSA-PSS-SHA256",
       "activeKeyId": "psychometric-key-2026-v1",
       "keys": [
         {
           "keyId": "psychometric-key-2026-v1",
           "publicKey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...\n-----END PUBLIC KEY-----\n",
           "active": true
         }
       ]
     }
     ```

---

## 6. Report Verification Workflow & Statuses

When a report is submitted to `POST /api/reports/verify`:
1. The server identifies the `keyId`. If not recognized in the key store, returns `UNKNOWN_KEY`.
2. The trusted public key for that `keyId` is retrieved from the server store (never trusted from client input).
3. The report payload is extracted and canonicalized via RFC 8785.
4. The canonical SHA-256 hash is recalculated.
5. The digital signature is verified against the canonical hash using RSA-PSS SHA-256 with 32-byte salt padding.
6. A structured outcome is returned:

| Verification Status | Meaning |
| :--- | :--- |
| **`VALID`** | Cryptographic signature is valid; canonical hash matches; content is verified authentic and unaltered. |
| **`TAMPERED_CONTENT`** | Signature does not match the canonical hash. The report was altered, forged, or edited after signing. |
| **`UNKNOWN_KEY`** | The key ID is not recognized by the platform key registry. |
| **`INVALID_SIGNATURE`** | The signature string is corrupt, truncated, or improperly formatted Base64. |
| **`REPORT_NOT_FOUND`** | When queried by `reportId`, no report exists with that ID. |
| **`INVALID_PAYLOAD`** | The provided payload lacks necessary cryptographic or structure fields. |

---

## 7. Public Frontend Verification Portal (`/verify`)

Candidates, employers, and evaluators can verify any report at `http://localhost:5173/verify`:
- **Lookup by Report ID:** Queries the verified database record, recalculates the canonical hash, and verifies the signature in real time.
- **Upload / Paste Signed JSON:** Allows verifying offline exported report files (`REP-YYYY-XXXX_SignedReport.json`) by reconstructing the canonical payload and checking the RSA-PSS signature against the platform public key.

---

## 8. Test Evidence

```bash
PASS backend/tests/digital_signatures.test.js
  ✓ canonicalizeJson produces deterministic RFC 8785 strings regardless of key order
  ✓ generates deterministic SHA-256 hash for canonical payload
  ✓ successfully signs and verifies an authentic report payload
  ✓ detects score tampering and rejects altered payload
  ✓ detects competency tampering and rejects altered payload
  ✓ rejects corrupt or malformed base64 signature
  ✓ safely handles unknown keyId without throwing
  ✓ supports key rotation and verifies older reports against archived keys
  ✓ verifies that private signing keys are never exposed in public keys payload
```

All 9 test cases passed.
