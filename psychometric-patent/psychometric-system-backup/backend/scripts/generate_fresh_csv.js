const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const uri = 'mongodb+srv://AnirudhMadhira:372825@cluster0.wiw5lv2.mongodb.net/testing?retryWrites=true&w=majority';

async function exportCSV() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const sessions = await db.collection('assessmentsessions').find({}).sort({ createdAt: -1 }).toArray();

  const sanitizedData = sessions.map((s, idx) => {
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

    return {
        anonymousParticipantId: `PARTICIPANT-${String(idx + 1).padStart(3, "0")}`,
        anonymousResponseId: `RESP-${String(s._id).slice(-6).toUpperCase()}`,
        testId: s.testId || "TEST-1",
        testVersion: s.testVersion || "1.0.0",
        cohortId: s.cohortId || "PILOT-A",
        attemptNumber: s.attemptNumber || 1,
        status: s.status,
        knowledgeScore: knowledge,
        reasoningScore: reasoning,
        communicationScore: communication,
        adaptabilityScore: adaptability,
        integrityScore: integrity,
        overallReadiness: readiness,
        decision: decision,
        createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : "",
        completedAt: s.completedAt ? new Date(s.completedAt).toISOString() : ""
    };
  });

  const headers = [
      "anonymousParticipantId",
      "anonymousResponseId",
      "testId",
      "testVersion",
      "cohortId",
      "attemptNumber",
      "status",
      "knowledgeScore",
      "reasoningScore",
      "communicationScore",
      "adaptabilityScore",
      "integrityScore",
      "overallReadiness",
      "decision",
      "createdAt",
      "completedAt"
  ];

  const escapeCSV = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
  };

  const csvRows = [headers.join(",")];
  for (const row of sanitizedData) {
      const line = headers.map((h) => escapeCSV(row[h])).join(",");
      csvRows.push(line);
  }

  const csvContent = csvRows.join("\n");
  const outPath = "C:\\Users\\prayu\\Downloads\\psychometric_research_data_updated.csv";
  fs.writeFileSync(outPath, csvContent, 'utf8');
  console.log(`Exported ${sanitizedData.length} rows to ${outPath}`);

  await mongoose.disconnect();
}

exportCSV().catch(console.error);
