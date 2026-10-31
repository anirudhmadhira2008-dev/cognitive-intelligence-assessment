# Recovery, Network Reliability & Low-Bandwidth Resilience (Phase 7)

## Overview
During controlled academic or field evaluations involving up to 150 concurrent participants, transient network drops, high Wi-Fi latency, browser refreshes, and device power interruptions can occur. This document outlines the recovery and reliability mechanisms engineered into the platform.

---

## 1. Network Fault Tolerance & Low-Bandwidth Handling

### 1.1 Exponential Backoff Retry Policy
In `frontend/src/api/apiClient.js`, requests that fail due to transient network disconnections (`TypeError: Failed to fetch`, network timeout) execute exponential backoff retries:
$$\text{Delay}(attempt) = 2^{attempt} \times 500\text{ms} \quad (1.0\text{s}, 2.0\text{s})$$

### 1.2 Offline Local Storage Action Queue
If connection failure persists after retries:
1. Mutative candidate actions (`/api/assessment/answer` and `/api/assessment/progress`) are saved immediately to `localStorage[psy_assessment_offline_queue]`.
2. The UI renders an amber badge: `Autosave Offline / Queued`.
3. The client listens for the `window.ononline` event. As soon as the device regains Internet connectivity, `flushOfflineQueue()` replays queued answers sequentially to the server.
4. On successful replay, the badge updates to `Server Autosaved`.

---

## 2. Session Interruption & Mid-Test Recovery

### 2.1 State Recovery on Page Refresh
If a candidate accidentally closes their browser tab, refreshes, or loses power:
1. `AdaptiveAssessment` queries `GET /api/assessment/sessions/:sessionId` upon mounting.
2. The server returns:
   - `session.responses`: all recorded questions, answers, and timestamps.
   - `session.adaptiveState.currentDifficulty`: the exact calibrated difficulty tier reached.
   - `session.adaptiveState.attemptedQuestionIds`: question IDs already served to prevent re-issuing duplicate questions.
3. Candidate resumes testing at the next unanswered question without losing progress.

### 2.2 Time Expiry Synchronization
- Session start time `startedAt` is stored authoritatively on the server.
- The 15-minute countdown clock is validated on submission against server-side session timestamps to prevent client-side clock tampering.

---

## 3. Server Crash & Database Restart Recovery

- Assessment sessions are persisted directly in MongoDB with write concern `w: 1`.
- When the backend service restarts (e.g. after a process crash or reboot):
  - Mongoose automatically reconnects with connection pooling (`maxPoolSize: 20`).
  - Active sessions remain in `in-progress` or `IN_PROGRESS` status and can be resumed seamlessly by candidates.
  - Background ephemeral sweeps (`mediaRetentionService.js`) run safely on startup without destroying active identity reference photos.
