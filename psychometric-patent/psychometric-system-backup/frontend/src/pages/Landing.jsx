import React from "react";
import { Link } from "react-router-dom";
import { 
  Brain, 
  ShieldCheck, 
  Mic, 
  Activity, 
  CheckCircle2, 
  ArrowRight, 
  Award, 
  Lock, 
  Sparkles,
  Layers,
  ChevronRight,
  GraduationCap
} from "lucide-react";
import { isAuthenticated } from "../services/authService";

export default function Landing() {
  const authed = isAuthenticated();

  return (
    <div className="landing-page">
      {/* Navigation Header */}
      <header className="landing-nav">
        <div className="landing-nav-container">
          <div className="landing-brand">
            <div className="brand-icon">
              <Brain size={26} className="text-indigo-400" />
            </div>
            <div>
              <span className="brand-name">Psychometric AI</span>
              <span className="brand-tag">Patent Edition</span>
            </div>
          </div>

          <div className="landing-nav-actions">
            {authed ? (
              <Link to="/dashboard" className="btn-landing-primary">
                <span>Go to Dashboard</span>
                <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn-landing-secondary">
                  Sign In
                </Link>
                <Link to="/register" className="btn-landing-primary">
                  <span>Register as Student</span>
                  <ArrowRight size={16} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="hero-badge">
          <Sparkles size={16} className="text-indigo-400" />
          <span>Multimodal Cognitive Intelligence Platform · Patent Architecture</span>
        </div>

        <h1 className="hero-title">
          Adaptive Psychometric Assessment for Engineering Students
        </h1>

        <p className="hero-description">
          An integrated multimodal platform combining knowledge evaluation, behavioral baseline analysis, 
          real-time AI proctoring, and verbal fluency analysis to improve engineering interview confidence and readiness.
        </p>

        <div className="hero-cta-group">
          <Link to={authed ? "/assessment" : "/register"} className="btn-hero-main">
            <span>Start Multimodal Assessment</span>
            <ArrowRight size={18} />
          </Link>
          <Link to="/login" className="btn-hero-sub">
            <span>Evaluator & Admin Login</span>
            <ChevronRight size={18} />
          </Link>
        </div>

        {/* Feature Pill Grid */}
        <div className="hero-stats-grid">
          <div className="stat-card">
            <div className="stat-icon bg-blue-glow">
              <Brain size={24} />
            </div>
            <h3>Adaptive Cognitive Engine</h3>
            <p>Dynamically scales difficulty using Bloom's Taxonomy and real-time response latency.</p>
          </div>

          <div className="stat-card">
            <div className="stat-icon bg-indigo-glow">
              <Activity size={24} />
            </div>
            <h3>Behavioral Baselines</h3>
            <p>Tracks typing rhythm, mouse dynamics, and cognitive reaction times to establish individualized baselines.</p>
          </div>

          <div className="stat-card">
            <div className="stat-icon bg-emerald-glow">
              <ShieldCheck size={24} />
            </div>
            <h3>Evidence-Based Proctoring</h3>
            <p>Continuous face detection, window blur tracking, and explainable integrity confidence metrics.</p>
          </div>

          <div className="stat-card">
            <div className="stat-icon bg-purple-glow">
              <Mic size={24} />
            </div>
            <h3>Voice & Communication</h3>
            <p>Evaluates technical vocabulary, keyword relevance, and verbal delivery under mock interview pressure.</p>
          </div>
        </div>
      </section>

      {/* 15-Step Workflow Section */}
      <section className="landing-workflow">
        <div className="section-header">
          <div className="section-tag">
            <Layers size={14} />
            <span>Integrated Assessment Pipeline</span>
          </div>
          <h2>The 15-Stage Evaluation Process</h2>
          <p>From initial device verification to personalized 3-week developmental career roadmaps.</p>
        </div>

        <div className="pipeline-steps-grid">
          {[
            { step: "01", title: "Student Authentication", desc: "Secure JWT registration with college, branch, and roll number attribution." },
            { step: "02", title: "Identity Verification", desc: "Live camera verification enforcing single-face detection via TinyFaceDetector." },
            { step: "03", title: "Device & Environment Check", desc: "Validates camera, microphone, network speed, storage, and secure context." },
            { step: "04", title: "Behavioral Baseline", desc: "Captures mouse velocity, reaction latency, and typing velocity calibration." },
            { step: "05", title: "Blueprint Configuration", desc: "Customizes target engineering role, domain emphasis, and starting difficulty." },
            { step: "06", title: "Dynamic Question Engine", desc: "Selects competency-tagged challenges across DSA, OS, DBMS, and Networks." },
            { step: "07", title: "Multimodal Telemetry", desc: "Synchronously correlates answer accuracy with response latency and interaction events." },
            { step: "08", title: "Continuous Monitoring", desc: "Records background tab shifts, focus loss, and multiple-face anomalies." },
            { step: "09", title: "Cognitive Scoring", desc: "Calculates multidimensional knowledge and partial analytical reasoning indexes." },
            { step: "10", title: "Adaptive Difficulty Shift", desc: "Scales between Foundation, Intermediate, and Advanced tiers in real time." },
            { step: "11", title: "Knowledge Evaluation", desc: "Assesses Bloom cognitive depths: Remember, Understand, Apply, and Analyze." },
            { step: "12", title: "Voice & Speech Analysis", desc: "Analyzes verbal answers against technical keywords and speech cadence." },
            { step: "13", title: "Integrity Risk Fusion", desc: "Computes explainable integrity scores from verified incident telemetry." },
            { step: "14", title: "Readiness Decision", desc: "Generates recommended role matches and overall professional readiness index." },
            { step: "15", title: "Personalized Roadmap", desc: "Delivers concrete 3-week study and mock interview preparation targets." }
          ].map((item) => (
            <div className="step-item" key={item.step}>
              <span className="step-number">{item.step}</span>
              <h4>{item.title}</h4>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Scientific Limitation & Privacy Section */}
      <section className="landing-disclaimer-section">
        <div className="disclaimer-box">
          <div className="disclaimer-header">
            <Lock size={20} className="text-amber-400" />
            <h3>Scientific Validity & Privacy Notice</h3>
          </div>
          <p>
            This system implements the educational and research architecture specified in the patent:
            <em> "System and Method for Multimodal Psychometric Assessment to improve Engineering Student’s Interview Confidence through AI-Based Adaptive Cognitive Intelligence Assessment Using Behavioral, Knowledge and Integrity Analysis."</em>
          </p>
          <p>
            <strong>Important Limitation:</strong> Generated scores represent transparent rules-based educational readiness and interview preparation indicators. 
            The system is strictly an academic diagnostic and learning tool and makes <strong>no psychological, clinical, or medical health determinations</strong>. 
            Video and audio features are processed in transient memory for telemetry scoring and are protected under role-based access control.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-brand">
            <div className="brand-icon-sm">
              <Brain size={20} />
            </div>
            <span>Psychometric Assessment System · Patent Edition</span>
          </div>
          <p className="footer-copyright">
            Engineering Cognitive Intelligence Research & Assessment Platform. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
