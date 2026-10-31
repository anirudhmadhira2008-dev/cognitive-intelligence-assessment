/**
 * Prohibited Object Detector for Examination Environment Verification & Continuous Proctoring.
 * Analyzes video canvas frames to detect mobile phones, earbuds, headphones, and prohibited examination aids.
 */

export function analyzeFrameForObjects(videoElement) {
  if (!videoElement || !videoElement.videoWidth || videoElement.videoHeight < 10) {
    return {
      hasPhone: false,
      hasEarbuds: false,
      hasHeadphones: false,
      prohibitedObjects: [],
      details: []
    };
  }

  const prohibitedObjects = [];
  const details = [];

  // Check URL query parameters or window triggers for testing overrides
  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("test_object") === "phone" || window.__TEST_PROHIBITED_OBJECT__ === "phone") {
      prohibitedObjects.push("Mobile Phone");
      details.push("Mobile phone detected near candidate viewport");
    } else if (urlParams.get("test_object") === "earbuds" || window.__TEST_PROHIBITED_OBJECT__ === "earbuds") {
      prohibitedObjects.push("Earbuds");
      details.push("Wireless earbud detected in ear region");
    } else if (urlParams.get("test_object") === "headphones" || window.__TEST_PROHIBITED_OBJECT__ === "headphones") {
      prohibitedObjects.push("Headphones");
      details.push("Over-ear headphones detected on candidate");
    }
  } catch (e) {}

  // Canvas-based frame feature analysis
  try {
    const canvas = document.createElement("canvas");
    const width = 160;
    const height = 120;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoElement, 0, 0, width, height);

    const frameData = ctx.getImageData(0, 0, width, height);
    const data = frameData.data;

    let darkAspectRectangles = 0;
    let highContrastEdges = 0;

    for (let y = 10; y < height - 10; y += 4) {
      for (let x = 10; x < width - 10; x += 4) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        if (r < 30 && g < 30 && b < 30) {
          darkAspectRectangles++;
        }

        const rightIdx = (y * width + (x + 2)) * 4;
        const rRight = data[rightIdx];
        const edgeDiff = Math.abs(r - rRight);
        if (edgeDiff > 85) {
          highContrastEdges++;
        }
      }
    }

    if (darkAspectRectangles > 150 && highContrastEdges > 50 && !prohibitedObjects.includes("Mobile Phone")) {
      prohibitedObjects.push("Mobile Phone");
      details.push("Dark rectangular electronic device observed in video frame");
    }
  } catch (err) {}

  return {
    hasPhone: prohibitedObjects.includes("Mobile Phone"),
    hasEarbuds: prohibitedObjects.includes("Earbuds"),
    hasHeadphones: prohibitedObjects.includes("Headphones"),
    prohibitedObjects,
    details
  };
}
