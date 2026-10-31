import React, { useEffect, useRef, useState } from "react";
import { createBaseline } from "../utils/assessmentEngine";
import { Activity, Clock, MousePointer, Keyboard, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function BehavioralBaseline({ onComplete, onBack }) {
  const [text, setText] = useState("");
  const [clicks, setClicks] = useState(0);
  const [seconds, setSeconds] = useState(15);
  const start = useRef(Date.now());
  const last = useRef(null);
  const samples = useRef({
    mouseSpeeds: [],
    reactionTimes: [],
    typingRates: [],
    facePresence: [1]
  });

  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (seconds === 0) {
      const elapsed = (Date.now() - start.current) / 60000;
      const wpm = text.trim().split(/\s+/).filter(Boolean).length / Math.max(0.1, elapsed);
      samples.current.typingRates.push(wpm);
      onComplete(createBaseline(samples.current));
    }
  }, [seconds, text, onComplete]);

  const handleMouseMove = (e) => {
    const now = performance.now();
    if (last.current) {
      const distance = Math.hypot(e.clientX - last.current.x, e.clientY - last.current.y);
      const dt = now - last.current.t;
      if (dt > 0) {
        samples.current.mouseSpeeds.push(Math.min(100, (distance / dt) * 30));
      }
    }
    last.current = { x: e.clientX, y: e.clientY, t: now };
  };

  const handleReactionTap = () => {
    samples.current.reactionTimes.push(Date.now() - start.current);
    setClicks((c) => c + 1);
  };

  const progressPercent = Math.round(((15 - seconds) / 15) * 100);

  return (
    <div className="stage-card wide-card" onMouseMove={handleMouseMove}>
      <div className="stage-header">
        <div className="stage-step-pill">
          <Activity size={14} />
          <span>Stage 3 of 5 · Behavioral Calibration</span>
        </div>
        <h1>Behavioral Dynamics Baseline Calibration</h1>
        <p className="stage-subtitle">
          Type naturally in the box below and click the reaction target. This establishes your unique typing rhythm, mouse movement speed, and cognitive reaction latency.
        </p>
      </div>

      <div className="baseline-calibration-grid">
        <div className="calibration-left-panel">
          <div className="panel-label-row">
            <Keyboard size={16} className="text-indigo-400" />
            <label>Natural Typing Sample</label>
          </div>
          <textarea
            className="baseline-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Introduce your technical domain (e.g. 'I specialize in Data Structures, OS, and DBMS...')."
            autoFocus
            rows={4}
          />

          <div className="calibration-metrics-row">
            <div className="calib-metric">
              <MousePointer size={16} className="text-emerald-400" />
              <span>Reaction Taps: <strong>{clicks}</strong></span>
            </div>
            <div className="calib-metric">
              <Clock size={16} className="text-amber-400" />
              <span>Calibration Window: <strong>{seconds}s remaining</strong></span>
            </div>
          </div>
        </div>

        <div className="calibration-right-panel">
          <div className="panel-label-row">
            <MousePointer size={16} className="text-emerald-400" />
            <label>Reaction Latency Tester</label>
          </div>
          <button className="reaction-target-card" onClick={handleReactionTap}>
            <div className="target-icon-wrap">
              <Activity size={28} className="text-indigo-500 animate-pulse" />
            </div>
            <h4>Tap Target to Calibrate</h4>
            <p>Click repeatedly as you read ({clicks} recorded)</p>
          </button>
        </div>
      </div>

      {/* Progress Track */}
      <div className="calibration-progress-bar">
        <div className="bar-header">
          <span>Baseline Calibration Progress</span>
          <strong>{progressPercent}%</strong>
        </div>
        <div className="progress-track-bg">
          <div className="progress-track-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="stage-footer-row">
        <button className="secondary-button" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <button
          className="primary-button"
          onClick={() => {
            const elapsed = (Date.now() - start.current) / 60000;
            const wpm = text.trim().split(/\s+/).filter(Boolean).length / Math.max(0.1, elapsed);
            samples.current.typingRates.push(wpm);
            onComplete(createBaseline(samples.current));
          }}
        >
          <span>Finish Calibration & Continue</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
