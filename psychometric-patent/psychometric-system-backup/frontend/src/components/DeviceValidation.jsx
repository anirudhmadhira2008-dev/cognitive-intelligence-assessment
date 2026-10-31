import React, { useEffect, useState } from "react";
import { calculateDeviceScore } from "../utils/assessmentEngine";
import { 
  Camera, 
  Mic, 
  ShieldCheck, 
  HardDrive, 
  Wifi, 
  Monitor, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  Cpu
} from "lucide-react";

export default function DeviceValidation({ onComplete, onBack }) {
  const [checks, setChecks] = useState({
    camera: false,
    microphone: false,
    secureContext: false,
    storage: false,
    network: false,
    screen: false
  });
  const [testing, setTesting] = useState(true);

  const runDiagnostics = async () => {
    setTesting(true);
    let stream;
    const next = {
      secureContext: window.isSecureContext || window.location.hostname === "localhost",
      storage: typeof localStorage !== "undefined",
      network: navigator.onLine,
      screen: window.screen.width >= 800 && window.screen.height >= 600,
      camera: false,
      microphone: false
    };

    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      next.camera = stream.getVideoTracks().length > 0;
      next.microphone = stream.getAudioTracks().length > 0;
    } catch (e) {
      console.warn("Device permissions diagnostic notice:", e.message);
    }

    setChecks(next);
    setTesting(false);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const score = calculateDeviceScore(checks);

  const checkItems = [
    { key: "camera", label: "Camera Stream", icon: Camera, desc: "High Definition Video Device" },
    { key: "microphone", label: "Microphone Audio", icon: Mic, desc: "Speech & Fluency Input" },
    { key: "network", label: "Network Connectivity", icon: Wifi, desc: "Real-time Telemetry Sync" },
    { key: "secureContext", label: "Secure Browser (HTTPS)", icon: ShieldCheck, desc: "Encrypted Data Transmission" },
    { key: "screen", label: "Display Resolution", icon: Monitor, desc: "Minimum 800x600px Display" },
    { key: "storage", label: "Local Session Storage", icon: HardDrive, desc: "Offline Autosave Buffer" }
  ];

  return (
    <div className="stage-card wide-card">
      <div className="stage-header">
        <div className="stage-step-pill">
          <Cpu size={14} />
          <span>Stage 2 of 5 · Device & Environment Check</span>
        </div>
        <h1>Hardware & Browser Readiness Diagnostic</h1>
        <p className="stage-subtitle">
          Ensuring your assessment environment meets required proctoring and evaluation specifications.
        </p>
      </div>

      <div className="device-check-grid">
        {checkItems.map((item) => {
          const IconComp = item.icon;
          const isOk = checks[item.key];
          return (
            <div className={`device-check-card ${isOk ? "card-pass" : "card-warn"}`} key={item.key}>
              <div className="check-card-header">
                <div className={`check-icon-badge ${isOk ? "badge-pass" : "badge-warn"}`}>
                  <IconComp size={20} />
                </div>
                {testing ? (
                  <span className="check-status-text text-slate-400">Testing...</span>
                ) : isOk ? (
                  <span className="check-status-tag tag-pass">
                    <CheckCircle2 size={13} />
                    Ready
                  </span>
                ) : (
                  <span className="check-status-tag tag-warn">
                    <AlertTriangle size={13} />
                    Needs Action
                  </span>
                )}
              </div>
              <h4 className="check-title">{item.label}</h4>
              <p className="check-desc">{item.desc}</p>
            </div>
          );
        })}
      </div>

      <div className="device-score-banner">
        <div className="banner-left">
          <ShieldCheck size={28} className="text-emerald-500" />
          <div>
            <h3>Hardware Trust Score</h3>
            <p>Calculated environment compatibility index for proctored evaluation</p>
          </div>
        </div>
        <div className="banner-score">
          <span className="score-val">{testing ? "..." : `${score}%`}</span>
          <span className="score-label">Compatibility</span>
        </div>
      </div>

      <div className="stage-footer-row">
        <div className="flex gap-2">
          <button className="secondary-button" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <button className="secondary-button" onClick={runDiagnostics} disabled={testing}>
            <RefreshCw size={16} className={testing ? "animate-spin" : ""} />
            <span>Re-run Diagnostic</span>
          </button>
        </div>
        <button
          className="primary-button"
          disabled={testing || !checks.camera}
          onClick={() => onComplete({ checks, score })}
        >
          <span>Continue to Behavioral Baseline</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
