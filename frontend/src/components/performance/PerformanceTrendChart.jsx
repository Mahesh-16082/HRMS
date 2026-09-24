import { useState } from "react";

export default function PerformanceTrendChart({ trend = [], title = "Overall Performance Trend" }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Filter out any points that don't have an authoritative overall_rating
  const validPoints = (Array.isArray(trend) ? trend : []).filter(
    (item) => typeof item?.overall_rating === "number" && !isNaN(item.overall_rating)
  );

  if (validPoints.length === 0) {
    return (
      <div className="perf-chart-card">
        <div className="perf-chart-header">
          <h3 className="perf-chart-title">{title}</h3>
          <span className="perf-chart-badge">1.0 – 5.0 Scale</span>
        </div>
        <div className="perf-chart-empty">
          <p>No completed review trend data available yet.</p>
        </div>
      </div>
    );
  }

  // Chart dimensions in viewBox coordinates
  const width = 720;
  const height = 260;
  const padding = { top: 30, right: 40, bottom: 50, left: 50 };

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  // Y-axis: 1.0 to 5.0
  const minY = 1.0;
  const maxY = 5.0;

  const getY = (rating) => {
    const clamped = Math.max(minY, Math.min(maxY, rating));
    const ratio = (clamped - minY) / (maxY - minY);
    return padding.top + (1 - ratio) * plotHeight;
  };

  const getX = (index, total) => {
    if (total <= 1) {
      return padding.left + plotWidth / 2;
    }
    return padding.left + (index / (total - 1)) * plotWidth;
  };

  // Build coordinate points
  const points = validPoints.map((item, index) => {
    const x = getX(index, validPoints.length);
    const y = getY(item.overall_rating);
    return { ...item, x, y, index };
  });

  // SVG Line path
  const linePath = points.length === 1
    ? `M ${points[0].x - 30} ${points[0].y} L ${points[0].x + 30} ${points[0].y}`
    : points.reduce((acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`, "");

  // SVG Area path for smooth gradient below the line
  const areaPath = points.length === 1
    ? `M ${points[0].x - 30} ${points[0].y} L ${points[0].x + 30} ${points[0].y} L ${points[0].x + 30} ${height - padding.bottom} L ${points[0].x - 30} ${height - padding.bottom} Z`
    : `${linePath} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`;

  // Grid tick marks on Y-axis (1 to 5)
  const yTicks = [1.0, 2.0, 3.0, 4.0, 5.0];

  return (
    <div className="perf-chart-card">
      <div className="perf-chart-header">
        <div>
          <h3 className="perf-chart-title">{title}</h3>
          <span className="perf-chart-subtitle">
            Showing {validPoints.length} completed review{validPoints.length > 1 ? "s" : ""}
          </span>
        </div>
        <div className="perf-chart-legend">
          <span className="perf-legend-dot" />
          <span>Authoritative Rating (1.0 – 5.0)</span>
        </div>
      </div>

      <div className="perf-chart-svg-wrapper">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="perf-trend-svg"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="perfAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.32" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
            </linearGradient>
            <filter id="perfGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="var(--primary)" floodOpacity="0.35" />
            </filter>
          </defs>

          {/* Horizontal Grid lines & Y-axis labels */}
          {yTicks.map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick} className="perf-grid-group">
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  className="perf-grid-line"
                  stroke="var(--border-subtle)"
                  strokeDasharray={tick === 1.0 ? "none" : "3,3"}
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 12}
                  y={y + 4}
                  textAnchor="end"
                  className="perf-axis-label"
                >
                  {tick.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Shaded area under the line */}
          <path d={areaPath} fill="url(#perfAreaGradient)" />

          {/* Main trend line */}
          <path
            d={linePath}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#perfGlow)"
          />

          {/* Data Points */}
          {points.map((pt) => {
            const isHovered = hoveredPoint?.review_id === pt.review_id;
            return (
              <g
                key={pt.review_id || pt.index}
                className="perf-point-group"
                onMouseEnter={() => setHoveredPoint(pt)}
                onMouseLeave={() => setHoveredPoint(null)}
                tabIndex="0"
                role="button"
                aria-label={`Review ${pt.review_period}: ${pt.overall_rating} out of 5`}
              >
                {/* Invisible hit area for easier mouse/touch interaction */}
                <circle cx={pt.x} cy={pt.y} r="18" fill="transparent" />

                {/* Outer ring */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? "8" : "5.5"}
                  fill="var(--bg-card)"
                  stroke="var(--primary)"
                  strokeWidth="3"
                  className="perf-point-circle"
                />

                {/* Point center dot */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="2.5"
                  fill="var(--primary)"
                />

                {/* X-axis text label */}
                <text
                  x={pt.x}
                  y={height - padding.bottom + 22}
                  textAnchor="middle"
                  className={`perf-x-label ${isHovered ? "active" : ""}`}
                >
                  {pt.review_period || pt.review_date}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip */}
        {hoveredPoint && (
          <div
            className="perf-tooltip"
            style={{
              left: `${(hoveredPoint.x / width) * 100}%`,
              top: `${(hoveredPoint.y / height) * 100}%`,
            }}
          >
            <div className="perf-tooltip-period">
              {hoveredPoint.review_period}
            </div>
            {hoveredPoint.title && (
              <div className="perf-tooltip-title">{hoveredPoint.title}</div>
            )}
            <div className="perf-tooltip-rating">
              Overall Rating: <strong>{hoveredPoint.overall_rating} / 5</strong>
            </div>
            {hoveredPoint.review_date && (
              <div className="perf-tooltip-date">
                Date: {hoveredPoint.review_date}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
