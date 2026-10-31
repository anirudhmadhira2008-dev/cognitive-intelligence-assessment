const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../server');
const connectDB = require('../config/db');
const User = require('../models/User');
const AssessmentSession = require('../models/AssessmentSession');

jest.setTimeout(25000);

const jwtSecret = process.env.JWT_SECRET || 'default_development_secret_key_32chars_min';

describe('Phase 6: Admin Research Dashboard, Examiner Analytics & Cohort Comparison', () => {
  let adminUser, adminToken;
  let studentUser, studentToken;
  let sessionT1, sessionT2;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }
    app.locals.dbConnected = true;

    const unique = Date.now();

    adminUser = await User.create({
      name: `Research Admin ${unique}`,
      email: `admin_${unique}@research.edu`,
      password: 'HashedPassword123!',
      role: 'admin',
      accountStatus: 'active'
    });

    studentUser = await User.create({
      name: `Pilot Participant ${unique}`,
      email: `participant_${unique}@univ.edu`,
      phone: "+1-555-0199",
      rollNumber: `PILOT-${unique}`,
      password: 'HashedPassword123!',
      role: 'student',
      accountStatus: 'active'
    });

    adminToken = jwt.sign(
      { id: adminUser._id.toString(), role: adminUser.role, email: adminUser.email },
      jwtSecret,
      { expiresIn: '1h' }
    );

    studentToken = jwt.sign(
      { id: studentUser._id.toString(), role: studentUser.role, email: studentUser.email },
      jwtSecret,
      { expiresIn: '1h' }
    );

    // Test 1 attempt
    sessionT1 = await AssessmentSession.create({
      userId: studentUser._id,
      testId: 'TEST-1',
      testVersion: '1.0.0',
      cohortId: 'PILOT-2026',
      attemptNumber: 1,
      status: 'COMPLETED',
      report: {
        knowledge: 75,
        reasoning: 70,
        communication: 80,
        adaptability: 65,
        integrity: 95,
        readiness: 77,
        decision: 'Recommended'
      },
      monitoring: {
        events: [
          { type: 'TAB_BLUR', time: '10:00:01', severity: 'medium' }
        ]
      }
    });

    // Test 2 attempt by the same participant (Paired Test)
    sessionT2 = await AssessmentSession.create({
      userId: studentUser._id,
      testId: 'TEST-2',
      testVersion: '1.0.0',
      cohortId: 'PILOT-2026',
      attemptNumber: 1,
      status: 'COMPLETED',
      report: {
        knowledge: 85,
        reasoning: 80,
        communication: 85,
        adaptability: 75,
        integrity: 98,
        readiness: 85,
        decision: 'Highly Recommended'
      },
      telemetryEvents: [
        { type: 'FACE_ABSENCE', time: '11:15:30', severity: 'warning' }
      ]
    });
  });

  afterAll(async () => {
    if (adminUser?._id) {
      await User.deleteMany({ email: { $in: [adminUser.email, studentUser.email] } });
      await AssessmentSession.deleteMany({ userId: studentUser._id });
    }
  });

  it('1. GET /api/admin/analytics/cohorts calculates Test 1 vs Test 2 stats & paired delta shift', async () => {
    const res = await request(app)
      .get('/api/admin/analytics/cohorts')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.totalCandidates).toBeGreaterThanOrEqual(1);
    expect(res.body.completedAttempts).toBeGreaterThanOrEqual(2);

    // Test 1 and Test 2 stats
    expect(res.body.test1Stats).toBeDefined();
    expect(res.body.test1Stats.n).toBeGreaterThanOrEqual(1);
    expect(res.body.test2Stats).toBeDefined();
    expect(res.body.test2Stats.n).toBeGreaterThanOrEqual(1);

    // Paired Delta Shift
    expect(res.body.pairedCohortShift).toBeDefined();
    expect(res.body.pairedCohortShift.n).toBeGreaterThanOrEqual(1);
    expect(typeof res.body.pairedCohortShift.meanDelta).toBe('number');

    // Cognitive dimension breakdown
    expect(res.body.cognitiveDimensions).toBeDefined();
    expect(res.body.cognitiveDimensions.knowledge).toBeGreaterThan(0);
    expect(res.body.cognitiveDimensions.integrity).toBeGreaterThan(0);
  });

  it('2. GET /api/admin/analytics/proctoring aggregates integrity scores and proctoring incidents', async () => {
    const res = await request(app)
      .get('/api/admin/analytics/proctoring')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.distribution).toBeDefined();
    expect(res.body.distribution.excellent).toBeGreaterThanOrEqual(1);
    expect(res.body.incidents).toBeDefined();
    expect(res.body.incidents.tabSwitches).toBeGreaterThanOrEqual(1);
  });

  it('3. GET /api/admin/export enforces Double-Blind Privacy (JSON & CSV exports)', async () => {
    // 3a. JSON Export
    const jsonRes = await request(app)
      .get('/api/admin/export?format=json')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(jsonRes.status).toBe(200);
    expect(jsonRes.body.success).toBe(true);
    expect(Array.isArray(jsonRes.body.data)).toBe(true);
    expect(jsonRes.body.data.length).toBeGreaterThanOrEqual(2);

    const record = jsonRes.body.data.find((d) => d.anonymousResponseId === `RESP-${sessionT1._id.toString().slice(-6).toUpperCase()}`);
    expect(record).toBeDefined();
    expect(record.anonymousParticipantId).toMatch(/^PARTICIPANT-\d{3}$/);

    // Strict privacy assertions: personal identification fields must NOT exist in export
    expect(record.name).toBeUndefined();
    expect(record.email).toBeUndefined();
    expect(record.phone).toBeUndefined();
    expect(record.password).toBeUndefined();
    expect(record.answers).toBeUndefined();

    // 3b. CSV Export
    const csvRes = await request(app)
      .get('/api/admin/export?format=csv')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(csvRes.status).toBe(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');
    expect(csvRes.text).toContain('anonymousParticipantId');
    expect(csvRes.text).toContain('knowledgeScore');

    // Asserts no PII string present in raw CSV
    expect(csvRes.text).not.toContain(studentUser.email);
    expect(csvRes.text).not.toContain(studentUser.phone);
  });

  it('4. GET /api/admin/examiner/attempts & POST /api/admin/examiner/attempt/:id/review updates attempt decision', async () => {
    const listRes = await request(app)
      .get('/api/admin/examiner/attempts?testId=TEST-1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(Array.isArray(listRes.body.attempts)).toBe(true);

    const reviewRes = await request(app)
      .post(`/api/admin/examiner/attempt/${sessionT1._id}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        decision: 'Approved',
        notes: 'Verified biometric integrity and stable telemetry timeline.'
      });

    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.success).toBe(true);
    expect(reviewRes.body.examinerReview.status).toBe('Approved');

    const updated = await AssessmentSession.findById(sessionT1._id);
    expect(updated.examinerReview.status).toBe('Approved');
  });

  it('5. Rejects candidate student accessing admin analytics or research export (403)', async () => {
    const res1 = await request(app)
      .get('/api/admin/analytics/cohorts')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res1.status).toBe(403);

    const res2 = await request(app)
      .get('/api/admin/export')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res2.status).toBe(403);
  });
});
