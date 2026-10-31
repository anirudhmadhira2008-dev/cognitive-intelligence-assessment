# Voice Assessment, Rubric Dimensions & Review Workflow (Phase 5)

## Overview
The Voice Assessment subsystem evaluates verbal responses through speech recognition, AI-assisted semantic scoring, structured multi-dimensional rubrics, and a double-blind human examiner workflow.

---

## 1. Structured Rubric Dimensions (Scale: 1 – 10)

Every verbal interview response is evaluated across six structured cognitive and engineering dimensions:

| Rubric Dimension | Score Range | Evaluation Focus & Criteria |
| :--- | :---: | :--- |
| **Problem Analysis** | 1 – 10 | Structured decomposition of the question prompt; explicit identification of core requirements, bottlenecks, and assumptions. |
| **Technical Depth** | 1 – 10 | Accurate mastery of technical principles, data structures, algorithmic complexities, and domain terminology. |
| **Practicality** | 1 – 10 | Feasibility in real-world production systems; consideration of latency, deployment, caching, testing, and scalability. |
| **Communication** | 1 – 10 | Verbal coherence, vocabulary richness (lexical diversity), structure, fluency, and professional clarity. |
| **Adaptability** | 1 – 10 | Awareness of alternative solutions, trade-off comparisons, fallback plans, and handling edge cases. |
| **Ethical Judgment** | 1 – 10 | Consideration of data privacy, user consent, fairness, security hygiene, compliance, and fault tolerance. |

### Overall Score Calculation
$$\text{Overall Score (0 - 100)} = \text{round}\left(\frac{\sum_{i=1}^{6} \text{Dimension Score}_i}{60} \times 100\right)$$

---

## 2. AI-Assisted Evaluation & Fail-Safe Fallbacks

- **Primary Provider (Online):** When `OPENAI_API_KEY` is present and active, `aiService.evaluateVerbalResponse` queries `gpt-3.5-turbo` for fine-grained multi-dimensional rubric scoring, evidence quotation, and constructive advice.
- **Fail-Safe Semantic Fallback Engine:**
  - If network interruptions occur or external AI keys are unavailable/invalid, the system transitions to the deterministic rules-based semantic engine.
  - Generates transparent dimension ratings, extracts 1-2 direct quote strings from the transcript, and highlights constructive areas for development.
  - Transparently sets `source = "RULES_BASED_FALLBACK"` and `fallbackReason = "AI_SERVICE_UNAVAILABLE"`.
  - The assessment flow never hangs or crashes candidate sessions due to external API failures.

---

## 3. Human Reviewer Workflow & Double-Blind Privacy Boundary

To maintain psychometric objectivity and candidate privacy:

1. **Submission Review Queue (`GET /api/voice/submissions`):**
   - Restricted to `admin`, `evaluator`, and `psychologist` roles.
   - **Double-Blind Anonymization:** Records are identified strictly by `anonymousResponseId` (e.g. `RESP-A7F2B1`).
   - Candidate personal identification (Name, Email, Roll Number, Phone Number) is strictly excluded from evaluator payloads.
2. **Examiner Score Override (`POST /api/voice/override/:sessionId`):**
   - Evaluators can review transcripts, audio recordings, and automated scores, then submit revised rubric ratings.
   - Requires a mandatory structured justification note ($\ge 8$ characters).
   - Validates that each revised dimension is within $[1, 10]$.
   - Records an immutable audit trail (`reviewerId`, `reviewerRole`, `timestamp`, `originalScores`, `revisedScores`, `reasoning`).
   - Human reviewer scores supersede automated AI evaluations in final candidate reporting.

---

## 4. Test Verification
All unit and integration tests verifying rubric calculations, fallback engine operation, evaluator role gating, human overrides, and double-blind privacy boundaries pass in `backend/tests/phase5_voice_rubric.test.js`.
