import { CloseIcon, EditIcon, ClockIcon, CheckCircleIcon } from "../icons/Icons";

export default function ComplaintDetails({
  complaint,
  onClose,
  onEdit,
}) {
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

  const statusBadge = getStatusBadge(complaint.status);
  const priorityBadge = getPriorityBadge(complaint.priority);
  const isOpen = complaint.status === "OPEN";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "620px", width: "100%" }}
      >
        <div className="modal-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <h3 className="modal-title" style={{ margin: 0 }}>
                Complaint #{complaint.id}
              </h3>
              <span
                className={statusBadge.className}
                style={statusBadge.style}
              >
                {statusBadge.label}
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
          <button className="modal-close-btn" onClick={onClose} title="Close details">
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Subject */}
          <div className="detail-section">
            <span className="detail-label">Subject</span>
            <div
              className="detail-content-box"
              style={{ fontWeight: "600", fontSize: "14.5px", color: "var(--text-heading)" }}
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

          {/* Timestamps Grid */}
          <div className="detail-grid">
            <div className="detail-card-tile">
              <div className="detail-tile-icon">
                <ClockIcon size={18} />
              </div>
              <div className="detail-tile-content">
                <span className="detail-label" style={{ fontSize: "10.5px" }}>Submitted On</span>
                <span style={{ fontSize: "12.5px", fontWeight: "600", color: "var(--text-main)" }}>
                  {formatDate(complaint.created_at) || "—"}
                </span>
              </div>
            </div>

            <div className="detail-card-tile">
              <div className="detail-tile-icon">
                <ClockIcon size={18} />
              </div>
              <div className="detail-tile-content">
                <span className="detail-label" style={{ fontSize: "10.5px" }}>Last Updated</span>
                <span style={{ fontSize: "12.5px", fontWeight: "600", color: "var(--text-main)" }}>
                  {formatDate(complaint.updated_at) || "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Resolved Timestamp (if available) */}
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
                <strong>Resolved on: </strong>
                <span>{formatDate(complaint.resolved_at)}</span>
              </div>
            </div>
          )}

          {/* HR Remarks (Read-Only) */}
          {complaint.hr_remarks ? (
            <div className="detail-section">
              <span className="detail-label" style={{ color: "var(--primary)" }}>
                HR Feedback &amp; Resolution Remarks
              </span>
              <div
                className="detail-content-box"
                style={{
                  background: "var(--primary-subtle, rgba(90, 75, 234, 0.05))",
                  border: "1px solid rgba(90, 75, 234, 0.2)",
                }}
              >
                <p className="detail-text" style={{ whiteSpace: "pre-wrap", color: "var(--text-heading)" }}>
                  {complaint.hr_remarks}
                </p>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: "12.5px", color: "var(--text-muted)", fontStyle: "italic" }}>
              No HR remarks added yet.
            </div>
          )}
        </div>

        <div
          className="modal-footer"
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {isOpen ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Complaint is <strong>OPEN</strong> and can be edited.
              </span>
            </div>
          ) : (
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Complaint status is <strong>{complaint.status}</strong> (editing locked).
            </span>
          )}

          <div style={{ display: "flex", gap: "10px" }}>
            {isOpen && onEdit && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onEdit(complaint)}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <EditIcon size={15} />
                <span>Edit Complaint</span>
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
