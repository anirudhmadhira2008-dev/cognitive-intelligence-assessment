import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { resolvePhotoUrl } from "../api/apiClient";
import { getUser } from "../services/authService";
import { 
  Brain, 
  Award, 
  ArrowRight, 
  Clock, 
  CheckCircle2, 
  ShieldCheck, 
  TrendingUp, 
  Eye, 
  RotateCcw,
  Sparkles,
  FileText,
  User,
  Loader2
} from "lucide-react";
import AssessmentProgressionChart from "../components/AssessmentProgressionChart";
import PerformanceAnalysis from "../components/PerformanceAnalysis";

export default function Dashboard() {
  const navigate = useNavigate();
  const user = getUser() || {};

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Identity Photo State
  const [enrollment, setEnrollment] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(() => resolvePhotoUrl(user?.profilePhoto));
  const [photoLoading, setPhotoLoading] = useState(!user?.profilePhoto);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await api.assessment.getMySessions();
        if (res.sessions) {
          setSessions(res.sessions);
        }
      } catch (err) {
        console.error("Failed to load past assessment sessions:", err);
      } finally {
        setLoading(false);
      }
    };

    const fetchCandidateEnrollmentAndPhoto = async () => {
      setPhotoLoading(true);
      try {
        const res = await api.enrollment.getMyEnrollments();
        let loadedUrl = null;

        if (res?.enrollments && res.enrollments.length > 0) {
          const activeEnr = res.enrollments[0];
          setEnrollment(activeEnr);

          const storageKey = activeEnr.identityEnrollment?.secureStorageKey;
          const refImg = activeEnr.identityEnrollment?.referenceImage;
          if (storageKey) {
            loadedUrl = resolvePhotoUrl(storageKey);
          } else if (refImg) {
            loadedUrl = resolvePhotoUrl(refImg);
          }
        }

        if (!loadedUrl && user?.profilePhoto) {
          loadedUrl = resolvePhotoUrl(user.profilePhoto);
        }

        if (loadedUrl) {
          setPhotoUrl(loadedUrl);
        }
      } catch (err) {
        console.warn("Error loading registered identity photo:", err.message);
        if (user?.profilePhoto) {
          setPhotoUrl(resolvePhotoUrl(user.profilePhoto));
        }
      } finally {
        setPhotoLoading(false);
      }
    };

    fetchHistory();
    fetchCandidateEnrollmentAndPhoto();
  }, []);

  const latestSession = sessions.length > 0 ? sessions[0] : null;
  const latestReport = latestSession?.report || null;

  return (
    <div className="dashboard-container">
      {/* Student Welcome Hero & Registered Identity Card */}
      <section className="dashboard-hero-card flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="dashboard-hero-content flex-1">
          <div className="hero-pill">
            <Sparkles size={16} />
            <span>AI Multimodal Cognitive Platform</span>
          </div>
          <h1>Welcome back, {user.name || "Candidate"}</h1>
          <p className="hero-subtext">
            {user.branch ? `${user.branch} · ` : ""}
            {user.college || "Engineering Candidate"} 
            {user.rollNumber ? ` (${user.rollNumber})` : ""}
          </p>

          <div className="hero-actions">
            <Link to="/assessment" className="btn-launch-assessment">
              <Award size={18} />
              <span>Launch 15-Step Assessment</span>
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>

        {/* REGISTERED CANDIDATE PHOTO & PROFILE CARD */}
        <div className="registered-identity-profile-card">
          <div className="candidate-photo-frame">
            {photoLoading ? (
              <div className="candidate-photo-loading">
                <Loader2 className="animate-spin text-indigo-400" size={28} />
              </div>
            ) : photoUrl ? (
              <img 
                src={photoUrl} 
                alt="Registered Identity Photo" 
                className="candidate-photo-img" 
                onError={() => setPhotoUrl(null)}
              />
            ) : (
              <div className="candidate-photo-fallback">
                <User size={42} className="text-slate-400" />
              </div>
            )}
          </div>

          <div className="candidate-identity-info">
            <h3 className="candidate-display-name">{user.name || "Candidate"}</h3>
            <div className="candidate-detail-row">
              <span className="detail-label">Roll / ID:</span>
              <span className="detail-value">{user.rollNumber || "Not Specified"}</span>
            </div>
            <div className="candidate-detail-row">
              <span className="detail-label">Branch:</span>
              <span className="detail-value">{user.branch || "General Engineering"}</span>
            </div>
            <div className="candidate-detail-row">
              <span className="detail-label">Year:</span>
              <span className="detail-value">{user.year ? `${user.year}th Year` : "4th Year"}</span>
            </div>

            <div className="identity-verification-status-tag mt-3">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span>Registered Identity ✓ Verified</span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Pillars Grid */}
      <section className="dashboard-pillars-grid">
        <div className="pillar-card">
          <div className="pillar-icon bg-indigo-subtle">
            <Brain size={24} className="text-indigo-600" />
          </div>
          <h3>Adaptive Knowledge & Reasoning</h3>
          <p>Dynamically scales questions using Bloom's Taxonomy across DSA, OS, Networks, and DBMS.</p>
        </div>

        <div className="pillar-card">
          <div className="pillar-icon bg-emerald-subtle">
            <ShieldCheck size={24} className="text-emerald-600" />
          </div>
          <h3>Evidence-Based Proctoring</h3>
          <p>Continuous face tracking and tab focus monitoring provide explainable integrity confidence.</p>
        </div>

        <div className="pillar-card">
          <div className="pillar-icon bg-purple-subtle">
            <TrendingUp size={24} className="text-purple-600" />
          </div>
          <h3>Interview Speech & Readiness</h3>
          <p>Analyzes verbal responses against technical concepts to strengthen communication under pressure.</p>
        </div>
      </section>

      {/* Longitudinal Performance & Difficulty Analysis */}
      <section className="dashboard-performance-section mb-8">
        <PerformanceAnalysis studentId={user.id} />
      </section>

      {/* Past Assessment History */}
      <section className="dashboard-history-section">
        <div className="section-header-row">
          <div>
            <h2>Assessment History & Performance Audits</h2>
            <p>Review past multimodal evaluation reports and track interview readiness progression.</p>
          </div>
          {sessions.length > 0 && (
            <Link to="/assessment" className="btn-retake-sm">
              <RotateCcw size={15} />
              <span>New Assessment</span>
            </Link>
          )}
        </div>

        {loading ? (
          <div className="history-loading">
            <div className="spinner-small" />
            <span>Loading evaluation records from database...</span>
          </div>
        ) : sessions.length > 0 ? (
          <>
            {/* Longitudinal Multi-Test Progression Line Graph */}
            <AssessmentProgressionChart sessions={sessions} />

            <div className="sessions-list">
            {sessions.map((s, idx) => (
              <div className="session-history-item" key={s._id || idx}>
                <div className="session-main">
                  <div className="session-icon">
                    <FileText size={24} className="text-indigo-600" />
                  </div>
                  <div>
                    <h4>{s.setup?.role || "Software Developer Assessment"}</h4>
                    <span className="session-meta">
                      <Clock size={14} />
                      {new Date(s.completedAt || s.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>
                </div>

                <div className="session-metrics-row">
                  <div className="metric-pill">
                    <small>Knowledge</small>
                    <strong>{s.report?.knowledge || 0}%</strong>
                  </div>

                  <div className="metric-pill">
                    <small>Readiness</small>
                    <strong>{s.report?.readiness || 0}%</strong>
                  </div>

                  <div className="metric-pill">
                    <small>Integrity</small>
                    <strong>{s.report?.integrity || 100}%</strong>
                  </div>

                  <div className="decision-tag">
                    {s.report?.decision || "Recommended"}
                  </div>
                </div>

                <div className="session-actions">
                  <Link to={`/results/${s._id}`} className="btn-view-report">
                    <span>View Report</span>
                    <Eye size={16} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
          <div className="empty-history-card">
            <Brain size={44} className="text-indigo-400" />
            <h3>No Assessments Completed Yet</h3>
            <p>
              Take your first 15-step multimodal assessment to evaluate knowledge, verbal articulation, 
              behavioral baseline, and interview readiness.
            </p>
            <Link to="/assessment" className="primary-button">
              Start Your First Assessment
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
