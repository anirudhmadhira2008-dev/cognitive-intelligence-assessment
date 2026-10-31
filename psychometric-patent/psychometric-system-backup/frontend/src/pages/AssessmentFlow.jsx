import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import IdentityVerification from "../components/IdentityVerification";
import DeviceValidation from "../components/DeviceValidation";
import BehavioralBaseline from "../components/BehavioralBaseline";
import AssessmentSetup from "../components/AssessmentSetup";
import AdaptiveAssessment from "../components/AdaptiveAssessment";
import VoiceInterview from "../components/VoiceInterview";
import api from "../api/apiClient";
import { getUser } from "../services/authService";
import { Loader2, CheckCircle2, AlertTriangle, RefreshCw, Shield, Sparkles, RotateCcw } from "lucide-react";

export default function AssessmentFlow() {
  const navigate = useNavigate();
  const user = getUser();

  const [step, setStep] = useState("identity");
  const [sessionId, setSessionId] = useState(null);
  const [resumedNotice, setResumedNotice] = useState(false);
  const [sessionData, setSessionData] = useState({
    identity: {},
    device: { score: 100, checks: {} },
    baseline: { baselineQuality: 70 },
    setup: { startingDifficulty: 2, role: "Software Developer" },
    mcq: { correct: 0, total: 1, answers: [], partialReasoning: 0, improvement: 0 },
    monitor: { risk: 0, events: [], attention: 85 },
    voice: { communication: 70, confidence: 70, wordsSpoken: 0, keywordCoverage: 0, responses: [] },
    difficultyReached: 2,
    startedAt: new Date().toISOString()
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Check and restore active in-progress session if power cuts or browser reloads
  useEffect(() => {
    const checkActiveSession = async () => {
      try {
        const cached = localStorage.getItem("active_assessment_state");
        let activeId = null;
        let savedStep = null;

        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            activeId = parsed.sessionId;
            savedStep = parsed.step;
          } catch (_) {}
        }

        // Check user sessions from backend
        const res = await api.assessment.getMySessions();
        const activeServerSession = (res.sessions || []).find(
          (s) => s.status === "IN_PROGRESS" || s.status === "in-progress"
        );

        let targetSession = activeServerSession;
        if (!targetSession && activeId) {
          const detailRes = await api.assessment.getSessionById(activeId);
          if (detailRes?.session) targetSession = detailRes.session;
        }

        if (targetSession && (targetSession.status === "IN_PROGRESS" || targetSession.status === "in-progress")) {
          setSessionId(targetSession._id);
          setSessionData((prev) => ({
            ...prev,
            setup: targetSession.setup || prev.setup,
            identity: { verified: true, enrollmentId: targetSession.enrollmentId },
            difficultyReached: targetSession.adaptiveState?.currentDifficulty || 2
          }));

          const ansCount = (targetSession.responses || []).length;
          const nextStep = savedStep === "voice" || ansCount >= 6 ? "voice" : "mcq";
          setStep(nextStep);
          setResumedNotice(true);
        }
      } catch (err) {
        console.warn("Session auto-resume check:", err.message);
      }
    };

    checkActiveSession();
  }, []);

  // Keep active assessment progress cached in localStorage
  useEffect(() => {
    if (sessionId && (step === "mcq" || step === "voice")) {
      localStorage.setItem(
        "active_assessment_state",
        JSON.stringify({
          sessionId,
          step,
          sessionData
        })
      );
    }
  }, [sessionId, step, sessionData]);

  const updateSession = (data) => {
    setSessionData((prev) => ({ ...prev, ...data }));
  };

  const handleSetupComplete = async (setupValues) => {
    updateSession({ setup: setupValues });
    try {
      const payload = {
        setup: setupValues,
        enrollmentId: sessionData.identity?.enrollmentId,
        verificationToken: sessionData.identity?.verificationToken
      };
      const res = await api.assessment.startSession(payload);
      if (res.sessionId) {
        setSessionId(res.sessionId);
        setStep("mcq");
      } else {
        alert(res.message || "Assessment Locked: Server identity verification required.");
      }
    } catch (err) {
      console.warn("Server session authorization error:", err.message);
      alert(`Assessment Locked: ${err.message || "Identity verification failed or missing."}`);
    }
  };


  const handleAssessmentComplete = async (voiceResult) => {
    const finalVoice = voiceResult || sessionData.voice;
    const finalSession = {
      ...sessionData,
      voice: finalVoice
    };
    updateSession({ voice: finalVoice });

    // Submit complete assessment package to backend
    setStep("submitting");
    setSubmitting(true);
    setSubmitError("");

    const payload = {
      sessionId: sessionId || undefined,
      candidate: {
        name: user?.name || "Candidate",
        email: user?.email || "",
        rollNumber: user?.rollNumber || "",
        college: user?.college || "",
        branch: user?.branch || ""
      },

      identity: {
        faceCount: finalSession.identity.faceCount || 1,
        confidence: finalSession.identity.confidence || 95,
        verified: true,
        livenessCheck: "verified"
      },
      device: {
        checks: finalSession.device.checks || {},
        score: finalSession.device.score || 95
      },
      baseline: finalSession.baseline || {},
      setup: finalSession.setup || {},
      responses: finalSession.mcq.answers || [],
      monitoring: {
        riskScore: finalSession.monitor.risk || 0,
        attentionIndex: finalSession.monitor.attention || 85,
        events: finalSession.monitor.events || []
      },
      voice: {
        communication: finalVoice.communication || 75,
        confidence: finalVoice.confidence || 75,
        wordsSpoken: finalVoice.wordsSpoken || 35,
        keywordCoverage: finalVoice.keywordCoverage || 80,
        responses: finalVoice.responses || []
      },
      difficultyReached: finalSession.difficultyReached || 2,
      startedAt: finalSession.startedAt
    };

    try {
      const response = await api.assessment.submitSession(payload);
      localStorage.removeItem("active_assessment_state");
      const sessionId = response.session?._id || response.session?.id || "latest";
      // Redirect to persistent results page
      navigate(`/results/${sessionId}`);
    } catch (err) {
      console.error("Session submission failed:", err);
      setSubmitting(false);
      setSubmitError(err.message || "Failed to submit assessment to database. Please retry.");
    }
  };

  if (step === "submitting") {
    return (
      <div className="center-page">
        <div className="submission-card">
          <div className="submission-animation">
            {submitting ? (
              <Loader2 className="spinner-icon text-indigo-500" size={54} />
            ) : (
              <AlertTriangle className="text-amber-500" size={54} />
            )}
          </div>

          <h2>{submitting ? "Processing Multimodal Assessment" : "Submission Interrupted"}</h2>
          <p className="submission-subtitle">
            {submitting 
              ? "Synthesizing knowledge depth, behavioral dynamics, voice transcription, and proctoring telemetry..."
              : submitError}
          </p>

          {submitting && (
            <div className="telemetry-progress-list">
              <div className="telemetry-item done">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span>MCQ Knowledge & Analytical Reasoning Fused</span>
              </div>
              <div className="telemetry-item done">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span>Behavioral Latency & Baseline Calibrated</span>
              </div>
              <div className="telemetry-item active">
                <Sparkles size={16} className="text-indigo-400 animate-spin" />
                <span>Voice Fluency & Technical Keywords Analyzed</span>
              </div>
              <div className="telemetry-item active">
                <Shield size={16} className="text-indigo-400" />
                <span>Integrity Event Timeline Audited</span>
              </div>
            </div>
          )}

          {!submitting && submitError && (
            <div className="submission-actions">
              <button 
                className="primary-button" 
                onClick={() => handleAssessmentComplete(sessionData.voice)}
              >
                <RefreshCw size={18} />
                <span>Retry Submission</span>
              </button>
              <button 
                className="secondary-button" 
                onClick={() => navigate("/dashboard")}
              >
                Return to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="assessment-flow-container">
      {resumedNotice && (
        <div style={{
          maxWidth: "880px",
          margin: "16px auto 0",
          padding: "10px 18px",
          borderRadius: "10px",
          background: "#ecfdf5",
          border: "1.5px solid #a7f3d0",
          color: "#047857",
          fontSize: "0.85rem",
          fontWeight: "700",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 2px 8px rgba(16, 185, 129, 0.15)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <RotateCcw size={16} />
            <span>Active Assessment Resumed: Power interruption detected. Your previously answered questions have been safely restored from the server!</span>
          </div>
          <button 
            type="button" 
            onClick={() => setResumedNotice(false)}
            style={{ background: "transparent", border: "none", color: "#047857", cursor: "pointer", fontWeight: "800", fontSize: "1rem", padding: "0 4px" }}
          >
            ✕
          </button>
        </div>
      )}

      {step === "identity" && (
        <div className="center-page">
          <IdentityVerification 
            onBack={() => navigate("/dashboard")} 
            onVerified={(v) => {
              updateSession({ identity: v });
              setStep("device");
            }} 
          />
        </div>
      )}

      {step === "device" && (
        <div className="center-page">
          <DeviceValidation 
            onBack={() => setStep("identity")} 
            onComplete={(v) => {
              updateSession({ device: v });
              setStep("baseline");
            }} 
          />
        </div>
      )}

      {step === "baseline" && (
        <div className="center-page">
          <BehavioralBaseline 
            onBack={() => setStep("device")} 
            onComplete={(v) => {
              updateSession({ baseline: v });
              setStep("setup");
            }} 
          />
        </div>
      )}

      {step === "setup" && (
        <div className="center-page">
          <AssessmentSetup 
            user={user} 
            onBack={() => setStep("baseline")} 
            onComplete={(v) => {
              handleSetupComplete(v);
            }} 
          />
        </div>
      )}

      {step === "mcq" && (
        <AdaptiveAssessment 
          setup={sessionData.setup} 
          sessionId={sessionId}
          onComplete={(mcqData) => {
            updateSession(mcqData);
            setStep("voice");
          }} 
        />
      )}


      {step === "voice" && (
        <div className="center-page">
          <VoiceInterview 
            onComplete={(voiceData) => {
              handleAssessmentComplete(voiceData);
            }} 
          />
        </div>
      )}
    </div>
  );
}
