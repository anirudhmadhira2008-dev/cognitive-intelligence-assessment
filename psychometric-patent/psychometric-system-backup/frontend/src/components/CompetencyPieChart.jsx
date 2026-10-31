import React, { useState } from "react";
import { PieChart, Sparkles } from "lucide-react";

/**
 * CompetencyPieChart - Interactive SVG Donut / Pie Chart
 * Visualizes multimodal psychometric competency distribution
 */
export default function CompetencyPieChart({ metrics = [] }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  // Filter valid metrics with positive values
  const validMetrics = metrics.filter((m) => typeof m.value === "number" && m.value >= 0);
  const totalValue = validMetrics.reduce((sum, m) => sum + Math.max(1, m.value), 0);
  const avgScore = validMetrics.length 
    ? Math.round(validMetrics.reduce((sum, m) => sum + m.value, 0) / validMetrics.length) 
    : 0;

  // Preset hex colors for professional display
  const colorMap = {
    blue: "#3b82f6",
    indigo: "#6366f1",
    purple: "#a855f7",
    emerald: "#10b981",
    teal: "#14b8a6",
    amber: "#f59e0b",
    cyan: "#06b6d4",
    rose: "#f43f5e"
  };

  // Compute donut chart geometry
  const cx = 130;
  const cy = 130;
  const outerR = 105;
  const innerR = 68;

  let currentAngle = -Math.PI / 2; // Start from top (12 o'clock)

  const slices = validMetrics.map((m, idx) => {
    const fraction = Math.max(1, m.value) / (totalValue || 1);
    const sliceAngle = fraction * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;

    const isHovered = hoveredIdx === idx;
    const rOuter = isHovered ? outerR + 5 : outerR;
    const rInner = isHovered ? innerR - 2 : innerR;

    // SVG coordinates
    const x1 = cx + rOuter * Math.cos(startAngle);
    const y1 = cy + rOuter * Math.sin(startAngle);
    const x2 = cx + rOuter * Math.cos(endAngle);
    const y2 = cy + rOuter * Math.sin(endAngle);

    const x3 = cx + rInner * Math.cos(endAngle);
    const y3 = cy + rInner * Math.sin(endAngle);
    const x4 = cx + rInner * Math.cos(startAngle);
    const y4 = cy + rInner * Math.sin(startAngle);

    const largeArc = sliceAngle > Math.PI ? 1 : 0;
    const pathData = [
      `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
      `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
      `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
      "Z"
    ].join(" ");

    const sliceColor = colorMap[m.color] || m.color || "#6366f1";

    return {
      ...m,
      idx,
      fraction,
      pathData,
      sliceColor,
      isHovered
    };
  });

  const activeSlice = hoveredIdx !== null ? slices[hoveredIdx] : null;

  return (
    <div className="chart-section-card">
      <div className="chart-section-header">
        <div className="chart-header-left">
          <PieChart size={22} className="text-indigo-500" />
          <h3>Competency Proportion & Skill Balance</h3>
        </div>
        <span className="chart-header-pill">
          <Sparkles size={12} style={{ display: "inline", marginRight: 4 }} />
          Normalized Multimodal Distribution
        </span>
      </div>

      <div className="pie-chart-layout">
        {/* SVG Donut Chart */}
        <div className="pie-chart-wrapper">
          <svg width="260" height="260" viewBox="0 0 260 260">
            <defs>
              <filter id="pieShadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
              </filter>
            </defs>

            {slices.map((slice) => (
              <path
                key={slice.label}
                d={slice.pathData}
                fill={slice.sliceColor}
                stroke="#ffffff"
                strokeWidth={slice.isHovered ? "2.5" : "1.5"}
                opacity={hoveredIdx === null || slice.isHovered ? 1 : 0.65}
                filter={slice.isHovered ? "url(#pieShadow)" : undefined}
                style={{
                  cursor: "pointer",
                  transition: "opacity 0.2s ease, stroke-width 0.2s ease"
                }}
                onMouseEnter={() => setHoveredIdx(slice.idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            ))}
          </svg>

          {/* Center Callout */}
          <div className="pie-center-label">
            {activeSlice ? (
              <>
                <span className="pie-center-value" style={{ color: activeSlice.sliceColor }}>
                  {activeSlice.value}%
                </span>
                <span className="pie-center-sub">{activeSlice.label.split(" ")[0]}</span>
              </>
            ) : (
              <>
                <span className="pie-center-value">{avgScore}%</span>
                <span className="pie-center-sub">Avg Competency</span>
              </>
            )}
          </div>
        </div>

        {/* Legend Grid */}
        <div className="pie-legend-grid">
          {slices.map((slice) => (
            <div
              key={slice.label}
              className={`pie-legend-card ${slice.isHovered ? "is-active" : ""}`}
              onMouseEnter={() => setHoveredIdx(slice.idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div className="legend-left">
                <span
                  className="legend-color-dot"
                  style={{ backgroundColor: slice.sliceColor }}
                />
                <span className="legend-label-text">{slice.label}</span>
              </div>
              <span className="legend-score-val">{slice.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
