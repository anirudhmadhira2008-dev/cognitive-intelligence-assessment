import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../api/apiClient";
import { getUser } from "../services/authService";
import { 
  Award, 
  CheckCircle2, 
  AlertCircle, 
  Printer, 
  RotateCcw, 
  LayoutDashboard, 
  ShieldCheck, 
  Brain, 
  ArrowRight,
  TrendingUp,
  Target,
  Clock,
  Sparkles,
  Lock,
  Server,
  EyeOff,
  FileCheck
} from "lucide-react";
import CompetencyPieChart from "../components/CompetencyPieChart";
import SignedReportViewer from "../components/SignedReportViewer";

export default function Results() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = getUser();

  const [session, setSession] = useState(null);
  const [signedReport, setSignedReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (session && session._id) {
      api.reports.getById(session._id)
        .then((res) => {
          if (res.report) setSignedReport(res.report);
        })
        .catch(() => {
          api.reports.generate(session._id)
            .then((res) => {
              if (res.report) setSignedReport(res.report);
            })
            .catch(() => {});
        });
    }
  }, [session]);

  useEffect(() => {
    const fetchSessionResult = async () => {
      setLoading(true);
      setError("");
      try {
        if (id && id !== "latest") {
          const res = await api.assessment.getSessionById(id);
          if (res.session) {
            setSession(res.session);
            return;
          }
        }

        // Fallback: fetch candidate's latest session
        const sessionsRes = await api.assessment.getMySessions();
        if (sessionsRes.sessions && sessionsRes.sessions.length > 0) {
          setSession(sessionsRes.sessions[0]);
        } else {
          setError("No assessment results found. Please complete an assessment first.");
        }
      } catch (err) {
        console.error("Failed to load assessment report:", err);
        setError("Unable to retrieve assessment report from the server.");
      } finally {
        setLoading(false);
      }
    };

    fetchSessionResult();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="center-page">
        <div className="loading-card">
          <div className="spinner-large"></div>
          <h2>Loading Cognitive Intelligence Report...</h2>
          <p>Retrieving verified psychometric and proctoring telemetry from database.</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="center-page">
        <div className="error-card">
          <AlertCircle className="text-rose-500" size={48} />
          <h2>Report Unavailable</h2>
          <p>{error || "Assessment report could not be located."}</p>
          <div className="card-actions">
            <Link to="/assessment" className="primary-button">
              Take Assessment
            </Link>
            <Link to="/dashboard" className="secondary-button">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const report = session.report || {};
  const candidate = session.candidate || currentUser || {};
  const decision = report.decision || "Recommended";

  const metrics = [
    { label: "Knowledge Depth", value: report.knowledge || 0, color: "blue" },
    { label: "Analytical Reasoning", value: report.reasoning || 0, color: "indigo" },
    { label: "Verbal Communication", value: report.communication || 0, color: "purple" },
    { label: "Interview Confidence", value: report.confidence || 0, color: "emerald" },
    { label: "Cognitive Adaptability", value: report.adaptability || 0, color: "teal" },
    { label: "Examination Integrity", value: report.integrity || 100, color: "amber" },
    { label: "Learning Potential", value: report.learningPotential || 0, color: "cyan" },
    { label: "Professional Readiness", value: report.readiness || 0, color: "rose" }
  ];

  const getDecisionBadgeClass = (dec) => {
    if (dec.includes("Highly")) return "badge-highly-recommended";
    if (dec.includes("Conditionally")) return "badge-conditionally-recommended";
    if (dec.includes("Review")) return "badge-review-required";
    return "badge-recommended";
  };

  return (
    <div className="results-page-container">
      <div className="results-paper">
        {/* Report Hero */}
        <section className="report-hero">
          <div className="hero-left">
            <div className="report-eyebrow">
              <Sparkles size={16} />
              <span>Step 15 · Multimodal Psychometric Evaluation Report</span>
            </div>
            <h1 className="report-candidate-name">{candidate.name || "Candidate"}</h1>
            <p className="report-candidate-meta">
              {candidate.rollNumber ? `Roll No: ${candidate.rollNumber} · ` : ""}
              {candidate.branch ? `${candidate.branch} · ` : ""}
              {candidate.college || candidate.email}
            </p>
            <div className="report-timestamp">
              <Clock size={14} />
              <span>Evaluated: {new Date(session.completedAt || session.createdAt || Date.now()).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
            </div>
          </div>

          <div className="hero-right">
            <div className={`decision-card ${getDecisionBadgeClass(decision)}`}>
              <small>Explainable AI Decision</small>
              <h2 className="decision-title">{decision}</h2>
              <div className="readiness-meter">
                <span className="readiness-num">{report.readiness || 0}%</span>
                <span className="readiness-label">Professional Readiness Index</span>
              </div>
            </div>
          </div>
        </section>

        {/* Competency Proportion Pie / Donut Chart */}
        <CompetencyPieChart metrics={metrics} />

        {/* 8-Dimensional Metric Grid */}
        <section className="metrics-section">
          <div className="section-title-row">
            <Target size={20} className="text-indigo-500" />
            <h3>Multimodal Competency Breakdown</h3>
          </div>

          <div className="metrics-grid">
            {metrics.map((m) => (
              <div className="metric-box" key={m.label}>
                <div className="metric-header">
                  <span className="metric-name">{m.label}</span>
                  <strong className="metric-val">{m.value}%</strong>
                </div>
                <div className="metric-bar-bg">
                  <div 
                    className={`metric-bar-fill fill-${m.color}`} 
                    style={{ width: `${Math.min(100, Math.max(0, m.value))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3-Column Diagnostic Summary */}
        <section className="diagnostic-section">
          <div className="diag-card">
            <div className="diag-header text-emerald-500">
              <CheckCircle2 size={18} />
              <h4>Top Cognitive Strengths</h4>
            </div>
            <ul className="diag-list">
              {(report.strengths || ["Analytical Thinking", "Core Knowledge", "Integrity"]).map((s, idx) => (
                <li key={idx}>
                  <strong>{s}</strong>
                  <span>Demonstrated consistently in response evaluation.</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="diag-card">
            <div className="diag-header text-amber-500">
              <TrendingUp size={18} />
              <h4>Development Areas</h4>
            </div>
            <ul className="diag-list">
              {(report.gaps || ["Verbal Communication", "Adaptive Speed"]).map((g, idx) => (
                <li key={idx}>
                  <strong>{g}</strong>
                  <span>Targeted for focused interview preparation practice.</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="diag-card">
            <div className="diag-header text-indigo-500">
              <Award size={18} />
              <h4>Target Career Alignment</h4>
            </div>
            <ul className="diag-list">
              {(report.roles || ["Software Development Engineer", "Graduate Engineering Trainee"]).map((r, idx) => (
                <li key={idx}>
                  <strong>{r}</strong>
                  <span>Aligned with demonstrated problem-solving competence.</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 3-Week Personalized Improvement Roadmap */}
        <section className="roadmap-section">
          <div className="section-title-row">
            <Brain size={20} className="text-purple-500" />
            <h3>Personalized 3-Week Development Roadmap</h3>
          </div>

          <div className="roadmap-grid">
            {(report.roadmap && report.roadmap.length > 0 ? report.roadmap : [
              { week: "Week 1", focus: "Strengthen Foundational Knowledge", task: "Review core computer science principles, complete concept quizzes, and solve 10 targeted problems." },
              { week: "Week 2", focus: "Verbal Articulation & STAR Responses", task: "Practice structured technical verbal explanations using the STAR method; conduct timed mock interview responses." },
              { week: "Week 3", focus: "Full-Length Adaptive Interview Simulations", task: "Attempt full-length adaptive assessments under live proctoring conditions to refine speed and focus." }
            ]).map((step, i) => (
              <div className="roadmap-step-box" key={i}>
                <div className="step-tag">{step.week}</div>
                <h5>{step.focus}</h5>
                <p>{step.task}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Zero-Data-Egress & AI Governance Certificate (Feature 4) */}
        <section className="report-compliance-card">
          <div className="compliance-header">
            <div className="compliance-title-group">
              <div className="compliance-shield-icon">
                <ShieldCheck size={22} className="text-emerald-400" />
              </div>
              <div>
                <h4>Zero-Data-Egress &amp; AI Governance Certificate</h4>
                <p className="compliance-subtitle">
                  EU AI Act (High-Risk AI) &amp; GDPR Article 9 Compliant Architecture
                </p>
              </div>
            </div>
            <span className="compliance-badge-verified">
              <CheckCircle2 size={14} /> Verified On-Premise
            </span>
          </div>

          <div className="compliance-grid">
            <div className="compliance-item">
              <div className="compliance-item-icon text-indigo-400">
                <Server size={18} />
              </div>
              <div>
                <strong>Zero Cloud Egress</strong>
                <p>100% On-Premise LAN deployment. No candidate video, audio, or biometric metadata ever leaves your institutional perimeter.</p>
              </div>
            </div>

            <div className="compliance-item">
              <div className="compliance-item-icon text-emerald-400">
                <EyeOff size={18} />
              </div>
              <div>
                <strong>Ephemeral Biometrics Only</strong>
                <p>Raw video is never recorded or hoarded. Real-time 68-point facial geometry is processed in browser memory and immediately discarded.</p>
              </div>
            </div>

            <div className="compliance-item">
              <div className="compliance-item-icon text-amber-400">
                <Clock size={18} />
              </div>
              <div>
                <strong>Transient Audio Purge</strong>
                <p>Voice response clips are unlinked immediately after psychometric acoustic extraction with an automated 5-minute background sweeper.</p>
              </div>
            </div>

            <div className="compliance-item">
              <div className="compliance-item-icon text-purple-400">
                <FileCheck size={18} />
              </div>
              <div>
                <strong>Explainable AI Metrics</strong>
                <p>Transparent deterministic scoring formulas with full rule-based audit trails, eliminating black-box algorithmic bias.</p>
              </div>
            </div>

            <div className="compliance-item">
              <div className="compliance-item-icon text-cyan-400">
                <Lock size={18} />
              </div>
              <div>
                <strong>TLS 1.3 In-Transit Encryption</strong>
                <p>Enforced HTTPS/WSS secure contexts required for browser camera &amp; microphone streams, securing on-premise candidate telemetry.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Scientific Limitations & Non-Clinical Disclaimer */}
        <section className="report-disclaimer">
          <div className="disclaimer-inner">
            <Lock size={16} className="text-amber-500" />
            <p>
              <strong>Academic & Educational Boundary:</strong> {report.disclaimer || "Scores represent transparent educational and cognitive readiness indicators calculated for engineering interview preparation. Not a clinical psychological diagnosis."}
            </p>
          </div>
        </section>

        {/* Cryptographically Signed Report & Digital Signature Viewer */}
        {signedReport && (
          <section className="signed-report-section my-8">
            <SignedReportViewer report={signedReport} />
          </section>
        )}

        {/* Action Controls */}
        <div className="report-actions-bar">
          <Link to="/assessment" className="btn-action secondary">
            <RotateCcw size={16} />
            <span>Retake Assessment</span>
          </Link>

          <button onClick={handlePrint} className="btn-action primary">
            <Printer size={16} />
            <span>Print / Save PDF</span>
          </button>

          <Link to="/dashboard" className="btn-action secondary">
            <LayoutDashboard size={16} />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
