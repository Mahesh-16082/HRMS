import { useState, useEffect, useCallback } from "react";
import { getMyPerformanceReviews, getMyPerformanceAnalytics } from "../../api/performanceApi";
import { LoadingState, ErrorAlert } from "../../components/common/FeedbackStates";
import PerformanceTrendChart from "../../components/performance/PerformanceTrendChart";
import CategoryRatingBars from "../../components/performance/CategoryRatingBars";
import {
  PerformanceIcon,
  CalendarIcon,
  CheckCircleIcon,
  TrendingUpIcon,
  TargetIcon,
  MessageSquareIcon,
} from "../../components/icons/Icons";
import "../../styles/performance.css";

export default function EmployeePerformance() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [analytics, setAnalytics] = useState(null);
  const [completedReviews, setCompletedReviews] = useState([]);
  const [selectedReview, setSelectedReview] = useState(null);

  const loadData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      // Fetch both analytics summary and list of reviews
      const [analyticsRes, reviewsRes] = await Promise.all([
        getMyPerformanceAnalytics(),
        getMyPerformanceReviews({ limit: 50 }),
      ]);

      setAnalytics(analyticsRes);

      const reviewsList = Array.isArray(reviewsRes?.reviews) ? reviewsRes.reviews : [];
      const completed = reviewsList.filter((r) => r.status === "COMPLETED");
      setCompletedReviews(completed);

      if (completed.length > 0) {
        setSelectedReview(completed[0]);
      } else {
        setSelectedReview(null);
      }
    } catch (err) {
      console.error("Failed to load employee performance data:", err);
      setError(typeof err?.data?.detail === "string" ? err.data.detail : err.message || "Failed to load performance data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const [analyticsRes, reviewsRes] = await Promise.all([
          getMyPerformanceAnalytics(),
          getMyPerformanceReviews({ limit: 50 }),
        ]);
        if (ignore) return;
        setAnalytics(analyticsRes);

        const reviewsList = Array.isArray(reviewsRes?.reviews) ? reviewsRes.reviews : [];
        const completed = reviewsList.filter((r) => r.status === "COMPLETED");
        setCompletedReviews(completed);

        if (completed.length > 0) {
          setSelectedReview(completed[0]);
        } else {
          setSelectedReview(null);
        }
      } catch (err) {
        if (!ignore) {
          setError(typeof err?.data?.detail === "string" ? err.data.detail : err.message || "Failed to load performance data.");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    init();
    return () => { ignore = true; };
  }, []);

  if (loading) {
    return (
      <div className="page-container perf-page-content">
        <div className="perf-emp-page-header">
          <h1 className="perf-page-title">My Performance</h1>
          <p className="perf-page-subtitle">Track your growth, review feedback, and performance progress.</p>
        </div>
        <LoadingState message="Loading your performance evaluation..." />
      </div>
    );
  }

  // Authoritative latest rating from backend (or null if no completed reviews)
  const latestRating = analytics?.latest_rating ?? (completedReviews[0]?.overall_rating ?? null);
  const trendData = Array.isArray(analytics?.trend) && analytics.trend.length > 0
    ? analytics.trend
    : completedReviews.map((r) => ({
        review_id: r.id,
        review_date: r.review_date,
        review_period: r.review_period,
        overall_rating: r.overall_rating,
        title: r.title,
      }));

  // Growth trend calculation
  const growthTrendVal = trendData.length >= 2
    ? (() => {
        const diff = trendData[trendData.length - 1].overall_rating - trendData[0].overall_rating;
        return `${diff >= 0 ? "+" : ""}${diff.toFixed(1)} pts`;
      })()
    : "—";

  return (
    <div className="page-container perf-page-content">
      {/* 1. Header */}
      <div className="perf-emp-page-header">
        <h1 className="perf-page-title">My Performance</h1>
        <p className="perf-page-subtitle">
          Track your growth, review feedback, and performance progress.
        </p>
      </div>

      {error && <ErrorAlert message={error} onRetry={loadData} />}

      {/* 2. Compact 4-Column Summary Area */}
      <div className="perf-summary-grid">
        <div className="perf-summary-card">
          <div className="perf-summary-card-header">
            <span className="perf-summary-card-label">Overall Rating</span>
            <div className="perf-summary-card-icon icon-purple">
              <PerformanceIcon size={16} />
            </div>
          </div>
          <div className="perf-summary-card-body">
            <div className="perf-summary-card-val">
              {latestRating !== null ? `${latestRating} / 5.0` : "Not rated yet"}
            </div>
            <div className="perf-summary-card-sub">
              {latestRating !== null
                ? `From ${completedReviews[0]?.review_period || "Latest Review"}`
                : "Based on completed reviews"}
            </div>
          </div>
        </div>

        <div className="perf-summary-card">
          <div className="perf-summary-card-header">
            <span className="perf-summary-card-label">Completed Reviews</span>
            <div className="perf-summary-card-icon icon-green">
              <CheckCircleIcon size={16} />
            </div>
          </div>
          <div className="perf-summary-card-body">
            <div className="perf-summary-card-val">{completedReviews.length}</div>
            <div className="perf-summary-card-sub">Total completed reviews</div>
          </div>
        </div>

        <div className="perf-summary-card">
          <div className="perf-summary-card-header">
            <span className="perf-summary-card-label">Active Goals</span>
            <div className="perf-summary-card-icon icon-orange">
              <TargetIcon size={16} />
            </div>
          </div>
          <div className="perf-summary-card-body">
            <div className="perf-summary-card-val">{analytics?.active_goals ?? 0}</div>
            <div className="perf-summary-card-sub">Goals in progress</div>
          </div>
        </div>

        <div className="perf-summary-card">
          <div className="perf-summary-card-header">
            <span className="perf-summary-card-label">Growth Trend</span>
            <div className="perf-summary-card-icon icon-blue">
              <TrendingUpIcon size={16} />
            </div>
          </div>
          <div className="perf-summary-card-body">
            <div className="perf-summary-card-val">{growthTrendVal}</div>
            <div className="perf-summary-card-sub">
              {trendData.length >= 2 ? "Across evaluations" : "Not enough data yet"}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Balanced 2-Column Main Section */}
      <div className="perf-overview-two-col">
        {/* LEFT COLUMN: Performance Timeline */}
        <div className="perf-balanced-col-card">
          <div className="perf-col-card-header">
            <h3 className="perf-col-card-title">Performance Timeline</h3>
            <span className="perf-col-card-badge">1.0 – 5.0 Scale</span>
          </div>

          <div className="perf-col-card-body">
            {trendData.length > 0 ? (
              <PerformanceTrendChart
                trend={trendData}
                title="Performance Trajectory"
              />
            ) : (
              <div className="perf-compact-empty-state">
                <div className="perf-empty-icon-wrap icon-purple">
                  <TrendingUpIcon size={24} />
                </div>
                <h4 className="perf-empty-title">No performance data available yet.</h4>
                <p className="perf-empty-desc">
                  Your performance trend will appear here after reviews are completed.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Recent Feedback */}
        <div className="perf-balanced-col-card">
          <div className="perf-col-card-header">
            <h3 className="perf-col-card-title">Recent Feedback</h3>
            {completedReviews.length > 0 && (
              <span className="perf-col-card-badge">
                {selectedReview?.review_period || "Latest"}
              </span>
            )}
          </div>

          <div className="perf-col-card-body">
            {selectedReview?.comments ? (
              <div className="perf-feedback-display-wrap">
                <div className="perf-feedback-card-inner">
                  <div className="perf-feedback-meta">
                    <span className="perf-feedback-reviewer">HR Evaluator</span>
                    <span className="perf-feedback-period">{selectedReview.review_period}</span>
                  </div>
                  <p className="perf-feedback-text">"{selectedReview.comments}"</p>
                </div>

                {Array.isArray(selectedReview.ratings) && selectedReview.ratings.length > 0 && (
                  <div className="perf-feedback-params-summary">
                    <span className="perf-feedback-params-title">
                      Score: {selectedReview.overall_rating} / 5
                    </span>
                    <div className="perf-feedback-mini-tags">
                      {selectedReview.ratings.slice(0, 4).map((r, i) => (
                        <span key={i} className="perf-mini-tag">
                          {r.category}: <strong>{r.rating}/5</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : completedReviews.length > 0 ? (
              <div className="perf-feedback-display-wrap">
                <div className="perf-feedback-card-inner">
                  <p className="perf-feedback-text" style={{ fontStyle: "italic", color: "var(--text-muted)" }}>
                    No narrative remarks were recorded for this evaluation. All parameter ratings are available below.
                  </p>
                </div>
              </div>
            ) : (
              <div className="perf-compact-empty-state">
                <div className="perf-empty-icon-wrap icon-orange">
                  <MessageSquareIcon size={24} />
                </div>
                <h4 className="perf-empty-title">No feedback available yet.</h4>
                <p className="perf-empty-desc">
                  Feedback from your performance reviews will appear here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. When Performance Data Exists: Parameters Breakdown & History */}
      {completedReviews.length > 0 && (
        <div className="perf-details-section">
          {/* Quick Review Selector (if multiple reviews) */}
          {completedReviews.length > 1 && (
            <div className="perf-review-quick-pills">
              <span className="perf-quick-pills-label">
                Select Review:
              </span>
              {completedReviews.map((rev) => (
                <button
                  key={rev.id}
                  type="button"
                  className={`perf-quick-pill ${selectedReview?.id === rev.id ? "active" : ""}`}
                  onClick={() => setSelectedReview(rev)}
                >
                  <span>{rev.review_period}</span>
                  <span className="perf-pill-score">{rev.overall_rating} / 5</span>
                </button>
              ))}
            </div>
          )}

          {/* Clean Parameter Breakdown */}
          <CategoryRatingBars
            ratings={selectedReview?.ratings || []}
            reviewPeriod={selectedReview?.review_period}
            title={`Performance Parameters (${selectedReview?.review_period || "Latest"})`}
          />

          {/* Performance History Table */}
          <div className="perf-history-card">
            <div className="perf-history-header">
              <h3 className="perf-history-title">Performance History</h3>
              <span className="perf-history-subtitle">Inspect parameter breakdowns from past evaluations</span>
            </div>

            <div className="perf-history-table-wrapper">
              <table className="data-table perf-table">
                <thead>
                  <tr>
                    <th>Review Period</th>
                    <th>Review Date</th>
                    <th>Title</th>
                    <th>Overall Rating</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {completedReviews.map((rev) => {
                    const isSelected = selectedReview?.id === rev.id;
                    return (
                      <tr
                        key={rev.id}
                        className={`perf-history-row ${isSelected ? "selected" : ""}`}
                        onClick={() => setSelectedReview(rev)}
                      >
                        <td><strong>{rev.review_period}</strong></td>
                        <td>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <CalendarIcon size={14} /> {rev.review_date}
                          </span>
                        </td>
                        <td>{rev.title || "Evaluation"}</td>
                        <td>
                          <span className="perf-rating-pill">
                            {rev.overall_rating !== null ? `${rev.overall_rating} / 5` : "N/A"}
                          </span>
                        </td>
                        <td>
                          <span className="status-badge status-approved">
                            COMPLETED
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`btn btn-sm ${isSelected ? "btn-primary" : "btn-secondary"}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedReview(rev);
                            }}
                          >
                            {isSelected ? "Viewing" : "View Breakdown"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
