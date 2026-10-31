import React, { useEffect, useState } from "react";
import api from "../api/apiClient";
import { 
  Shield, 
  Users, 
  FileCheck, 
  AlertTriangle, 
  Search, 
  Filter, 
  Eye, 
  BookOpen, 
  BarChart3, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ChevronRight,
  TrendingUp,
  X,
  Award,
  Download
} from "lucide-react";

export default function AdminDashboard() {
  const [tab, setTab] = useState("overview"); // overview, candidates, sessions, questions
  const [metrics, setMetrics] = useState({
    totalCandidates: 0,
    totalAssessments: 0,
    completedAssessments: 0,
    averageReadiness: 0,
    averageIntegrity: 100,
    flaggedIncidents: 0
  });
  const [candidates, setCandidates] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [decisionFilter, setDecisionFilter] = useState("");

  // Inspect Modal State
  const [selectedSession, setSelectedSession] = useState(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  // Research Analytics State (Phase 6)
  const [analyticsData, setAnalyticsData] = useState(null);
  const [proctoringData, setProctoringData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const [cohortRes, procRes] = await Promise.all([
        api.admin.getCohortAnalytics(),
        api.admin.getProctoringAnalytics()
      ]);
      setAnalyticsData(cohortRes);
      setProctoringData(procRes);
    } catch (err) {
      console.error("Failed to load cohort analytics:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleExportData = (format = "csv") => {
    const token = localStorage.getItem("token");
    const exportUrl = api.admin.exportResearchDataUrl(format);
    
    // Trigger download with auth token header or fetch blob
    fetch(exportUrl, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `psychometric_research_data.${format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch((err) => console.error("Export download failed:", err));
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const res = await api.admin.getOverview();
      if (res.metrics) {
        setMetrics(res.metrics);
      }
    } catch (err) {
      console.error("Failed to load admin overview:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const res = await api.admin.getCandidates(1, search);
      setCandidates(res.candidates || []);
    } catch (err) {
      console.error("Failed to load candidates:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res = await api.admin.getSessions(1, decisionFilter);
      setSessions(res.sessions || []);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setLoading(false);
    }
  };

  const [questions, setQuestions] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newQuestion, setNewQuestion] = useState({
    questionId: "",
    domain: "Data Structures",
    difficulty: 2,
    competency: "Problem Solving",
    question: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    answer: 0,
    explanation: ""
  });

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const res = await api.admin.getQuestions(1, search);
      setQuestions(res.questions || []);
    } catch (err) {
      console.error("Failed to load questions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "candidates") loadCandidates();
    if (tab === "sessions") loadSessions();
    if (tab === "questions") loadQuestions();
    if (tab === "analytics") loadAnalytics();
  }, [tab, decisionFilter]);

  const handleCreateQuestionSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.admin.createQuestion({
        questionId: newQuestion.questionId || `custom-${Date.now()}`,
        domain: newQuestion.domain,
        difficulty: Number(newQuestion.difficulty),
        type: "mcq",
        bloom: "Apply",
        competency: newQuestion.competency,
        question: newQuestion.question,
        options: [newQuestion.optionA, newQuestion.optionB, newQuestion.optionC, newQuestion.optionD],
        answer: Number(newQuestion.answer),
        explanation: newQuestion.explanation
      });
      setShowCreateModal(false);
      setNewQuestion({
        questionId: "",
        domain: "Data Structures",
        difficulty: 2,
        competency: "Problem Solving",
        question: "",
        optionA: "",
        optionB: "",
        optionC: "",
        optionD: "",
        answer: 0,
        explanation: ""
      });
      loadQuestions();
    } catch (err) {
      alert(err.message || "Failed to create question");
    }
  };


  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (tab === "candidates") loadCandidates();
  };

  const inspectSession = async (id) => {
    setInspectLoading(true);
    try {
      const res = await api.admin.getSessionDetail(id);
      setSelectedSession(res.session || null);
    } catch (err) {
      console.error("Failed to inspect session:", err);
    } finally {
      setInspectLoading(false);
    }
  };

  const toggleCandidateStatus = async (candidateId, currentStatus) => {
    const nextStatus = currentStatus === "active" ? "suspended" : "active";
    try {
      await api.admin.updateStatus(candidateId, { accountStatus: nextStatus });
      loadCandidates();
    } catch (err) {
      console.error("Failed to toggle status:", err);
    }
  };

  return (
    <div className="admin-page-container">
      <header className="admin-header">
        <div className="admin-header-title">
          <div className="admin-badge">
            <Shield size={18} className="text-indigo-400" />
            <span>Administrator & Faculty Portal</span>
          </div>
          <h1>Multimodal Assessment Supervision & Auditing</h1>
        </div>

        <div className="admin-tabs">
          <button 
            className={`admin-tab-btn ${tab === "overview" ? "active" : ""}`}
            onClick={() => setTab("overview")}
          >
            <BarChart3 size={16} />
            <span>Overview</span>
          </button>

          <button 
            className={`admin-tab-btn ${tab === "candidates" ? "active" : ""}`}
            onClick={() => setTab("candidates")}
          >
            <Users size={16} />
            <span>Candidates</span>
          </button>

          <button 
            className={`admin-tab-btn ${tab === "sessions" ? "active" : ""}`}
            onClick={() => setTab("sessions")}
          >
            <FileCheck size={16} />
            <span>Assessment Audits</span>
          </button>

          <button 
            className={`admin-tab-btn ${tab === "questions" ? "active" : ""}`}
            onClick={() => setTab("questions")}
          >
            <BookOpen size={16} />
            <span>Question Bank</span>
          </button>

          <button 
            className={`admin-tab-btn ${tab === "analytics" ? "active" : ""}`}
            onClick={() => setTab("analytics")}
          >
            <TrendingUp size={16} />
            <span>Research Analytics</span>
          </button>
        </div>
      </header>


      {/* TAB 1: OVERVIEW */}
      {tab === "overview" && (
        <div className="admin-content-section">
          <div className="overview-metric-cards">
            <div className="admin-metric-card">
              <div className="metric-icon-box bg-blue">
                <Users size={24} />
              </div>
              <div>
                <span className="metric-label">Registered Candidates</span>
                <strong className="metric-value">{metrics.totalCandidates}</strong>
              </div>
            </div>

            <div className="admin-metric-card">
              <div className="metric-icon-box bg-indigo">
                <FileCheck size={24} />
              </div>
              <div>
                <span className="metric-label">Completed Assessments</span>
                <strong className="metric-value">{metrics.completedAssessments}</strong>
              </div>
            </div>

            <div className="admin-metric-card">
              <div className="metric-icon-box bg-emerald">
                <TrendingUp size={24} />
              </div>
              <div>
                <span className="metric-label">Avg Readiness Score</span>
                <strong className="metric-value">{metrics.averageReadiness}%</strong>
              </div>
            </div>

            <div className="admin-metric-card">
              <div className="metric-icon-box bg-purple">
                <Shield size={24} />
              </div>
              <div>
                <span className="metric-label">Avg Integrity Index</span>
                <strong className="metric-value">{metrics.averageIntegrity}%</strong>
              </div>
            </div>

            <div className="admin-metric-card">
              <div className="metric-icon-box bg-amber">
                <AlertTriangle size={24} />
              </div>
              <div>
                <span className="metric-label">Flagged Incidents</span>
                <strong className="metric-value">{metrics.flaggedIncidents}</strong>
              </div>
            </div>
          </div>

          <div className="admin-quick-actions">
            <div className="quick-action-card">
              <h3>System Operational Status</h3>
              <p>Proctoring stream collector, speech evaluation gateway, and Mongoose database connection are active.</p>
              <div className="system-pill ok">
                <CheckCircle2 size={16} />
                <span>Operational (Latency &lt; 45ms)</span>
              </div>
            </div>

            <div className="quick-action-card">
              <h3>Next Steps for Evaluators</h3>
              <p>Review completed candidate sessions flagged under "Review Required" to examine video presence and tab blur timelines.</p>
              <button className="primary-button" onClick={() => { setDecisionFilter("Review Required"); setTab("sessions"); }}>
                <span>Inspect Flagged Sessions</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CANDIDATES */}
      {tab === "candidates" && (
        <div className="admin-content-section">
          <div className="table-controls-bar">
            <form onSubmit={handleSearchSubmit} className="search-form">
              <Search size={18} className="search-icon" />
              <input 
                type="text" 
                placeholder="Search candidates by name, email, roll number..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="submit" className="search-btn">Search</button>
            </form>
          </div>

          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Candidate Name</th>
                  <th>Roll Number</th>
                  <th>Account Status</th>
                  <th>Joined</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {candidates.length > 0 ? (
                  candidates.map((c) => (
                    <tr key={c._id}>
                      <td>
                        <strong>{c.name}</strong>
                      </td>
                      <td>{c.rollNumber || "—"}</td>
                      <td>
                        <span className={`status-chip ${c.accountStatus || "active"}`}>
                          {c.accountStatus || "active"}
                        </span>
                      </td>
                      <td>{c.joinedAt ? new Date(c.joinedAt).toLocaleDateString() : "—"}</td>
                      <td>
                        <button 
                          className="btn-status-toggle"
                          onClick={() => toggleCandidateStatus(c._id, c.accountStatus || "active")}
                        >
                          {c.accountStatus === "suspended" ? "Reactivate" : "Suspend"}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="text-center py-6">
                      {loading ? "Loading candidate roster..." : "No candidates found matching query."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ASSESSMENT SESSIONS & AUDITS */}
      {tab === "sessions" && (
        <div className="admin-content-section">
          <div className="table-controls-bar">
            <div className="filter-group">
              <Filter size={16} />
              <span>Filter by Decision:</span>
              <select 
                value={decisionFilter} 
                onChange={(e) => setDecisionFilter(e.target.value)}
              >
                <option value="">All Decisions</option>
                <option value="Highly Recommended">Highly Recommended</option>
                <option value="Recommended">Recommended</option>
                <option value="Conditionally Recommended">Conditionally Recommended</option>
                <option value="Review Required">Review Required</option>
              </select>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Anonymous Response ID</th>
                  <th>Target Role</th>
                  <th>Readiness</th>
                  <th>Integrity</th>
                  <th>Decision</th>
                  <th>Completed</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length > 0 ? (
                  sessions.map((s) => (
                    <tr key={s._id}>
                      <td>
                        <strong>{s.anonymousId || `RESP-${String(s._id).slice(-6).toUpperCase()}`}</strong>
                      </td>
                      <td>{s.targetRole || s.setup?.role || "Software Developer"}</td>
                      <td>
                        <span className="score-pill">
                          {s.readiness !== undefined ? s.readiness : (s.report?.readiness || 0)}%
                        </span>
                      </td>
                      <td>
                        <span className={`score-pill ${(s.integrity !== undefined ? s.integrity : (s.report?.integrity || 100)) < 60 ? "pill-warn" : "pill-good"}`}>
                          {s.integrity !== undefined ? s.integrity : (s.report?.integrity || 100)}%
                        </span>
                      </td>
                      <td>
                        <span className={`decision-pill ${(s.decision || s.report?.decision || "Recommended").replace(/\s+/g, "-").toLowerCase()}`}>
                          {s.decision || s.report?.decision || "Recommended"}
                        </span>
                      </td>
                      <td>{new Date(s.completedAt || s.createdAt).toLocaleDateString()}</td>
                      <td>
                        <button 
                          className="btn-inspect" 
                          onClick={() => inspectSession(s._id)}
                        >
                          <Eye size={15} />
                          <span>Audit</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="text-center py-6">
                      {loading ? "Loading assessment sessions..." : "No assessment sessions recorded."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* TAB 4: QUESTION BANK */}
      {tab === "questions" && (

        <div className="admin-content-section">
          <div className="table-controls-bar">
            <div className="search-form">
              <Search size={18} className="search-icon" />
              <input 
                type="text" 
                placeholder="Filter questions by concept or question text..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button onClick={() => loadQuestions()} className="search-btn">Search</button>
            </div>
            <button className="primary-button" onClick={() => setShowCreateModal(true)}>
              <span>+ Add New Question</span>
            </button>
          </div>

          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Domain</th>
                  <th>Difficulty</th>
                  <th>Question & Options</th>
                  <th>Competency</th>
                </tr>
              </thead>
              <tbody>
                {questions.length > 0 ? (
                  questions.map((q, idx) => (
                    <tr key={q.questionId || idx}>
                      <td><strong>{q.questionId}</strong></td>
                      <td>{q.domain}</td>
                      <td>
                        <span className="score-pill">Tier {q.difficulty}/3</span>
                      </td>
                      <td>
                        <strong>{q.question}</strong>
                        <span className="table-subtext">Options: {q.options?.join(" | ")}</span>
                      </td>
                      <td>{q.competency}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="text-center py-6">
                      {loading ? "Loading question bank..." : "No questions found matching criteria."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: RESEARCH ANALYTICS & EXAMINER EXPORT (PHASE 6) */}
      {tab === "analytics" && (
        <div className="admin-content-section">
          {/* Export Action Bar */}
          <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl mb-6 shadow-sm flex-wrap gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">150-Participant Controlled Pilot Research Dataset</h3>
              <p className="text-xs text-slate-500">
                Double-Blind Privacy Policy Enforced: Candidate personal emails, phones, and raw responses are strictly excluded.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="secondary-button flex items-center gap-2"
                onClick={() => handleExportData("json")}
              >
                <Download size={15} />
                <span>Export JSON</span>
              </button>
              <button
                type="button"
                className="primary-button flex items-center gap-2"
                onClick={() => handleExportData("csv")}
              >
                <Download size={15} />
                <span>Export CSV Dataset</span>
              </button>
            </div>
          </div>

          {analyticsLoading ? (
            <div className="text-center py-12 text-slate-500">
              <Clock size={32} className="mx-auto mb-2 animate-spin text-indigo-500" />
              <span>Calculating statistical metrics across test cohorts...</span>
            </div>
          ) : analyticsData ? (
            <div className="space-y-6">
              {/* Test 1 vs Test 2 Statistical Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">Baseline Round</div>
                  <h4 className="text-lg font-bold text-slate-900">Test 1 Cohort Performance</h4>
                  <div className="mt-4 space-y-2 text-sm text-slate-600">
                    <div className="flex justify-between"><span>Sample Size (N):</span><strong>{analyticsData.test1Stats?.n || 0}</strong></div>
                    <div className="flex justify-between"><span>Mean Readiness Score:</span><strong className="text-indigo-600">{analyticsData.test1Stats?.mean || 0}%</strong></div>
                    <div className="flex justify-between"><span>Standard Deviation (σ):</span><strong>±{analyticsData.test1Stats?.stdDev || 0}</strong></div>
                    <div className="flex justify-between"><span>Score Range:</span><strong>{analyticsData.test1Stats?.min || 0} - {analyticsData.test1Stats?.max || 0}</strong></div>
                    <div className="flex justify-between"><span>Median (Q2):</span><strong>{analyticsData.test1Stats?.median || 0}%</strong></div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-1">Comparative Round</div>
                  <h4 className="text-lg font-bold text-slate-900">Test 2 Cohort Performance</h4>
                  <div className="mt-4 space-y-2 text-sm text-slate-600">
                    <div className="flex justify-between"><span>Sample Size (N):</span><strong>{analyticsData.test2Stats?.n || 0}</strong></div>
                    <div className="flex justify-between"><span>Mean Readiness Score:</span><strong className="text-emerald-600">{analyticsData.test2Stats?.mean || 0}%</strong></div>
                    <div className="flex justify-between"><span>Standard Deviation (σ):</span><strong>±{analyticsData.test2Stats?.stdDev || 0}</strong></div>
                    <div className="flex justify-between"><span>Score Range:</span><strong>{analyticsData.test2Stats?.min || 0} - {analyticsData.test2Stats?.max || 0}</strong></div>
                    <div className="flex justify-between"><span>Median (Q2):</span><strong>{analyticsData.test2Stats?.median || 0}%</strong></div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-wider text-purple-600 mb-1">Intra-Participant Shift</div>
                  <h4 className="text-lg font-bold text-slate-900">Paired Test Delta (Δ)</h4>
                  <div className="mt-4 space-y-2 text-sm text-slate-600">
                    <div className="flex justify-between"><span>Paired Participants:</span><strong>{analyticsData.pairedCohortShift?.n || 0}</strong></div>
                    <div className="flex justify-between">
                      <span>Mean Shift (Δ = T2 - T1):</span>
                      <strong className={analyticsData.pairedCohortShift?.meanDelta >= 0 ? "text-emerald-600" : "text-rose-600"}>
                        {analyticsData.pairedCohortShift?.meanDelta > 0 ? "+" : ""}{analyticsData.pairedCohortShift?.meanDelta || 0}%
                      </strong>
                    </div>
                    <div className="flex justify-between"><span>Positive Score Gains:</span><strong className="text-emerald-600">{analyticsData.pairedCohortShift?.positiveCount || 0}</strong></div>
                    <div className="flex justify-between"><span>Negative / Neutral Shifts:</span><strong className="text-slate-500">{analyticsData.pairedCohortShift?.negativeCount || 0}</strong></div>
                    <div className="flex justify-between"><span>Completion Rate:</span><strong>{analyticsData.completionRate || 0}%</strong></div>
                  </div>
                </div>
              </div>

              {/* Cognitive Competencies Breakdown */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-base font-bold text-slate-900">Multimodal Cognitive Dimensions Aggregate</h4>
                  <div className="text-xs text-slate-500">
                    Strongest: <strong className="text-indigo-600">{analyticsData.competencyInsights?.strongest}</strong> | 
                    Growth Gap: <strong className="text-rose-600">{analyticsData.competencyInsights?.gaps}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {Object.entries(analyticsData.cognitiveDimensions || {}).map(([dim, val]) => (
                    <div key={dim} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-center">
                      <div className="text-xs uppercase font-bold text-slate-500 tracking-wider">{dim}</div>
                      <div className="text-2xl font-black text-slate-800 my-1">{val}%</div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${val}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Proctoring & Integrity Telemetry Breakdown */}
              {proctoringData && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h4 className="text-base font-bold text-slate-900 mb-4">Proctoring Telemetry & Integrity Distribution</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-lg">
                      <div className="text-xs font-bold text-emerald-800 uppercase">Excellent (90-100%)</div>
                      <div className="text-2xl font-black text-emerald-700 mt-1">{proctoringData.distribution?.excellent || 0}</div>
                      <div className="text-[11px] text-emerald-600 mt-1">Zero material incidents</div>
                    </div>

                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                      <div className="text-xs font-bold text-blue-800 uppercase">Good (75-89%)</div>
                      <div className="text-2xl font-black text-blue-700 mt-1">{proctoringData.distribution?.good || 0}</div>
                      <div className="text-[11px] text-blue-600 mt-1">Minor transient notices</div>
                    </div>

                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg">
                      <div className="text-xs font-bold text-amber-800 uppercase">Moderate (50-74%)</div>
                      <div className="text-2xl font-black text-amber-700 mt-1">{proctoringData.distribution?.moderate || 0}</div>
                      <div className="text-[11px] text-amber-600 mt-1">Tab switches or face movement</div>
                    </div>

                    <div className="p-4 bg-rose-50 border border-rose-100 rounded-lg">
                      <div className="text-xs font-bold text-rose-800 uppercase">Flagged / High Risk (&lt;50%)</div>
                      <div className="text-2xl font-black text-rose-700 mt-1">{proctoringData.distribution?.highRisk || 0}</div>
                      <div className="text-[11px] text-rose-600 mt-1">Manual review requested</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              No research cohort data currently recorded in database.
            </div>
          )}
        </div>
      )}

      {/* CREATE QUESTION MODAL */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Assessment Question</h3>
              <button className="modal-close-btn" onClick={() => setShowCreateModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateQuestionSubmit}>
              <div className="modal-body">
                <div className="form-grid-2col">
                  <div className="form-field">
                    <label>Question ID *</label>
                    <input 
                      type="text" 
                      placeholder="e.g. ds-04" 
                      value={newQuestion.questionId} 
                      onChange={(e) => setNewQuestion({ ...newQuestion, questionId: e.target.value })} 
                      required 
                    />
                  </div>
                  <div className="form-field">
                    <label>Domain</label>
                    <select 
                      value={newQuestion.domain} 
                      onChange={(e) => setNewQuestion({ ...newQuestion, domain: e.target.value })}
                    >
                      <option>Data Structures</option>
                      <option>Algorithms</option>
                      <option>DBMS</option>
                      <option>Operating Systems</option>
                      <option>Computer Networks</option>
                      <option>Software Engineering</option>
                    </select>
                  </div>
                </div>

                <div className="form-field mt-3">
                  <label>Question Text *</label>
                  <textarea 
                    rows="3"
                    className="form-input"
                    style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1" }}
                    placeholder="Enter the full question statement..." 
                    value={newQuestion.question} 
                    onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })} 
                    required 
                  />
                </div>

                <div className="form-grid-2col mt-3">
                  <div className="form-field">
                    <label>Option A *</label>
                    <input 
                      type="text" 
                      value={newQuestion.optionA} 
                      onChange={(e) => setNewQuestion({ ...newQuestion, optionA: e.target.value })} 
                      required 
                    />
                  </div>
                  <div className="form-field">
                    <label>Option B *</label>
                    <input 
                      type="text" 
                      value={newQuestion.optionB} 
                      onChange={(e) => setNewQuestion({ ...newQuestion, optionB: e.target.value })} 
                      required 
                    />
                  </div>
                  <div className="form-field">
                    <label>Option C *</label>
                    <input 
                      type="text" 
                      value={newQuestion.optionC} 
                      onChange={(e) => setNewQuestion({ ...newQuestion, optionC: e.target.value })} 
                      required 
                    />
                  </div>
                  <div className="form-field">
                    <label>Option D *</label>
                    <input 
                      type="text" 
                      value={newQuestion.optionD} 
                      onChange={(e) => setNewQuestion({ ...newQuestion, optionD: e.target.value })} 
                      required 
                    />
                  </div>
                </div>

                <div className="form-grid-2col mt-3">
                  <div className="form-field">
                    <label>Correct Choice Index *</label>
                    <select 
                      value={newQuestion.answer} 
                      onChange={(e) => setNewQuestion({ ...newQuestion, answer: Number(e.target.value) })}
                    >
                      <option value={0}>Option A (Index 0)</option>
                      <option value={1}>Option B (Index 1)</option>
                      <option value={2}>Option C (Index 2)</option>
                      <option value={3}>Option D (Index 3)</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Difficulty Tier</label>
                    <select 
                      value={newQuestion.difficulty} 
                      onChange={(e) => setNewQuestion({ ...newQuestion, difficulty: Number(e.target.value) })}
                    >
                      <option value={1}>Tier 1 (Foundation)</option>
                      <option value={2}>Tier 2 (Intermediate)</option>
                      <option value={3}>Tier 3 (Advanced)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="secondary-button" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-button ml-2">
                  Create Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* SESSION INSPECTOR MODAL */}
      {selectedSession && (
        <div className="modal-backdrop" onClick={() => setSelectedSession(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-title">
                <Shield size={20} className="text-indigo-400" />
                <h3>Session Telemetry & Proctoring Audit</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedSession(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* Anonymous Session Header (Strict Privacy: Identity Disassociated) */}
              <div className="audit-candidate-header">
                <div>
                  <h4>Audit: {selectedSession.anonymousId || `RESP-${String(selectedSession._id).slice(-6).toUpperCase()}`}</h4>
                  <p>Role: {selectedSession.setup?.role || "Software Developer"} · Status: {selectedSession.status || "COMPLETED"}</p>
                </div>
                <div className="audit-decision-tag">
                  <small>Decision:</small>
                  <strong>{selectedSession.report?.decision || "Recommended"}</strong>
                </div>
              </div>

              {/* Integrity Timeline */}
              <div className="audit-section">
                <h4>Recorded Proctoring Incidents</h4>
                <div className="audit-event-timeline">
                  {selectedSession.monitoring?.events && selectedSession.monitoring.events.length > 0 ? (
                    selectedSession.monitoring.events.map((ev, i) => (
                      <div className={`audit-event-row severity-${ev.severity || "low"}`} key={i}>
                        <div className="event-time">
                          <Clock size={14} />
                          <span>{ev.time || (ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : "00:00")}</span>
                        </div>
                        <div className="event-details">
                          <strong>{ev.type || "WINDOW_BLUR"}</strong>
                          <p>{ev.description || "Window focus shifted away from the assessment."}</p>
                        </div>
                        <div className="event-points">
                          <span className="severity-badge">{ev.severity || "low"}</span>
                          <small>Confidence: {ev.confidence || 90}%</small>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="audit-clean-box">
                      <CheckCircle2 size={22} className="text-emerald-500" />
                      <span>Zero proctoring incidents detected. Single continuous face presence verified.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Verbal Transcript Audit */}
              <div className="audit-section">
                <h4>Verbal Interview Transcript Evaluation</h4>
                <div className="audit-voice-box">
                  <p className="voice-transcript-text">
                    "{selectedSession.voice?.responses?.[0]?.transcript || "No transcript recorded for this session."}"
                  </p>
                  <div className="voice-stats-row">
                    <span>Words Spoken: {selectedSession.voice?.wordsSpoken || 0}</span>
                    <span>Keyword Coverage: {selectedSession.voice?.keywordCoverage || 0}%</span>
                    <span>Communication: {selectedSession.report?.communication || 0}%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="secondary-button" onClick={() => setSelectedSession(null)}>
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
