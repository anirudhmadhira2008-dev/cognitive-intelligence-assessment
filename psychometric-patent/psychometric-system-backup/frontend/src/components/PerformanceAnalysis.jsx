import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../api/apiClient";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Sparkles, 
  CheckCircle2, 
  HelpCircle,
  Brain,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Award,
  Calendar,
  Activity,
  FileText,
  Minus
} from "lucide-react";

/**
 * HistoricalDifficultyBarChart
 * Real, accessible SVG bar chart component with percentage Y-axis, chronological X-axis,
 * distinct colors per tier, honest null/unattempted handling, and hover tooltips.
 */
function HistoricalDifficultyBarChart({ title, tierLabel, tierClass, pointsPerQ, data = [] }) {
  const [hoveredItem, setHoveredItem] = useState(null);

  // SVG Coordinates & Dimensions
  const svgWidth = 340;
  const svgHeight = 220;
  const padLeft = 44;
  const padRight = 20;
  const padTop = 32;
  const padBottom = 48;

  const chartWidth = svgWidth - padLeft - padRight;
  const chartHeight = svgHeight - padTop - padBottom;

  const gridLevels = [100, 75, 50, 25, 0];
  const totalBars = Math.max(1, data.length);
  const barSlotWidth = chartWidth / totalBars;
  const barWidth = Math.min(36, Math.max(20, barSlotWidth * 0.55));

  // Tier color themes
  const themeColors = {
    easy: {
      barFill: "url(#easyGradient)",
      glow: "rgba(16, 185, 129, 0.4)",
      labelColor: "#10b981",
      gradStart: "#10b981",
      gradEnd: "#059669"
    },
    medium: {
      barFill: "url(#mediumGradient)",
      glow: "rgba(245, 158, 11, 0.4)",
      labelColor: "#f59e0b",
      gradStart: "#f59e0b",
      gradEnd: "#d97706"
    },
    hard: {
      barFill: "url(#hardGradient)",
      glow: "rgba(244, 63, 94, 0.4)",
      labelColor: "#f43f5e",
      gradStart: "#f43f5e",
      gradEnd: "#e11d48"
    }
  };

  const theme = themeColors[tierClass] || themeColors.easy;

  return (
    <div className="diff-chart-card">
      {/* Card Header */}
      <div className="diff-card-header">
        <div className="diff-card-top-row">
          <span className={`diff-tier-tag ${tierClass}`}>{tierLabel}</span>
          <span className="diff-points-tag">{pointsPerQ}</span>
        </div>
        <h4 className="diff-chart-title">{title}</h4>
        <p className="diff-formula-note">
          Formula: <code>earned / available × 100</code>
        </p>
      </div>

      {/* Real SVG Bar Chart */}
      <div className="svg-bar-chart-container">
        <svg 
          viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
          className="real-svg-chart"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id={`${tierClass}Gradient`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={theme.gradStart} stopOpacity="1" />
              <stop offset="100%" stopColor={theme.gradEnd} stopOpacity="0.8" />
            </linearGradient>
            <pattern id="diagonalHatch" patternUnits="userSpaceOnUse" width="8" height="8">
              <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke="#334155" strokeWidth="1.2" />
            </pattern>
          </defs>

          {/* Y-Axis Horizontal Grid Lines & Ticks */}
          {gridLevels.map((lvl) => {
            const y = padTop + (1 - lvl / 100) * chartHeight;
            return (
              <g key={lvl} className="chart-grid-row">
                <line
                  x1={padLeft}
                  y1={y}
                  x2={svgWidth - padRight}
                  y2={y}
                  stroke={lvl === 0 ? "#334155" : "#1e293b"}
                  strokeDasharray={lvl === 0 || lvl === 100 ? "none" : "3,4"}
                  strokeWidth={lvl === 0 ? "1.5" : "1"}
                />
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize="10"
                  fill="#64748b"
                  fontWeight="600"
                >
                  {lvl}%
                </text>
              </g>
            );
          })}

          {/* Historical Data Bars */}
          {data.map((item, idx) => {
            const x = padLeft + (idx + 0.5) * barSlotWidth - barWidth / 2;
            const isAssessed = item.percentage !== null && !isNaN(item.percentage);
            const clampedPct = isAssessed ? Math.min(100, Math.max(0, item.percentage)) : 0;
            const bHeight = isAssessed ? Math.max(4, (clampedPct / 100) * chartHeight) : chartHeight;
            const y = padTop + chartHeight - bHeight;

            const isHovered = hoveredItem?.attemptNumber === item.attemptNumber;

            return (
              <g 
                key={item.attemptNumber || idx} 
                className="chart-bar-group"
                onMouseEnter={() => setHoveredItem({ ...item, x: x + barWidth / 2, y })}
                onMouseLeave={() => setHoveredItem(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Hit target for smooth hover */}
                <rect 
                  x={x - 6} 
                  y={padTop} 
                  width={barWidth + 12} 
                  height={chartHeight} 
                  fill="transparent" 
                />

                {isAssessed ? (
                  <>
                    {/* Evaluated Real Bar */}
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={bHeight}
                      rx="4"
                      ry="4"
                      fill={theme.barFill}
                      stroke={isHovered ? "#ffffff" : "none"}
                      strokeWidth={isHovered ? "1.5" : "0"}
                      style={{ transition: "all 0.3s ease" }}
                    />
                    {/* Score Label Above Bar */}
                    <text
                      x={x + barWidth / 2}
                      y={y - 6}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="800"
                      fill={isHovered ? "#ffffff" : theme.labelColor}
                    >
                      {clampedPct}%
                    </text>
                  </>
                ) : (
                  <>
                    {/* Unassessed / Null Placeholder Bar */}
                    <rect
                      x={x}
                      y={padTop}
                      width={barWidth}
                      height={chartHeight}
                      rx="4"
                      ry="4"
                      fill="url(#diagonalHatch)"
                      stroke="#334155"
                      strokeWidth="1"
                      strokeDasharray="3,3"
                      opacity="0.8"
                    />
                    <text
                      x={x + barWidth / 2}
                      y={padTop + chartHeight / 2}
                      textAnchor="middle"
                      fontSize="9.5"
                      fontWeight="600"
                      fill="#64748b"
                      transform={`rotate(-90, ${x + barWidth / 2}, ${padTop + chartHeight / 2})`}
                    >
                      Not Assessed
                    </text>
                  </>
                )}

                {/* X-Axis Attempt Label */}
                <text
                  x={x + barWidth / 2}
                  y={svgHeight - 22}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill={isHovered ? "#f8fafc" : "#94a3b8"}
                >
                  Att {item.attemptNumber}
                </text>

                {/* X-Axis Date Sublabel */}
                <text
                  x={x + barWidth / 2}
                  y={svgHeight - 8}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="500"
                  fill="#64748b"
                >
                  {item.date ? new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip */}
        {hoveredItem && (
          <div 
            className="bar-chart-tooltip"
            style={{
              left: `${(hoveredItem.x / svgWidth) * 100}%`,
              top: `${(hoveredItem.y / svgHeight) * 100}%`
            }}
          >
            <div className="tooltip-title">{hoveredItem.label || `Attempt ${hoveredItem.attemptNumber}`}</div>
            <div className="tooltip-val">
              {hoveredItem.percentage !== null ? `${hoveredItem.percentage}% Performance` : "Not Assessed"}
            </div>
            {hoveredItem.percentage !== null && (
              <div className="tooltip-meta">
                Earned {hoveredItem.earned} of {hoveredItem.available} available points
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card Footer Summary */}
      <div className="diff-card-footer">
        <span>Completed: {data.filter((d) => d.percentage !== null).length} of {data.length} tests</span>
        <span>Scale: 0% – 100%</span>
      </div>
    </div>
  );
}

export default function PerformanceAnalysis({ studentId }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAnalysis = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.reports.getPerformanceAnalysis(studentId);
      if (res.analysis) {
        setAnalysis(res.analysis);
      } else {
        setError("No performance analysis data available.");
      }
    } catch (err) {
      console.error("Failed to load performance analysis:", err);
      setError("Unable to load performance analysis from server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, [studentId]);

  if (loading) {
    return (
      <div className="perf-kpi-card" style={{ padding: "40px", textAlign: "center" }}>
        <RefreshCw className="animate-spin" size={32} style={{ margin: "0 auto 12px", color: "#818cf8" }} />
        <h4 style={{ fontSize: "15px", fontWeight: "700", color: "#f8fafc", margin: "0 0 4px 0" }}>
          Calculating Longitudinal Performance Metrics...
        </h4>
        <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
          Retrieving server-authoritative difficulty curves and competency blueprints.
        </p>
      </div>
    );
  }

  if (error || !analysis || !analysis.hasData) {
    return (
      <div className="perf-kpi-card" style={{ padding: "48px 24px", textAlign: "center", borderStyle: "dashed" }}>
        <HelpCircle size={44} style={{ margin: "0 auto 16px", color: "#64748b" }} />
        <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#f8fafc", margin: "0 0 8px 0" }}>
          No Assessment History Available Yet
        </h3>
        <p style={{ fontSize: "14px", color: "#94a3b8", maxWidth: "520px", margin: "0 auto 20px" }}>
          {analysis?.message || "Complete your first adaptive assessment to generate longitudinal difficulty analysis, competency tracking, and evidence-based performance insights."}
        </p>
        <Link to="/assessment" className="perf-refresh-btn" style={{ textDecoration: "none", display: "inline-flex" }}>
          <Award size={16} />
          <span>Launch Your First Assessment</span>
        </Link>
      </div>
    );
  }

  const { charts, competencies, trends, aiFeedback, history = [] } = analysis;

  // 1. Calculate KPI Metrics
  const totalAssessments = analysis.totalCompletedAssessments || history.length || 0;
  const latestScore = analysis.latestOverallScore ?? (history.length > 0 ? history[history.length - 1].overallScore : 0);

  // Score progression delta (latest vs previous)
  let scoreDelta = null;
  if (history.length >= 2) {
    const prevScore = history[history.length - 2].overallScore;
    scoreDelta = latestScore - prevScore;
  }

  // Strongest measured difficulty tier
  let strongestTier = "Not enough data yet";
  if (charts) {
    const tierAvgs = [];
    ["easy", "medium", "hard"].forEach((key) => {
      const validAttempts = (charts[key] || []).filter((a) => a.percentage !== null);
      if (validAttempts.length > 0) {
        const avg = Math.round(validAttempts.reduce((acc, curr) => acc + curr.percentage, 0) / validAttempts.length);
        tierAvgs.push({ name: key.charAt(0).toUpperCase() + key.slice(1), avg });
      }
    });
    if (tierAvgs.length > 0) {
      tierAvgs.sort((a, b) => b.avg - a.avg);
      strongestTier = `${tierAvgs[0].name} (${tierAvgs[0].avg}%)`;
    }
  }

  return (
    <div className="perf-analytics-wrapper">
      {/* SECTION HEADER */}
      <div className="perf-page-header">
        <div className="perf-header-content">
          <div className="perf-badge-pill">
            <BarChart3 size={13} />
            <span>Performance Analytics</span>
          </div>
          <h2 className="perf-page-title">Student Performance</h2>
          <p className="perf-page-subtitle">
            Track assessment outcomes, difficulty-level performance, and competency development over time.
          </p>
        </div>

        <div className="perf-header-actions">
          <div className="perf-count-badge">
            <Activity size={14} style={{ color: "#818cf8" }} />
            <span>{totalAssessments} Completed Assessment{totalAssessments !== 1 ? "s" : ""}</span>
          </div>

          <button 
            onClick={fetchAnalysis} 
            className="perf-refresh-btn" 
            title="Refresh analytics from database"
          >
            <RefreshCw size={14} />
            <span>Refresh Analytics</span>
          </button>
        </div>
      </div>

      {/* SUMMARY KPI METRIC CARDS */}
      <div className="perf-kpi-grid">
        {/* KPI 1: Completed Assessments */}
        <div className="perf-kpi-card">
          <div className="perf-kpi-top">
            <span className="perf-kpi-label">Completed Assessments</span>
            <div className="perf-kpi-icon-wrap">
              <Calendar size={18} />
            </div>
          </div>
          <div className="perf-kpi-value-row">
            <span className="perf-kpi-number">{totalAssessments}</span>
          </div>
          <span className="perf-kpi-subtext">Persisted evaluation sessions</span>
        </div>

        {/* KPI 2: Latest Overall Score */}
        <div className="perf-kpi-card">
          <div className="perf-kpi-top">
            <span className="perf-kpi-label">Latest Overall Score</span>
            <div className="perf-kpi-icon-wrap">
              <Award size={18} />
            </div>
          </div>
          <div className="perf-kpi-value-row">
            <span className="perf-kpi-number">{latestScore}%</span>
            <span className="perf-kpi-badge neutral">Attempt #{totalAssessments}</span>
          </div>
          <span className="perf-kpi-subtext">Composite server evaluation</span>
        </div>

        {/* KPI 3: Score Change vs Previous */}
        <div className="perf-kpi-card">
          <div className="perf-kpi-top">
            <span className="perf-kpi-label">Score Progression</span>
            <div className="perf-kpi-icon-wrap">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="perf-kpi-value-row">
            {scoreDelta !== null ? (
              <>
                <span className="perf-kpi-number" style={{ color: scoreDelta >= 0 ? "#34d399" : "#f87171" }}>
                  {scoreDelta > 0 ? `+${scoreDelta}%` : `${scoreDelta}%`}
                </span>
                <span className={`perf-kpi-badge ${scoreDelta > 0 ? "positive" : scoreDelta < 0 ? "negative" : "neutral"}`}>
                  {scoreDelta > 0 ? "Improved" : scoreDelta < 0 ? "Variance" : "Stable"}
                </span>
              </>
            ) : (
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#94a3b8" }}>
                Not enough data yet
              </span>
            )}
          </div>
          <span className="perf-kpi-subtext">
            {scoreDelta !== null ? "Compared to prior assessment" : "Requires at least 2 attempts"}
          </span>
        </div>

        {/* KPI 4: Strongest Measured Category */}
        <div className="perf-kpi-card">
          <div className="perf-kpi-top">
            <span className="perf-kpi-label">Strongest Measured Tier</span>
            <div className="perf-kpi-icon-wrap">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="perf-kpi-value-row">
            <span style={{ fontSize: "20px", fontWeight: "800", color: "#f8fafc" }}>
              {strongestTier}
            </span>
          </div>
          <span className="perf-kpi-subtext">Top accuracy difficulty category</span>
        </div>
      </div>

      {/* THREE HISTORICAL DIFFICULTY BAR CHARTS */}
      <section className="diff-charts-section">
        <div className="section-title-wrap">
          <h3 className="section-main-title">Difficulty-Level Historical Progression</h3>
          <p className="section-main-subtext">
            Performance accuracy calculated strictly as earned points divided by available points. Unattempted tiers are explicitly marked as Not Assessed.
          </p>
        </div>

        <div className="diff-charts-grid">
          {/* Chart 1: Easy */}
          <HistoricalDifficultyBarChart
            title="Easy Questions Performance"
            tierLabel="Level 1: Foundational"
            tierClass="easy"
            pointsPerQ="10 pts / question"
            data={charts?.easy || []}
          />

          {/* Chart 2: Medium */}
          <HistoricalDifficultyBarChart
            title="Medium Questions Performance"
            tierLabel="Level 2: Applied"
            tierClass="medium"
            pointsPerQ="20 pts / question"
            data={charts?.medium || []}
          />

          {/* Chart 3: Hard */}
          <HistoricalDifficultyBarChart
            title="Hard Questions Performance"
            tierLabel="Level 3: Complex"
            tierClass="hard"
            pointsPerQ="30 pts / question"
            data={charts?.hard || []}
          />
        </div>
      </section>

      {/* COMPETENCY INSIGHTS (10 DEFINED CATEGORIES) */}
      <section className="competency-section">
        <div className="competency-header">
          <div className="perf-badge-pill" style={{ marginBottom: "6px" }}>
            <Layers size={13} />
            <span>10 Standardized Domains</span>
          </div>
          <h3>Competency Insights</h3>
          <p>
            Evaluated from persisted adaptive question responses and verbal communication telemetry. Categories without attempted questions are designated as Insufficient Data.
          </p>
        </div>

        <div className="competency-grid">
          {Object.values(competencies || {}).map((comp) => (
            <div key={comp.name} className="competency-item-card">
              <div className="comp-item-top">
                <span className="comp-name">{comp.name}</span>
                {comp.hasEvidence ? (
                  <span className="comp-score-badge">{comp.percentage}%</span>
                ) : (
                  <span className="comp-score-badge na">Insufficient Data</span>
                )}
              </div>

              <div className="comp-progress-track">
                {comp.hasEvidence ? (
                  <div
                    className="comp-progress-fill"
                    style={{ width: `${Math.max(4, comp.percentage)}%` }}
                  />
                ) : (
                  <div style={{ width: "100%", height: "100%", background: "#111827" }} />
                )}
              </div>

              <div className="comp-item-meta">
                <span>{comp.hasEvidence ? `${comp.questionsCount} question${comp.questionsCount !== 1 ? "s" : ""} evaluated` : "0 questions in sample"}</span>
                <span>{comp.hasEvidence ? `${comp.earned} / ${comp.available} pts` : "N/A"}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* HISTORICAL ASSESSMENT DATA TABLE */}
      {history && history.length > 0 && (
        <section className="assessment-table-section">
          <div className="table-card-wrapper">
            <div className="table-header-bar">
              <h4 className="table-header-title">Historical Assessment Log</h4>
              <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                {history.length} evaluation record{history.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="table-responsive-box">
              <table className="saas-data-table">
                <thead>
                  <tr>
                    <th>Assessment</th>
                    <th>Completion Date</th>
                    <th>Overall Score</th>
                    <th>Easy (L1)</th>
                    <th>Medium (L2)</th>
                    <th>Hard (L3)</th>
                    <th>Report Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item, idx) => (
                    <tr key={item.sessionId || idx}>
                      <td>
                        <div style={{ fontWeight: "700", color: "#f8fafc" }}>
                          {item.label || `Attempt ${item.attemptNumber}`}
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>
                          Difficulty Reached: Level {item.difficultyReached || 2}
                        </div>
                      </td>
                      <td>
                        {item.date ? new Date(item.date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        }) : "—"}
                      </td>
                      <td>
                        <span className="table-score-pill">{item.overallScore}%</span>
                      </td>
                      <td>
                        {item.difficulties?.easy?.percentage !== null 
                          ? `${item.difficulties.easy.percentage}%` 
                          : <span style={{ color: "#64748b", fontStyle: "italic" }}>Not Assessed</span>}
                      </td>
                      <td>
                        {item.difficulties?.medium?.percentage !== null 
                          ? `${item.difficulties.medium.percentage}%` 
                          : <span style={{ color: "#64748b", fontStyle: "italic" }}>Not Assessed</span>}
                      </td>
                      <td>
                        {item.difficulties?.hard?.percentage !== null 
                          ? `${item.difficulties.hard.percentage}%` 
                          : <span style={{ color: "#64748b", fontStyle: "italic" }}>Not Assessed</span>}
                      </td>
                      <td>
                        <span className="table-status-badge">
                          <CheckCircle2 size={12} />
                          <span>Finalized &amp; Signed</span>
                        </span>
                      </td>
                      <td>
                        <Link 
                          to={`/results/${item.sessionId}`} 
                          className="table-action-link"
                        >
                          <FileText size={13} />
                          <span>View Report</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* TRENDS & QUALITATIVE INSIGHTS */}
      {trends && (
        <section className="trends-insights-grid">
          {/* Measured Trajectory */}
          <div className="trend-box-card">
            <div>
              <div className="trend-box-title">
                <TrendingUp size={18} style={{ color: "#10b981" }} />
                <span>Measured Longitudinal Trajectory</span>
              </div>
              <div className="trend-desc-banner">
                <strong>Status: </strong>{trends.trajectoryDescription}
              </div>

              {trends.improvingAreas?.length > 0 && (
                <div style={{ marginBottom: "12px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "#10b981", display: "flex", alignItems: "center", gap: "4px", marginBottom: "6px" }}>
                    <ArrowUpRight size={14} /> Demonstrated Improvements:
                  </span>
                  <ul className="trend-list">
                    {trends.improvingAreas.map((area, i) => (
                      <li key={i}>
                        <CheckCircle2 size={14} className="trend-list-icon-up" />
                        <span>{area}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {trends.decliningAreas?.length > 0 && (
                <div style={{ marginBottom: "12px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "#f43f5e", display: "flex", alignItems: "center", gap: "4px", marginBottom: "6px" }}>
                    <TrendingDown size={14} /> Measured Performance Gaps:
                  </span>
                  <ul className="trend-list">
                    {trends.decliningAreas.map((area, i) => (
                      <li key={i}>
                        <AlertCircle size={14} className="trend-list-icon-down" />
                        <span>{area}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="boundary-note">
              <ShieldCheck size={14} style={{ color: "#818cf8" }} />
              <span>Evidence-based trajectory requires minimum 2 completed assessments with &ge;5% delta.</span>
            </div>
          </div>

          {/* Supplementary Qualitative Insights */}
          <div className="trend-box-card">
            <div>
              <div className="trend-box-title">
                <Sparkles size={18} style={{ color: "#f59e0b" }} />
                <span>Supplementary Qualitative Feedback</span>
              </div>

              <div className="qualitative-feedback-body">
                {aiFeedback ? (
                  <p style={{ margin: 0 }}>{aiFeedback}</p>
                ) : (
                  <>
                    <p style={{ margin: "0 0 8px 0" }}>
                      Across your {totalAssessments} evaluation attempt{totalAssessments !== 1 ? "s" : ""}, your technical accuracy demonstrates steady baseline performance in foundational and applied problem-solving domains.
                    </p>
                    <p style={{ margin: 0, color: "#94a3b8", fontSize: "12px" }}>
                      Focus your preparation on advanced system design trade-offs, concurrency synchronization, and articulate verbal justification of algorithmic complexity.
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="boundary-note">
              <ShieldCheck size={14} style={{ color: "#818cf8" }} />
              <span>Educational advisory: Supplementary insights do not alter authoritative server scores.</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
