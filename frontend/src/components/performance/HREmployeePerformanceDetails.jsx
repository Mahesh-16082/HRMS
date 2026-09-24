import { useState, useEffect, useCallback } from "react";
import { getHRPerformanceReviews, deletePerformanceReview } from "../../api/performanceApi";
import PerformanceTrendChart from "./PerformanceTrendChart";
import CategoryRatingBars from "./CategoryRatingBars";
import PerformanceReviewModal from "./PerformanceReviewModal";
import { LoadingState, ErrorAlert } from "../common/FeedbackStates";
import {
  PerformanceIcon,
  CalendarIcon,
  ChevronLeft,
  PlusIcon,
  EditIcon,
  TrashIcon,
  CheckCircleIcon,
  ClockIcon,
  TrendingUpIcon,
} from "../icons/Icons";

export default function HREmployeePerformanceDetails({
  employee,
  onBack,
  onReviewUpdated,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [completedReviews, setCompletedReviews] = useState([]);
  const [draftReviews, setDraftReviews] = useState([]);
  const [selectedCompletedReview, setSelectedCompletedReview] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDraftReview, setEditingDraftReview] = useState(null);
  const [draftToDelete, setDraftToDelete] = useState(null);
  const [deletingDraft, setDeletingDraft] = useState(false);

  const employeeId = employee?.id;

  const loadEmployeeReviews = useCallback(async (showLoading = false) => {
    if (!employeeId) return;
    if (showLoading) setLoading(true);
    setError("");
    try {
      const res = await getHRPerformanceReviews({
        employee_id: employeeId,
        limit: 100,
      });

      const list = Array.isArray(res?.reviews) ? res.reviews : [];

      const completed = list.filter((r) => r.status === "COMPLETED");
      const drafts = list.filter((r) => r.status === "DRAFT");

      setCompletedReviews(completed);
      setDraftReviews(drafts);

      if (completed.length > 0) {
        setSelectedCompletedReview(completed[0]);
      } else {
        setSelectedCompletedReview(null);
      }
    } catch (err) {
      console.error("Failed to load employee performance reviews:", err);
      setError(typeof err?.data?.detail === "string" ? err.data.detail : err.message || "Failed to load employee reviews.");
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    let ignore = false;
    async function init() {
      if (!employeeId) return;
      try {
        const res = await getHRPerformanceReviews({
          employee_id: employeeId,
          limit: 100,
        });
        if (ignore) return;
        const list = Array.isArray(res?.reviews) ? res.reviews : [];
        const completed = list.filter((r) => r.status === "COMPLETED");
        const drafts = list.filter((r) => r.status === "DRAFT");
        setCompletedReviews(completed);
        setDraftReviews(drafts);
        if (completed.length > 0) {
          setSelectedCompletedReview(completed[0]);
        } else {
          setSelectedCompletedReview(null);
        }
      } catch (err) {
        if (!ignore) {
          setError(typeof err?.data?.detail === "string" ? err.data.detail : err.message || "Failed to load employee reviews.");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    init();
    return () => { ignore = true; };
  }, [employeeId]);

  const handleDeleteDraftClick = (draft) => {
    setDraftToDelete(draft);
  };

  const handleCancelDelete = () => {
    if (deletingDraft) return;
    setDraftToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!draftToDelete || deletingDraft) return;
    setDeletingDraft(true);
    try {
      await deletePerformanceReview(draftToDelete.id);
      setSuccessMsg("Draft review deleted successfully.");
      setDraftToDelete(null);
      loadEmployeeReviews();
      if (onReviewUpdated) onReviewUpdated();
    } catch (err) {
      setError(
        typeof err?.data?.detail === "string"
          ? err.data.detail
          : err.message || "Failed to delete draft review."
      );
      setDraftToDelete(null);
    } finally {
      setDeletingDraft(false);
    }
  };

  // Close delete modal on Escape key press
  useEffect(() => {
    if (!draftToDelete) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !deletingDraft) {
        setDraftToDelete(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [draftToDelete, deletingDraft]);

  const handleModalSuccess = (msg) => {
    setSuccessMsg(msg);
    loadEmployeeReviews();
    if (onReviewUpdated) onReviewUpdated();
  };

  if (loading) {
    return (
      <div className="perf-detail-container">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>
          <ChevronLeft size={16} /> Back to Employee List
        </button>
        <LoadingState message={`Loading performance details for ${employee.first_name} ${employee.last_name}...`} />
      </div>
    );
  }

  // Authoritative latest rating from the most recent completed review (or null)
  const latestRating = completedReviews[0]?.overall_rating ?? null;

  // Chart data: completed reviews only, chronological order
  const trendData = [...completedReviews]
    .sort((a, b) => new Date(a.review_date) - new Date(b.review_date))
    .map((r) => ({
      review_id: r.id,
      review_date: r.review_date,
      review_period: r.review_period,
      overall_rating: r.overall_rating,
      title: r.title,
    }));

  return (
    <div className="perf-detail-container">
      {/* 1. Header Navigation Bar */}
      <div className="perf-detail-top-nav">
        <button
          type="button"
          className="btn btn-secondary btn-sm perf-back-btn"
          onClick={onBack}
        >
          <ChevronLeft size={16} /> Back to Employee List
        </button>

        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            setEditingDraftReview(null);
            setIsModalOpen(true);
          }}
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          <PlusIcon size={14} /> + Create Performance Review
        </button>
      </div>

      {/* 2. Compact Employee Information Header */}
      <div className="perf-emp-compact-header">
        <div className="perf-emp-avatar-wrap">
          {employee.profile_photo_url ? (
            <img
              src={employee.profile_photo_url}
              alt={`${employee.first_name} ${employee.last_name}`}
              className="perf-emp-avatar-img"
            />
          ) : (
            <div className="perf-emp-avatar-initials">
              {(employee.first_name?.[0] || "") + (employee.last_name?.[0] || "")}
            </div>
          )}
        </div>

        <div className="perf-emp-main-info">
          <div className="perf-emp-name-row">
            <h2 className="perf-emp-name">
              {employee.first_name} {employee.last_name}
            </h2>
            <span className="perf-emp-id-badge">Employee ID: {employee.employee_code}</span>
          </div>

          <div className="perf-emp-meta-row">
            {employee.department_name && (
              <span className="perf-emp-meta-item">
                {employee.department_name}
              </span>
            )}
            {(employee.designation_name || employee.designation) && (
              <span className="perf-emp-meta-item">
                <span className="perf-meta-dot">•</span>
                {employee.designation_name || employee.designation}
              </span>
            )}
            {(employee.location || employee.address) && (
              <span className="perf-emp-meta-item">
                <span className="perf-meta-dot">•</span>
                {employee.location || employee.address}
              </span>
            )}
            {employee.joining_date && (
              <span className="perf-emp-meta-item">
                <span className="perf-meta-dot">•</span>
                Joined: {employee.joining_date}
              </span>
            )}
          </div>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={loadEmployeeReviews} />}
      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: "16px" }}>
          {successMsg}
        </div>
      )}

      {/* 3. Compact 4-Column Summary Area */}
      <div className="perf-summary-grid">
        <div className="perf-summary-card">
          <div className="perf-summary-card-header">
            <span className="perf-summary-card-label">Latest Overall Rating</span>
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
                : "No completed reviews"}
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
            <span className="perf-summary-card-label">Draft Reviews</span>
            <div className="perf-summary-card-icon icon-orange">
              <ClockIcon size={16} />
            </div>
          </div>
          <div className="perf-summary-card-body">
            <div className="perf-summary-card-val">{draftReviews.length}</div>
            <div className="perf-summary-card-sub">Reviews in progress</div>
          </div>
        </div>

        <div className="perf-summary-card">
          <div className="perf-summary-card-header">
            <span className="perf-summary-card-label">Last Evaluated</span>
            <div className="perf-summary-card-icon icon-blue">
              <CalendarIcon size={16} />
            </div>
          </div>
          <div className="perf-summary-card-body">
            <div className="perf-summary-card-val">
              {completedReviews[0]?.review_date || "—"}
            </div>
            <div className="perf-summary-card-sub">
              {completedReviews[0]?.review_period || "No evaluations yet"}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Navigation Tab Row */}
      <div className="perf-tab-row">
        <button
          type="button"
          className={`perf-tab-btn ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className={`perf-tab-btn ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          Review History ({completedReviews.length})
        </button>
        {draftReviews.length > 0 && (
          <button
            type="button"
            className={`perf-tab-btn ${activeTab === "drafts" ? "active" : ""}`}
            onClick={() => setActiveTab("drafts")}
          >
            Draft Reviews ({draftReviews.length})
          </button>
        )}
      </div>

      {/* 5. Main Content: Overview Tab */}
      {activeTab === "overview" && (
        <div className="perf-overview-two-col">
          {/* LEFT COLUMN: Performance Trend */}
          <div className="perf-balanced-col-card">
            <div className="perf-col-card-header">
              <h3 className="perf-col-card-title">Performance Trend</h3>
              <span className="perf-col-card-badge">1.0 – 5.0 Scale</span>
            </div>

            <div className="perf-col-card-body">
              {trendData.length > 0 ? (
                <PerformanceTrendChart
                  trend={trendData}
                  title={`${employee.first_name}'s Rating Trajectory`}
                />
              ) : (
                <div className="perf-compact-empty-state">
                  <div className="perf-empty-icon-wrap icon-purple">
                    <TrendingUpIcon size={24} />
                  </div>
                  <h4 className="perf-empty-title">No performance trend data available yet.</h4>
                  <p className="perf-empty-desc">
                    Completed performance reviews will appear here to show the employee's rating trend over time.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Recent Performance Reviews */}
          <div className="perf-balanced-col-card">
            <div className="perf-col-card-header">
              <h3 className="perf-col-card-title">Recent Performance Reviews</h3>
              {completedReviews.length > 0 && (
                <span className="perf-col-card-badge">
                  {completedReviews.length} Record{completedReviews.length > 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="perf-col-card-body">
              {completedReviews.length > 0 ? (
                <div className="perf-recent-reviews-wrap">
                  {/* If multiple completed reviews, show quick selector pills */}
                  {completedReviews.length > 1 && (
                    <div className="perf-review-quick-pills">
                      {completedReviews.slice(0, 4).map((rev) => (
                        <button
                          key={rev.id}
                          type="button"
                          className={`perf-quick-pill ${selectedCompletedReview?.id === rev.id ? "active" : ""}`}
                          onClick={() => setSelectedCompletedReview(rev)}
                        >
                          <span>{rev.review_period}</span>
                          <span className="perf-pill-score">{rev.overall_rating} / 5</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Clean Parameter Breakdown for selected review */}
                  <CategoryRatingBars
                    ratings={selectedCompletedReview?.ratings || []}
                    reviewPeriod={selectedCompletedReview?.review_period}
                    title="Evaluated Parameters"
                  />

                  {/* Review Remarks if any */}
                  {selectedCompletedReview?.comments && (
                    <div className="perf-compact-remarks-box">
                      <span className="perf-remarks-label">Review Remarks:</span>
                      <p className="perf-remarks-text">{selectedCompletedReview.comments}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="perf-compact-empty-state">
                  <div className="perf-empty-icon-wrap icon-green">
                    <PerformanceIcon size={24} />
                  </div>
                  <h4 className="perf-empty-title">No performance reviews found.</h4>
                  <p className="perf-empty-desc">
                    Create a performance review to get started.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. Review History Tab */}
      {activeTab === "history" && (
        <div className="perf-history-card">
          <div className="perf-history-header">
            <div>
              <h3 className="perf-history-title">Completed Review History</h3>
              <p className="perf-history-subtitle">
                Inspect historical evaluations and parameter breakdowns.
              </p>
            </div>
          </div>

          {completedReviews.length === 0 ? (
            <div className="perf-compact-empty-state" style={{ minHeight: "180px" }}>
              <PerformanceIcon size={24} />
              <h4 className="perf-empty-title">No review history found</h4>
              <p className="perf-empty-desc">There are no completed reviews recorded for this employee.</p>
            </div>
          ) : (
            <div className="perf-history-table-wrapper">
              <table className="data-table perf-table">
                <thead>
                  <tr>
                    <th>Review Period</th>
                    <th>Date</th>
                    <th>Title</th>
                    <th>Overall Rating</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {completedReviews.map((rev) => {
                    const isSelected = selectedCompletedReview?.id === rev.id;
                    return (
                      <tr
                        key={rev.id}
                        className={`perf-history-row ${isSelected ? "selected" : ""}`}
                        onClick={() => setSelectedCompletedReview(rev)}
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
                            <CheckCircleIcon size={12} /> COMPLETED
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`btn btn-sm ${isSelected ? "btn-primary" : "btn-secondary"}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCompletedReview(rev);
                              setActiveTab("overview");
                            }}
                          >
                            {isSelected ? "Inspecting" : "Inspect Parameters"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 7. Draft Reviews Tab */}
      {activeTab === "drafts" && (
        <div className="perf-drafts-card">
          <div className="perf-drafts-header">
            <div>
              <h3 className="perf-drafts-title">Draft Reviews in Progress</h3>
              <p className="perf-drafts-notice">
                Drafts are not visible to employees and do not participate in overall ratings.
              </p>
            </div>
          </div>

          <div className="perf-history-table-wrapper">
            <table className="data-table perf-table">
              <thead>
                <tr>
                  <th>Review Period</th>
                  <th>Date</th>
                  <th>Title</th>
                  <th>Parameters</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {draftReviews.map((draft) => (
                  <tr key={draft.id}>
                    <td><strong>{draft.review_period}</strong></td>
                    <td>{draft.review_date}</td>
                    <td>{draft.title || "Draft Evaluation"}</td>
                    <td>{draft.ratings?.length || 0} parameter(s)</td>
                    <td>
                      <span className="status-badge status-draft">DRAFT</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setEditingDraftReview(draft);
                            setIsModalOpen(true);
                          }}
                          title="Edit or Complete Draft"
                        >
                          <EditIcon size={14} /> Edit & Complete
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDeleteDraftClick(draft)}
                          style={{ color: "#ef4444" }}
                          title="Delete Draft"
                        >
                          <TrashIcon size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review Modal for HR */}
      <PerformanceReviewModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingDraftReview(null);
        }}
        onSuccess={handleModalSuccess}
        preselectedEmployeeId={employee.id}
        initialReview={editingDraftReview}
      />

      {/* Custom Delete Draft Confirmation Modal */}
      {draftToDelete && (
        <div
          className="perf-delete-modal-backdrop"
          onClick={deletingDraft ? undefined : handleCancelDelete}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-draft-title"
        >
          <div
            className="perf-delete-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="perf-delete-modal-body">
              <div className="perf-delete-icon-wrap">
                <TrashIcon size={22} />
              </div>
              <div className="perf-delete-content">
                <h3 id="delete-draft-title" className="perf-delete-title">
                  Delete Draft Review?
                </h3>
                <p className="perf-delete-message">
                  Are you sure you want to delete this draft performance review?
                </p>
                <p className="perf-delete-warning">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="perf-delete-modal-footer">
              <button
                type="button"
                className="btn btn-secondary btn-sm perf-delete-cancel-btn"
                onClick={handleCancelDelete}
                disabled={deletingDraft}
              >
                Cancel
              </button>
              <button
                type="button"
                className="perf-delete-confirm-btn"
                onClick={handleConfirmDelete}
                disabled={deletingDraft}
              >
                {deletingDraft ? (
                  "Deleting..."
                ) : (
                  <>
                    <TrashIcon size={14} /> Delete Draft
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
