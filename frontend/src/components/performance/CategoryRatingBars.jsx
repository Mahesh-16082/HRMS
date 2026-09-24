export default function CategoryRatingBars({ ratings = [], reviewPeriod = null, title = "Performance Parameters" }) {
  if (!Array.isArray(ratings) || ratings.length === 0) {
    return (
      <div className="perf-params-card">
        <div className="perf-params-header">
          <h3 className="perf-params-title">{title}</h3>
          {reviewPeriod && <span className="perf-params-period">{reviewPeriod}</span>}
        </div>
        <div className="perf-params-empty">
          <p>No category ratings recorded for this review.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="perf-params-card">
      <div className="perf-params-header">
        <div>
          <h3 className="perf-params-title">{title}</h3>
          {reviewPeriod && <span className="perf-params-period">Evaluation Period: {reviewPeriod}</span>}
        </div>
        <span className="perf-params-count">{ratings.length} parameter{ratings.length > 1 ? "s" : ""}</span>
      </div>

      <div className="perf-params-grid">
        {ratings.map((cat, idx) => {
          const score = typeof cat.rating === "number" ? cat.rating : 0;
          const percentage = Math.min(100, Math.max(0, (score / 5) * 100));

          return (
            <div key={cat.id || cat.category || idx} className="perf-param-row-clean">
              <div className="perf-param-info-row">
                <span className="perf-param-name">{cat.category}</span>
                <span className="perf-param-score-badge">
                  <strong>{score}</strong> / 5
                </span>
              </div>

              {/* Progress bar */}
              <div className="perf-param-bar-bg" role="progressbar" aria-valuenow={score} aria-valuemin="1" aria-valuemax="5">
                <div
                  className="perf-param-bar-fill"
                  style={{ width: `${percentage}%` }}
                />
              </div>

              {cat.comments && (
                <div className="perf-param-comment">
                  <span>Note:</span> {cat.comments}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
