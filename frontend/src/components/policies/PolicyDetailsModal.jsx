import { useEffect } from "react";
import { CloseIcon, ShieldIcon, CalendarIcon, CheckCircleIcon } from "../icons/Icons";
import "../../styles/policies.css";

const CATEGORY_BADGE_MAP = {
  "OFFICE RULES": "badge-policy-office",
  "LEAVE POLICIES": "badge-policy-leave",
  "ATTENDANCE": "badge-policy-attendance",
  "WORKPLACE CONDUCT": "badge-policy-conduct",
  "TECHNOLOGY & SECURITY": "badge-policy-tech",
  "EMPLOYEE GUIDELINES": "badge-policy-guidelines",
};

export default function PolicyDetailsModal({ policy, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!policy) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return "01 Oct 2026";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const badgeClass = CATEGORY_BADGE_MAP[policy.category] || "badge-policy-office";

  // Split content into clean paragraphs
  const paragraphs = (policy.content || "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div
      className="policy-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="policy-modal-title"
    >
      <div
        className="policy-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="policy-modal-header">
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span className={`badge ${badgeClass}`}>
                {policy.category}
              </span>
              <span className="badge badge-status-published" style={{ background: "#dcfce7", color: "#15803d", border: "1px solid rgba(21, 128, 61, 0.2)" }}>
                {policy.status || "PUBLISHED"}
              </span>
            </div>
            <h3 id="policy-modal-title" className="policy-modal-title">
              {policy.title}
            </h3>
          </div>

          <button
            type="button"
            className="policy-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Metadata Grid */}
        <div className="policy-modal-meta-grid">
          <div className="policy-modal-meta-item">
            <span className="policy-modal-meta-label">Category</span>
            <span className="policy-modal-meta-value">{policy.category}</span>
          </div>
          <div className="policy-modal-meta-item">
            <span className="policy-modal-meta-label">Status</span>
            <span className="policy-modal-meta-value" style={{ color: "#16a34a" }}>
              {policy.status || "Published"}
            </span>
          </div>
          <div className="policy-modal-meta-item">
            <span className="policy-modal-meta-label">Effective Date</span>
            <span className="policy-modal-meta-value">
              {formatDate(policy.effective_date)}
            </span>
          </div>
          <div className="policy-modal-meta-item">
            <span className="policy-modal-meta-label">Last Updated</span>
            <span className="policy-modal-meta-value">
              {formatDate(policy.updated_at || policy.created_at || policy.effective_date)}
            </span>
          </div>
        </div>

        {/* Document Body */}
        <div className="policy-modal-body">
          <div className="policy-document-section-title">
            <ShieldIcon size={14} />
            <span>Policy Content</span>
          </div>

          <div className="policy-document-content">
            {paragraphs.length > 0 ? (
              paragraphs.map((para, idx) => (
                <p key={idx} className="policy-document-paragraph">
                  {para}
                </p>
              ))
            ) : (
              <p className="policy-document-paragraph">
                {policy.content || "No policy content available."}
              </p>
            )}
          </div>
        </div>

        {/* Read-only Document Footer */}
        <div className="policy-modal-footer">
          <div className="policy-modal-footer-notice">
            <ShieldIcon size={14} />
            <span>Official Organization Policy • Read-only document</span>
          </div>

          <button
            type="button"
            className="policy-modal-done-btn"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
