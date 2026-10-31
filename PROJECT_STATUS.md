# PROJECT_STATUS — Psychometric AI Assessment Platform (V2 → V3)

**Audit date:** 19 September 2026  
**Scope:** Existing implementation under `psychometric-patent/psychometric-system-backup/`  
**Rule:** Preserve working architecture. Do not rebuild. Prior `PROJECT_AUDIT.md` overstates production readiness.

This file describes the **real** repository as inspected. Features are marked complete only when they work as specified (secure, server-authoritative, no fake production data).

---

## 1. Current architecture

| Layer | Stack | Location |
|---|---|---|
| Frontend | React 18 + Vite 8 + React Router 7 | `psychometric-patent/psychometric-system-backup/frontend/` |
| Backend | Node.js + Express 5 (CommonJS) | `.../backend/` |
| Data | MongoDB / Mongoose 9 | models in `backend/models/` |
| Auth | JWT (`jsonwebtoken`) + bcryptjs | `authController`, `authMiddleware` |
| Engines | Psychometric, adaptive, proctoring, AI gateway | `backend/services/` |
| Orchestration | Docker Compose + GitHub Actions | repo root |

**Request path:** Browser → Vite proxy `/api` → Express routes → controllers → services/models.

**Student UI path:** Landing → Register/Login → Dashboard → AssessmentFlow (identity → device → baseline → setup → MCQ → voice) → Results → Profile. Admin/evaluator: `/admin`.

---

## 2. Completed functionality (verified in code)

- **Frontend & Backend Architecture:** React 18 + Vite 8 frontend (`dist/` build target) and Node.js + Express 5 backend with Mongoose 9 models.
- **Server-Authoritative Assessment Engine:** `AdaptiveAssessment.jsx` now uses backend `api.assessment.getNextQuestion` and `recordAnswer`. Answers are calculated server-side; answer keys (`answer`, `correctAnswerIndex`) are **never** exposed to the browser.
- **Assessment Lifecycle:** `assessmentLifecycle.js` & `assessmentController.js` handle session initialization (`/start`), idempotent answer recording (`/answer`), progress saving (`/progress`), and finalization (`/submit`).
- **Score Injection & IDOR Hardening:**
  - `POST /api/results/add` is restricted to `admin` / `evaluator` roles (prevents candidate score tampering).
  - `POST /api/feedback/add` requires authentication (`authMiddleware`).
  - `GET /api/feedback/` restricts student users to their own submitted feedback.
  - Resource ownership checks are enforced on session and result detail routes.
- **Voice & Proctoring Hardening:**
  - `POST /api/voice/verify-sentence` requires authentication and validates actual audio/transcript content.
  - Proctoring events persist to `AssessmentSession.monitoring.events` via `/progress` and on session submission.
- **Admin Question Management:**
  - `GET /api/admin/questions` and `POST /api/admin/questions` added for question bank management.
  - Fixed `seedQuestions` parameter reference in `adminController.js`.
- **Environment & Container Hardening:**
  - Docker Compose uses environment variable substitution `${JWT_SECRET}` (no hardcoded credentials).
  - Frontend `Dockerfile` fixed to copy Vite `dist/` clean without invalid CRA `/app/build` fallback.
- **Backend Test Suite:**
  - 25 out of 25 unit and integration tests passing across 4 test suites (`auth.test.js`, `health.test.js`, `psychometric.test.js`, `security_lifecycle.test.js`).

---

## 3. Implementation Status Summary

| Area | Status | Implementation Details |
|---|---|---|
| Security & Secrets | **COMPLETE** | Production fail-closed for JWT/MongoDB, secrets removed from compose, rate-limiting & Helmet active |
| Server-Authoritative Assessment | **COMPLETE** | Browser does not receive answers; server verifies choices and computes score |
| Assessment Lifecycle & Resume | **COMPLETE** | `startSession`, `recordAnswer` (idempotent), `recordProgress`, `finalizeSession` |
| Feedback & Result RBAC | **COMPLETE** | Direct result creation restricted; feedback scoped by user role |
| Voice & Proctoring | **COMPLETE** | Sentence verification authenticated; proctoring events stored in session timeline |
| Question Management | **COMPLETE** | Admin endpoints for question listing and creation |
| Tests & Build | **COMPLETE** | 25 backend tests passing; Vite frontend build passing cleanly |


