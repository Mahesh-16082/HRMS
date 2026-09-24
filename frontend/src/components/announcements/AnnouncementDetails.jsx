import {
  CloseIcon,
  ClockIcon,
  CalendarIcon,
  CheckCircleIcon,
  EditIcon,
  TrashIcon,
} from "../icons/Icons";
import "../../styles/announcements.css";

export default function AnnouncementDetails({
  announcement,
  onClose,
  isHR = false,
  onEdit,
  onPublish,
  onArchive,
  onDelete,
  actionLoading = false,
}) {
  if (!announcement) return null;

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

  const isExpired =
    announcement.expires_at &&
    new Date(announcement.expires_at).getTime() <= Date.now();

  const getCategoryBadgeClass = (category) => {
    switch (category) {
      case "POLICY":
        return "badge badge-cat-policy";
      case "EVENT":
        return "badge badge-cat-event";
      case "HOLIDAY":
        return "badge badge-cat-holiday";
      case "IMPORTANT":
        return "badge badge-cat-important";
      case "GENERAL":
      default:
        return "badge badge-cat-general";
    }
  };

  const getPriorityBadgeClass = (priority) => {
    switch (priority) {
      case "URGENT":
        return "badge badge-pri-urgent";
      case "HIGH":
        return "badge badge-pri-high";
      case "MEDIUM":
        return "badge badge-pri-medium";
      case "LOW":
      default:
        return "badge badge-pri-low";
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "DRAFT":
        return "badge badge-status-draft";
      case "PUBLISHED":
        return "badge badge-status-published";
      case "ARCHIVED":
        return "badge badge-status-archived";
      default:
        return "badge";
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "640px", width: "100%" }}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ flex: 1, paddingRight: "12px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
                marginBottom: "6px",
              }}
            >
              <span className={getCategoryBadgeClass(announcement.category)}>
                {announcement.category}
              </span>
              <span className={getPriorityBadgeClass(announcement.priority)}>
                {announcement.priority}
              </span>
              {isHR && (
                <span className={getStatusBadgeClass(announcement.status)}>
                  {announcement.status}
                </span>
              )}
              {isExpired && (
                <span className="badge badge-expired">
                  Expired
                </span>
              )}
            </div>
            <h3 className="modal-title" style={{ margin: 0, fontSize: "19px" }}>
              {announcement.title}
            </h3>
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            title="Close details"
            aria-label="Close"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Body */}
        <div
          className="modal-body"
          style={{ display: "flex", flexDirection: "column", gap: "20px" }}
        >
          {/* Announcement Full Content */}
          <div className="detail-section">
            <span
              className="detail-label"
              style={{
                fontSize: "12px",
                fontWeight: "600",
                color: "var(--text-muted)",
                marginBottom: "8px",
                display: "block",
              }}
            >
              Announcement Content
            </span>
            <div
              className="detail-content-box"
              style={{
                background: "var(--bg-card-subtle, #f8fafc)",
                border: "1px solid var(--border-color)",
                borderRadius: "12px",
                padding: "16px 18px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  lineHeight: "1.65",
                  color: "var(--text-heading)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {announcement.description}
              </p>
            </div>
          </div>

          {/* Date & Timestamps Details */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 14px",
                background: "var(--bg-card-subtle, #f8fafc)",
                borderRadius: "10px",
                border: "1px solid var(--border-color)",
              }}
            >
              <ClockIcon size={18} />
              <div>
                <span
                  style={{
                    display: "block",
                    fontSize: "11px",
                    color: "var(--text-muted)",
                  }}
                >
                  Published Date
                </span>
                <span
                  style={{
                    fontSize: "12.5px",
                    fontWeight: "600",
                    color: "var(--text-main)",
                  }}
                >
                  {formatDate(announcement.published_at) || "Not published yet"}
                </span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 14px",
                background: "var(--bg-card-subtle, #f8fafc)",
                borderRadius: "10px",
                border: "1px solid var(--border-color)",
              }}
            >
              <CalendarIcon size={18} />
              <div>
                <span
                  style={{
                    display: "block",
                    fontSize: "11px",
                    color: "var(--text-muted)",
                  }}
                >
                  Expiration Date
                </span>
                <span
                  className={isExpired ? "announcement-detail-expired-date" : ""}
                  style={{
                    fontSize: "12.5px",
                    fontWeight: "600",
                    color: isExpired ? "#b91c1c" : "var(--text-main)",
                  }}
                >
                  {formatDate(announcement.expires_at) || "No expiration date"}
                </span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 14px",
                background: "var(--bg-card-subtle, #f8fafc)",
                borderRadius: "10px",
                border: "1px solid var(--border-color)",
              }}
            >
              <ClockIcon size={18} />
              <div>
                <span
                  style={{
                    display: "block",
                    fontSize: "11px",
                    color: "var(--text-muted)",
                  }}
                >
                  Created On
                </span>
                <span
                  style={{
                    fontSize: "12.5px",
                    fontWeight: "600",
                    color: "var(--text-main)",
                  }}
                >
                  {formatDate(announcement.created_at) || "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Expiration Notice if expired */}
          {isExpired && (
            <div className="detail-expiry-box">
              <ClockIcon size={18} />
              <div>
                <strong>Notice: </strong>
                <span>
                  This announcement reached its expiration date on{" "}
                  {formatDate(announcement.expires_at)}. It is hidden from
                  employee views.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          className="modal-footer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: isHR ? "space-between" : "flex-end",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          {isHR && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {announcement.status === "DRAFT" && onPublish && (
                <button
                  type="button"
                  className="table-action-btn btn-publish"
                  onClick={() => onPublish(announcement.id)}
                  disabled={actionLoading}
                >
                  <CheckCircleIcon size={14} />
                  <span>Publish</span>
                </button>
              )}

              {announcement.status === "PUBLISHED" && onArchive && (
                <button
                  type="button"
                  className="table-action-btn btn-archive"
                  onClick={() => onArchive(announcement.id)}
                  disabled={actionLoading}
                >
                  <ClockIcon size={14} />
                  <span>Archive</span>
                </button>
              )}

              {announcement.status !== "ARCHIVED" && onEdit && (
                <button
                  type="button"
                  className="table-action-btn btn-view btn-edit"
                  onClick={() => onEdit(announcement)}
                  disabled={actionLoading}
                >
                  <EditIcon size={14} />
                  <span>Edit</span>
                </button>
              )}

              {onDelete && (
                <button
                  type="button"
                  className="table-action-btn btn-delete"
                  onClick={() => onDelete(announcement.id)}
                  disabled={actionLoading}
                >
                  <TrashIcon size={14} />
                  <span>Delete</span>
                </button>
              )}
            </div>
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
  );
}
