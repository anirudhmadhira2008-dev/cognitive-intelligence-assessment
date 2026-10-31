# Pilot Launch Checklist & Operational Runbook

**Target Assessment:** 150-Participant Controlled Pilot (Paired Rounds: `TEST-1` & `TEST-2`)  
**Architecture:** Multimodal Psychometric AI Assessment Platform v2.4.0  
**Verification Status:** 13/13 Test Suites Passing (84/84 Tests), 150-User Synthetic Load Test Passed (0% Errors)  

---

## 1. Readiness Tier Matrix

| Dimension | Local Development | Staging / Campus Pilot | Full Cloud Production |
| :--- | :--- | :--- | :--- |
| **Database** | Local MongoDB (`127.0.0.1:27017`) | Dedicated MongoDB Replica Set | Managed MongoDB Atlas with VPC peering |
| **Network & TLS** | HTTP on `localhost` (W3C Secure Context) | Nginx Reverse Proxy with TLS Certificate | Cloud Load Balancer with TLS 1.3 & HSTS |
| **Rate Limiting** | Dev Default (2,000 auth / 5,000 global) | Calibrated for Campus NAT (2,000 auth/15m) | Distributed Redis-backed Rate Limiter |
| **Identity Verification** | Offline / Camera Local Test | Local Face Matcher + Manual Review Queue | Managed Biometric Verification Service |
| **Cryptographic Keys** | Local RSA 2048-bit (`config/keys/`) | Secure Mount (`/run/secrets/signing.key`) | Hardware Security Module (HSM) / KMS |
| **Voice Processing** | Deterministic Rules Engine + Gemini | Dual Engine (Gemini + Local Semantic Fallback)| Scaled Worker Pool + Transcribe Cluster |
| **Data Retention** | Local disk (`uploads/`) | Automated 30-Day Cleanup Daemon | Encrypted Object Store (S3/GCS with Lifecycle) |

---

## 2. Pre-Launch Verification Phase (T - 24 Hours)

### System Infrastructure Checks
- [ ] **MongoDB Service Active:**
  ```powershell
  mongod --version
  mongosh --eval "db.adminCommand('ping')"
  ```
- [ ] **Node.js Environment Verified (v18+ or v20+):**
  ```powershell
  node -v # Expected: >= v18.0.0
  npm -v
  ```
- [ ] **Dependencies Fully Installed:**
  ```powershell
  cd backend && npm install
  cd ../frontend && npm install
  ```
- [ ] **Environment Configuration (.env):**
  Ensure `.env` in `backend/` has:
  ```env
  PORT=5000
  NODE_ENV=production (or development for testing)
  MONGO_URI=mongodb://127.0.0.1:27017/psychometric_db
  JWT_SECRET=<min-32-character-high-entropy-secret>
  AUTH_RATE_LIMIT_MAX=2000
  RATE_LIMIT_MAX=5000
  CLIENT_URL=http://localhost:5173,http://localhost:3000
  ```
  *(Note: Never commit or share this file).*

- [ ] **RSA-PSS Signing Key Pair Exists:**
  Check `backend/config/keys/`:
  - `private_key.pem` (600 permissions, owner read-only)
  - `public_key.pem`
  Verify via automated test:
  ```powershell
  npm test tests/digital_signatures.test.js
  ```

- [ ] **Seed Test Definitions (`TEST-1` & `TEST-2`):**
  Run database seed/migration script to verify tests are populated:
  ```powershell
  node scripts/migrate_assessment_v3.js
  ```
  Verify via API:
  ```powershell
  curl -s http://localhost:5000/api/assessment/tests
  ```
  Expected output: Array containing `TEST-1` (v1.0.0) and `TEST-2` (v1.0.0).

- [ ] **Campus NAT Rate Limiting Policy Verified:**
  Confirm that `AUTH_RATE_LIMIT_MAX` is set to `2000` to allow 150 candidates sharing the same university egress IP without HTTP 429 throttling.

---

## 3. Pilot Day Preparation (T - 2 Hours)

### Service Launch & Health Verification
- [ ] **Start Backend Daemon:**
  ```powershell
  cd backend
  node server.js
  ```
  Verify health status:
  ```powershell
  curl http://localhost:5000/api/health
  # Response: {"status":"OK","database":"connected","timestamp":"..."}
  ```

- [ ] **Start or Serve Frontend Production Assets:**
  ```powershell
  cd frontend
  npm run build
  npm run preview -- --port 5173 --host 0.0.0.0
  ```

- [ ] **Run Pre-Pilot Regression Suite:**
  ```powershell
  cd backend
  npm test
  # All 13 test suites and 84 tests must pass cleanly.
  ```

- [ ] **Verify Examiner & Proctor Accounts:**
  - Log in to Admin portal (`/admin/dashboard`) with `examiner` or `admin` credentials.
  - Verify access to "Cohort Analytics", "Integrity Telemetry", and "Human Reviewer Queue".
  - Confirm candidate privacy boundary: Administrator view must only show Candidate Name and Roll Number. Email, Phone, and raw individual responses must remain inaccessible.

