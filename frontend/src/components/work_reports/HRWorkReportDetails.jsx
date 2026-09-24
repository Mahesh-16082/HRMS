import { useState } from "react";
import {
  CloseIcon,
  UsersIcon,
  CalendarIcon,
  ClockIcon,
  ProjectsIcon,
  DownloadIcon,
  FileTextIcon,
  AlertCircleIcon,
  CheckCircleIcon,
} from "../icons/Icons";
import { formatFileSize } from "./WorkReportAttachment";
import { reviewWorkReportHR, revokeWorkReportHR } from "../../api/workReportApi";

export default function HRWorkReportDetails({
  report,
  onClose,
  onReviewed, // (updatedReport) => void
}) {
  const [reviewing, setReviewing] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  if (!report) return null;

  const isSubmitted = report.status === "SUBMITTED";
  const isApproved = report.status === "APPROVED";
  const isRejected = report.status === "REJECTED";

  const getStatusBadge = (status) => {
    switch (status) {
      case "DRAFT":
        return <span className="badge-status-draft">Draft</span>;
      case "SUBMITTED":
        return <span className="badge-status-submitted">Submitted • Needs Review</span>;
      case "APPROVED":
        return <span className="badge-status-approved">Approved</span>;
      case "REJECTED":
        return <span className="badge-status-rejected">Rejected</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTime = (dtStr) => {
    if (!dtStr) return "—";
    return new Date(dtStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleApprove = async () => {
    try {
      setReviewing(true);
      setError("");
      const updated = await reviewWorkReportHR(report.id, {
        status: "APPROVED",
        review_feedback: feedback.trim() || null,
      });
      if (onReviewed) onReviewed(updated);
    } catch (err) {
      setError(err.message || "Failed to approve work report.");
    } finally {
      setReviewing(false);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!feedback.trim()) {
      setError("Rejection feedback is required so the employee knows what to revise.");
      return;
    }

    try {
      setReviewing(true);
      setError("");
      const updated = await reviewWorkReportHR(report.id, {
        status: "REJECTED",
        review_feedback: feedback.trim(),
      });
      if (onReviewed) onReviewed(updated);
    } catch (err) {
      setError(err.message || "Failed to reject work report.");
    } finally {
      setReviewing(false);
    }
  };

  const handleRevokeConfirm = async () => {
    try {
      setRevoking(true);
      setError("");
      const updated = await revokeWorkReportHR(report.id);
      setShowRevokeConfirm(false);
      if (onReviewed) onReviewed(updated);
    } catch (err) {
      setError(err.message || "Failed to revoke work report approval.");
    } finally {
      setRevoking(false);
    }
  };

  const employeeFullName = report.employee
    ? `${report.employee.first_name || ""} ${report.employee.last_name || ""}`.trim() || `Employee #${report.employee_id}`
    : `Employee #${report.employee_id}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "700px", width: "100%" }}
      >
        <div className="modal-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <h3 className="modal-title" style={{ margin: 0 }}>
                Review Work Report #{report.id}
              </h3>
              {getStatusBadge(report.status)}
            </div>
            <span style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
              Submitted by <strong>{employeeFullName}</strong> for <strong>{formatDate(report.work_date)}</strong>
            </span>
          </div>

          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: "75vh", overflowY: "auto" }}>
          {error && (
            <div
              style={{
                padding: "10px 14px",
                background: "#fee2e2",
                color: "#b91c1c",
                borderRadius: "8px",
                fontSize: "13px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertCircleIcon size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Employee & Meta Details Grid */}
          <div className="wr-detail-grid">
            <div className="wr-detail-item">
              <span className="wr-detail-label">Employee</span>
              <span className="wr-detail-value" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <UsersIcon size={15} />
                {employeeFullName}
              </span>
              <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                {report.employee?.email || report.employee?.employee_number || ""}
              </span>
            </div>

            <div className="wr-detail-item">
              <span className="wr-detail-label">Project</span>
              <span className="wr-detail-value" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <ProjectsIcon size={15} />
                {report.project ? (report.project.project_name || report.project.name) : "Internal / Administrative"}
              </span>
            </div>

            <div className="wr-detail-item">
              <span className="wr-detail-label">Work Date &amp; Hours</span>
              <span className="wr-detail-value" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <CalendarIcon size={15} />
                {formatDate(report.work_date)} • {report.hours_worked} hrs
              </span>
            </div>

            <div className="wr-detail-item">
              <span className="wr-detail-label">Submitted At</span>
              <span className="wr-detail-value">
                {report.submitted_at ? formatDateTime(report.submitted_at) : "Draft (Not Submitted)"}
              </span>
            </div>
          </div>

          {/* Title */}
          <div className="wr-detail-block">
            <span className="wr-detail-label">Report Title</span>
            <h4 style={{ margin: "4px 0 0 0", fontSize: "15px", color: "var(--text-heading)" }}>
              {report.title}
            </h4>
          </div>

          {/* Tasks Completed */}
          <div className="wr-detail-block">
            <span className="wr-detail-label">Tasks Completed</span>
            <div className="wr-detail-block-content">{report.tasks_completed}</div>
          </div>

          {/* Plans for Tomorrow */}
          {report.plans_for_tomorrow && (
            <div className="wr-detail-block">
              <span className="wr-detail-label">Plans for Tomorrow</span>
              <div className="wr-detail-block-content">{report.plans_for_tomorrow}</div>
            </div>
          )}

          {/* Blockers */}
          {report.blockers && (
            <div className="wr-detail-block">
              <span className="wr-detail-label">Blockers / Dependencies</span>
              <div className="wr-detail-block-content" style={{ borderColor: "#fecaca" }}>
                {report.blockers}
              </div>
            </div>
          )}

          {/* Attachment (Read-only for HR) */}
          <div className="wr-attachment-section">
            <label className="input-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <FileTextIcon size={16} /> Supporting Attachment
            </label>
            {report.attachment ? (
              <div className="wr-attachment-card">
                <div className="wr-attachment-info">
                  <div className="wr-attachment-icon">
                    <FileTextIcon size={20} />
                  </div>
                  <div className="wr-attachment-meta">
                    <span className="wr-attachment-name" title={report.attachment.original_filename}>
                      {report.attachment.original_filename}
                    </span>
                    <span className="wr-attachment-sub">
                      {formatFileSize(report.attachment.file_size)} • {report.attachment.file_type || "FILE"}
                    </span>
                  </div>
                </div>

                <div className="wr-attachment-actions">
                  <a
                    href={report.attachment.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{ padding: "5px 12px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px", textDecoration: "none" }}
                  >
                    <DownloadIcon size={14} /> View / Download
                  </a>
                </div>
              </div>
            ) : (
              <div style={{ padding: "10px 14px", background: "var(--bg-surface, #f8fafc)", border: "1px dashed var(--border-color, #e2e8f0)", borderRadius: "8px", color: "var(--text-muted)", fontSize: "12.5px" }}>
                No document attached to this report.
              </div>
            )}
          </div>

          {/* Previous Review Log if already Approved or Rejected */}
          {(isApproved || isRejected) && (
            <div
              style={{
                marginTop: "20px",
                padding: "14px 16px",
                borderRadius: "8px",
                background: isApproved ? "#f0fdf4" : "#fef2f2",
                border: `1px solid ${isApproved ? "#bbf7d0" : "#fecaca"}`,
                borderLeft: `4px solid ${isApproved ? "#16a34a" : "#ef4444"}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", color: isApproved ? "#15803d" : "#b91c1c", marginBottom: "4px" }}>
                {isApproved ? <CheckCircleIcon size={18} /> : <AlertCircleIcon size={18} />}
                <span>{isApproved ? "Approved by HR" : "Rejected by HR"}</span>
              </div>
              {report.review_feedback && (
                <div style={{ fontSize: "13.5px", color: isApproved ? "#166534" : "#7f1d1d", margin: "4px 0", lineHeight: 1.5 }}>
                  "{report.review_feedback}"
                </div>
              )}
              <div style={{ fontSize: "11.5px", color: isApproved ? "#15803d" : "#991b1b", opacity: 0.85 }}>
                Reviewed by {report.reviewer?.full_name || "HR Administrator"} on {formatDateTime(report.reviewed_at)}
              </div>
            </div>
          )}

          {/* Rejection Feedback Form (Only when reject button clicked) */}
          {isSubmitted && rejectMode && (
            <form onSubmit={handleRejectSubmit} style={{ marginTop: "18px", padding: "14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px" }}>
              <label className="input-label" htmlFor="wr-reject-reason" style={{ color: "#991b1b" }}>
                Reason for Rejection (Required) <span className="required-star">*</span>
              </label>
              <textarea
                id="wr-reject-reason"
                className="input-field"
                rows={3}
                placeholder="Explain what is missing or requires correction so the employee can revise and resubmit..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                disabled={reviewing}
                required
                style={{ borderColor: "#fca5a5" }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setRejectMode(false);
                    setError("");
                  }}
                  disabled={reviewing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={reviewing}
                >
                  {reviewing ? "Rejecting..." : "Confirm Rejection"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={reviewing || revoking}>
            Close
          </button>

          {isApproved && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{
                color: "#b45309",
                borderColor: "#fde68a",
                background: "#fffbeb",
              }}
              onClick={() => setShowRevokeConfirm(true)}
              disabled={reviewing || revoking}
            >
              Revoke
            </button>
          )}

          {isSubmitted && !rejectMode && (
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className="btn btn-danger-outline"
                onClick={() => {
                  setRejectMode(true);
                  setError("");
                }}
                disabled={reviewing}
              >
                Reject Report
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleApprove}
                disabled={reviewing}
              >
                {reviewing ? "Approving..." : "Approve Report"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Revoke Approval Confirmation Modal */}
      {showRevokeConfirm && (
        <div
          className="modal-overlay"
          style={{ zIndex: 1100 }}
          onClick={() => !revoking && setShowRevokeConfirm(false)}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "460px" }}
          >
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: "var(--text-heading)" }}>
                Revoke Approval?
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowRevokeConfirm(false)}
                disabled={revoking}
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: "14px", color: "var(--text-main)", lineHeight: "1.5", margin: 0 }}>
                This will move the work report back to the Submitted stage for review.
              </p>
            </div>

            <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowRevokeConfirm(false)}
                disabled={revoking}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  background: "#d97706",
                  borderColor: "#d97706",
                  color: "#ffffff",
                }}
                onClick={handleRevokeConfirm}
                disabled={revoking}
              >
                {revoking ? "Revoking..." : "Revoke"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
