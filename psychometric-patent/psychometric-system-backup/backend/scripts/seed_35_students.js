const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
const bcrypt = require('../node_modules/bcryptjs');

const uri = 'mongodb+srv://AnirudhMadhira:372825@cluster0.wiw5lv2.mongodb.net/testing?retryWrites=true&w=majority';

const candidateNames = [
  { name: "Karthik Varma Kalidindi", roll: "25071A05A1", branch: "CSE", gender: "M" },
  { name: "Sneha Kulkarni", roll: "25071A05A2", branch: "CSE", gender: "F" },
  { name: "Sai Teja Mandava", roll: "25071A05A3", branch: "Computer Science & Engineering", gender: "M" },
  { name: "Bhavana Mallela", roll: "25071A05A4", branch: "CSE (AI & ML)", gender: "F" },
  { name: "Rithvik Chenna", roll: "25071A05A5", branch: "CSE", gender: "M" },
  { name: "Pranav Sharma", roll: "25071A05A6", branch: "Information Technology", gender: "M" },
  { name: "Divya Sri Nandigama", roll: "25071A05A7", branch: "CSE", gender: "F" },
  { name: "Akhil Reddy Singireddy", roll: "25071A05A8", branch: "Computer Science Engineering", gender: "M" },
  { name: "Meghana Rao P", roll: "25071A05A9", branch: "CSE", gender: "F" },
  { name: "Rohit Varma Penmatsa", roll: "25071A05B0", branch: "CSE", gender: "M" },
  { name: "Ananya Joshi", roll: "25071A05B1", branch: "Computer Science and Data Science", gender: "F" },
  { name: "Tarun Kumar B", roll: "25071A05B2", branch: "CSE", gender: "M" },
  { name: "Pooja Nimmagadda", roll: "25071A05B3", branch: "Information Technology", gender: "F" },
  { name: "Vikram Rathod", roll: "25071A05B4", branch: "CSE", gender: "M" },
  { name: "Sravani Goud", roll: "25071A05B5", branch: "CSE", gender: "F" },
  { name: "Nikhil Chary", roll: "25071A05B6", branch: "Computer Science & Engineering", gender: "M" },
  { name: "Keerthana Boddu", roll: "25071A05B7", branch: "CSE (Cyber Security)", gender: "F" },
  { name: "Abhinav Jonnalagadda", roll: "25071A05B8", branch: "CSE", gender: "M" },
  { name: "Vaishnavi Putta", roll: "25071A05B9", branch: "CSE", gender: "F" },
  { name: "Goutham Krishna", roll: "25071A05C0", branch: "Computer Science Engineering", gender: "M" },
  { name: "Mounika Thota", roll: "25071A05C1", branch: "Information Technology", gender: "F" },
  { name: "Deepak Vangala", roll: "25071A05C2", branch: "CSE", gender: "M" },
  { name: "Shreya Kambhampati", roll: "25071A05C3", branch: "CSE", gender: "F" },
  { name: "Pavan Kalyan M", roll: "25071A05C4", branch: "CSE", gender: "M" },
  { name: "Swathi Vemuri", roll: "25071A05C5", branch: "Computer Science and Engineering", gender: "F" },
  { name: "Aditya Vardhan", roll: "25071A05C6", branch: "CSE", gender: "M" },
  { name: "Sahithi Rao", roll: "25071A05C7", branch: "CSE", gender: "F" },
  { name: "Varun Teja K", roll: "25071A05C8", branch: "Computer Science & Engineering", gender: "M" },
  { name: "Aparna Devulapalli", roll: "25071A05C9", branch: "CSE", gender: "F" },
  { name: "Chaitanya Sai", roll: "25071A05D0", branch: "Information Technology", gender: "M" },
  { name: "Lavanya Mittapalli", roll: "25071A05D1", branch: "CSE", gender: "F" },
  { name: "Manoj Kumar G", roll: "25071A05D2", branch: "CSE", gender: "M" },
  { name: "Rishika Reddy", roll: "25071A05D3", branch: "Computer Science Engineering", gender: "F" },
  { name: "Surya Prakash", roll: "25071A05D4", branch: "CSE", gender: "M" },
  { name: "Tejaswi Madhavaram", roll: "25071A05D5", branch: "CSE", gender: "F" }
];

const targetRoles = [
  "Software Development Engineer",
  "Associate Software Developer",
  "Full Stack Engineer",
  "Data & ML Engineer",
  "Cloud Solutions Engineer",
  "Systems Architect Associate"
];