---

## 4. Candidate Execution Phase (During Pilot)

### Step 1: Candidate Registration & Pre-Checks
- [ ] **Registration:** Candidate navigates to `/register` and enters Name, Roll Number, Department, and Year.
- [ ] **Role Enforcement:** Server automatically enforces `student` role.
- [ ] **Device & Identity Check (`/enrollment`):**
  - Camera & microphone permission granted in browser.
  - Candidate captures reference webcam photo.
  - Backend performs face presence detection and stores encrypted reference hash.
  - *Fail-Closed Policy:* Unverified or missing identity checks are routed to `MANUAL_REVIEW_REQUIRED`.

### Step 2: Assessment Round 1 (`TEST-1`)
- [ ] **Start Session:** Candidate launches `TEST-1`.
- [ ] **Adaptive MCQ Navigation:**
  - Question Palette displays 5 real-time states:
    1. Answered (Green)
    2. Marked for Review (Purple)
    3. Answered & Marked for Review (Green with indicator)
    4. Current Active Question (Blue focus ring)
    5. Unanswered (Neutral gray)
  - Candidates can jump to any question, toggle review tags, and clear answers.
  - Auto-save synchronizes responses to backend continuously.
  - Local offline queue (`localStorage[psy_assessment_offline_queue]`) caches responses if local Wi-Fi drops, auto-replaying on reconnection.
- [ ] **Final Submission Modal:** Requires explicit confirmation showing answered vs. review count before finalizing.

### Step 3: Voice Qualitative Assessment
- [ ] Candidate records spoken responses to scenario prompt.
- [ ] 6-dimension rubric scored server-side (1–10): Problem Analysis, Technical Depth, Practicality, Communication, Adaptability, Ethical Judgment.
- [ ] Dual-engine processing: Google Gemini primary with instant deterministic rules fallback if AI rate limits or network issues occur.

### Step 4: Proctored Session Finalization
- [ ] Integrity score generated from background telemetry (tab switches, webcam continuity, window blur).
- [ ] Server computes overall score, creates immutable record, and generates RSA-PSS digital signature.

### Step 5: Paired Round 2 (`TEST-2`)
- [ ] Candidate initiates `TEST-2` under cohort definition.
- [ ] Server enforces distinct attempt records (`attemptNumber: 2`, `testId: "TEST-2"`). No historical overwrite of `TEST-1` data.

---

## 5. Examiner Review & Post-Pilot Actions (T + 1 Hour)

### Human Reviewer Workflow
- [ ] **Review Borderline Voice Submissions:**
  - Examiner visits `GET /api/voice/submissions` in admin console.
  - Examiner plays voice audio and reviews automated rubric breakdown.
  - Examiner enters human score override via `POST /api/voice/override/:sessionId` with mandatory rationale ($\ge 8$ chars).

- [ ] **Resolve Flagged Proctoring Sessions:**
  - Examiner reviews candidates with integrity scores $< 75\%$.
  - Examiner checks timestamped incident logs (tab-switches, face-absence events).

### Double-Blind Research Export
- [ ] **Export Cohort Data:**
  - Admin clicks "Export Research Data" on `/admin/dashboard` or calls `GET /api/admin/export?format=csv`.
  - **Privacy Audit:** Verify that export contains only double-blind IDs (e.g. `CAND-xxxx`), test scores, cognitive dimensions, and integrity metrics. No student names, emails, phone numbers, or raw response keys.

### Cryptographic Credential Verification
- [ ] **Verify Signed Reports:**
  - Open `/verify` portal.
  - Input candidate Report ID or upload downloaded `.json` certificate.
  - Confirm RSA-PSS cryptographic validation against public key `psychometric-key-2026-v1`.

### Data Retention & Cleanup
- [ ] **Run Ephemeral Cleanup Daemon:**
  ```powershell
  node -e "require('./backend/services/mediaRetentionService').runRetentionCleanup()"
  ```
  - Deletes temporary voice recordings and unverified attempt caches.
  - Preserves verified identity references in `uploads/identity_references/`.

---

## 6. Emergency Contingency Plan

| Incident Scenario | Immediate Action |
| :--- | :--- |
| **Wi-Fi / Network Flap** | Frontend offline queue caches all answers in localStorage. Candidates are informed with an offline banner; upon network restoration, all queued answers replay automatically without data loss. |
| **Accidental Tab Close / Browser Crash** | Candidate re-opens URL and logs in. Backend session state machine recognizes `IN_PROGRESS` and restores question palette state and elapsed time. |
| **AI Evaluation Outage (Gemini 429/503)** | Backend automatically switches to built-in deterministic rules-based semantic engine. Voice rubric evaluation succeeds with fallback disclosure tag. |
| **Candidate Identity Flagged False-Positive** | Examiner accesses Examiner Review Queue and manually reviews candidate webcam reference to grant manual authorization token. |
| **Campus IP 429 Rate Limit** | Backend is pre-configured with `AUTH_RATE_LIMIT_MAX=2000`. If required, bump `RATE_LIMIT_MAX` in `.env` and restart server. |
