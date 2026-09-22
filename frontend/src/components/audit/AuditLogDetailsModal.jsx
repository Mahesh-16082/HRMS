import { useState, useEffect } from "react";
import { auditApi } from "../../api/auditApi";
import {
  CloseIcon,
  CheckCircleIcon,
  ShieldIcon,
  ClockIcon,
  UsersIcon,
} from "../icons/Icons";
import { LoadingState, ErrorAlert } from "../common/FeedbackStates";

export default function AuditLogDetailsModal({ logId, onClose }) {
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    async function fetchDetails() {
      try {
        setLoading(true);
        setError("");
        const data = await auditApi.getAuditLog(logId);
        if (isMounted) {
          setLog(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Failed to load audit log details.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (logId) {
      fetchDetails();
    }

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      isMounted = false;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [logId, onClose]);

  const getActionBadgeClass = (action) => {
    switch (action) {
      case "LOGIN":
        return "badge badge-action-login";
      case "LOGOUT":
        return "badge badge-action-logout";
      case "OTP_VERIFICATION":
        return "badge badge-action-otp";
      default:
        return "badge";
    }
  };

  const getStatusBadgeClass = (status) => {
    return status === "SUCCESS"
      ? "badge badge-audit-success"
      : "badge badge-audit-failed";
  };

  const formatDate = (isoString) => {
    if (!isoString) return "—";
    const date = new Date(isoString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "620px", width: "100%" }}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "var(--primary-light)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShieldIcon size={20} />
            </div>
            <div>
              <h3 className="modal-title" style={{ margin: 0, fontSize: "17px" }}>
                Audit Log #{logId}
              </h3>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Authentication Activity Record
              </span>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ maxHeight: "calc(85vh - 120px)", overflowY: "auto" }}>
          {loading && <LoadingState message="Fetching audit details..." />}

          {error && <ErrorAlert message={error} />}

          {!loading && !error && log && (
            <div>
              {/* Event Summary Pill Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "10px",
                  padding: "12px 14px",
                  background: "var(--bg-hover)",
                  borderRadius: "10px",
                  border: "1px solid var(--border-color)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className={getActionBadgeClass(log.action)}>
                    {log.action}
                  </span>
                  <span className={getStatusBadgeClass(log.status)}>
                    {log.status === "SUCCESS" ? "✓ SUCCESS" : "✕ FAILED"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
                  <ClockIcon size={14} />
                  <span>{formatDate(log.created_at)}</span>
                </div>
              </div>

              {/* Grid Details */}
              <div className="audit-details-grid">
                {/* User / Identity */}
                <div className="audit-detail-item">
                  <span className="audit-detail-label">User / Identity</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <UsersIcon size={15} style={{ color: "var(--text-muted)" }} />
                    <span className="audit-detail-value" style={{ fontWeight: 600 }}>
                      {log.user?.full_name || log.email || "Unknown / Anonymous"}
                    </span>
                  </div>
                  {log.user?.role && (
                    <span style={{ fontSize: "11px", color: "var(--primary)", textTransform: "uppercase", fontWeight: 700 }}>
                      Role: {log.user.role}
                    </span>
                  )}
                </div>

                {/* Email Address */}
                <div className="audit-detail-item">
                  <span className="audit-detail-label">Email Address</span>
                  <span className="audit-detail-value audit-mono">
                    {log.email || log.user?.email || "—"}
                  </span>
                </div>

                {/* User ID */}
                <div className="audit-detail-item">
                  <span className="audit-detail-label">User ID</span>
                  <span className="audit-detail-value audit-mono">
                    {log.user_id !== null && log.user_id !== undefined ? `#${log.user_id}` : "Unauthenticated"}
                  </span>
                </div>

                {/* IP Address */}
                <div className="audit-detail-item">
                  <span className="audit-detail-label">Client IP Address</span>
                  <span className="audit-detail-value audit-mono">
                    {log.ip_address || "Unavailable"}
                  </span>
                </div>
              </div>

              {/* Details / Message */}
              <div style={{ marginBottom: "16px" }}>
                <span className="audit-detail-label" style={{ display: "block", marginBottom: "6px" }}>
                  Event Details & Context
                </span>
                <div
                  style={{
                    background: "var(--bg-hover)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    fontSize: "13px",
                    color: "var(--text-main)",
                    lineHeight: "1.5",
                  }}
                >
                  {log.details || "No additional metadata recorded for this authentication event."}
                </div>
              </div>

              {/* User Agent */}
              <div style={{ marginBottom: "18px" }}>
                <span className="audit-detail-label" style={{ display: "block", marginBottom: "6px" }}>
                  User Agent
                </span>
                <div
                  className="audit-mono"
                  style={{
                    background: "var(--bg-hover)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    fontSize: "11.5px",
                    color: "var(--text-muted)",
                    wordBreak: "break-all",
                    lineHeight: "1.4",
                  }}
                >
                  {log.user_agent || "No User-Agent header detected."}
                </div>
              </div>

              {/* Append-only Compliance Notice */}
              <div className="audit-banner-notice">
                <CheckCircleIcon size={16} style={{ color: "#16a34a", flexShrink: 0 }} />
                <span>
                  <strong>Immutable Audit Record:</strong> This entry is permanently cryptographically logged and append-only. Modification and deletion are strictly prevented by enterprise policy.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ justifyContent: "flex-end" }}>
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
