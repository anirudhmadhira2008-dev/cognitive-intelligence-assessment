# Student Performance Analysis Specification

**Multimodal Psychometric AI Assessment Platform**  
**Specification Version:** 2.4.0  
**Status:** IMPLEMENTED & VERIFIED  

---

## 1. Overview & Methodological Principles

The Student Performance Analysis module provides longitudinal analytics tracking candidate progress across multiple completed assessment attempts.

### Key Methodological Rules:
1. **Exclusively Persisted Data:** Only finalized, submitted assessments (`status: "COMPLETED"`) are incorporated. Abandoned, in-progress, or interrupted sessions are strictly excluded.
2. **Server-Authoritative Calculations:** Percentages are computed server-side directly from response verification records.
3. **Strict Non-Clinical Boundaries:** The analytics measure educational and technical task readiness. No claims are made regarding innate intelligence, psychiatric condition, or clinical psychometric profiles.
4. **Honest Null Representation:** If a candidate was not presented with questions of a given difficulty, that difficulty is explicitly represented as `null` ("Unavailable / Not Attempted"). It is **never** reported as `0%`.

---

## 2. Historical Difficulty Analysis

Candidates are presented with **exactly three historical bar charts** in chronological sequence:

```
[ Attempt 1: Easy ] ────────────── 100%
[ Attempt 2: Easy ] ────────────── 100%

[ Attempt 1: Medium ] ────────────  0%
[ Attempt 2: Medium ] ──────────── 100%

[ Attempt 1: Hard ]   (Unavailable / Not Attempted)
[ Attempt 2: Hard ]   ──────────── 100%
```

### Calculation Formula:
For each completed assessment session $s$ and difficulty level $d \in \{\text{easy}, \text{medium}, \text{hard}\}$:

$$\text{Difficulty Percentage}_{s, d} = \begin{cases} 
\text{round}\left(\frac{\text{earned points}_{s, d}}{\text{available points}_{s, d}} \times 100\right) & \text{if } \text{available points}_{s, d} > 0 \\ 
\text{null} & \text{if } \text{available points}_{s, d} = 0 
\end{cases}$$

### Point Allocation Weights:
- **Easy (Difficulty 1):** 10 points per question.
- **Medium (Difficulty 2):** 20 points per question.
- **Hard (Difficulty 3):** 30 points per question.

---

## 3. Competency Breakdown across 10 Engineering Domains

The platform evaluates candidates against 10 standardized engineering and workplace competencies:

| # | Competency Domain | Primary Evaluation Signal |
| :---: | :--- | :--- |
| 1 | **Critical Thinking** | Algorithmic analysis, premise validity, edge-case deduction |
| 2 | **Problem-Solving** | Data structure selection, algorithmic paradigm selection |
| 3 | **Situational Judgment** | Engineering tradeoffs, incident response, team compromise |
| 4 | **Communication** | Voice interview fluency, clarity, concise articulation |
| 5 | **Adaptability** | Performance recovery after incorrect answers at higher difficulty |
| 6 | **Technical Judgment** | Architecture, ACID properties, OSI layer troubleshooting |
| 7 | **Ethical Decision-Making** | Security integrity, data privacy adherence, bias avoidance |
| 8 | **Prioritization** | CPU scheduling, resource allocation, bottleneck triage |
| 9 | **Teamwork** | Code review feedback, cross-functional collaboration reasoning |
| 10 | **Root-Cause Analysis** | Memory leak debugging, stack trace inspection, concurrency deadlocks |

### Normalization & Evidence Rules:
- If no questions were evaluated for a specific competency, `hasEvidence` is `false` and the percentage is `null`.
- Questions are assigned points according to difficulty; scores represent weighted accuracy.
- Verbal communication signals from the voice interview module are normalized to a 100-point scale and blended into the Communication domain.

---

## 4. Evidence-Based Longitudinal Trend Engine