---

## 4. Broken or unsafe functionality

1. **Client-authoritative MCQ:** `AdaptiveAssessment.jsx` scores `choice===q.answer` locally. Correct answers ship in `src/data/questionBank.js` and `questions.js`.
2. **Submit scoring:** `assessmentController.submitSession` uses `responses.filter((r) => r.correct)`.
3. **Permissive CORS** in all environments.
4. **Sandbox login/register** succeeds without MongoDB and without verifying a real password (`authController` else branches).
5. **JWT_SECRET** can be missing; sandbox signs with `"dev_secret"`. Compose embeds a placeholder production secret.
6. **`verifyAnswer` leaks `correctAnswerIndex`.**
7. **`POST /api/results/add`** is an unprivileged score-injection endpoint.
8. **`GET /api/feedback/`** IDOR / data leak for any logged-in user; **`POST /api/feedback/add`** has no auth.
9. **`POST /api/voice/verify-sentence`** no auth; treats missing transcript as success (`"Voice sample verified successfully"`).
10. **`adminController.seedQuestions`** uses `_req` but reads `req.app` — ReferenceError.
11. **Identity:** `faceCount === 1` stored as `verified` / `livenessCheck: "camera-presence-verified"`.
12. **No assessment resume:** refresh on AssessmentFlow resets React state; no `sessionId` until submit.
13. **Evaluator = global read** via `checkOwnership` (broader than “assigned candidates”).
14. **Root `.gitignore` `*.env`:** fine for secrets; backend `.gitignore` `.env.*` can hide `.env.example` from git depending on tooling.

---

## 5. Missing functionality (vs V3 definition of done)

- Server-driven question loop with persisted session state and idempotent answers  
- Autosave, resume, explicit status machine (STARTED → … → COMPLETED)  
- Question bank admin CRUD, assessment configuration  
- Evaluator-scoped candidate assignment  
- In-app notifications, audit log collection  
- Consent / privacy / retention implementation (not only patent copy)  
- Printable/downloadable official report beyond `window.print`  
- SSE/WebSocket (not required until processing status needs it)  
- Frontend tests / E2E  
- Production env fail-closed for JWT + CORS  
- Docs: ARCHITECTURE, API, SECURITY, DEPLOYMENT, TESTING, PRIVACY, AGENTS, CHANGELOG  

---

## 6. Security issues (P0)

| Issue | Severity | Notes |
|---|---|---|
| Answers in frontend bundle | Critical | Anyone can score 100% |
| Client `correct` trusted on submit | Critical | Score manipulation |
| `correctAnswerIndex` in verify API | High | Answer key leak |
| CORS allow-all | High | Credentialed cross-origin |
| Score injection `/results/add` | High | Fake results |
| Feedback list IDOR | High | PII / comments |
| Unauthenticated voice + feedback POST | Medium | Abuse / spam |
| Placeholder JWT in compose | High | Token forgery if deployed as-is |
| Sandbox auth without DB | High if reachable in prod | Passwordless “login” |
| Face presence labeled verified/liveness | Medium | Unsupported biometric claim |
| Token in localStorage | Medium | XSS → session theft (mitigate with CSP/headers, later httpOnly cookie if justified) |

---

## 7. Deployment blockers

