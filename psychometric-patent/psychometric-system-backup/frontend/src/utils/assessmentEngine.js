export const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));

export function calculateDeviceScore(checks) {
  const values = Object.values(checks).map(Boolean);
  return clamp((values.filter(Boolean).length / Math.max(1, values.length)) * 100);
}

export function createBaseline(samples) {
  const avg = (arr) => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
  return {
    mouseSpeed: clamp(avg(samples.mouseSpeeds), 0, 100),
    reactionTimeMs: Math.round(avg(samples.reactionTimes) || 900),
    typingRate: Math.round(avg(samples.typingRates) || 0),
    facePresence: clamp(avg(samples.facePresence) * 100),
    baselineQuality: clamp(55 + samples.mouseSpeeds.length * 3 + samples.reactionTimes.length * 5)
  };
}

export function chooseQuestions(bank, startingDifficulty = 2, count = 6) {
  const mcqs = bank.filter(q => q.type === 'mcq');
  return [...mcqs].sort((a,b) => Math.abs(a.difficulty-startingDifficulty)-Math.abs(b.difficulty-startingDifficulty)).slice(0,count);
}

export function nextDifficulty(current, correct, responseMs, confidence = 50) {
  if (correct && responseMs < 20000 && confidence >= 55) return Math.min(3, current + 1);
  if (!correct && responseMs > 25000) return Math.max(1, current - 1);
  return current;
}

export function evaluateVoice(transcript, keywords = [], durationSec = 1) {
  const normalized = (transcript || '').toLowerCase();
  const matches = keywords.filter(k => normalized.includes(k.toLowerCase())).length;
  const words = normalized.trim() ? normalized.trim().split(/\s+/).length : 0;
  const coverage = keywords.length ? matches / keywords.length : Math.min(1, words / 25);
  const fluency = Math.min(1, words / Math.max(20, durationSec * 1.3));
  return {
    transcript,
    keywordCoverage: clamp(coverage * 100),
    communication: clamp(coverage * 65 + fluency * 35),
    confidence: clamp(45 + Math.min(words, 50) * 0.7),
    words
  };
}

export function buildFinalReport({ mcq, voice, monitor, baseline, device, difficultyReached }) {
  const knowledge = clamp((mcq.correct / Math.max(1, mcq.total)) * 100);
  const reasoning = clamp(knowledge * 0.65 + mcq.partialReasoning * 0.35);
  const communication = clamp(voice.communication || 0);
  const confidence = clamp((voice.confidence || 45) * 0.7 + (monitor.attention || 70) * 0.3);
  const integrity = clamp(100 - (monitor.risk || 0));
  const adaptability = clamp(45 + difficultyReached * 14 + (mcq.improvement || 0));
  const cognitive = clamp(knowledge * .35 + reasoning * .25 + adaptability * .2 + communication * .2);
  const readiness = clamp(cognitive * .45 + communication * .2 + confidence * .15 + integrity * .2);
  const learningPotential = clamp(adaptability * .55 + reasoning * .45);
  let decision = 'Needs Improvement';
  if (readiness >= 85 && integrity >= 75) decision = 'Highly Recommended';
  else if (readiness >= 70 && integrity >= 65) decision = 'Recommended';
  else if (readiness >= 55) decision = 'Conditionally Recommended';
  if (integrity < 50) decision = 'Review Required';
  const roles = knowledge >= 75 ? ['Software Developer','Data Analyst','Technical Associate'] : ['Junior Developer','Support Engineer','Graduate Trainee'];
  const strengths = Object.entries({Knowledge:knowledge,Reasoning:reasoning,Communication:communication,Adaptability:adaptability,Integrity:integrity}).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]);
  const gaps = Object.entries({Knowledge:knowledge,Reasoning:reasoning,Communication:communication,Confidence:confidence}).sort((a,b)=>a[1]-b[1]).slice(0,2).map(x=>x[0]);
  return { knowledge, reasoning, communication, confidence, integrity, adaptability, cognitive, readiness, learningPotential, decision, roles, strengths, gaps, deviceTrust:device.score, baselineQuality:baseline.baselineQuality, difficultyReached };
}
