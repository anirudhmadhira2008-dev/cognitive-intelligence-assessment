# Overall Assessment Report Specification

**Multimodal Psychometric AI Assessment Platform**  
**Specification Version:** 2.4.0  
**Status:** IMPLEMENTED & VERIFIED  

---

## 1. Overview & Purpose

The Overall Assessment Report combines multimodal evaluation data—including server-scored adaptive multiple choice questions (MCQ), verbal communication signals from automated voice interviews, and proctoring integrity streams—into a comprehensive, official evaluation credential.

Every report is automatically generated, sealed, and digitally signed upon session finalization, creating a verifiable, immutable record of candidate competence.

---

## 2. Report Contents & Structural Schema

The report artifact encapsulates twelve mandatory evaluation components:

```
┌────────────────────────────────────────────────────────────────────────┐
│               MULTIMODAL PSYCHOMETRIC ASSESSMENT REPORT                │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Identifiers:        Report ID (REP-2026-XXXX) & Session ID          │
│ 2. Methodology:        Version 2.4.0 | Scoring Engine v2 | Timestamp   │
│ 3. Overall Points:     Earned Points: 110 / Available Points: 120      │
│ 4. Overall Percentage: 92% (Server-authoritative calculation)          │
│ 5. Difficulty Split:   Easy: 100% | Medium: 100% | Hard: 85%          │
│ 6. Competencies:       10 Domains evaluated with evidence count        │
│ 7. Historical Trends:  Trajectory across longitudinal completed sessions│
│ 8. Strengths:          Demonstrated competencies grounded in responses │
│ 9. Areas for Growth:   Targeted gaps identified from incorrect choices │
│ 10. Recommendations:   Targeted curriculum & problem-solving practice  │
│ 11. Disclaimers:       Non-clinical educational readiness disclosures │
│ 12. Cryptography:      RSA-PSS SHA-256 Signature, Canonical Hash, KeyID│
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Server-Authoritative Scoring Engine & Formula

Scores are derived strictly from persisted server-side verification records. Client-provided scores are never trusted.

### Composite Score Formula:
The overall assessment score balances cognitive reasoning with professional verbal delivery while penalizing suspicious proctoring anomalies:

$$\text{Overall Score} = \text{round}\left(0.65 \times S_{\text{cognitive}} + 0.25 \times S_{\text{voice}} + 0.10 \times S_{\text{integrity}}\right)$$

Where:
- $S_{\text{cognitive}}$: Weighted MCQ performance based on difficulty ($10 \text{ pts (Easy)}, 20 \text{ pts (Medium)}, 30 \text{ pts (Hard)}$).
- $S_{\text{voice}}$: Verbal communication index calculated from acoustic clarity, vocabulary coverage, and confidence.
- $S_{\text{integrity}}$: Proctoring integrity index ($100 - \text{Risk Score}$), evaluated from attention stability and gaze variance.

### Duplicate Prevention & Idempotency:
- If a report has already been generated and signed for a session, subsequent calls return the existing immutable report with `alreadySigned: true`.
- Sessions can only be finalized once; status transitions from `IN_PROGRESS` to `COMPLETED` and rejects duplicate submissions (`HTTP 409 Conflict`).

---

## 4. Controlled Report Lifecycle

```
             ┌───────────────┐
             │     Draft     │ (Session In-Progress: Responses recorded)
             └───────┬───────┘
                     │ Candidate completes test / Finalize triggered
                     ▼
             ┌───────────────┐
             │   Finalized   │ (Scores calculated server-side; Result saved)
             └───────┬───────┘
                     │ Automatic RSA-PSS SHA-256 signing
                     ▼
             ┌───────────────┐
             │    Signed     │ (Canonical hash created; SignedReport persisted)
             │  [IMMUTABLE]  │
             └───────┬───────┘
                     │ Verifier submits payload to /api/reports/verify
                     ▼
             ┌───────────────┐
             │   Verified    │ (Signature mathematically confirmed valid)
             └───────────────┘
```

### Immutability Policy:
Once signed, the database record and canonical payload cannot be edited. Any change to the signed content will immediately invalidate the cryptographic signature upon inspection. If an evaluation must be recalculated, an entirely new session and report version must be initiated.

---

## 5. Non-Clinical Educational Boundary Disclosures

Every report includes mandatory standard disclaimers to ensure ethical AI deployment:

> **Assessment Methodology Disclosures:**  
> 1. This assessment report is an educational, technical, and interview-readiness evaluation based on candidate responses, acoustic features, and session telemetry recorded during the evaluation.  
> 2. This report does NOT represent a psychiatric, neurological, or clinical psychometric diagnosis.  
> 3. Results should be interpreted alongside portfolio reviews, practical coding exercises, and human interviews.

---

## 6. Access Control & Authorization (IDOR Defense)

Reports contain private candidate evaluation data and are safeguarded by strict authorization:
- **Candidate Ownership:** A student can only view or download their own reports (`req.user.id === report.userId`).
- **Elevated Roles:** Evaluators and administrators are authorized to inspect candidate reports for assessment governance.
- **Unauthorized Rejection:** Any third-party student attempting to fetch or download another candidate's report receives `HTTP 403 Forbidden`.
- **Public Verification Privacy:** The public verification endpoint (`/api/reports/verify`) verifies the cryptographic signature without exposing private student contact details, college names, or raw video streams.

---

## 7. Export & Download Format

Candidates and evaluators can download the official signed report as an audit-ready JSON artifact (`REP-YYYY-XXXX_SignedReport.json`):

```json
{
  "$schema": "https://psychometric.platform/schema/signed-report-v2.json",
  "reportId": "REP-2026-53B0CC42",
  "issuedBy": "Multimodal Psychometric AI Assessment Platform",
  "methodologyVersion": "2.4.0",
  "scoringVersion": "adaptive-multimodal-v2",
  "candidateReference": "alex.rivera@test.com",
  "overallScore": 92,
  "totalAvailableScore": 100,
  "overallPercentage": 92,
  "difficultyBreakdown": {
    "easy": { "earned": 20, "available": 20, "percentage": 100 },
    "medium": { "earned": 40, "available": 40, "percentage": 100 },
    "hard": { "earned": 60, "available": 60, "percentage": 100 }
  },
  "cryptographicSignature": {
    "algorithm": "RSA-PSS-SHA256",
    "keyId": "psychometric-key-2026-v1",
    "canonicalHash": "ba5e709ca206ab4c047bb576a54302cbb500d337a85eba17d398ccc8281bfeca",
    "signature": "V/3G5Zk9...==",
    "signedAt": "2026-10-22T16:43:00.999Z"
  }
}
```

---

## 8. Automated Test Verification

```bash
PASS backend/tests/overall_report.test.js
  ✓ generates a complete, signed overall report from assessment session
  ✓ enforces idempotency: repeated report generation returns existing signed report
  ✓ guarantees signed report immutability against database tampering
```

All 3 test cases passed.
