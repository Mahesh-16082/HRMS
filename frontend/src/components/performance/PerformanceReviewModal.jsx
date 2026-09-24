import { useState, useEffect } from "react";
import { employeeApi } from "../../api/employeeApi";
import { createPerformanceReview, updatePerformanceReview, completePerformanceReview } from "../../api/performanceApi";
import { CloseIcon } from "../icons/Icons";

const PREDEFINED_PARAMETERS = [
  "Quality of Work",
  "Productivity",
  "Communication",
  "Teamwork & Collaboration",
  "Problem Solving",
  "Initiative & Ownership",
  "Reliability & Attendance",
  "Goal Achievement",
];

const RATING_MEANINGS = {
  1: "Needs Significant Improvement",
  2: "Needs Improvement",
  3: "Meets Expectations",
  4: "Very Good",
  5: "Outstanding",
};

export default function PerformanceReviewModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedEmployeeId = null,
  initialReview = null,
}) {
  if (!isOpen) return null;

  return (
    <PerformanceReviewModalContent
      key={initialReview?.id ? `draft-${initialReview.id}` : `new-${preselectedEmployeeId || "none"}`}
      onClose={onClose}
      onSuccess={onSuccess}
      preselectedEmployeeId={preselectedEmployeeId}
      initialReview={initialReview}
    />
  );
}

