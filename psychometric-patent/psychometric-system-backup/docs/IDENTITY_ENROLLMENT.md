# Candidate Assessment & Identity Enrollment Blueprint

---

## 1. Enrollment Lifecycle Model

```
   Candidate
      ↓
 Assessment Enrollment  (Created by Admin / Evaluator)
      ↓
 Identity Enrollment    (Reference Image + Biometric Consent)
      ↓
 Verification Session   (Server-Authoritative Match & Token Generation)
      ↓
 Assessment Session     (Server-Authoritative MCQ & Voice)
      ↓
 Proctoring Events      (Real-time Socket.IO Telemetry)
      ↓
 Psychometric Result    (Explainable Multimodal Report)
```

---

## 2. Server-Authoritative Identity Matching Rules

1. **Reference Image Upload**: Administrator or Evaluator enrolls the candidate with an official reference face photo.
2. **Biometric Consent**: Explicit consent is required before identity verification can proceed.
3. **Server Verification Token**: Upon successful liveness and similarity check, server returns a cryptographically signed JWT verification token.
4. **Assessment Lock**: Assessment session starting endpoint (`/api/assessment/start`) verifies that a valid server verification token exists for the candidate enrollment.
5. **No Psychological Trait Inference**: Facial appearance data is strictly used for identity matching and proctoring telemetry; psychological traits are NEVER derived from face features.
