/**
 * Client-Side Facial Biometric Feature Extraction & Geometric Similarity
 * 
 * Extracts scale-invariant, position-invariant facial landmark proportion vectors
 * using 68-point 2D facial topology from face-api.js.
 * Compares reference enrollment photo against real-time webcam frame.
 */

export function extractFaceGeometry(landmarks) {
  if (!landmarks || !landmarks.positions || landmarks.positions.length < 68) return null;
  const pts = landmarks.positions;

  // 1. Eye Centers
  const leftEye = { 
    x: (pts[36].x + pts[39].x) / 2, 
    y: (pts[36].y + pts[39].y) / 2 
  };
  const rightEye = { 
    x: (pts[42].x + pts[45].x) / 2, 
    y: (pts[42].y + pts[45].y) / 2 
  };
  
  // 2. Inter-Ocular Distance (IOD) — scale-invariant normalizer
  const iod = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y) || 1;
  const eyeMid = { 
    x: (leftEye.x + rightEye.x) / 2, 
    y: (leftEye.y + rightEye.y) / 2 
  };
  
  // 3. Key Facial Anchors
  const noseTip = pts[30];
  const mouthMid = { 
    x: (pts[48].x + pts[54].x) / 2, 
    y: (pts[51].y + pts[57].y) / 2 
  };
  const chin = pts[8];
  
  // 4. Distances & Widths
  const jawWidth = Math.hypot(pts[16].x - pts[0].x, pts[16].y - pts[0].y);
  const mouthWidth = Math.hypot(pts[54].x - pts[48].x, pts[54].y - pts[48].y);
  const noseWidth = Math.hypot(pts[35].x - pts[31].x, pts[35].y - pts[31].y);
  const leftEyebrowToEye = Math.hypot(pts[19].x - leftEye.x, pts[19].y - leftEye.y);
  const rightEyebrowToEye = Math.hypot(pts[24].x - rightEye.x, pts[24].y - rightEye.y);

  // Return scale-normalized biometric proportions vector
  return [
    Math.hypot(noseTip.x - eyeMid.x, noseTip.y - eyeMid.y) / iod,       // Eye-to-nose proportion
    Math.hypot(mouthMid.x - noseTip.x, mouthMid.y - noseTip.y) / iod,   // Nose-to-mouth proportion
    Math.hypot(chin.x - mouthMid.x, chin.y - mouthMid.y) / iod,         // Mouth-to-chin proportion
    Math.hypot(chin.x - eyeMid.x, chin.y - eyeMid.y) / iod,             // Total facial length proportion
    jawWidth / iod,                                                     // Jaw-to-eye proportion
    mouthWidth / iod,                                                   // Mouth span proportion
    noseWidth / iod,                                                    // Nose span proportion
    ((leftEyebrowToEye + rightEyebrowToEye) / 2) / iod                 // Eyebrow vertical proportion
  ];
}

/**
 * Computes biometric similarity percentage between two normalized facial geometry vectors.
 * Returns score between 10% and 99%. Threshold for match is >= 60%.
 */
export function compareFaceGeometries(vec1, vec2) {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;
  
  let sumSqDiff = 0;
  for (let i = 0; i < vec1.length; i++) {
    sumSqDiff += Math.pow(vec1[i] - vec2[i], 2);
  }
  const distance = Math.sqrt(sumSqDiff);
  
  // For the same individual across slight pose/expression shifts, distance is typically 0.04 - 0.22
  // For different individuals, distance typically exceeds 0.35 - 0.70+
  const rawScore = 100 - (distance * 135);
  return Math.max(15, Math.min(99, Math.round(rawScore)));
}
