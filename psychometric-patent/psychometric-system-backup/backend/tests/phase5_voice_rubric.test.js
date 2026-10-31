const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../server');
const connectDB = require('../config/db');
const User = require('../models/User');
const AssessmentSession = require('../models/AssessmentSession');
const aiService = require('../services/aiService');

jest.setTimeout(25000);

const jwtSecret = process.env.JWT_SECRET || 'default_development_secret_key_32chars_min';

describe('Phase 5: Voice Assessment, Rubric Dimensions & Human Reviewer Workflow', () => {
  let studentUser, studentToken;
  let evaluatorUser, evaluatorToken;
  let candidateSession;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }
    app.locals.dbConnected = true;

    const unique = Date.now();

    studentUser = await User.create({
      name: `Voice Candidate ${unique}`,
      email: `candidate_${unique}@test.com`,
      rollNumber: `ENG-VC-${unique}`,
      password: 'HashedPassword123!',
      role: 'student',
      accountStatus: 'active'
    });

    evaluatorUser = await User.create({
      name: `Senior Evaluator ${unique}`,
      email: `evaluator_${unique}@test.com`,
      password: 'HashedPassword123!',
      role: 'evaluator',
      accountStatus: 'active'
    });

    studentToken = jwt.sign(
      { id: studentUser._id.toString(), role: studentUser.role, email: studentUser.email },
      jwtSecret,
      { expiresIn: '1h' }
    );

    evaluatorToken = jwt.sign(
      { id: evaluatorUser._id.toString(), role: evaluatorUser.role, email: evaluatorUser.email },
      jwtSecret,
      { expiresIn: '1h' }
    );

    candidateSession = await AssessmentSession.create({
      userId: studentUser._id,
      testId: 'TEST-1',
      testVersion: '1.0.0',
      status: 'SUBMITTED',
      voice: {
        overallScore: 68,
        evaluationSource: 'RULES_BASED_FALLBACK',
        rubric: {
          problemAnalysis: 7,
          technicalDepth: 6,
          practicality: 7,
          communication: 8,
          adaptability: 6,
          ethicalJudgment: 7
        },
        evidenceQuotes: ["We decomposed the system into decoupled microservices."],
        feedback: "Solid technical clarity with practical considerations."
      }
    });
  });

  afterAll(async () => {
    if (studentUser?._id) {
      await User.deleteMany({ email: { $in: [studentUser.email, evaluatorUser.email] } });
      await AssessmentSession.deleteMany({ userId: studentUser._id });
    }
  });

  it('1. aiService.evaluateVerbalResponse returns 6 rubric dimensions (1-10) and fallback flag', async () => {
    const res = await aiService.evaluateVerbalResponse({
      question: "How do you handle database concurrency and caching?",
      transcript: "First, our approach uses Redis caching to minimize query latency. Because concurrency can cause race conditions, we use optimistic locking. For security, all input is sanitized.",
      keywords: ["redis", "concurrency", "caching", "locking"],
      durationSec: 25
    });

    expect(res).toBeDefined();
    expect(res.source).toBe('RULES_BASED_FALLBACK');
    expect(res.fallbackReason).toBe('AI_SERVICE_UNAVAILABLE');
    expect(res.rubric).toBeDefined();

    const dims = ['problemAnalysis', 'technicalDepth', 'practicality', 'communication', 'adaptability', 'ethicalJudgment'];
    dims.forEach((d) => {
      expect(typeof res.rubric[d]).toBe('number');
      expect(res.rubric[d]).toBeGreaterThanOrEqual(1);
      expect(res.rubric[d]).toBeLessThanOrEqual(10);
    });

    expect(Array.isArray(res.evidenceQuotes)).toBe(true);
    expect(res.evidenceQuotes.length).toBeGreaterThan(0);
    expect(typeof res.feedback).toBe('string');
    expect(res.overallScore).toBeGreaterThanOrEqual(10);
  });

  it('2. POST /api/voice/evaluate evaluates verbal answers with full rubric', async () => {
    const res = await request(app)
      .post('/api/voice/evaluate')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        question: "Explain microservices fault tolerance",
        transcript: "In our deployment, we implemented circuit breakers with exponential backoff. For compliance and privacy, user tokens are verified.",
        keywords: ["circuit breaker", "deployment", "fault tolerance"],
        durationSec: 20,
        sessionId: candidateSession._id.toString()
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.rubric).toBeDefined();
    expect(res.body.rubric.technicalDepth).toBeGreaterThanOrEqual(1);
    expect(res.body.overallScore).toBeGreaterThanOrEqual(10);
    expect(res.body.evidenceQuotes.length).toBeGreaterThan(0);
  });

  it('3. GET /api/voice/submissions enforces double-blind privacy (zero candidate PII leaked)', async () => {
    const res = await request(app)
      .get('/api/voice/submissions')
      .set('Authorization', `Bearer ${evaluatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.submissions)).toBe(true);

    const sub = res.body.submissions.find((s) => s.sessionId === candidateSession._id.toString());
    expect(sub).toBeDefined();
    expect(sub.anonymousResponseId).toMatch(/^RESP-[A-F0-9]{6}$/);

    // Double-blind privacy assertions:
    expect(sub.name).toBeUndefined();
    expect(sub.email).toBeUndefined();
    expect(sub.rollNumber).toBeUndefined();
    expect(sub.phone).toBeUndefined();
  });

  it('4. Rejects student candidate accessing evaluator review submissions (403)', async () => {
    const res = await request(app)
      .get('/api/voice/submissions')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
  });

  it('5. Evaluator can submit human score override with mandatory reasoning note', async () => {
    // 5a. Rejects missing/short reasoning
    const failRes = await request(app)
      .post(`/api/voice/override/${candidateSession._id}`)
      .set('Authorization', `Bearer ${evaluatorToken}`)
      .send({
        rubric: {
          problemAnalysis: 9,
          technicalDepth: 9,
          practicality: 8,
          communication: 9,
          adaptability: 8,
          ethicalJudgment: 9
        },
        reasoning: "short"
      });
    expect(failRes.status).toBe(400);

    // 5b. Rejects invalid score (> 10)
    const invalidRes = await request(app)
      .post(`/api/voice/override/${candidateSession._id}`)
      .set('Authorization', `Bearer ${evaluatorToken}`)
      .send({
        rubric: {
          problemAnalysis: 15,
          technicalDepth: 9,
          practicality: 8,
          communication: 9,
          adaptability: 8,
          ethicalJudgment: 9
        },
        reasoning: "Exemplary architectural understanding demonstrated."
      });
    expect(invalidRes.status).toBe(400);

    // 5c. Valid override succeeds
    const successRes = await request(app)
      .post(`/api/voice/override/${candidateSession._id}`)
      .set('Authorization', `Bearer ${evaluatorToken}`)
      .send({
        rubric: {
          problemAnalysis: 9,
          technicalDepth: 9,
          practicality: 8,
          communication: 9,
          adaptability: 8,
          ethicalJudgment: 9
        },
        reasoning: "Demonstrated exemplary architectural understanding and trade-off justification."
      });

    expect(successRes.status).toBe(200);
    expect(successRes.body.success).toBe(true);
    expect(successRes.body.evaluationSource).toBe('HUMAN_OVERRIDE');
    expect(successRes.body.humanOverride.isOverridden).toBe(true);
    expect(successRes.body.humanOverride.reviewerRole).toBe('evaluator');

    // Verify session in database
    const updatedSession = await AssessmentSession.findById(candidateSession._id);
    expect(updatedSession.voice.evaluationSource).toBe('HUMAN_OVERRIDE');
    expect(updatedSession.voice.rubric.technicalDepth).toBe(9);
    expect(updatedSession.voice.humanOverride.isOverridden).toBe(true);
  });
});
