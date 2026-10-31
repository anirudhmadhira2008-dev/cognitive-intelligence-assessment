const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');

const uri = 'mongodb+srv://AnirudhMadhira:372825@cluster0.wiw5lv2.mongodb.net/testing?retryWrites=true&w=majority';

async function verify() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const sessions = await db.collection('assessmentsessions').find({}).sort({ createdAt: -1 }).toArray();

  console.log(`Analyzing ${sessions.length} sessions for CSV export...`);

  let zeroCount = 0;
  const rows = [];
  sessions.forEach((s, idx) => {
    const report = s.report || {};
    const knowledge = report.knowledgeScore !== undefined && report.knowledgeScore !== null && report.knowledgeScore !== 0
        ? report.knowledgeScore
        : (report.knowledge !== undefined && report.knowledge !== null ? report.knowledge : 0);
    const reasoning = report.reasoningScore !== undefined && report.reasoningScore !== null && report.reasoningScore !== 0
        ? report.reasoningScore
        : (report.reasoning !== undefined && report.reasoning !== null ? report.reasoning : 0);
    const communication = report.communicationScore !== undefined && report.communicationScore !== null && report.communicationScore !== 0
        ? report.communicationScore
        : (report.voiceScore !== undefined && report.voiceScore !== null && report.voiceScore !== 0
            ? report.voiceScore
            : (report.communication !== undefined && report.communication !== null ? report.communication : 0));
    const adaptability = report.adaptabilityScore !== undefined && report.adaptabilityScore !== null && report.adaptabilityScore !== 0
        ? report.adaptabilityScore
        : (report.behavioralScore !== undefined && report.behavioralScore !== null && report.behavioralScore !== 0
            ? report.behavioralScore
            : (report.adaptability !== undefined && report.adaptability !== null ? report.adaptability : 0));
    const integrity = report.integrityScore !== undefined && report.integrityScore !== null
        ? report.integrityScore
        : (report.integrity !== undefined && report.integrity !== null ? report.integrity : 100);
    const readiness = report.overallScore !== undefined && report.overallScore !== null && report.overallScore !== 0
        ? report.overallScore
        : (report.readiness !== undefined && report.readiness !== null ? report.readiness : 0);
    const decision = report.decision || "Recommended";

    if (knowledge === 0 || reasoning === 0 || communication === 0 || adaptability === 0) {
      zeroCount++;
      console.log(`WARNING: Zero found at row ${idx + 1} (${s._id})! k=${knowledge}, r=${reasoning}, c=${communication}, a=${adaptability}`);
    }

    rows.push({
      row: idx + 1,
      id: `PARTICIPANT-${String(idx + 1).padStart(3, "0")}`,
      resp: `RESP-${String(s._id).slice(-6).toUpperCase()}`,
      knowledge,
      reasoning,
      communication,
      adaptability,
      integrity,
      readiness,
      decision
    });
  });

  console.log(`\nVerification Result:`);
  console.log(`Total Rows: ${rows.length}`);
  console.log(`Rows with any zeroes in H, I, J, K: ${zeroCount}`);
  
  console.log('\nSample First 5 Rows:');
  console.table(rows.slice(0, 5));

  console.log('\nSample Rows 18-25:');
  console.table(rows.slice(17, 25));

  console.log('\nSample Last 5 Rows:');
  console.table(rows.slice(-5));

  await mongoose.disconnect();
}

verify().catch(console.error);
