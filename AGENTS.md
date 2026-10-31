# AGENTS.md — Development & Architecture Guidelines for AI Agents

Welcome! This file provides essential context, architectural rules, security policies, and operational commands for any AI agent or software engineer working on this Multimodal Psychometric AI Assessment Platform codebase.

---

## 1. Repository Architecture & Layout

The project is structured as follows:

```
psychometric-patent/
└── psychometric-system-backup/
    ├── backend/                    # Node.js + Express 5 (CommonJS) API server
    │   ├── config/                 # db connection & env policies (env.js, db.js)
    │   ├── controllers/            # authController, assessmentController, resultController, adminController
    │   ├── middleware/             # authMiddleware, rbacMiddleware, errorMiddleware
    │   ├── models/                 # Mongoose schemas: User, AssessmentSession, Result, Question, Feedback
    │   ├── routes/                 # Express route handlers
    │   ├── services/               # Core engines: adaptiveEngine, psychometricEngine, proctoringService, aiService, assessmentLifecycle
    │   ├── tests/                  # Jest test suites (auth, health, psychometric, security_lifecycle)
    │   ├── uploads/                # Temporary audio/media storage
    │   └── server.js               # Main Express entry point with graceful shutdown & error middleware
    │
    ├── frontend/                   # React 18 + Vite 8 SPA
    │   ├── src/
    │   │   ├── api/                # Production API client (apiClient.js)
    │   │   ├── components/         # UI & Sub-step components (AdaptiveAssessment, RealtimeMonitor, VoiceInterview, etc.)
    │   │   ├── pages/              # Landing, Login, Register, Dashboard, AssessmentFlow, Results, Profile, AdminDashboard
    │   │   ├── services/           # Client-side session and auth services
    │   │   └── utils/              # Client utilities
    │   ├── package.json
    │   └── vite.config.js
    │
    ├── docs/                       # Project documentation
    └── docker-compose.yml          # Container orchestration (mongodb, backend, frontend)
```

---

## 2. Core Operational Commands

### Backend Commands (run in `psychometric-patent/psychometric-system-backup/backend`)
- **Start server in dev mode:** `npm run dev`
- **Run test suites:** `npm test`
- **Start production server:** `node server.js`

### Frontend Commands (run in `psychometric-patent/psychometric-system-backup/frontend`)
- **Start dev server:** `npm run dev`
- **Build production assets:** `npm run build`
- **Preview build:** `npm run preview`

---

## 3. Non-Negotiable Architectural & Security Rules

1. **Server-Authoritative Assessment & Scoring:**
   - The browser MUST NOT contain answer keys or score questions locally.
   - The backend adaptive engine (`adaptiveEngine.js` & `assessmentLifecycle.js`) selects questions and verifies answers server-side.
   - Answer keys (`answer`, `correctAnswerIndex`) MUST NEVER be returned in API responses to candidates.

2. **Authentication & Authorization (RBAC & IDOR Prevention):**
   - User identity is verified via JWT tokens passed in `Authorization: Bearer <token>` headers.
   - Public registration (`/api/auth/register`) ALWAYS assigns the `student` role regardless of client inputs.
   - All user-owned resources (sessions, results, feedback) MUST be validated against `req.user.id` or elevated roles (`admin`, `evaluator`).

3. **Production Security & Fail-Closed Behavior:**
   - Production mode (`NODE_ENV=production`) MUST fail startup if `MONGO_URI` or secure `JWT_SECRET` (min 32 chars) is missing.
   - Stack traces, internal file paths, or raw database errors MUST NEVER be exposed in production error responses.
   - Sandbox/demo fallbacks are strictly development-only and must be disabled in production.

4. **Biometric & Psychometric Integrity:**
   - Face presence is monitored for proctoringTelemetry; do NOT label simple camera detection as clinically validated biometric identity or liveness.
   - Scoring indicators represent rules-based educational / interview-readiness metrics, not psychiatric or medical diagnoses.

---

## 4. Files Requiring Extreme Caution

- `backend/server.js`: Central server lifecycle, rate limiting, and global error handling.
- `backend/config/env.js`: Security policies and production enforcement.
- `backend/services/adaptiveEngine.js`: Question bank and adaptive selection rules.
- `backend/services/assessmentLifecycle.js`: Session lifecycle, state machine, and server scoring.
- `backend/controllers/assessmentController.js`: Assessment API endpoints.
- `frontend/src/components/AdaptiveAssessment.jsx`: Candidate question interaction.
- `frontend/src/pages/AssessmentFlow.jsx`: Multimodal assessment flow manager.

---

## 5. Prohibited Actions for Agents

- DO NOT rebuild the project from scratch or replace React + Vite / Express / Mongoose stack.
- DO NOT re-introduce client-side question banks or answer checking.
- DO NOT hardcode secrets or API keys in `docker-compose.yml` or source files.
- DO NOT force push git history or delete existing tests.
