# Admin Research Dashboard, Examiner Analytics & Cohort Comparison (Phase 6)

## Overview
The Admin Research and Examiner Analytics portal provides aggregate evaluation analytics, cross-cohort comparisons between Test 1 and Test 2, proctoring anomaly breakdowns, and double-blind research dataset exports for the 150-participant pilot evaluation.

---

## 1. Aggregate Analytics & Test 1 vs Test 2 Comparison

`GET /api/admin/analytics/cohorts` calculates:
1. **Pilot Population Metrics:** Total registered candidates, completed assessment attempts, and completion rate percentage.
2. **Test 1 vs Test 2 Statistical Performance:**
   - Sample size $N$ for each round.
   - Mean readiness score $\mu$.
   - Standard deviation $\sigma$:
     $$\sigma = \sqrt{\frac{1}{N - 1} \sum_{i=1}^{N} (x_i - \mu)^2}$$
   - Score range (Min, Max) and Quartile breakdown ($Q_1$, Median $Q_2$, $Q_3$).
3. **Paired Intra-Participant Delta Shift ($\Delta$):**
   - For participants completing both rounds, $\Delta_i = \text{Score}_{T2, i} - \text{Score}_{T1, i}$.
   - Aggregates mean delta $\bar{\Delta}$, count of positive performance gains, and neutral/negative variance.
4. **Cognitive Dimension Breakdown:**
   - Aggregated across Knowledge, Reasoning, Communication, Adaptability, and Integrity.
   - Automatically highlights strongest demonstrated competencies and developmental growth gaps.

---

## 2. Proctoring & Anomaly Distribution

`GET /api/admin/analytics/proctoring` categorizes:
- **Integrity Score Distribution:**
  - Excellent ($90 - 100\%$): Clean telemetry without notable infractions.
  - Good ($75 - 89\%$): Minor transient notices (e.g. ambient noise or lighting shift).
  - Moderate ($50 - 74\%$): Tab switches, intermittent focus loss.
  - High Risk / Flagged ($< 50\%$): Repeated absences or multiple faces observed; flagged for examiner review.
- **Incident Categorization:** Event breakdown counting tab switches, multiple faces, face absence, and audio/speech anomalies.

---

## 3. Double-Blind Privacy Boundary in Research Exports

`GET /api/admin/export?format=csv|json` guarantees compliance with ethical research guidelines:
- **Included Identifiers:**
  - Masked candidate identifier: `PARTICIPANT-001`, `PARTICIPANT-002`, ...
  - Anonymous attempt ID: `RESP-XXXXXX`
  - Cohort ID (e.g. `PILOT-2026`) and Test ID (`TEST-1`, `TEST-2`)
  - Attempt sequence number ($1, 2, \dots$)
  - Dimension scores (Knowledge, Reasoning, Communication, Adaptability, Integrity, Overall Readiness)
  - Proctoring telemetry counts and completion timestamps.
- **Prohibited & Filtered Data:**
  - Candidate name, email address, phone number, and student roll number are **strictly excluded**.
  - Individual question answer choices and raw video/audio media files are never leaked.

---

## 4. Examiner Review Workflow

`GET /api/admin/examiner/attempts` & `POST /api/admin/examiner/attempt/:id/review`:
- Allows faculty examiners and evaluators to filter attempts by Test, Cohort, and Review Status.
- Evaluators can review flagged attempts and record official decisions (`Approved`, `Rejected`, `Manual Review Required`) along with structured review notes, creating a permanent audit trail.

---

## 5. Test Verification
All cohort comparison math, proctoring aggregation, double-blind export filtering, and examiner permissions pass in `backend/tests/phase6_admin_analytics.test.js`.