The trend engine avoids generating baseless claims from minor statistical fluctuations. It implements strict minimum-evidence thresholds:

1. **Attempt Minimum:** Longitudinal trajectory claims require at least $N \ge 2$ completed assessments. If $N < 2$, the system reports:
   > *"Overall Historical Trajectory: Minimum 2 completed assessments required."*
2. **Improvement / Decline Threshold ($\ge 5\%$):**
   - An area is classified as **Improving** if and only if: $\Delta = P_{\text{latest}} - P_{\text{baseline}} \ge +5\%$.
   - An area is classified as **Declining** if and only if: $\Delta = P_{\text{latest}} - P_{\text{baseline}} \le -5\%$.
   - Fluctuations within $[-4\%, +4\%]$ are classified as stable/consistent.
3. **Difficulty Gap Analysis ($\ge 20\%$):**
   - When Easy accuracy exceeds Hard accuracy by $\ge 20\%$, a specific gap insight is generated advising targeted practice in advanced problem-solving.

---

## 5. Resilient Supplementary AI Feedback Architecture

When Gemini or OpenAI keys are configured (`GEMINI_API_KEY` / `OPENAI_API_KEY`):
- The backend generates a qualitative synthesis summarizing measured progress, top strengths, and focus areas.
- **Fail-Safe Design:** If the AI provider times out, encounters a rate limit, or returns an invalid schema:
  - The request catches the error gracefully.
  - `aiFeedback` is set to `null`.
  - The entire analytics dashboard renders without disruption using objective metrics.
  - The student's assessment scores and history remain 100% authoritative and intact.

---

## 6. API Interface & Data Schema

### Endpoint:
`GET /api/reports/performance-analysis`  
`Authorization: Bearer <JWT_TOKEN>`

### Response Schema:
```json
{
  "success": true,
  "analysis": {
    "hasData": true,
    "totalCompletedAssessments": 2,
    "latestOverallScore": 88,
    "charts": {
      "easy": [
        { "attemptNumber": 1, "earned": 20, "available": 20, "percentage": 100, "label": "Attempt 1 (Oct 22, 2026)" },
        { "attemptNumber": 2, "earned": 20, "available": 20, "percentage": 100, "label": "Attempt 2 (Oct 22, 2026)" }
      ],
      "medium": [
        { "attemptNumber": 1, "earned": 0, "available": 20, "percentage": 0, "label": "Attempt 1 (Oct 22, 2026)" },
        { "attemptNumber": 2, "earned": 40, "available": 40, "percentage": 100, "label": "Attempt 2 (Oct 22, 2026)" }
      ],
      "hard": [
        { "attemptNumber": 1, "earned": 0, "available": 0, "percentage": null, "label": "Attempt 1 (Oct 22, 2026)" },
        { "attemptNumber": 2, "earned": 60, "available": 60, "percentage": 100, "label": "Attempt 2 (Oct 22, 2026)" }
      ]
    },
    "competencies": {
      "Critical thinking": { "earned": 20, "available": 20, "percentage": 100, "hasEvidence": true, "questionsCount": 2 },
      "Problem-solving": { "earned": 80, "available": 80, "percentage": 100, "hasEvidence": true, "questionsCount": 4 }
    },
    "trends": {
      "improvingAreas": [
        "Medium Questions (+100% improvement from 0% to 100%)"
      ],
      "decliningAreas": [],
      "insufficientDataAreas": [],
      "trajectoryDescription": "Measured positive progression (+23% across 2 attempts)."
    },
    "aiFeedback": null
  }
}
```

---

## 7. Automated Test Verification

```bash
PASS backend/tests/performance_analysis.test.js
  ✓ correctly computes difficulty percentages using earned / available * 100
  ✓ represents unattempted difficulty as null rather than 0%
  ✓ correctly maps and evaluates performance across all 10 competencies
  ✓ enforces minimum-evidence thresholds for trend analysis
```

All 4 test cases passed.
