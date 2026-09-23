import { useState } from "react";
import {
  CloseIcon,
  CalendarIcon,
  ClockIcon,
  ProjectsIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  EditIcon,
  TrashIcon,
} from "../icons/Icons";
import WorkReportAttachment from "./WorkReportAttachment";

export default function WorkReportDetails({
  report,
  onClose,
  onEdit, // (report) => void
  onSubmit, // (report) => void
  onDelete, // (report) => void
  onAttachmentChange, // (updatedAttachment) => void
}) {
  const [actionLoading, setActionLoading] = useState(false);

  if (!report) return null;

  const isDraft = report.status === "DRAFT";
  const isSubmitted = report.status === "SUBMITTED";
  const isApproved = report.status === "APPROVED";
  const isRejected = report.status === "REJECTED";

  const getStatusBadge = (status) => {
    switch (status) {
      case "DRAFT":
        return <span className="badge-status-draft">Draft</span>;
      case "SUBMITTED":
        return <span className="badge-status-submitted">Submitted • Pending Review</span>;
      case "APPROVED":
        return <span className="badge-status-approved">Approved</span>;
      case "REJECTED":
        return <span className="badge-status-rejected">Rejected • Needs Revision</span>;
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "680px", width: "100%" }}
      >
        <div className="modal-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <h3 className="modal-title" style={{ margin: 0 }}>
                Work Report #{report.id}
              </h3>
              {getStatusBadge(report.status)}
            </div>
            <span style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
              Work Date: <strong>{formatDate(report.work_date)}</strong>
            </span>
          </div>

          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: "75vh", overflowY: "auto" }}>
          {/* Rejection Banner */}
          {isRejected && (
            <div className="wr-rejection-alert">
              <div className="wr-rejection-header">
                <AlertCircleIcon size={18} />
                <span>HR Reviewer Feedback (Action Required)</span>
              </div>
              <p className="wr-rejection-text">
                {report.review_feedback || "Report requires revision before it can be approved."}
              </p>
              <div className="wr-rejection-meta">
                Reviewed by {report.reviewer?.full_name || "HR Administrator"} on {formatDateTime(report.reviewed_at)}
              </div>
            </div>
          )}

          {/* Approval Banner */}
          {isApproved && (
            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderLeft: "4px solid #16a34a",
                borderRadius: "8px",
                padding: "12px 16px",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <CheckCircleIcon size={20} style={{ color: "#16a34a" }} />
              <div>
                <div style={{ fontWeight: "700", color: "#15803d", fontSize: "13.5px" }}>
                  Report Approved
                </div>
                <div style={{ fontSize: "12px", color: "#166534" }}>
                  Reviewed by {report.reviewer?.full_name || "HR Administrator"} on {formatDateTime(report.reviewed_at)}
                  {report.review_feedback ? ` — "${report.review_feedback}"` : ""}
                </div>
              </div>
            </div>
          )}

          {/* Top Metadata Grid */}
          <div className="wr-detail-grid">
            <div className="wr-detail-item">
              <span className="wr-detail-label">Project</span>
              <span className="wr-detail-value" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <ProjectsIcon size={15} />
                {report.project ? (report.project.project_name || report.project.name) : "Internal / Administrative"}
              </span>
            </div>

            <div className="wr-detail-item">
              <span className="wr-detail-label">Hours Logged</span>
              <span className="wr-detail-value" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <ClockIcon size={15} />
                {report.hours_worked} hours
              </span>
            </div>

            <div className="wr-detail-item">
              <span className="wr-detail-label">Submission Time</span>
              <span className="wr-detail-value">
                {report.submitted_at ? formatDateTime(report.submitted_at) : "Not yet submitted"}
              </span>
            </div>
          </div>

          {/* Title */}
          <div className="wr-detail-block">
            <span className="wr-detail-label">Title</span>
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

          {/* Single Attachment Component */}
          <WorkReportAttachment
            reportId={report.id}
            attachment={report.attachment}
            reportStatus={report.status}
            canManage={isDraft || isRejected}
            onAttachmentChange={(updated) => {
              if (onAttachmentChange) onAttachmentChange(updated);
            }}
          />
        </div>

        {/* Modal Footer Actions */}
        <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div>
            {isDraft && onDelete && (
              <button
                type="button"
                className="btn btn-danger-outline"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12.5px" }}
                onClick={() => onDelete(report)}
                disabled={actionLoading}
              >
                <TrashIcon size={14} />
                Delete Draft
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={actionLoading}
            >
              Close
            </button>

            {(isDraft || isRejected) && onEdit && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                onClick={() => onEdit(report)}
                disabled={actionLoading}
              >
                <EditIcon size={14} />
                {isRejected ? "Edit & Resubmit" : "Edit Draft"}
              </button>
            )}

            {isDraft && onSubmit && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onSubmit(report)}
                disabled={actionLoading}
              >
                Submit Report
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
