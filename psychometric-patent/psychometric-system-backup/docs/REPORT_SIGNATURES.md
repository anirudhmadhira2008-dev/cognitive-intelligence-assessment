# Cryptographic Report Signatures & Verification Protocol (Phase 7)

## Overview
Every generated candidate assessment report is cryptographically signed using an asymmetric RSA-PSS key pair with RFC 8785 JSON Canonicalization. This guarantees tamper resistance, third-party authenticity, and non-repudiation.

---

## 1. Signing Architecture

```
 Candidate Assessment Session Finalized
                 │
                 ▼
 Generate Assessment Report Payload
                 │
                 ▼
 RFC 8785 JSON Canonicalization (Deterministic Sort & Encoding)
                 │
                 ▼
 SHA-256 Digest Computation
                 │
                 ▼
 RSA-PSS Asymmetric Signing (2048-bit Private Key)
                 │
                 ▼
 Stored as Immutable SignedReport Record in MongoDB
                 │
                 ▼
 Public Verification Portal (/api/reports/verify)
```

---

## 2. Cryptographic Specifications

- **Canonicalization Scheme:** RFC 8785 JSON Canonicalization Scheme (JCS).
  Ensures whitespace variations, key ordering differences, and floating-point representations produce identical binary byte streams across platforms.
- **Signature Algorithm:** RSA-PSS (Probabilistic Signature Scheme).
  - Digest: SHA-256
  - Key Length: 2048-bit RSA
  - Salt Length: 32 bytes
- **Key Identifiers & Rotation:**
  - Active Key ID: `psychometric-key-2026-v1`
  - Historical keys retained in server key registry to guarantee permanent verifiability of older reports.
  - Private keys remain strictly on the server and are never bundled in client distribution.

---

## 3. Public Verification Flow

Any employer, academic institution, or audit authority can verify report authenticity:

### Endpoint:
`POST /api/reports/verify` (Public, no auth required)

### Verification Payload:
```json
{
  "report": {
    "reportId": "REP-2026-A1B2C3",
    "issuedAt": "2026-10-28T14:00:00.000Z",
    "candidate": { "name": "Candidate Name", "rollNumber": "ENG-2026-001" },
    "testId": "TEST-1",
    "testVersion": "1.0.0",
    "overallReadiness": 84,
    "integrityScore": 98,
    "scores": { "knowledge": 85, "reasoning": 82, "communication": 88, "adaptability": 78, "integrity": 98 }
  },
  "signature": "base64_encoded_rsa_pss_signature...",
  "keyId": "psychometric-key-2026-v1"
}
```

### Verification Response:
```json
{
  "valid": true,
  "status": "VALID",
  "reason": "Cryptographic signature is valid. Report content is verified authentic and unaltered.",
  "details": {
    "reportId": "REP-2026-A1B2C3",
    "keyId": "psychometric-key-2026-v1",
    "verifiedAt": "2026-10-28T14:15:00.000Z",
    "algorithm": "RSA-PSS-SHA256"
  }
}
```

### Tamper Detection:
If even one score, competency, candidate roll number, or timestamp is altered by an adversary, the canonical SHA-256 hash will diverge, and the endpoint returns `valid: false` with status `TAMPERED_CONTENT`.
