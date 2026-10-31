const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../server');
const connectDB = require('../config/db');
const User = require('../models/User');
const AssessmentSession = require('../models/AssessmentSession');
const env = require('../config/env');

jest.setTimeout(25000);

const jwtSecret = process.env.JWT_SECRET || env.JWT_SECRET || 'default_development_secret_key_32chars_min';

describe('Phase 4: MCQ Workflow, Question Palette, Answer Updates & Autosave', () => {
  let studentUser;
  let studentToken;
  let testSession;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }
    app.locals.dbConnected = true;
    const unique = Date.now();
    studentUser = await User.create({
      name: `MCQ Student ${unique}`,
      email: `mcq_student_${unique}@test.com`,
      rollNumber: `MCQ-${unique}`,
      password: 'HashedPassword123!',
      role: 'student',
      accountStatus: 'active'
    });

    studentToken = jwt.sign(
      { id: studentUser._id.toString(), role: studentUser.role, email: studentUser.email },
      jwtSecret,
      { expiresIn: '1h' }
    );

    testSession = await AssessmentSession.create({
      userId: studentUser._id,
      testId: 'TEST-1',
      testVersion: '1.0.0',
      status: 'in-progress',
      responses: [],
      adaptiveState: {
        currentDifficulty: 2,
        attemptedQuestionIds: []
      }
    });
  });

  afterAll(async () => {
    if (studentUser?._id) {
      await User.deleteMany({ email: studentUser.email });
      await AssessmentSession.deleteMany({ userId: studentUser._id });
    }
  });

  it('1. Rejects recordAnswer with invalid or missing questionId or choiceIndex', async () => {
    const res1 = await request(app)
      .post('/api/assessment/answer')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        sessionId: testSession._id.toString(),
        choiceIndex: 1
      });
    expect(res1.status).toBe(400);

    const res2 = await request(app)
      .post('/api/assessment/answer')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        sessionId: testSession._id.toString(),
        questionId: 'q-valid-1',
        choiceIndex: 'invalid_string'
      });
    expect(res2.status).toBe(400);
  });

  it('2. Records an initial answer to AssessmentSession responses', async () => {
    const res = await request(app)
      .post('/api/assessment/answer')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        sessionId: testSession._id.toString(),
        questionId: 'ds-01',
        choiceIndex: 2,
        responseMs: 1450,
        confidence: 80
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.isCorrect).toBe('boolean');
    expect(typeof res.body.nextDifficulty).toBe('number');

    const updated = await AssessmentSession.findById(testSession._id);
    expect(updated.responses.length).toBe(1);
    expect(updated.responses[0].questionId).toBe('ds-01');
    expect(updated.responses[0].choice).toBe(2);
  });

  it('3. Allows updating an existing response without creating duplicate question records', async () => {
    const res = await request(app)
      .post('/api/assessment/answer')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        sessionId: testSession._id.toString(),
        questionId: 'ds-01',
        choiceIndex: 3,
        responseMs: 2100,
        confidence: 90,
        allowUpdate: true
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updated = await AssessmentSession.findById(testSession._id);
    expect(updated.responses.length).toBe(1); // No duplicate
    expect(updated.responses[0].choice).toBe(3); // Updated choice
  });

  it('4. Rejects recording answers to sessions owned by another candidate (IDOR protection)', async () => {
    const intruder = await User.create({
      name: 'Intruder Candidate',
      email: `intruder_${Date.now()}@test.com`,
      rollNumber: `INT-${Date.now()}`,
      password: 'HashedPassword123!',
      role: 'student'
    });
    const intruderToken = jwt.sign(
      { id: intruder._id.toString(), role: intruder.role, email: intruder.email },
      jwtSecret,
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .post('/api/assessment/answer')
      .set('Authorization', `Bearer ${intruderToken}`)
      .send({
        sessionId: testSession._id.toString(),
        questionId: 'q-adaptive-1',
        choiceIndex: 1
      });

    expect(res.status).toBe(403);
    await User.findByIdAndDelete(intruder._id);
  });
});
