import React, { useState } from "react";
import { Sliders, Brain, ArrowRight, ArrowLeft, Layers, Globe, Shield } from "lucide-react";

export default function AssessmentSetup({ user, onComplete, onBack }) {
  const [role, setRole] = useState("Software Developer");
  const [level, setLevel] = useState(2);
  const [language, setLanguage] = useState("English");

  const blueprint = [
    { name: "Knowledge Depth (Bloom)", weight: 35, desc: "DSA, OS, DBMS, Networks", color: "blue" },
    { name: "Analytical Reasoning", weight: 25, desc: "Problem Solving & Logic", color: "indigo" },
    { name: "Verbal Articulation", weight: 15, desc: "Technical Speech & Keywords", color: "purple" },
    { name: "Behavioral Latency", weight: 10, desc: "Reaction Speed & Rhythm", color: "emerald" },
    { name: "Proctoring Integrity", weight: 15, desc: "Continuous Camera & Focus", color: "amber" }
  ];

  return (
    <div className="stage-card wide-card">
      <div className="stage-header">
        <div className="stage-step-pill">
          <Sliders size={14} />
          <span>Stage 4 of 5 · Blueprint Configuration</span>
        </div>
        <h1>Assessment Blueprint & Role Configuration</h1>
        <p className="stage-subtitle">
          Generating an individualized psychometric matrix for candidate <strong>{user?.name || "Candidate"}</strong>.
        </p>
      </div>

      <div className="setup-config-grid">
        <div className="setup-form-panel">
          <div className="form-field mb-4">
            <label className="flex items-center gap-2">
              <Layers size={16} className="text-indigo-400" />
              <span>Target Engineering Role</span>
            </label>
            <select className="form-select-lg" value={role} onChange={(e) => setRole(e.target.value)}>
              <option>Software Developer</option>
              <option>Data Analyst</option>
              <option>AI / ML Engineer</option>
              <option>Graduate Engineering Trainee</option>
              <option>Systems & Networks Engineer</option>
            </select>
          </div>

          <div className="form-field mb-4">
            <label className="flex items-center gap-2">
              <Brain size={16} className="text-purple-400" />
              <span>Adaptive Starting Difficulty</span>
            </label>
            <select className="form-select-lg" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
              <option value={1}>Foundation (Tier 1 - Fundamentals & Definitions)</option>
              <option value={2}>Intermediate (Tier 2 - Application & Analysis)</option>
              <option value={3}>Advanced (Tier 3 - Synthesis & Complex Scenarios)</option>
            </select>
          </div>

          <div className="form-field">
            <label className="flex items-center gap-2">
              <Globe size={16} className="text-cyan-400" />
              <span>Voice Interview Language</span>
            </label>
            <select className="form-select-lg" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option>English</option>
              <option>Telugu</option>
              <option>Hindi</option>
            </select>
          </div>
        </div>

        <div className="setup-blueprint-panel">
          <div className="blueprint-header">
            <Shield size={18} className="text-indigo-400" />
            <h4>Multimodal Assessment Blueprint Weights</h4>
          </div>

          <div className="blueprint-items-list">
            {blueprint.map((item) => (
              <div className="blueprint-item" key={item.name}>
                <div className="blueprint-row-top">
                  <span className="bp-name">{item.name}</span>
                  <strong className="bp-weight">{item.weight}%</strong>
                </div>
                <div className="bp-bar-bg">
                  <div className={`bp-bar-fill fill-${item.color}`} style={{ width: `${item.weight * 2}%` }} />
                </div>
                <small className="bp-desc">{item.desc}</small>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="stage-footer-row">
        <button className="secondary-button" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <button
          className="primary-button"
          onClick={() =>
            onComplete({
              role,
              startingDifficulty: level,
              language,
              blueprint
            })
          }
        >
          <span>Initialize Assessment Session</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
