import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { Shield, Eye } from "lucide-react";
import { connectSocket, emitProctoringEvent, joinSessionRoom } from "../services/realtimeService";
import { analyzeFrameForObjects } from "../utils/prohibitedObjectDetector";

export default function RealtimeMonitor({ 
  onMetrics, 
  isSubmitted, 
  sessionId, 
  currentDifficulty = 2, 
  questionBloom = "" 
}) {
  const video = useRef(null);
  const stream = useRef(null);
  const lastEvent = useRef({});
  const risk = useRef(0);
  const prevFaceCount = useRef(null);
  const prevObjects = useRef({});

  const [faces, setFaces] = useState(0);
  const [status, setStatus] = useState("Initializing AI monitor...");

  useEffect(() => {
    // Initialize WebSocket connection
    const token = localStorage.getItem("token");
    connectSocket(token);
    if (sessionId) {
      joinSessionRoom(sessionId);
    }
  }, [sessionId]);

  useEffect(() => {
    let active = true;
    let interval;

    const emit = (type, points, statusText = "⚠ Detected", severityText = "Warning", detailsText = "") => {
      if (isSubmitted) return;
      const now = Date.now();
      if (now - (lastEvent.current[type] || 0) < 3000) return;
      lastEvent.current[type] = now;
      risk.current = Math.min(100, risk.current + points);

      const timeString = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      const eventPayload = {
        id: `evt-${now}-${Math.random().toString(36).substring(2, 6)}`,
        time: timeString,
        type: type,
        status: statusText,
        severity: severityText,
        details: detailsText || `${type.replace(/_/g, " ")} observed`,
        timestamp: new Date().toISOString()
      };

      // 1. Emit locally to parent component state
      onMetrics?.({
        risk: risk.current,
        event: eventPayload,
        facesCount: faces,
        cameraActive: true
      });

      // 2. Emit real-time WebSocket event to backend evaluators
      emitProctoringEvent({
        sessionId,
        type,
        severity: severityText,
        time: timeString,
        details: detailsText,
        metadata: { risk: risk.current }
      });
    };

    (async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
        const userStream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false });
        stream.current = userStream;

        if (video.current) {
          video.current.srcObject = userStream;
          await video.current.play().catch(() => {});
        }
        setStatus("Monitoring Active");

        // Listen for video track end / camera disable
        const videoTrack = userStream.getVideoTracks()?.[0];
        if (videoTrack) {
          videoTrack.onended = () => {
            setStatus("Camera stream disconnected");
            emit("CAMERA_DISABLED", 25, "⚠ Feed Interrupted", "critical", "Camera stream was disconnected or disabled");
          };
        }

        interval = setInterval(async () => {
          if (!active || !video.current || video.current.readyState < 2 || isSubmitted) return;

          // 1. Check prohibited objects in camera stream
          const objResult = analyzeFrameForObjects(video.current);
          if (objResult.hasPhone && !prevObjects.current.hasPhone) {
            emit("PHONE_DETECTED", 25, "⚠ Prohibited Device", "critical", "Mobile phone detected in examination area");
          }
          if (objResult.hasEarbuds && !prevObjects.current.hasEarbuds) {
            emit("EARBUD_DETECTED", 20, "⚠ Audio Device", "high", "Earbud audio device detected on candidate");
          }
          if (objResult.hasHeadphones && !prevObjects.current.hasHeadphones) {
            emit("HEADPHONE_DETECTED", 20, "⚠ Audio Device", "high", "Over-ear headphones detected on candidate");
          }
          prevObjects.current = objResult;

          // 2. Check face count & presence
          try {
            const detections = await faceapi.detectAllFaces(
              video.current,
              new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 })
            );
            const count = detections.length;
            setFaces(count);

            if (prevFaceCount.current === null && count === 1) {
              // Initial detection stable
            } else if (count === 0 && prevFaceCount.current !== 0) {
              const isHighCognitive = currentDifficulty >= 3 || /analyz|evaluat|creat/i.test(questionBloom);
              if (isHighCognitive) {
                setStatus("Reflective problem solving observed");
                emit(
                  "COGNITIVE_REFLECTION", 
                  0, 
                  "✓ Cognitive Reflection", 
                  "low", 
                  "Candidate reflective gaze shift on advanced question (Zero Penalty)"
                );
              } else {
                setStatus("Candidate face missing");
                emit("FACE_MISSING", 10, "⚠ Face Absent", "medium", "Candidate face not detected in primary viewport");
              }
            } else if (count > 1 && prevFaceCount.current !== count) {
              setStatus(`${count} faces detected`);
              emit("MULTIPLE_FACE", 20, "⚠ Multiple Faces", "high", `${count} people detected in examination stream`);
            } else if (count === 1) {
              setStatus("Single candidate verified");
            }
            prevFaceCount.current = count;
          } catch (detErr) {
            if (prevFaceCount.current === null) {
              prevFaceCount.current = 1;
            }
          }
        }, 1200);
      } catch (e) {
        setStatus("Camera stream standby");
        emit("CAMERA_DISABLED", 25, "⚠ Camera Error", "critical", "Unable to access camera video feed");
      }
    })();

    const handleVisibilityChange = () => {
      if (document.hidden && !isSubmitted) {
        emit("TAB_SWITCH", 12, "⚠ Tab Switch", "high", "Candidate switched browser tabs or minimized window");
      }
    };

    const handleWindowBlur = () => {
      if (!isSubmitted) {
        emit("WINDOW_BLUR", 5, "⚠ Focus Lost", "medium", "Assessment window lost primary desktop focus");
      }
    };

    const handleOffline = () => {
      if (!isSubmitted) {
        emit("NETWORK_INTERRUPTION", 8, "⚠ Offline", "medium", "Candidate lost internet connection during assessment");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("offline", handleOffline);

    return () => {
      active = false;
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("offline", handleOffline);
      if (stream.current) {
        stream.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [onMetrics, isSubmitted, sessionId]);

  return (
    <aside className="monitor-card">
      <div className="monitor-video-wrap">
        <video ref={video} muted playsInline />
        <span className="live-ai-badge">● AI LIVE PROCTORING</span>
      </div>
      <div className="monitor-info-row">
        <div className="info-item">
          <Eye size={13} className="text-indigo-400" />
          <span>{status}</span>
        </div>
        <div className="info-item">
          <Shield size={13} className={risk.current > 30 ? "text-amber-400" : "text-emerald-400"} />
          <span>Risk: {risk.current}/100</span>
        </div>
      </div>
    </aside>
  );
}
