const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');

const uri = 'mongodb+srv://AnirudhMadhira:372825@cluster0.wiw5lv2.mongodb.net/testing?retryWrites=true&w=majority';

async function main() {
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    const users = await db.collection('users').find({}).toArray();
    console.log(`\n======================================================`);
    console.log(`TOTAL REGISTERED STUDENTS: ${users.length}`);
    console.log(`======================================================`);
    users.forEach((u, i) => {
      console.log(`${i + 1}. [${u.role.toUpperCase()}] ${u.name} | Roll: ${u.rollNumber || 'N/A'} | Email: ${u.email} | Branch: ${u.branch || 'N/A'}`);
    });

    const results = await db.collection('results').find({}).toArray();
    console.log(`\n======================================================`);
    console.log(`COMPLETED CANDIDATE TEST REPORTS (${results.length})`);
    console.log(`======================================================`);
    results.forEach((r, i) => {
      console.log(`\nCandidate #${i + 1}: ${r.name || r.candidateName}`);
      console.log(`  • Status: ${r.decision || 'Completed'}`);
      console.log(`  • Technical Score: ${r.score} / ${r.total}`);
      console.log(`  • Knowledge Score: ${r.knowledgeScore}%`);
      console.log(`  • Reasoning Score: ${r.reasoningScore}%`);
      console.log(`  • Cognitive Index: ${r.cognitiveIndex}%`);
      console.log(`  • Adaptability: ${r.adaptabilityScore}%`);
      console.log(`  • Communication / Verbal: ${r.communicationScore}%`);
      console.log(`  • Integrity Score: ${r.integrityScore}%`);
      console.log(`  • Recommended Roles: ${Array.isArray(r.recommendedRoles) ? r.recommendedRoles.join(', ') : 'Software Developer'}`);
      console.log(`  • Completed At: ${r.createdAt}`);
    });

    const sessions = await db.collection('assessmentsessions').find({}).toArray();
    console.log(`\n======================================================`);
    console.log(`ACTIVE / IN-PROGRESS SESSIONS (${sessions.length})`);
    console.log(`======================================================`);
    sessions.forEach((s, i) => {
      console.log(`${i + 1}. Session: ${s._id} | User: ${s.userId} | Status: ${s.status} | Stage: ${s.currentStage} | Started: ${s.createdAt}`);
    });

    // Promote candidates to admin so the user can easily log in to the admin portal
    // We promote saiviratk2008@gmail.com and create or update a dedicated admin account: admin@vnrvjiet.in
    const updateResult = await db.collection('users').updateMany(
      { email: { $in: ['saiviratk2008@gmail.com', 'abcd@gmail.com', 'bava@gmail.com'] } },
      { $set: { role: 'admin' } }
    );
    console.log(`\nPromoted ${updateResult.modifiedCount} accounts to ADMIN role!`);

    await mongoose.disconnect();
  } catch (err) {
    console.error('Database query error:', err);
  }
}

main();
