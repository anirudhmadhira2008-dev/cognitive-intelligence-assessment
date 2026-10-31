import React, { useState } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  Award, 
  Activity, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  Sparkles,
  CheckCircle2,
  Minus
} from "lucide-react";

/**
 * AssessmentProgressionChart
 * Visualizes longitudinal assessment performance trends across multiple test attempts.
 * Compares current attempt against previous attempts with comparative delta analytics.
 */
export default function AssessmentProgressionChart({ sessions = [] }) {
  const [selectedMetric, setSelectedMetric] = useState("readiness");
  const [hoveredPoint, setHoveredPoint] = useState(null);

  if (!sessions || sessions.length === 0) {
    return null;
  }

  // Filter completed or submitted sessions with report data
  const validSessions = sessions
    .filter((s) => s.report && typeof s.report === "object")
    // Sort chronologically (oldest to newest for the timeline progression)
    .sort((a, b) => new Date(a.completedAt || a.createdAt) - new Date(b.completedAt || b.createdAt));

  if (validSessions.length === 0) {
    return null;
  }

  // Available metrics configuration
  const metricsConfig = {
    readiness: {
      label: "Interview Readiness",
      color: "#6366f1", // Indigo
      gradientStart: "rgba(99, 102, 241, 0.35)",
      gradientEnd: "rgba(99, 102, 241, 0.0)",
      getValue: (s) => Number(s.report?.readiness ?? 0)
    },
    knowledge: {
      label: "Technical Knowledge",
      color: "#3b82f6", // Blue
      gradientStart: "rgba(59, 130, 246, 0.35)",
      gradientEnd: "rgba(59, 130, 246, 0.0)",
      getValue: (s) => Number(s.report?.knowledge ?? 0)
    },
    reasoning: {
      label: "Analytical Reasoning",
      color: "#8b5cf6", // Purple
      gradientStart: "rgba(139, 92, 246, 0.35)",
      gradientEnd: "rgba(139, 92, 246, 0.0)",
      getValue: (s) => Number(s.report?.reasoning ?? 0)
    },
    communication: {
      label: "Verbal Communication",
      color: "#10b981", // Emerald
      gradientStart: "rgba(16, 185, 129, 0.35)",
      gradientEnd: "rgba(16, 185, 129, 0.0)",
      getValue: (s) => Number(s.report?.communication ?? 0)
    },
    integrity: {
      label: "Integrity Confidence",
      color: "#06b6d4", // Cyan
      gradientStart: "rgba(6, 182, 212, 0.35)",
      gradientEnd: "rgba(6, 182, 212, 0.0)",
      getValue: (s) => Number(s.report?.integrity ?? 100)
    }
  };

  const activeConfig = metricsConfig[selectedMetric] || metricsConfig.readiness;

  // Extract data points
  const dataPoints = validSessions.map((session, index) => {
    const value = Math.max(0, Math.min(100, activeConfig.getValue(session)));
    const dateObj = new Date(session.completedAt || session.createdAt);
    const dateLabel = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const fullDate = dateObj.toLocaleDateString("en-US", { 
      year: "numeric", 
      month: "short", 
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
    
    return {
      id: session._id || `test-${index}`,
      index: index + 1,
      name: `Test #${index + 1}`,
      role: session.setup?.role || "Software Developer",
      dateLabel,
      fullDate,
      value,
      decision: session.report?.decision || "Recommended",
      raw: session
    };
  });

  // Comparative delta calculations
  const totalTests = dataPoints.length;
  const currentTest = dataPoints[totalTests - 1];
  const previousTest = totalTests > 1 ? dataPoints[totalTests - 2] : null;

  const deltaFromPrevious = previousTest ? currentTest.value - previousTest.value : 0;
  const initialTest = dataPoints[0];
  const totalGrowth = totalTests > 1 ? currentTest.value - initialTest.value : 0;

  const allScores = dataPoints.map((d) => d.value);
  const peakScore = Math.max(...allScores);
  const avgScore = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);

  // SVG Geometry Dimensions
  const svgWidth = 720;
  const svgHeight = 260;
  const padLeft = 48;
  const padRight = 36;
  const padTop = 30;
  const padBottom = 45;

  const chartWidth = svgWidth - padLeft - padRight;
  const chartHeight = svgHeight - padTop - padBottom;

  // Coordinates mapping
  const pointsWithCoords = dataPoints.map((pt, i) => {
    const x = totalTests === 1 
      ? padLeft + chartWidth / 2 
      : padLeft + (i / (totalTests - 1)) * chartWidth;
    const y = padTop + (1 - pt.value / 100) * chartHeight;
    return { ...pt, x, y };
  });

  // Generate smooth SVG path (Catmull-Rom or Bezier curve)
  const generatePath = (points) => {
    if (points.length === 0) return "";
    if (points.length === 1) {
      return `M ${points[0].x - 20} ${points[0].y} L ${points[0].x + 20} ${points[0].y}`;
    }

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i > 0 ? points[i - 1] : points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i != points.length - 2 ? points[i + 2] : p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;

      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  };

  const linePath = generatePath(pointsWithCoords);

  // Generate area path for gradient under the line
  const areaPath = pointsWithCoords.length > 1
    ? `${linePath} L ${pointsWithCoords[pointsWithCoords.length - 1].x} ${padTop + chartHeight} L ${pointsWithCoords[0].x} ${padTop + chartHeight} Z`
    : "";

  // Grid tick lines
  const gridLevels = [0, 25, 50, 75, 100];

  return (
    <div className="assessment-progression-card">
      {/* Header & Metric Selector */}
      <div className="progression-header">
        <div className="progression-title-area">
          <div className="progression-badge">
            <TrendingUp size={15} />
            <span>Multi-Test Longitudinal Analysis</span>
          </div>
          <h3>Performance Progression &amp; Historical Comparison</h3>
          <p>
            Track cognitive trajectory and skill improvement comparing current test scores to prior attempts.
          </p>
        </div>

        {/* Metric Switcher Pills */}
        <div className="metric-switcher-group">
          {Object.entries(metricsConfig).map(([key, config]) => (
            <button
              key={key}
              type="button"
              className={`metric-switch-pill ${selectedMetric === key ? "active" : ""}`}
              onClick={() => setSelectedMetric(key)}
              style={selectedMetric === key ? { backgroundColor: config.color, borderColor: config.color } : {}}
            >
              {config.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Comparison Summary Row */}
      <div className="progression-kpis-grid">
        <div className="progression-kpi-item">
          <span className="kpi-label">Latest Attempt Score</span>
          <div className="kpi-value-row">
            <strong className="kpi-number" style={{ color: activeConfig.color }}>
              {currentTest.value}%
            </strong>
            <span className="kpi-badge-neutral">{currentTest.name}</span>
          </div>
          <span className="kpi-subtext">Completed {currentTest.dateLabel}</span>
        </div>

        <div className="progression-kpi-item">
          <span className="kpi-label">Delta vs. Previous Test</span>
          <div className="kpi-value-row">
            {totalTests > 1 ? (
              <>
                <strong className={`kpi-number ${deltaFromPrevious > 0 ? "positive" : deltaFromPrevious < 0 ? "negative" : "neutral"}`}>
                  {deltaFromPrevious > 0 ? `+${deltaFromPrevious}%` : `${deltaFromPrevious}%`}
                </strong>
                {deltaFromPrevious > 0 ? (
                  <span className="kpi-badge-success">
                    <ArrowUpRight size={14} /> Improved
                  </span>
                ) : deltaFromPrevious < 0 ? (
                  <span className="kpi-badge-warn">
                    <ArrowDownRight size={14} /> Refine Focus
                  </span>
                ) : (
                  <span className="kpi-badge-neutral">
                    <Minus size={14} /> Stable
                  </span>
                )}
              </>
            ) : (
              <>
                <strong className="kpi-number neutral">0%</strong>
                <span className="kpi-badge-neutral">Baseline Set</span>
              </>
            )}
          </div>
          <span className="kpi-subtext">
            {totalTests > 1 
              ? `${deltaFromPrevious >= 0 ? "Gain" : "Difference"} from ${previousTest.name}` 
              : "Take test #2 to track growth trajectory"}
          </span>
        </div>

        <div className="progression-kpi-item">
          <span className="kpi-label">All-Time Peak</span>
          <div className="kpi-value-row">
            <strong className="kpi-number text-slate-800">{peakScore}%</strong>
            <span className="kpi-badge-peak">
              <Award size={13} /> High Score
            </span>
          </div>
          <span className="kpi-subtext">Across {totalTests} evaluation attempt{totalTests > 1 ? "s" : ""}</span>
        </div>

        <div className="progression-kpi-item">
          <span className="kpi-label">Average Performance</span>
          <div className="kpi-value-row">
            <strong className="kpi-number text-slate-800">{avgScore}%</strong>
            <span className="kpi-badge-neutral">
              <Activity size={13} /> Cohort Avg
            </span>
          </div>
          <span className="kpi-subtext">Historical baseline mean</span>
        </div>
      </div>

      {/* Interactive SVG Chart Container */}
      <div className="chart-viewport-box">
        <svg 
          viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
          className="progression-svg-chart"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="progressionGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={activeConfig.color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={activeConfig.color} stopOpacity="0.0" />
            </linearGradient>
            <filter id="shadowFilter" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor={activeConfig.color} floodOpacity="0.3" />
            </filter>
          </defs>

          {/* Horizontal Grid lines & Y-axis labels */}
          {gridLevels.map((lvl) => {
            const y = padTop + (1 - lvl / 100) * chartHeight;
            return (
              <g key={lvl} className="grid-level-group">
                <line
                  x1={padLeft}
                  y1={y}
                  x2={svgWidth - padRight}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray={lvl === 0 || lvl === 100 ? "none" : "3,4"}
                  strokeWidth={lvl === 0 ? "1.5" : "1"}
                />
                <text
                  x={padLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="#94a3b8"
                  fontWeight="600"
                >
                  {lvl}%
                </text>
              </g>
            );
          })}

          {/* Area gradient under the line */}
          {areaPath && (
            <path
              d={areaPath}
              fill="url(#progressionGradient)"
              className="chart-area-fill"
            />
          )}

          {/* Continuous Trend Line */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={activeConfig.color}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#shadowFilter)"
              className="chart-trend-line"
            />
          )}

          {/* Interactive Data Nodes */}
          {pointsWithCoords.map((pt, i) => {
            const isHovered = hoveredPoint?.id === pt.id;
            const isLatest = i === pointsWithCoords.length - 1;

            return (
              <g 
                key={pt.id} 
                className="chart-node-group"
                onMouseEnter={() => setHoveredPoint(pt)}
                onMouseLeave={() => setHoveredPoint(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Invisible larger hit target for smooth hovering */}
                <circle cx={pt.x} cy={pt.y} r="18" fill="transparent" />

                {/* Outer halo when hovered or for latest point */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 12 : isLatest ? 8 : 6}
                  fill={activeConfig.color}
                  fillOpacity={isHovered ? 0.35 : isLatest ? 0.2 : 0.1}
                  className="node-outer-halo"
                />

                {/* Main node point */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 7 : isLatest ? 6 : 5}
                  fill="#ffffff"
                  stroke={activeConfig.color}
                  strokeWidth="3"
                  className="node-center-circle"
                />

                {/* Score badge directly above point */}
                <text
                  x={pt.x}
                  y={pt.y - 12}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="800"
                  fill={isHovered ? activeConfig.color : "#334155"}
                  className="node-score-label"
                >
                  {pt.value}%
                </text>

                {/* X-axis test label */}
                <text
                  x={pt.x}
                  y={svgHeight - 14}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill={isHovered ? "#0f172a" : "#64748b"}
                >
                  {pt.name}
                </text>

                {/* X-axis date sublabel */}
                <text
                  x={pt.x}
                  y={svgHeight - 2}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="500"
                  fill="#94a3b8"
                >
                  {pt.dateLabel}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && (
          <div 
            className="chart-hover-tooltip"
            style={{
              left: `${(hoveredPoint.x / svgWidth) * 100}%`,
              top: `${(hoveredPoint.y / svgHeight) * 100}%`
            }}
          >
            <div className="tooltip-header">
              <strong>{hoveredPoint.name}</strong>
              <span className="tooltip-date">{hoveredPoint.dateLabel}</span>
            </div>
            <div className="tooltip-body">
              <div className="tooltip-row">
                <span>{activeConfig.label}:</span>
                <strong style={{ color: activeConfig.color }}>{hoveredPoint.value}%</strong>
              </div>
              <div className="tooltip-row">
                <span>Role:</span>
                <span>{hoveredPoint.role}</span>
              </div>
              <div className="tooltip-row">
                <span>Status:</span>
                <span className="tooltip-decision">{hoveredPoint.decision}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Comparative Analytical Takeaway Callout */}
      <div className="progression-footer-summary">
        <div className="footer-summary-icon">
          <Sparkles size={18} className="text-indigo-600" />
        </div>
        <p>
          {totalTests > 1 ? (
            <>
              <strong>Comparative Analysis: </strong> 
              {deltaFromPrevious > 0 ? (
                <span>
                  Candidate demonstrated a <strong>+{deltaFromPrevious}% improvement</strong> in {activeConfig.label} compared to the previous assessment ({previousTest.name}). Overall progression across {totalTests} attempts shows a net gain of <strong>{totalGrowth >= 0 ? `+${totalGrowth}%` : `${totalGrowth}%`}</strong>.
                </span>
              ) : deltaFromPrevious < 0 ? (
                <span>
                  Performance varied by <strong>{deltaFromPrevious}%</strong> from the previous test ({previousTest.name}). Focus on targeted roadmap practice areas to raise consistency back toward peak score ({peakScore}%).
                </span>
              ) : (
                <span>
                  Performance remained consistent with the previous attempt at <strong>{currentTest.value}%</strong> across {totalTests} assessments.
                </span>
              )}
            </>
          ) : (
            <>
              <strong>Baseline Established: </strong>
              <span>
                Initial evaluation recorded at <strong>{currentTest.value}%</strong> {activeConfig.label}. Complete your next assessment to view historical trend curves and automatic comparative growth audits.
              </span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
