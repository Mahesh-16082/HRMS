import { useState, useEffect } from "react";
import { CloseIcon } from "../icons/Icons";
import "../../styles/announcements.css";

const CATEGORIES = [
  { value: "GENERAL", label: "General" },
  { value: "POLICY", label: "Policy" },
  { value: "EVENT", label: "Event" },
  { value: "HOLIDAY", label: "Holiday" },
  { value: "IMPORTANT", label: "Important" },
];

const PRIORITIES = [
  { value: "LOW", label: "Low Priority" },
  { value: "MEDIUM", label: "Medium Priority" },
  { value: "HIGH", label: "High Priority" },
  { value: "URGENT", label: "Urgent Priority" },
];

// Helper to format ISO datetime to YYYY-MM-DDTHH:mm for datetime-local input
const toDateTimeLocalValue = (isoString) => {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export default function AnnouncementFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData = null,
  isSubmitting = false,
}) {
  const isEditing = Boolean(initialData?.id);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [priority, setPriority] = useState("MEDIUM");
  const [expiresAt, setExpiresAt] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || "");
      setDescription(initialData.description || "");
      setCategory(initialData.category || "GENERAL");
      setPriority(initialData.priority || "MEDIUM");
      setExpiresAt(toDateTimeLocalValue(initialData.expires_at));
    } else {
      setTitle("");
      setDescription("");
      setCategory("GENERAL");
      setPriority("MEDIUM");
      setExpiresAt("");
    }
    setValidationError("");
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError("");

    if (!title.trim()) {
      setValidationError("Announcement title is required.");
      return;
    }

    if (!description.trim()) {
      setValidationError("Announcement description is required.");
      return;
    }

    let parsedExpiresAt = null;
    if (expiresAt) {
      const expDate = new Date(expiresAt);
      if (isNaN(expDate.getTime())) {
        setValidationError("Invalid expiration date.");
        return;
      }
      if (expDate.getTime() <= Date.now()) {
        setValidationError("Expiration date must be in the future.");
        return;
      }
      parsedExpiresAt = expDate.toISOString();
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      expires_at: parsedExpiresAt,
    };

    onSubmit(payload);
  };

  return (
    <div className="modal-overlay" onClick={!isSubmitting ? onClose : undefined}>
      <div
        className="modal-card announcement-form-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 className="modal-title">
            {isEditing ? "Edit Announcement" : "Create New Announcement"}
          </h3>
          <button
            className="modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            title="Close"
            aria-label="Close"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="announcement-form-container">
          <div className="modal-body announcement-form-body" style={{ gap: "16px" }}>
            {validationError && (
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
                {validationError}
              </div>
            )}

            {/* Title */}
            <div className="form-group">
              <label htmlFor="announcement-title" className="form-label">
                Title <span style={{ color: "var(--danger, #ef4444)" }}>*</span>
              </label>
              <input
                id="announcement-title"
                type="text"
                className="form-input"
                placeholder="e.g. Annual Company Offsite 2026"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={255}
                disabled={isSubmitting}
                required
              />
            </div>

            {/* Category and Priority Grid */}
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="announcement-category" className="form-label">
                  Category <span style={{ color: "var(--danger, #ef4444)" }}>*</span>
                </label>
                <select
                  id="announcement-category"
                  className="form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={isSubmitting}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="announcement-priority" className="form-label">
                  Priority <span style={{ color: "var(--danger, #ef4444)" }}>*</span>
                </label>
                <select
                  id="announcement-priority"
                  className="form-select"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  disabled={isSubmitting}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Expiry Date */}
            <div className="form-group">
              <label htmlFor="announcement-expiry" className="form-label">
                Expiration Date (Optional)
              </label>
              <input
                id="announcement-expiry"
                type="datetime-local"
                className="form-input"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                disabled={isSubmitting}
              />
              <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                Once expired, this announcement will automatically disappear from employee views.
              </span>
            </div>

            {/* Description */}
            <div className="form-group">
              <label htmlFor="announcement-description" className="form-label">
                Description / Message <span style={{ color: "var(--danger, #ef4444)" }}>*</span>
              </label>
              <textarea
                id="announcement-description"
                className="form-textarea"
                rows={5}
                placeholder="Write the full announcement content here..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div className="modal-footer announcement-form-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                ? "Save Changes"
                : "Create Announcement"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