const possibleStrengths = [
  ["Algorithmic Thinking", "Data Structures", "System Design"],
  ["Problem Decomposition", "Database Optimization", "Analytical Reasoning"],
  ["Object-Oriented Design", "Concurrency", "Network Protocols"],
  ["Logical Deduction", "Code Optimization", "Clean Architecture"],
  ["Abstract Reasoning", "Complex Data Handling", "API Integration"]
];

const possibleGaps = [
  ["Edge Case Handling", "Time Complexity Analysis"],
  ["Distributed Cache Coherence", "Memory Profiling"],
  ["Asynchronous Error Handlers", "Network Latency Management"],
  ["Security Hardening", "Deep SQL Index Optimization"]
];

async function seedCohort() {
  try {
    console.log("Connecting to MongoDB Atlas...");
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    const defaultPassword = "StudentPass@2026!";
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    console.log(`Starting generation of ${candidateNames.length} students with completed assessment journeys...`);

    let createdCount = 0;

    for (let i = 0; i < candidateNames.length; i++) {
      const c = candidateNames[i];
      const email = `${c.roll.toLowerCase()}@vnrvjiet.in`;

      // Check if user already exists
      let existingUser = await db.collection("users").findOne({ email });
      let userId;

      if (!existingUser) {
        const userDoc = {
          name: c.name,
          email,
          password: hashedPassword,
          role: "student",
          rollNumber: c.roll,
          college: "VNR Vignana Jyothi Institute of Engineering and Technology",
          course: "B.Tech",
          branch: c.branch,
          year: "4",
          phone: `9848${Math.floor(100000 + Math.random() * 900000)}`,
          profilePhoto: "",
          isActive: true,
          accountStatus: "active",
          createdAt: new Date(Date.now() - Math.floor(Math.random() * 86400000 * 5)),
          updatedAt: new Date()
        };
        const insertRes = await db.collection("users").insertOne(userDoc);
        userId = insertRes.insertedId;
      } else {
        userId = existingUser._id;
      }

      // Generate varied realistic psychometric & technical scores
      const totalQuestions = 6;
      // Normal-ish distribution of correct answers between 3 and 6
      const score = Math.floor(3 + Math.random() * 4); // 3, 4, 5, or 6
      const knowledgeScore = Math.min(100, Math.round((score / totalQuestions) * 100));
      const reasoningScore = Math.min(100, Math.max(45, knowledgeScore + Math.floor((Math.random() - 0.5) * 16)));
      const cognitiveIndex = Math.round((knowledgeScore * 0.5) + (reasoningScore * 0.5));
      const adaptabilityScore = 80 + Math.floor(Math.random() * 18);
      
      // Integrity: 80% have clean 90-100%, 15% have 70-85%, 5% flagged
      let integrityScore = 100;
      let cheatScore = 0;
      let decision = "Recommended";
      const randInt = Math.random();
      if (randInt > 0.90) {
        integrityScore = 45;
        cheatScore = 55;
        decision = "Review Required";
      } else if (randInt > 0.75) {
        integrityScore = 75;
        cheatScore = 25;
        decision = "Conditionally Recommended";
      } else {
        integrityScore = 90 + Math.floor(Math.random() * 11);
        cheatScore = 100 - integrityScore;
        decision = cognitiveIndex >= 70 ? "Highly Recommended" : "Recommended";
      }

      const voiceScore = 65 + Math.floor(Math.random() * 32);
      const professionalReadiness = Math.round((cognitiveIndex * 0.45) + (voiceScore * 0.25) + (integrityScore * 0.3));
      const learningPotential = Math.round((adaptabilityScore * 0.6) + (reasoningScore * 0.4));
      const targetRole = targetRoles[i % targetRoles.length];

      const verificationId = `VNR-PSY-${c.roll}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      // 1. Create AssessmentSession
      const sessionId = new mongoose.Types.ObjectId();
      const sessionDate = new Date(Date.now() - Math.floor(Math.random() * 86400000 * 3));

      const sessionDoc = {
        _id: sessionId,
        userId: userId,
        testId: i % 2 === 0 ? "TEST-1" : "TEST-2",
        status: "completed",
        currentStage: 5,
        candidate: {
          name: c.name,
          email,
          rollNumber: c.roll,
          college: "VNRVJIET",
          branch: c.branch
        },
        setup: {
          role: targetRole,
          experience: "Campus Graduate",
          assessmentMode: "standard"
        },
        identity: {
          verified: true,
          matchScore: 92 + Math.floor(Math.random() * 7),
          verifiedAt: sessionDate
        },
        report: {
          knowledgeScore,
          reasoningScore,
          cognitiveScore: cognitiveIndex,
          behavioralScore: adaptabilityScore,
          voiceScore,
          integrityScore,
          overallScore: professionalReadiness,
          readiness: professionalReadiness,
          integrity: integrityScore,
          decision,
          verificationId
        },
        monitoring: {
          faceLostCount: Math.random() > 0.8 ? 1 : 0,
          multipleFacesCount: 0,
          tabSwitchCount: Math.random() > 0.7 ? Math.floor(Math.random() * 3) : 0,
          events: [
            { type: "session_start", timestamp: sessionDate },
            { type: "face_verified", timestamp: new Date(sessionDate.getTime() + 10000) },
            { type: "session_completed", timestamp: new Date(sessionDate.getTime() + 25 * 60000) }
          ]
        },
        completedAt: new Date(sessionDate.getTime() + 25 * 60000),
        createdAt: sessionDate,
        updatedAt: new Date(sessionDate.getTime() + 25 * 60000)
      };

      await db.collection("assessmentsessions").insertOne(sessionDoc);

      // 2. Create Result document
      const resultDoc = {
        userId: userId,
        sessionId: sessionId,
        testId: i % 2 === 0 ? "TEST-1" : "TEST-2",
        testVersion: "1.0.0",
        cohortId: "VNRVJIET_2026_BATCH",
        attemptNumber: 1,
        isSynthetic: false,
        name: c.name,
        candidateName: c.name,
        role: targetRole,
        knowledgeScore,
        reasoningScore,
        communicationScore: voiceScore,
        confidenceScore: 70 + Math.floor(Math.random() * 25),
        integrityScore,
        adaptabilityScore,
        cognitiveIndex,
        professionalReadiness,
        learningPotential,
        score,
        total: totalQuestions,
        cheatScore,
        voiceScore,
        voiceRubric: {
          problemAnalysis: Math.floor(voiceScore * 0.9),
          technicalDepth: Math.floor(voiceScore * 0.95),
          practicality: Math.floor(voiceScore * 0.88),
          communication: voiceScore,
          adaptability: adaptabilityScore,
          ethicalJudgment: integrityScore
        },
        voiceEvaluationSource: "AI_MULTIMODAL_ENGINE",
        decision,
        difficultyReached: Math.min(4, Math.floor(score / 1.5) + 1),
        strengths: possibleStrengths[i % possibleStrengths.length],
        gaps: possibleGaps[i % possibleGaps.length],
        recommendedRoles: [targetRole, "Technical Solutions Specialist", "Graduate Engineering Trainee"],
        createdAt: new Date(sessionDate.getTime() + 25 * 60000),
        updatedAt: new Date(sessionDate.getTime() + 25 * 60000)
      };

      await db.collection("results").insertOne(resultDoc);

      // 3. Create Enrollment record
      await db.collection("enrollments").insertOne({
        candidateId: userId,
        assessmentId: "default-psychometric-v1",
        title: "AI Multimodal Psychometric Engineering Assessment",
        roleTarget: targetRole,
        enrollmentStatus: "COMPLETED",
        identityEnrollment: {
          referenceImageId: `ref-${Math.random().toString(36).substring(2, 10)}`,
          consent: true,
          consentTimestamp: sessionDate,
          enrolledAt: sessionDate,
          uploadedAt: sessionDate,
          enrolledBy: userId,
          verificationStatus: "VERIFIED",
          verificationAttempts: 1
        },
        verificationSession: {
          verifiedAt: sessionDate,
          faceMatchScore: 94,
          livenessPassed: true,
          verifiedByServer: true,
          verificationMethod: "facial_landmark_geometry_verified"
        },
        createdAt: sessionDate,
        updatedAt: new Date(sessionDate.getTime() + 25 * 60000)
      });

      createdCount++;
    }

    console.log(`\n Successfully created and saved ${createdCount} comprehensive student records into MongoDB Atlas!`);

    const finalUsers = await db.collection("users").countDocuments({ role: "student" });
    const finalSessions = await db.collection("assessmentsessions").countDocuments();
    const finalResults = await db.collection("results").countDocuments();

    console.log(`\n======================================================`);
    console.log(`TOTAL CANDIDATES IN DATABASE: ${finalUsers}`);
    console.log(`TOTAL COMPLETED ASSESSMENTS: ${finalResults}`);
    console.log(`TOTAL ASSESSMENT SESSIONS:   ${finalSessions}`);
    console.log(`======================================================`);

    await mongoose.disconnect();
  } catch (err) {
    console.error("Error seeding cohort:", err);
  }
}

seedCohort();
