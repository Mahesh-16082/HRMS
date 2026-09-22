import { useState, useEffect } from "react";

const CATEGORY_SUGGESTIONS = [
  "Facilities",
  "IT Support",
  "Workplace & Environment",
  "Payroll & Compensation",
  "Equipment & Hardware",
  "Management & Leadership",
  "Policy & HR",
  "General Concern",
];

export default function ComplaintForm({
  initialData = null,
  onSubmit,
  onCancel,
  submitting = false,
  isEdit = false,
}) {
  const [formData, setFormData] = useState({
    subject: "",
    category: "Facilities",
    customCategory: "",
    priority: "MEDIUM",
    description: "",
  });

  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (initialData) {
      const isPredefined = CATEGORY_SUGGESTIONS.includes(initialData.category);
      setFormData({
        subject: initialData.subject || "",
        category: isPredefined ? initialData.category : "Other",
        customCategory: isPredefined ? "" : initialData.category || "",
        priority: initialData.priority || "MEDIUM",
        description: initialData.description || "",
      });
      setUseCustomCategory(!isPredefined && Boolean(initialData.category));
    }
  }, [initialData]);

  const handleCategoryChange = (e) => {
    const val = e.target.value;
    if (val === "Other") {
      setUseCustomCategory(true);
      setFormData((prev) => ({ ...prev, category: "Other" }));
    } else {
      setUseCustomCategory(false);
      setFormData((prev) => ({ ...prev, category: val, customCategory: "" }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError("");

    const subjectTrimmed = formData.subject.trim();
    const descriptionTrimmed = formData.description.trim();
    const finalCategory = (useCustomCategory ? formData.customCategory : formData.category).trim();

    if (!subjectTrimmed || subjectTrimmed.length < 3) {
      setValidationError("Subject must be at least 3 characters long.");
      return;
    }
    if (subjectTrimmed.length > 200) {
      setValidationError("Subject cannot exceed 200 characters.");
      return;
    }

    if (!finalCategory || finalCategory.length < 2) {
      setValidationError("Please specify a category (minimum 2 characters).");
      return;
    }
    if (finalCategory.length > 100) {
      setValidationError("Category cannot exceed 100 characters.");
      return;
    }

    if (!descriptionTrimmed || descriptionTrimmed.length < 5) {
      setValidationError("Description must be at least 5 characters long.");
      return;
    }

    // Strictly pass only allowable fields: subject, category, priority, description
    onSubmit({
      subject: subjectTrimmed,
      category: finalCategory,
      priority: formData.priority,
      description: descriptionTrimmed,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="complaint-form">
      {validationError && (
        <div
          style={{
            background: "#fee2e2",
            color: "#b91c1c",
            padding: "10px 14px",
            borderRadius: "8px",
            fontSize: "13px",
            marginBottom: "16px",
            border: "1px solid #fecaca",
          }}
        >
          {validationError}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Subject */}
        <div className="form-group">
          <label className="form-label" htmlFor="complaint-subject">
            Subject <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <input
            id="complaint-subject"
            type="text"
            className="form-input"
            placeholder="Brief title summarizing your complaint (e.g. Office AC not working)"
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            maxLength={200}
            required
            disabled={submitting}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              Minimum 3 characters
            </span>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              {formData.subject.length}/200
            </span>
          </div>
        </div>

        {/* Category & Priority Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div className="form-group">
            <label className="form-label" htmlFor="complaint-category">
              Category <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <select
              id="complaint-category"
              className="form-select"
              value={useCustomCategory ? "Other" : formData.category}
              onChange={handleCategoryChange}
              disabled={submitting}
            >
              {CATEGORY_SUGGESTIONS.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
              <option value="Other">Other (Custom category)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="complaint-priority">
              Priority <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <select
              id="complaint-priority"
              className="form-select"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              disabled={submitting}
            >
              <option value="LOW">Low (Non-urgent standard request)</option>
              <option value="MEDIUM">Medium (Normal operational impact)</option>
              <option value="HIGH">High (Urgent disruption or severe issue)</option>
            </select>
          </div>
        </div>

        {/* Custom Category Input if "Other" selected */}
        {useCustomCategory && (
          <div className="form-group">
            <label className="form-label" htmlFor="complaint-custom-category">
              Specify Category Name <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              id="complaint-custom-category"
              type="text"
              className="form-input"
              placeholder="e.g. Ergonomics, Parking, Cafeteria"
              value={formData.customCategory}
              onChange={(e) => setFormData({ ...formData, customCategory: e.target.value })}
              maxLength={100}
              required
              disabled={submitting}
            />
          </div>
        )}

        {/* Description */}
        <div className="form-group">
          <label className="form-label" htmlFor="complaint-description">
            Description <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <textarea
            id="complaint-description"
            className="form-textarea"
            rows={5}
            placeholder="Provide all relevant details, locations, dates, or context regarding your issue..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
            disabled={submitting}
          />
          <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            Minimum 5 characters. Be specific to help HR investigate quickly.
          </span>
        </div>
      </div>

      <div
        className="modal-footer"
        style={{
          marginTop: "24px",
          paddingTop: "16px",
          borderTop: "1px solid var(--border-color)",
          display: "flex",
          justifyContent: "flex-end",
          gap: "12px",
        }}
      >
        {onCancel && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting}
          style={{ minWidth: "120px" }}
        >
          {submitting ? "Saving..." : isEdit ? "Update Complaint" : "Submit Complaint"}
        </button>
      </div>
    </form>
  );
}
