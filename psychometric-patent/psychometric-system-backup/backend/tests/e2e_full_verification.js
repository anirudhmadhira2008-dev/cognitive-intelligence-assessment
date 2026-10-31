/**
 * Comprehensive E2E Verification Script for Features 1-5
 * Runs directly against live backend on http://localhost:5000
 */
const axios = require('axios');

const API = 'http://localhost:5000/api';

async function runE2E() {
    console.log('=== Starting E2E Verification ===\n');
    const ts = Date.now();
    const candidateEmail = `student_${ts}@test.com`;
    const password = 'StrongPassword123!';

    // 1. Register Student
    console.log('1. Registering Candidate:', candidateEmail);
    const regRes = await axios.post(`${API}/auth/register`, {
        name: 'Alex Rivera',
        email: candidateEmail,
        password: password
    });
    const token = regRes.data.token;
    const userId = regRes.data.user.id;
    console.log('   Registered successfully. User ID:', userId, 'Role:', regRes.data.user.role);

    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    // 2. Initial Performance Analysis (Empty State)
    console.log('\n2. Checking Initial Performance Analysis (Empty State)...');
    const initialPerfRes = await axios.get(`${API}/reports/performance-analysis`, authHeaders);
    const initialPerf = initialPerfRes.data.analysis || initialPerfRes.data;
    console.log('   hasData:', initialPerf.hasData);
    console.log('   message:', initialPerf.message);
    if (initialPerf.hasData !== false) throw new Error('Expected hasData=false on empty history');

    // 3. Complete Assessment 1 (Baseline: 2 Easy correct, 1 Medium incorrect, 0 Hard)
    console.log('\n3. Submitting Assessment Attempt 1...');
    const submit1 = await axios.post(`${API}/assessment/submit`, {
        candidate: { name: 'Alex Rivera', email: candidateEmail },
        responses: [
            { questionId: 'ds-01', choice: 1, difficulty: 1, competency: 'Critical thinking', responseMs: 4200 },
            { questionId: 'algo-01', choice: 1, difficulty: 1, competency: 'Problem-solving', responseMs: 5100 },
            { questionId: 'ds-02', choice: 0, difficulty: 2, competency: 'Technical judgment', responseMs: 6500 }
        ],
        voice: { communication: 75, confidence: 80, wordsSpoken: 45, keywordCoverage: 75 },
        monitoring: { riskScore: 5, attentionIndex: 90, events: [] },
        device: { score: 98 },
        baseline: { baselineQuality: 85 }
    }, authHeaders);

    console.log('   Assessment 1 submitted successfully.');
    console.log('   Result ID:', submit1.data.resultId, 'Session ID:', submit1.data.sessionId);

    // 4. Verify Signed Report for Attempt 1
    console.log('\n4. Verifying Signed Report for Attempt 1...');
    const reportsRes1 = await axios.get(`${API}/reports/my`, authHeaders);
    console.log('   Total signed reports found:', reportsRes1.data.reports?.length);
    if (!reportsRes1.data.reports || reportsRes1.data.reports.length === 0) {
        throw new Error('Signed report was not automatically generated on finalization');
    }

    const report1 = reportsRes1.data.reports[0];
    console.log('   Report ID:', report1.reportId);
    console.log('   Algorithm:', report1.signatureAlgorithm);
    console.log('   Key ID:', report1.keyId);
    console.log('   Canonical SHA-256 Hash:', report1.canonicalHash);
    console.log('   Signature length:', report1.signature?.length);

    // 5. Test Cryptographic Signature Verification
    console.log('\n5. Testing Cryptographic Verification API...');
    const verifyValid = await axios.post(`${API}/reports/verify`, {
        report: report1
    });
    console.log('   Original Report Verification:', verifyValid.data);
    if (!verifyValid.data.valid || verifyValid.data.status !== 'VALID') {
        throw new Error('Valid signed report failed cryptographic verification');
    }

    // 6. Test Tamper Detection
    console.log('\n6. Testing Tamper Detection...');
    const tamperedReport = JSON.parse(JSON.stringify(report1));
    tamperedReport.overallScore = 100; // Forging score
    if (tamperedReport.signedPayload) {
        tamperedReport.signedPayload.overallScore = 100;
    }
    const verifyTampered = await axios.post(`${API}/reports/verify`, {
        report: tamperedReport
    });
    console.log('   Tampered Report Verification (Altered Score):', verifyTampered.data);
    if (verifyTampered.data.valid !== false || verifyTampered.data.status !== 'TAMPERED_CONTENT') {
        throw new Error('Tampered report was not flagged as TAMPERED_CONTENT');
    }

    // 7. Complete Assessment Attempt 2 (Higher score across all 3 difficulties to test longitudinal trends)
    console.log('\n7. Submitting Assessment Attempt 2...');
    const submit2 = await axios.post(`${API}/assessment/submit`, {
        candidate: { name: 'Alex Rivera', email: candidateEmail },
        responses: [
            { questionId: 'ds-01', choice: 1, difficulty: 1, competency: 'Critical thinking', responseMs: 3800 },
            { questionId: 'algo-01', choice: 1, difficulty: 1, competency: 'Problem-solving', responseMs: 4200 },
            { questionId: 'ds-02', choice: 1, difficulty: 2, competency: 'Technical judgment', responseMs: 5000 },
            { questionId: 'algo-02', choice: 1, difficulty: 2, competency: 'Problem-solving', responseMs: 5300 },
            { questionId: 'ds-03', choice: 1, difficulty: 3, competency: 'Root-cause analysis', responseMs: 7200 },
            { questionId: 'algo-03', choice: 2, difficulty: 3, competency: 'Problem-solving', responseMs: 6900 }
        ],
        voice: { communication: 92, confidence: 90, wordsSpoken: 60, keywordCoverage: 88 },
        monitoring: { riskScore: 0, attentionIndex: 95, events: [] },
        device: { score: 100 },
        baseline: { baselineQuality: 90 }
    }, authHeaders);

    console.log('   Assessment 2 submitted successfully. Result ID:', submit2.data.resultId);

    // 8. Test Longitudinal Performance Analysis
    console.log('\n8. Checking Updated Longitudinal Performance Analysis...');
    const perfRes = await axios.get(`${API}/reports/performance-analysis`, authHeaders);
    const perf = perfRes.data.analysis || perfRes.data;
    console.log('   hasData:', perf.hasData);
    console.log('   Total Assessments:', perf.totalCompletedAssessments);
    console.log('   Historical Difficulty Charts:');
    console.log('     Easy Chart attempts:', perf.charts.easy.map(c => `[Att ${c.attemptNumber}: ${c.percentage}%]`).join(', '));
    console.log('     Medium Chart attempts:', perf.charts.medium.map(c => `[Att ${c.attemptNumber}: ${c.percentage === null ? 'Unavailable' : c.percentage + '%'}]`).join(', '));
    console.log('     Hard Chart attempts:', perf.charts.hard.map(c => `[Att ${c.attemptNumber}: ${c.percentage === null ? 'Unavailable' : c.percentage + '%'}]`).join(', '));
    console.log('   Trajectory Description:', perf.trends.trajectoryDescription);
    console.log('   Improving Areas:', perf.trends.improvingAreas);
    console.log('   10 Competencies Count:', Object.keys(perf.competencies).length);

    // 9. IDOR & Access Control Security
    console.log('\n9. Testing IDOR / Access Control Isolation...');
    const attackerRes = await axios.post(`${API}/auth/register`, {
        name: 'Attacker User',
        email: `attacker_${ts}@test.com`,
        password: 'AttackerPass123!'
    });
    const attackerHeaders = { headers: { Authorization: `Bearer ${attackerRes.data.token}` } };

    try {
        await axios.get(`${API}/reports/${report1._id || report1.reportId}`, attackerHeaders);
        throw new Error('IDOR vulnerability: Attacker was able to fetch another student report!');
    } catch (err) {
        if (err.response && (err.response.status === 403 || err.response.status === 404)) {
            console.log('   IDOR Prevented! Attacker received status:', err.response.status, err.response.data.message);
        } else {
            throw err;
        }
    }

    // 10. Public Keys Retrieval
    console.log('\n10. Fetching Public Keys for Verification...');
    const keysRes = await axios.get(`${API}/reports/public-keys`);
    console.log('   Public keys active ID:', keysRes.data.activeKeyId);
    console.log('   Supported algorithms:', keysRes.data.algorithms);

    console.log('\n=== ALL E2E VERIFICATIONS PASSED SUCCESSFULLY ===');
}

runE2E().catch((err) => {
    console.error('\n*** E2E VERIFICATION FAILED ***');
    console.error(err.response ? err.response.data : err.message);
    process.exit(1);
});
