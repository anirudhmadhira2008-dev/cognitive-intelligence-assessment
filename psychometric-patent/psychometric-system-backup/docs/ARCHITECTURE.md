# System Architecture & Technical Specification

**Platform**: Multimodal Psychometric AI Platform  
**Architecture Pattern**: Modular Monolith  
**Runtime**: Node.js + Express 5 (CommonJS) / React 18 + Vite 8 (ESM)  

---

## 1. High-Level Modular Monolith Diagram

```
                              [ React 18 / Vite 8 Frontend SPA ]
                                            │
                                            │ HTTPS / Socket.IO WebSockets
                                            ▼
                              [ Express 5 Modular Monolith API ]
                                  │                     │
                ┌─────────────────┴────────┐   ┌────────┴─────────────────┐
                ▼                          ▼   ▼                          ▼
      [ Identity Verification ]   [ Adaptive Engine ]     [ Realtime Socket Server ]
                │                          │                      │
                └─────────────────┬────────┘                      │
                                  ▼                               ▼
                       [ Redis Cache Adapter ] ◄─── (Pub/Sub Event Bus)
                                  │
                                  ▼
                      [ MongoDB Atlas / Mongoose ]
```

---

## 2. Core Subsystems

### 2.1 Enrollment & Identity Subsystem
- **Candidate Assessment Enrollment**: Explicit conceptual mapping connecting `candidateId`, `assessmentId`, reference face image, consent, verification status, and audit records.
- **Biometric Integrity**: Biometric face presence telemetry is strictly isolated for proctoring verification; psychological traits are NEVER derived from face appearance.

### 2.2 Server-Authoritative Adaptive MCQ Engine
- **Item Selection**: Server picks next question according to target difficulty tier (1=Foundation, 2=Intermediate, 3=Advanced) and domain.
- **Answer Hiding**: Answer index and explanations are stripped from client payloads. Validation occurs exclusively on backend via `/api/assessment/verify-answer` or `/api/assessment/answer`.

### 2.3 Real-Time Proctoring & Event Bus
- **Socket.IO Transport**: WebSockets emit telemetry events (`FACE_DETECTED`, `FACE_MISSING`, `MULTIPLE_FACE`, `TAB_SWITCH`, `WINDOW_BLUR`).
- **Evaluator Dashboard Room**: Live streams candidate events directly to administrative monitors.

### 2.4 Modular Event Bus & Background Workers
- **Proctoring Worker**: Analyzes risk trends.
- **AI Worker**: Asynchronously processes heavy verbal audio transcripts and keyword density.
- **Analytics Worker**: Audits system usage and performance.

### 2.5 Multi-Tier Storage Strategy
- **Redis**: Live session state, temporary socket presence, rate limiting locks.
- **MongoDB**: Permanent entity models (`User`, `Enrollment`, `AssessmentSession`, `Result`, `Question`, `AuditLog`).
- **Object Storage / Local Uploads**: Encrypted media storage for reference images and audio recordings.
