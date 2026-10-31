# Real-Time WebSocket & Live Proctoring Specification

**Protocol**: Socket.IO over WebSockets / HTTP Fallback  
**Transport Mode**: Bi-directional event streaming  

---

## 1. Socket Architecture & Channels

```
 [ Candidate Browser ]
       │  (proctoring_event)
       ▼
 [ Socket.IO Server ] ──► Room: "session:<sessionId>"
       │
       └────────────────► Room: "evaluators" ──► [ Evaluator Dashboard ]
```

---

## 2. Event Directory

- `ASSESSMENT_STARTED`: Candidate launches assessment session.
- `QUESTION_STARTED`: Candidate views new adaptive MCQ.
- `ANSWER_SAVED`: Candidate submits MCQ response.
- `FACE_DETECTED`: Continuous face presence confirmed.
- `FACE_MISSING`: No face detected in video viewport.
- `MULTIPLE_FACE`: More than one face detected in frame.
- `TAB_SWITCH`: Candidate switched browser window or tab.
- `WINDOW_BLUR`: Focus lost from exam viewport.
- `ASSESSMENT_SUBMITTED`: Assessment finalized and score generated.