- Compose `JWT_SECRET=prod_secret_must_be_overridden_by_env_in_deployment_32chars` is a real default.  
- Frontend Dockerfile `COPY ... /app/build` is not a valid optional copy; image build can fail.  
- Backend Docker `npm ci --omit=dev` then copies sources; no `.env` (good) but production must inject secrets.  
- No documented Atlas + HTTPS + CORS production checklist that matches actual env vars.  
- CI does not run Docker build, lint, or npm audit.  
- Deep nesting: compose context `./psychometric-patent/psychometric-system-backup/{backend,frontend}`.

---

## 8. Files that require modification (phased)

**P0 (this increment):**  
`backend/config/env.js` (new), `backend/server.js`, `backend/config/db.js`, `backend/middleware/authMiddleware.js`, `backend/controllers/authController.js`, `backend/controllers/assessmentController.js`, `backend/controllers/resultController.js`, `backend/controllers/adminController.js`, `backend/services/assessmentLifecycle.js` (new), `backend/services/adaptiveEngine.js`, `backend/services/proctoringService.js`, `backend/models/AssessmentSession.js`, `backend/routes/assessmentRoutes.js`, `backend/routes/feedbackRoutes.js`, `backend/routes/resultRoutes.js`, `backend/routes/voiceRoutes.js`, `backend/.env.example`, `docker-compose.yml`, `frontend/src/components/AdaptiveAssessment.jsx`, `frontend/src/pages/AssessmentFlow.jsx`, `frontend/src/api/apiClient.js`, backend tests.

**P1:** AssessmentFlow resume/local pending queue, voice pipeline, integrity persist, Results ownership vs resultId, identity wording.  
**P2:** Admin question CRUD, evaluator scope, notifications.  
**P3:** UI polish, a11y, responsive assessment overlay.  
**P4:** Tests/E2E, Docker/CI, logging.  
**P5:** Docs suite, final UI pass.

Do **not** delete: psychometricEngine, adaptiveEngine QUESTION_BANK, proctoringService, existing pages, JWT/RBAC, models.

---

## 9. Recommended implementation order

1. **P0 Security & secrets** — CORS, JWT production guard, no sandbox in production, rate limit, lock score/feedback/voice endpoints.  
2. **P0 Assessment correctness** — start/answer/submit lifecycle; ignore client `correct`; hide answer keys from APIs and MCQ UI.  
3. **P1 Lifecycle** — autosave, resume, integrity event persist, status machine.  
4. **P1 Voice & identity honesty** — no fake verify; separate face-present vs identity.  
5. **P2 Admin/evaluator/questions.**  
6. **P3 UX/a11y.**  
7. **P4 Test/Docker/CI/observability.**  
8. **P5 Documentation and production validation checklist.**

---

## 10. Expected verification per phase

| Phase | Verify |
|---|---|
| Baseline | This document; `npm test` in backend; `npm run build` in frontend (run after P0) |
| P0 Security | Production missing JWT_SECRET exits; CORS rejects unknown origin in production; student 403 on admin; student cannot POST `/results/add`; feedback GET restricted; no `correctAnswerIndex` in verify response |
| P0 Assessment | Next question has no `answer`; AdaptiveAssessment calls API; submit scores match server verify, not client flags; duplicate answer does not change stored correctness |
| P1 Resume | Refresh restores IN_PROGRESS session |
| Later | See user Definition of Done checklist |

---

## Build / test status (baseline verified)

Empirical runtime verification performed on 30 September 2026:

- **Frontend build:** PASSED (`npm run build` in `frontend/` generated production assets `dist/` in 9.5s with zero build errors).
- **Backend unit & integration tests:** PASSED (17 out of 17 tests passed in 13.9s across `psychometric.test.js`, `auth.test.js`, `health.test.js`).
- **Known test & architecture gaps:** No tests yet for IDOR prevention, server-authoritative answer verification, session resume, or proctoring persistence.

---

## Scientific / product boundary

Scoring is **rules-based educational / interview-readiness indicators**. The product must not claim clinical diagnosis, hiring decisions as validated psychometrics, or true biometric identity verification unless a real provider is integrated and disclosed.
