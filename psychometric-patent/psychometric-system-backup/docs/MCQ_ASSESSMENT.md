# MCQ Assessment Engine, Question Palette & Navigation Workflow (Phase 4)

## Overview
The MCQ Assessment module provides a 6-question adaptive psychometric and engineering assessment engine. In accordance with server-authoritative integrity rules, question difficulty is dynamically calibrated to candidate response accuracy without leaking question answer keys, correct flags, or raw rubrics to the browser bundle.

---

## 1. Question Palette & Navigation States

Candidates interact with an interactive Question Palette displaying question numbers `1` through `6`:

| State | Visual Indicator | Condition |
| :--- | :--- | :--- |
| **Answered** | Green background (`#10b981`) | Response recorded in session history |
| **Marked for Review** | Purple background (`#a855f7`) | Candidate flagged question for subsequent review |
| **Answered & Marked** | Diagonal gradient (Green / Purple) | Response recorded and flagged for review |
| **Unanswered** | Slate gray background (`#f1f5f9`) | Unattempted future questions |
| **Current Question** | Indigo focus ring (`#2563eb`) | Active question currently rendered on screen |

### Navigation Controls
- **Next Question:** Validates selected option, dispatches an autosave request to the backend, updates adaptive tier, and transitions to the subsequent question.
- **Previous:** Navigates back to any already attempted question to review statement and options.
- **Mark for Review:** Toggles review flag state without losing chosen answer.
- **Clear Choice:** Unselects the active option before recording.
- **Linear Adaptive Sequencing Protection:** Forward progression is gated so candidates cannot skip unanswered questions into uncalibrated adaptive tiers, but may freely revisit and modify previously answered questions within session time limits.

---

## 2. Server-Authoritative Scoring & Idempotent Updates

- **Answer Validation:** `POST /api/assessment/answer` verifies `choiceIndex` against server-side question bank definitions in `adaptiveEngine.js`.
- **Idempotent Updates:** When `allowUpdate: true` is supplied, candidate revisions overwrite the existing response entry in `AssessmentSession.responses` rather than duplicating the record.
- **Difficulty Recalibration:** Candidate ability $\theta$ and difficulty tier are recalculated on every confirmed response:
  $$\text{Next Difficulty} = \begin{cases} \min(3, \text{curr} + 1) & \text{if correct} \\ \max(1, \text{curr} - 1) & \text{if incorrect} \end{cases}$$

---

## 3. Submission Confirmation & Time Expiry Handling

1. **Submission Confirmation Modal:**
   - Displayed upon completing Question 6 or upon selecting "Review & Finish".
   - Shows an explicit summary:
     - Total Answered count
     - Total Marked for Review count
     - Total Unanswered count
   - Unanswered questions show a warning that unattempted questions receive zero credit.
   - Candidate must explicitly confirm submission before assessment locks.
2. **Time-Expiry Automatic Submission:**
   - If the 15-minute countdown timer reaches `00:00`, the test automatically locks (`isAssessmentCompleted = true`), persists uncommitted telemetry, and finalizes the assessment lifecycle.

---

## 4. Test Verification
All test cases for palette state rendering, answer recording, idempotent modifications, and IDOR prevention pass in `backend/tests/phase4_mcq_palette.test.js`.
