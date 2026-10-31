/**
 * Voice Assessment Prompts
 * (MCQ questions & answer keys are strictly server-authoritative and served via /api/assessment/question)
 */
const questionBank = [
  { id: 'hr1', domain: 'Behavioral', difficulty: 2, type: 'voice', bloom: 'Evaluate', competency: 'Communication', question: 'Describe a difficult technical problem you solved and how you approached it.', keywords: ['problem', 'approach', 'solution', 'learned'] },
  { id: 'hr2', domain: 'Behavioral', difficulty: 2, type: 'voice', bloom: 'Evaluate', competency: 'Adaptability', question: 'How do you respond when your first solution does not work?', keywords: ['analyze', 'alternative', 'feedback', 'improve'] },
  { id: 'techvoice', domain: 'Technical Communication', difficulty: 3, type: 'voice', bloom: 'Understand', competency: 'Communication', question: 'Explain binary search to a beginner, including its main requirement.', keywords: ['sorted', 'middle', 'half', 'log'] }
];

export default questionBank;
