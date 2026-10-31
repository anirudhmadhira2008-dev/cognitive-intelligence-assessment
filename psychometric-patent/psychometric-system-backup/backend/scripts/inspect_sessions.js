const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');

const uri = 'mongodb+srv://AnirudhMadhira:372825@cluster0.wiw5lv2.mongodb.net/testing?retryWrites=true&w=majority';

async function check() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const count = await db.collection('assessmentsessions').countDocuments();
  console.log('Total sessions:', count);
  const sessions = await db.collection('assessmentsessions').find({}).sort({ createdAt: -1 }).toArray();
  console.log(`Found ${sessions.length} sessions.`);
  sessions.forEach((s, i) => {
    console.log(`[${i+1}] ID: ${s._id} | Status: ${s.status} | knowledge: ${s.report?.knowledge} | knowledgeScore: ${s.report?.knowledgeScore} | reasoning: ${s.report?.reasoning} | reasoningScore: ${s.report?.reasoningScore} | comm: ${s.report?.communication} | commScore: ${s.report?.communicationScore} | voiceScore: ${s.report?.voiceScore} | adapt: ${s.report?.adaptability} | adaptScore: ${s.report?.adaptabilityScore} | behScore: ${s.report?.behavioralScore}`);
  });
  await mongoose.disconnect();
}

check().catch(console.error);
