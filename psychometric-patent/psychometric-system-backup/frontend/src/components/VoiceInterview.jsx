import React, { useEffect, useRef, useState } from "react";
import questionBank from "../data/questionBank";
import { evaluateVoice } from "../utils/assessmentEngine";
import api from "../api/apiClient";
import { 
  Mic, 
  MicOff, 
  Volume2, 
  ArrowRight, 
  Speech, 
  Sparkles, 
  Bot, 
  HelpCircle, 
  SkipForward, 
  Loader2, 
  CheckCircle2 
} from "lucide-react";

export default function VoiceInterview({ onComplete }) {
  const qs = questionBank.filter((q) => q.type === "voice");
  const [i, setI] = useState(0);

  // Flow phase: 'initial' -> 'probing' (generating) -> 'probe' -> next question
  const [phase, setPhase] = useState("initial");
  const [probeData, setProbeData] = useState(null);

  // Transcripts
  const [transcript, setTranscript] = useState("");
  const [probeTranscript, setProbeTranscript] = useState("");

  const [listening, setListening] = useState(false);
  const [results, setResults] = useState([]);

  const started = useRef(Date.now());
  const recognition = useRef(null);

  const supported = typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  // Clean unmount listener destruction
  useEffect(() => {
    return () => {
      if (recognition.current) {
        recognition.current.onresult = null;
        recognition.current.onend = null;
        recognition.current.onerror = null;
        try {
          recognition.current.abort();
        } catch (_) {}
        recognition.current = null;
      }
    };
  }, []);

  const startListening = () => {
    if (recognition.current) {
      recognition.current.onresult = null;
      recognition.current.onend = null;
      recognition.current.onerror = null;
      try {
        recognition.current.abort();
      } catch (_) {}
      recognition.current = null;
    }

    if (phase === "probe") {
      setProbeTranscript("");
    } else {
      setTranscript("");
    }
    started.current = Date.now();

    if (!supported) {
      setListening(true);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SpeechRecognition();

    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-IN";

    r.onresult = (event) => {
      let finalScript = "";
      let interimScript = "";

      for (let idx = 0; idx < event.results.length; idx++) {
        const res = event.results[idx];
        const phrase = res[0]?.transcript || "";
        if (res.isFinal) {
          finalScript += phrase + " ";
        } else {
          interimScript += phrase;
        }
      }

      const cleanFullTranscript = (finalScript + interimScript).replace(/\s+/g, " ").trim();
      if (phase === "probe") {
        setProbeTranscript(cleanFullTranscript);
      } else {
        setTranscript(cleanFullTranscript);
      }
    };

    r.onerror = (event) => {
      console.warn("Speech recognition notice:", event.error);
    };

    r.onend = () => {
      if (recognition.current === r) {
        setListening(false);
      }
    };

    try {
      r.start();
      recognition.current = r;
      setListening(true);
    } catch (err) {
      console.warn("Failed to start speech recognition:", err.message);
      setListening(false);
    }
  };

  const stopListening = () => {
    if (recognition.current) {
      const activeRef = recognition.current;
      activeRef.onresult = null;
      activeRef.onend = null;
      activeRef.onerror = null;
      try {
        activeRef.stop();
      } catch (_) {}
      recognition.current = null;
    }
    setListening(false);
  };

  // Phase 1: Submit Initial Answer -> Trigger Dynamic AI Follow-up Probe
  const handleInitialSubmit = async () => {
    stopListening();
    const currentQ = qs[i] || { question: "Technical question", keywords: ["algorithm", "complexity"] };

    setPhase("probing");

    try {
      const res = await api.voice.generateProbe({
        question: currentQ.question,
        transcript: transcript,
        keywords: currentQ.keywords || []
      });

      if (res && res.probeQuestion) {
        setProbeData(res);
      } else {
        throw new Error("No probe returned");
      }
    } catch {
      // Offline / fallback probe generation
      const missed = (currentQ.keywords || []).filter(
        (k) => !transcript.toLowerCase().includes(k.toLowerCase())
      );
      const targetConcept = missed[0] || "edge-case handling";
      setProbeData({
        probeQuestion: `You gave a structured overview. How does ${targetConcept} specifically impact the scalability, error handling, or performance in your design?`,
        focusArea: `Deep Dive: ${targetConcept}`,
        source: "adaptive_fallback"
      });
    }

    setPhase("probe");
  };

  // Phase 2: Finalize Question (After Probe or Skipped Probe)
  const handleFinalizeQuestion = (skipProbe = false) => {
    stopListening();
    const currentQ = qs[i] || { keywords: ["algorithm", "complexity"] };

    const combinedTranscript = skipProbe || !probeTranscript.trim()
      ? transcript
      : `${transcript} [Follow-up Response: ${probeTranscript}]`;

    const elapsed = (Date.now() - started.current) / 1000;
    const baseEval = evaluateVoice(combinedTranscript, currentQ.keywords || [], elapsed);

    // Dynamic probing bonus: answering the probe rewards verbal depth and adaptability
    const probeBonus = (!skipProbe && probeTranscript.trim().length > 15) ? 10 : 0;
    const ev = {
      ...baseEval,
      communication: Math.min(100, baseEval.communication + probeBonus),
      confidence: Math.min(100, baseEval.confidence + (probeBonus ? 5 : 0)),
      probed: !skipProbe && !!probeTranscript.trim(),
      probeQuestion: probeData?.probeQuestion || null
    };

    const next = [...results, ev];

    if (i === qs.length - 1) {
      const avg = (k) => Math.round(next.reduce((s, x) => s + (x[k] || 0), 0) / next.length);
      onComplete({
        communication: avg("communication"),
        confidence: avg("confidence"),
        keywordCoverage: avg("keywordCoverage"),
        responses: next
      });
    } else {
      setResults(next);
      setI((x) => x + 1);
      setTranscript("");
      setProbeTranscript("");
      setProbeData(null);
      setPhase("initial");
    }
  };

  const currentQuestionObj = qs[i] || {
    question: "Describe a challenging technical bug you encountered in a project, how you diagnosed it, and what you learned."
  };

  return (
    <div className="stage-card wide-card">
      <div className="stage-header">
        <div className="stage-step-pill">
          <Speech size={14} />
          <span>Stage 5 of 5 · Multimodal Voice Interview</span>
        </div>
        <h1>Verbal Communication & Adaptive Probing</h1>
        <p className="stage-subtitle">
          Speak clearly into your microphone to answer technical prompts. Unlike static recording tools, our AI actively probes your answer in real-time to assess deep reasoning and technical agility.
        </p>
      </div>

      {/* Main Technical Question */}
      <div className="voice-prompt-card">
        <div className="voice-prompt-header">
          <span className="question-number-pill">Question {i + 1} of {qs.length}</span>
          <span className="voice-tag">Speech Analytics Active</span>
        </div>
        <h2 className="voice-question-text">{currentQuestionObj.question}</h2>
      </div>

      {/* Generating Probe Loader */}
      {phase === "probing" && (
        <div className="probe-loading-box">
          <Loader2 size={24} className="animate-spin text-indigo-600" />
          <span>AI Interviewer is analyzing your articulation & formulating an adaptive follow-up probe...</span>
        </div>
      )}

      {/* Dynamic AI Follow-up Probe Card */}
      {phase === "probe" && probeData && (
        <div className="probe-prompt-card">
          <div className="probe-meta-row">
            <span className="probe-badge">
              <Bot size={14} />
              Dynamic AI Follow-Up Probe
            </span>
            <span className="probe-focus-pill">{probeData.focusArea || "Technical Depth"}</span>
          </div>
          <h3 className="probe-question-text">{probeData.probeQuestion}</h3>
          <p className="probe-context-hint">
            The AI formulated this question specifically from your prior answer to test depth and trade-offs.
          </p>
        </div>
      )}

      {/* Transcript Card */}
      <div className="voice-transcript-wrapper">
        <div className="transcript-header">
          <Volume2 size={16} className="text-indigo-400" />
          <span>
            {phase === "probe" 
              ? "Follow-up Response Transcript" 
              : "Speech Recognition Transcript"}
          </span>
          {listening && (
            <span className="recording-live-indicator">
              <span className="pulse-dot" />
              Recording Active
            </span>
          )}
        </div>
        <textarea
          className="voice-transcript-input"
          value={phase === "probe" ? probeTranscript : transcript}
          onChange={(e) => {
            if (phase === "probe") setProbeTranscript(e.target.value);
            else setTranscript(e.target.value);
          }}
          placeholder={
            phase === "probe"
              ? "Speak your response to the follow-up probe..."
              : supported
              ? "Click 'Start Voice Recording' and speak your answer. Live transcript will appear here..."
              : "Browser Web Speech API unavailable. Type your verbal response here for evaluation."
          }
          rows={3}
        />
      </div>

      {/* Action Footer */}
      <div className="stage-footer-row">
        <button
          type="button"
          className={`record-toggle-btn ${listening ? "is-recording" : ""}`}
          onClick={listening ? stopListening : startListening}
          disabled={phase === "probing"}
        >
          {listening ? <MicOff size={18} /> : <Mic size={18} />}
          <span>{listening ? "Stop Recording" : "Start Voice Recording"}</span>
        </button>

        {phase === "initial" && (
          <button
            type="button"
            className="primary-button"
            disabled={!transcript.trim() || phase === "probing"}
            onClick={handleInitialSubmit}
          >
            <span>Submit & Receive AI Probe</span>
            <Sparkles size={16} />
          </button>
        )}

        {phase === "probe" && (
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <button
              type="button"
              className="probe-skip-btn"
              onClick={() => handleFinalizeQuestion(true)}
            >
              <SkipForward size={16} />
              <span>Skip Follow-Up</span>
            </button>

            <button
              type="button"
              className="primary-button"
              disabled={!probeTranscript.trim()}
              onClick={() => handleFinalizeQuestion(false)}
            >
              <span>{i === qs.length - 1 ? "Complete Assessment" : "Submit & Next Question"}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