function PerformanceReviewModalContent({
  onClose,
  onSuccess,
  preselectedEmployeeId,
  initialReview,
}) {
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  const [employeeId, setEmployeeId] = useState(
    initialReview?.employee_id || preselectedEmployeeId || ""
  );
  const [reviewPeriod, setReviewPeriod] = useState(initialReview?.review_period || "");
  const [reviewDate, setReviewDate] = useState(
    initialReview?.review_date || new Date().toISOString().split("T")[0]
  );
  const [title, setTitle] = useState(initialReview?.title || "");
  const [comments, setComments] = useState(initialReview?.comments || "");

  // Predefined Performance Parameters: Show the 8 parameters automatically
  const [parameterStates, setParameterStates] = useState(() => {
    const existingRatingsMap = new Map();
    if (Array.isArray(initialReview?.ratings)) {
      initialReview.ratings.forEach((r) => {
        if (r.category) {
          existingRatingsMap.set(r.category.trim().toLowerCase(), r);
        }
      });
    }

    const hasInitialRatings = Array.isArray(initialReview?.ratings) && initialReview.ratings.length > 0;

    return PREDEFINED_PARAMETERS.map((name) => {
      const match = existingRatingsMap.get(name.toLowerCase());
      if (match) {
        return {
          name,
          selected: true,
          rating: Number.isInteger(match.rating) && match.rating >= 1 && match.rating <= 5 ? match.rating : 5,
          comments: match.comments || "",
        };
      }
      return {
        name,
        // When creating a new review (or if draft had no ratings), all 8 parameters are selected by default.
        // When editing a draft with saved ratings, only saved parameters are selected.
        selected: !hasInitialRatings,
        rating: 5,
        comments: "",
      };
    });
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Load active employees list for dropdown
  useEffect(() => {
    let ignore = false;
    async function fetchEmployees() {
      setLoadingEmployees(true);
      try {
        const res = await employeeApi.listEmployees({ limit: 100, employment_status: "ACTIVE" });
        if (ignore) return;
        const list = Array.isArray(res?.employees)
          ? res.employees
          : Array.isArray(res)
          ? res
          : [];
        setEmployees(list);
      } catch (err) {
        console.error("Failed to load employees for performance review:", err);
      } finally {
        if (!ignore) setLoadingEmployees(false);
      }
    }

    fetchEmployees();
    return () => {
      ignore = true;
    };
  }, []);

  const handleToggleParameter = (paramName) => {
    setParameterStates((prev) =>
      prev.map((p) =>
        p.name === paramName ? { ...p, selected: !p.selected } : p
      )
    );
  };

  const handleRatingChange = (paramName, num) => {
    setParameterStates((prev) =>
      prev.map((p) =>
        p.name === paramName ? { ...p, rating: num, selected: true } : p
      )
    );
  };

  const handleCommentsChange = (paramName, commentsText) => {
    setParameterStates((prev) =>
      prev.map((p) =>
        p.name === paramName ? { ...p, comments: commentsText } : p
      )
    );
  };

  const validateForm = (isCompleteAction) => {
    if (!employeeId) {
      setError("Please select an employee.");
      return false;
    }
    if (!reviewPeriod.trim()) {
      setError("Please specify a review period (e.g., Q1 2026).");
      return false;
    }
    if (!reviewDate) {
      setError("Please select a review date.");
      return false;
    }

    const selectedParams = parameterStates.filter((p) => p.selected);

    if (isCompleteAction) {
      if (selectedParams.length === 0) {
        setError("At least one performance parameter must be selected to complete a review.");
        return false;
      }
      for (const p of selectedParams) {
        if (typeof p.rating !== "number" || p.rating < 1 || p.rating > 5) {
          setError(`Parameter '${p.name}' rating must be between 1 and 5.`);
          return false;
        }
      }
    } else {
      // Draft mode
      for (const p of selectedParams) {
        if (typeof p.rating !== "number" || p.rating < 1 || p.rating > 5) {
          setError(`Parameter '${p.name}' rating must be between 1 and 5.`);
          return false;
        }
      }
    }

    return true;
  };

  const handleSubmit = async (targetStatus) => {
    setError("");
    const isComplete = targetStatus === "COMPLETED";

    if (!validateForm(isComplete)) {
      return;
    }

    setSubmitting(true);
    try {
      // Format parameters payload: Only selected parameters participate in backend calculation
      const formattedRatings = parameterStates
        .filter((p) => p.selected)
        .map((p) => ({
          category: p.name,
          rating: parseInt(p.rating, 10),
          comments: p.comments && p.comments.trim() ? p.comments.trim() : null,
        }));

      if (initialReview?.id) {
        // Updating existing review
        await updatePerformanceReview(initialReview.id, {
          review_period: reviewPeriod.trim(),
          title: title.trim() || null,
          review_date: reviewDate,
          comments: comments.trim() || null,
          ratings: formattedRatings,
        });

        if (isComplete) {
          await completePerformanceReview(initialReview.id, {
            ratings: formattedRatings,
            comments: comments.trim() || null,
          });
        }
      } else {
        // Creating new review
        // Authoritative score is calculated solely by backend!
        await createPerformanceReview({
          employee_id: parseInt(employeeId, 10),
          review_period: reviewPeriod.trim(),
          title: title.trim() || null,
          review_date: reviewDate,
          status: targetStatus,
          comments: comments.trim() || null,
          ratings: formattedRatings,
        });
      }

      onSuccess(
        isComplete
          ? "Performance review completed successfully!"
          : "Performance review saved as draft."
      );
      onClose();
    } catch (err) {
      console.error("Failed to save performance review:", err);
      setError(typeof err?.data?.detail === "string" ? err.data.detail : err.message || "Failed to save performance review.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="perf-modal-backdrop" onClick={onClose}>
      <div
        className="perf-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="perf-modal-header">
          <div>
            <h2 className="perf-modal-title">
              {initialReview ? "Edit Performance Review" : "Create Performance Review"}
            </h2>
            <p className="perf-modal-subtitle">
              Enter review details and performance parameters. Ratings must be between 1 and 5.
            </p>
          </div>
          <button
            type="button"
            className="perf-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        <div className="perf-modal-body">
          {error && (
            <div className="alert alert-error" style={{ marginBottom: "16px" }}>
              {error}
            </div>
          )}

          {/* Employee Selection */}
          <div className="form-group" style={{ marginBottom: "16px" }}>
            <label className="form-label" htmlFor="perf-employee-select">
              Select Employee <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <select
              id="perf-employee-select"
              className="form-input form-select"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              disabled={submitting || !!initialReview || !!preselectedEmployeeId}
            >
              <option value="">-- Choose Employee --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} ({emp.employee_code}) - {emp.department_name || "General"}
                </option>
              ))}
            </select>
            {loadingEmployees && (
              <span style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                Loading active employees...
              </span>
            )}
          </div>

          <div className="perf-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
            {/* Review Period */}
            <div className="form-group">
              <label className="form-label" htmlFor="perf-review-period">
                Review Period <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                id="perf-review-period"
                type="text"
                className="form-input"
                placeholder="e.g. Q1 2026, Annual 2025"
                value={reviewPeriod}
                onChange={(e) => setReviewPeriod(e.target.value)}
                disabled={submitting}
              />
            </div>

            {/* Review Date */}
            <div className="form-group">
              <label className="form-label" htmlFor="perf-review-date">
                Review Date <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                id="perf-review-date"
                type="date"
                className="form-input"
                value={reviewDate}
                onChange={(e) => setReviewDate(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          {/* Optional Title */}
          <div className="form-group" style={{ marginBottom: "16px" }}>
            <label className="form-label" htmlFor="perf-review-title">
              Review Title (Optional)
            </label>
            <input
              id="perf-review-title"
              type="text"
              className="form-input"
              placeholder="e.g. Quarterly Engineering Evaluation"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
            />
          </div>

          {/* Predefined Performance Parameters Section */}
          <div className="perf-params-input-section" style={{ marginBottom: "20px" }}>
            <div style={{ marginBottom: "12px" }}>
              <label className="form-label" style={{ marginBottom: "2px" }}>
                Performance Parameters <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
                Select applicable parameters and assign ratings from 1 to 5. Backend calculates authoritative overall rating.
              </p>
            </div>

            <div className="perf-param-rows-container">
              {parameterStates.map((param) => {
                const meaning = RATING_MEANINGS[param.rating] || "";
                return (
                  <div
                    key={param.name}
                    className={`perf-predefined-param-card ${param.selected ? "selected" : "unselected"}`}
                  >
                    <div className="perf-param-header-row">
                      {/* [✓] Parameter Name */}
                      <label className="perf-param-checkbox-label">
                        <input
                          type="checkbox"
                          className="perf-param-checkbox"
                          checked={param.selected}
                          onChange={() => handleToggleParameter(param.name)}
                          disabled={submitting}
                        />
                        <span className="perf-param-title-text">{param.name}</span>
                      </label>

                      {/* Rating: [1] [2] [3] [4] [5] */}
                      <div className={`perf-rating-selector-group ${!param.selected ? "inactive" : ""}`}>
                        <span className="perf-rating-label">Rating:</span>
                        <div className="perf-rating-buttons">
                          {[1, 2, 3, 4, 5].map((num) => (
                            <button
                              key={num}
                              type="button"
                              className={`perf-rating-num-btn ${param.selected && param.rating === num ? "selected" : ""}`}
                              onClick={() => handleRatingChange(param.name, num)}
                              disabled={submitting}
                              title={`${num} = ${RATING_MEANINGS[num]}`}
                              aria-label={`${param.name} rating ${num}: ${RATING_MEANINGS[num]}`}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                        {param.selected ? (
                          <span className="perf-rating-meaning-badge" title={meaning}>
                            {meaning}
                          </span>
                        ) : (
                          <span className="perf-rating-excluded-tag">
                            Deselected
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Optional feedback */}
                    <div className="perf-param-comment-wrap">
                      <input
                        type="text"
                        className="form-input perf-param-comment-input"
                        placeholder={
                          param.selected
                            ? `Optional feedback for ${param.name}...`
                            : `Not applicable / deselected (check box to include)`
                        }
                        value={param.comments}
                        onChange={(e) => handleCommentsChange(param.name, e.target.value)}
                        disabled={submitting || !param.selected}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Overall Comments */}
          <div className="form-group" style={{ marginBottom: "16px" }}>
            <label className="form-label" htmlFor="perf-overall-comments">
              Overall Comments / Summary Feedback
            </label>
            <textarea
              id="perf-overall-comments"
              className="form-input form-textarea"
              rows="3"
              placeholder="Provide constructive feedback, achievements, or development areas..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              disabled={submitting}
            />
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="perf-modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleSubmit("DRAFT")}
              disabled={submitting}
            >
              {submitting ? "Saving..." : "Save Draft"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleSubmit("COMPLETED")}
              disabled={submitting}
            >
              {submitting ? "Completing..." : "Complete Review"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
