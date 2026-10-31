# Master Quality Assurance & Test Execution Plan

---

## 1. Test Suite Coverage

### 1.1 Backend Unit & Integration Tests (Jest)
- `tests/auth.test.js`: Registration, login, JWT validation, role assignment.
- `tests/health.test.js`: Health endpoint `/api/health` check.
- `tests/psychometric.test.js`: Deterministic scoring rules, adaptive difficulty calculation, report generation.
- `tests/security_lifecycle.test.js`: IDOR checks, answer key stripping, fail-closed production config enforcement.

### 1.2 Automated Execution Command
Run in `psychometric-patent/psychometric-system-backup/backend`:
```bash
npm test
```

### 1.3 Security Bypass Verification Scenarios
- **Client Identity Bypass Attempt**: Candidate posts `identity.verified=true` to `/api/assessment/submit` without server verification token → Rejected with HTTP 403.
- **IDOR Session Access**: Student A requests `/api/assessment/sessions/:id` belonging to Student B → Rejected with HTTP 403.
- **Answer Key Leakage**: Candidate fetches `/api/assessment/next-question` → Payload verified to contain `options` but NO `answer` or `correctAnswerIndex`.
