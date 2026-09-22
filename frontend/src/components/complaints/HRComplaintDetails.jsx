import { useState, useEffect } from "react";
import { complaintApi } from "../../api/complaintApi";
import {
  CloseIcon,
  ClockIcon,
  CheckCircleIcon,
  UserIcon,
} from "../icons/Icons";

const ALLOWED_TRANSITIONS = {
  OPEN: ["OPEN", "IN_PROGRESS", "RESOLVED"],
  IN_PROGRESS: ["IN_PROGRESS", "OPEN", "RESOLVED"],
  RESOLVED: ["RESOLVED", "IN_PROGRESS", "CLOSED"],
  CLOSED: ["CLOSED"],
};

export default function HRComplaintDetails({
  complaint,
  onClose,
  onUpdated,
}) {
  const [selectedStatus, setSelectedStatus] = useState(complaint?.status || "OPEN");
  const [hrRemarks, setHrRemarks] = useState(complaint?.hr_remarks || "");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  useEffect(() => {
    if (complaint) {
      setSelectedStatus(complaint.status || "OPEN");
      setHrRemarks(complaint.hr_remarks || "");
      setActionError("");
      setActionSuccess("");
    }
  }, [complaint]);

  if (!complaint) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "OPEN":
        return { className: "badge badge-planned", label: "Open" };
      case "IN_PROGRESS":
        return { className: "badge badge-on_hold", label: "In Progress" };
      case "RESOLVED":
        return { className: "badge badge-active", label: "Resolved" };
      case "CLOSED":
        return {
          className: "badge",
          label: "Closed",
          style: { background: "#f1f5f9", color: "#475569" },
        };
      default:
        return { className: "badge", label: status };
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case "HIGH":
        return {
          label: "High",
          style: { background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca" },
        };
      case "MEDIUM":
        return {
          label: "Medium",
          style: { background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a" },
        };
      case "LOW":
      default:
        return {
          label: "Low",
          style: { background: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0" },
        };
    }
  };

  const isClosed = complaint.status === "CLOSED";
  const validNextStatuses = ALLOWED_TRANSITIONS[complaint.status] || [complaint.status];

  const handleUpdate = async (e) => {
    e.preventDefault();
    setActionError("");
    setActionSuccess("");

    try {
      setSubmitting(true);
      const payload = {
        status: selectedStatus,
        hr_remarks: hrRemarks.trim() || null,
      };

      const updated = await complaintApi.updateComplaintStatus(complaint.id, payload);
      setActionSuccess(`Complaint #${complaint.id} status updated to ${selectedStatus}.`);
      if (onUpdated) {
        onUpdated(updated);
      }
    } catch (err) {
      // Gracefully display backend validation or business rule error
      setActionError(err.message || "Failed to update complaint status.");
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = getStatusBadge(complaint.status);
  const priorityBadge = getPriorityBadge(complaint.priority);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "680px", width: "100%" }}
      >
        <div className="modal-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <h3 className="modal-title" style={{ margin: 0 }}>
                Review Complaint #{complaint.id}
              </h3>
              <span
                className={statusBadge.className}
                style={statusBadge.style}
              >
                Current: {statusBadge.label}
              </span>
              <span
                className="badge"
                style={priorityBadge.style}
              >
                Priority: {priorityBadge.label}
              </span>
            </div>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
              Category: <strong style={{ color: "var(--text-main)" }}>{complaint.category}</strong>
            </span>
          </div>
          <button className="modal-close-btn" onClick={onClose} disabled={submitting}>
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {actionError && (
            <div
              style={{
                background: "#fee2e2",
                color: "#b91c1c",
                padding: "10px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                border: "1px solid #fecaca",
              }}
            >
              {actionError}
            </div>
          )}

          {actionSuccess && (
            <div
              style={{
                background: "#dcfce7",
                color: "#166534",
                padding: "10px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                border: "1px solid #bbf7d0",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <CheckCircleIcon size={16} />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* Employee Info Header */}
          <div
            style={{
              padding: "12px 16px",
              background: "var(--bg-card-subtle)",
              borderRadius: "12px",
              border: "1px solid var(--border-color)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "var(--primary-light, #ede9fe)",
                  color: "var(--primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "700",
                }}
              >
                <UserIcon size={18} />
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>
                  Submitted by
                </span>
                <strong style={{ fontSize: "14px", color: "var(--text-heading)" }}>
                  {complaint.employee
                    ? `${complaint.employee.first_name} ${complaint.employee.last_name}`
                    : `Employee #${complaint.employee_id}`}
                </strong>
              </div>
            </div>

            {complaint.employee?.employee_code && (
              <span
                style={{
                  padding: "4px 10px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "var(--text-muted)",
                }}
              >
                Code: {complaint.employee.employee_code}
              </span>
            )}
          </div>

          {/* Subject */}
          <div className="detail-section">
            <span className="detail-label">Subject</span>
            <div
              className="detail-content-box"
              style={{ fontWeight: "600", fontSize: "14px", color: "var(--text-heading)" }}
            >
              {complaint.subject}
            </div>
          </div>

          {/* Description */}
          <div className="detail-section">
            <span className="detail-label">Description</span>
            <div className="detail-content-box">
              <p className="detail-text" style={{ whiteSpace: "pre-wrap" }}>
                {complaint.description}
              </p>
            </div>
          </div>

          {/* Timestamps */}
          <div className="detail-grid">
            <div className="detail-card-tile">
              <div className="detail-tile-icon">
                <ClockIcon size={18} />
              </div>
              <div className="detail-tile-content">
                <span className="detail-label" style={{ fontSize: "10.5px" }}>Submitted</span>
                <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-main)" }}>
                  {formatDate(complaint.created_at) || "—"}
                </span>
              </div>
            </div>

            <div className="detail-card-tile">
              <div className="detail-tile-icon">
                <ClockIcon size={18} />
              </div>
              <div className="detail-tile-content">
                <span className="detail-label" style={{ fontSize: "10.5px" }}>Last Modified</span>
                <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-main)" }}>
                  {formatDate(complaint.updated_at) || "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Resolved Timestamp (when present) */}
          {complaint.resolved_at && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 14px",
                background: "#f0fdf4",
                borderRadius: "10px",
                border: "1px solid #bbf7d0",
                color: "#166534",
                fontSize: "13px",
              }}
            >
              <CheckCircleIcon size={18} />
              <div>
                <strong>Resolution Timestamp: </strong>
                <span>{formatDate(complaint.resolved_at)}</span>
              </div>
            </div>
          )}

          {/* HR Management Form */}
          <form
            onSubmit={handleUpdate}
            style={{
              padding: "16px",
              background: "var(--bg-card-subtle)",
              borderRadius: "12px",
              border: "1px solid var(--border-color)",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-heading)" }}>
                HR Resolution &amp; Status Controls
              </span>
              {isClosed && (
                <span style={{ fontSize: "11.5px", color: "var(--text-muted)", fontStyle: "italic" }}>
                  Status CLOSED is permanent. Remarks may still be updated.
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="hr-status-select">
                Update Status
              </label>
              <select
                id="hr-status-select"
                className="form-select"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                disabled={submitting || isClosed}
              >
                {validNextStatuses.map((st) => (
                  <option key={st} value={st}>
                    {st === "IN_PROGRESS"
                      ? "IN_PROGRESS (Under Investigation)"
                      : st === "RESOLVED"
                      ? "RESOLVED (Mark as Resolved)"
                      : st === "CLOSED"
                      ? "CLOSED (Final Closure)"
                      : "OPEN (Pending Action)"}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="hr-remarks-input">
                HR Remarks &amp; Resolution Notes
              </label>
              <textarea
                id="hr-remarks-input"
                className="form-textarea"
                rows={3}
                placeholder="Enter investigation updates, actions taken, or resolution summary..."
                value={hrRemarks}
                onChange={(e) => setHrRemarks(e.target.value)}
                disabled={submitting}
              />
              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                Visible to the employee as formal resolution notes.
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{ minWidth: "140px" }}
              >
                {submitting ? "Updating..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>

        <div
          className="modal-footer"
          style={{
            padding: "14px 24px",
            borderTop: "1px solid var(--border-color)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
