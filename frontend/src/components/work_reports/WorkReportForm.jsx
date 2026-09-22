import { useState, useEffect } from "react";
import { projectApi } from "../../api/projectApi";
import WorkReportAttachment, { formatFileSize } from "./WorkReportAttachment";
import { PaperclipIcon, AlertCircleIcon, CloseIcon } from "../icons/Icons";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "txt",
  "csv",
];

export default function WorkReportForm({
  initialData = null,
  prefilledDate = null,
  onSubmit, // async (payload, stagedFile, isSubmitAction) => void
  onCancel,
  submitting = false,
  isEdit = false,
}) {
  const todayStr = new Date().toISOString().split("T")[0];

  const [workDate, setWorkDate] = useState(
    initialData?.work_date || prefilledDate || todayStr
  );
  const [projectId, setProjectId] = useState(
    initialData?.project_id !== undefined && initialData?.project_id !== null
      ? String(initialData.project_id)
      : ""
  );
  const [title, setTitle] = useState(initialData?.title || "");
  const [tasksCompleted, setTasksCompleted] = useState(
    initialData?.tasks_completed || ""
  );
  const [plansForTomorrow, setPlansForTomorrow] = useState(
    initialData?.plans_for_tomorrow || ""
  );
  const [blockers, setBlockers] = useState(initialData?.blockers || "");
  const [hoursWorked, setHoursWorked] = useState(
    initialData?.hours_worked !== undefined && initialData?.hours_worked !== null
      ? initialData.hours_worked
      : 8.0
  );

  // Staged attachment for newly created reports
  const [stagedFile, setStagedFile] = useState(null);
  // Live attachment for existing reports
  const [currentAttachment, setCurrentAttachment] = useState(
    initialData?.attachment || null
  );

  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [formError, setFormError] = useState("");

  // Load active project assignments for this employee
  useEffect(() => {
    let isMounted = true;
    async function loadProjects() {
      try {
        setLoadingProjects(true);
        const res = await projectApi.getMyProjectAssignments();
        if (isMounted) {
          const list = Array.isArray(res?.assignments)
            ? res.assignments
            : Array.isArray(res)
            ? res
            : [];
          setProjects(list);
        }
      } catch (err) {
        console.warn("Could not load project assignments:", err.message);
      } finally {
        if (isMounted) setLoadingProjects(false);
      }
    }
    loadProjects();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleStagedFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.size > MAX_FILE_SIZE) {
      setFormError(`File size (${formatFileSize(file.size)}) exceeds the maximum allowed limit of 10 MB.`);
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setFormError(`Unsupported file format (.${ext}). Allowed: PDF, Word, Excel, PowerPoint, Images, Text, CSV.`);
      return;
    }

    setFormError("");
    setStagedFile(file);
  };

  const handleAction = (e, isSubmit) => {
    e.preventDefault();
    setFormError("");

    if (!workDate) {
      setFormError("Work date is required.");
      return;
    }
    if (workDate > todayStr) {
      setFormError("Work date cannot be in the future.");
      return;
    }
    if (!title.trim()) {
      setFormError("Report title is required.");
      return;
    }
    if (!tasksCompleted.trim()) {
      setFormError("Tasks completed description is required.");
      return;
    }
    const hoursNum = parseFloat(hoursWorked);
    if (isNaN(hoursNum) || hoursNum < 0.5 || hoursNum > 24) {
      setFormError("Hours worked must be between 0.5 and 24 hours.");
      return;
    }

    const payload = {
      work_date: workDate,
      project_id: projectId ? parseInt(projectId, 10) : null,
      title: title.trim(),
      tasks_completed: tasksCompleted.trim(),
      plans_for_tomorrow: plansForTomorrow.trim() || null,
      blockers: blockers.trim() || null,
      hours_worked: hoursNum,
      submit: isSubmit,
    };

    onSubmit(payload, stagedFile, isSubmit);
  };

  return (
    <form onSubmit={(e) => handleAction(e, false)} className="wr-form">
      {formError && (
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
          <span>{formError}</span>
        </div>
      )}

      {/* Row 1: Date & Project */}
      <div className="wr-form-row" style={{ marginBottom: "14px" }}>
        <div className="form-group">
          <label className="input-label" htmlFor="wr-date">
            Work Date <span className="required-star">*</span>
          </label>
          <input
            id="wr-date"
            type="date"
            className="input-field"
            value={workDate}
            max={todayStr}
            onChange={(e) => setWorkDate(e.target.value)}
            disabled={submitting || isEdit} // Date locked upon edit to preserve single report per date integrity
            required
          />
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Cannot be in the future. One report per calendar date.
          </span>
        </div>

        <div className="form-group">
          <label className="input-label" htmlFor="wr-project">
            Project Association (Optional)
          </label>
          <select
            id="wr-project"
            className="input-field"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={submitting}
          >
            <option value="">None / Internal / Administrative</option>
            {loadingProjects ? (
              <option disabled>Loading your assigned projects...</option>
            ) : (
              projects.map((p) => {
                const pId = p.project_id || p.id;
                const pName = p.project_name || p.title || `Project #${pId}`;
                const roleLabel = p.role_name ? ` (${p.role_name})` : "";
                return (
                  <option key={pId} value={pId}>
                    {pName} {roleLabel}
                  </option>
                );
              })
            )}
          </select>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Select from your actively assigned projects.
          </span>
        </div>
      </div>

      {/* Row 2: Title & Hours */}
      <div className="wr-form-row" style={{ marginBottom: "14px" }}>
        <div className="form-group" style={{ flex: 2 }}>
          <label className="input-label" htmlFor="wr-title">
            Report Title <span className="required-star">*</span>
          </label>
          <input
            id="wr-title"
            type="text"
            className="input-field"
            placeholder="e.g. Daily progress on frontend authentication and report module"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
            required
          />
        </div>

        <div className="form-group" style={{ flex: 1 }}>
          <label className="input-label" htmlFor="wr-hours">
            Hours Worked <span className="required-star">*</span>
          </label>
          <input
            id="wr-hours"
            type="number"
            className="input-field"
            min="0.5"
            max="24"
            step="0.5"
            value={hoursWorked}
            onChange={(e) => setHoursWorked(e.target.value)}
            disabled={submitting}
            required
          />
        </div>
      </div>

      {/* Tasks Completed */}
      <div className="form-group" style={{ marginBottom: "14px" }}>
        <label className="input-label" htmlFor="wr-tasks">
          Tasks Completed Today <span className="required-star">*</span>
        </label>
        <textarea
          id="wr-tasks"
          className="input-field"
          rows={4}
          placeholder="Detailed breakdown of tasks completed today, deliverables completed, bug fixes, etc."
          value={tasksCompleted}
          onChange={(e) => setTasksCompleted(e.target.value)}
          disabled={submitting}
          required
        />
      </div>

      {/* Row 3: Plans for Tomorrow & Blockers */}
      <div className="wr-form-row" style={{ marginBottom: "16px" }}>
        <div className="form-group">
          <label className="input-label" htmlFor="wr-plans">
            Plans for Tomorrow (Optional)
          </label>
          <textarea
            id="wr-plans"
            className="input-field"
            rows={3}
            placeholder="Key priorities, planned milestones, and focus items for next working day"
            value={plansForTomorrow}
            onChange={(e) => setPlansForTomorrow(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className="form-group">
          <label className="input-label" htmlFor="wr-blockers">
            Blockers &amp; Impediments (Optional)
          </label>
          <textarea
            id="wr-blockers"
            className="input-field"
            rows={3}
            placeholder="Any dependencies, blockers, or assistance required from team members or HR"
            value={blockers}
            onChange={(e) => setBlockers(e.target.value)}
            disabled={submitting}
          />
        </div>
      </div>

      {/* Attachment Section */}
      {isEdit && initialData?.id ? (
        <WorkReportAttachment
          reportId={initialData.id}
          attachment={currentAttachment}
          reportStatus={initialData.status}
          canManage={true}
          onAttachmentChange={(updated) => setCurrentAttachment(updated)}
        />
      ) : (
        <div className="wr-attachment-section">
          <label className="input-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <PaperclipIcon size={16} />
            Document Attachment (Optional, max 1)
          </label>

          {stagedFile ? (
            <div className="wr-attachment-card">
              <div className="wr-attachment-info">
                <div className="wr-attachment-icon">
                  <PaperclipIcon size={18} />
                </div>
                <div className="wr-attachment-meta">
                  <span className="wr-attachment-name">{stagedFile.name}</span>
                  <span className="wr-attachment-sub">
                    {formatFileSize(stagedFile.size)} • Will be uploaded upon saving
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "4px 8px", fontSize: "11.5px" }}
                onClick={() => setStagedFile(null)}
                disabled={submitting}
              >
                <CloseIcon size={14} /> Remove
              </button>
            </div>
          ) : (
            <label
              className="wr-file-dropzone"
              style={{ display: "block", cursor: "pointer" }}
            >
              <input
                type="file"
                multiple={false}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.txt,.csv"
                style={{ display: "none" }}
                onChange={handleStagedFileSelect}
                disabled={submitting}
              />
              <div style={{ display: "flex", justifyContent: "center", color: "var(--primary, #5746e8)", marginBottom: "4px" }}>
                <PaperclipIcon size={22} />
              </div>
              <p className="wr-file-dropzone-text">
                Click to attach a supporting work document (Max 1 file)
              </p>
              <span className="wr-file-dropzone-hint">
                PDF, Word, Excel, PPT, PNG, JPG, Text, CSV (Up to 10 MB)
              </span>
            </label>
          )}
        </div>
      )}

      {/* Form Action Buttons */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "10px",
          marginTop: "20px",
          paddingTop: "14px",
          borderTop: "1px solid var(--border-color, #e2e8f0)",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={(e) => handleAction(e, false)}
          disabled={submitting}
          style={{ fontWeight: "600" }}
        >
          {submitting ? "Saving..." : isEdit ? "Save Changes" : "Save as Draft"}
        </button>

        <button
          type="button"
          className="btn btn-primary"
          onClick={(e) => handleAction(e, true)}
          disabled={submitting}
          style={{ fontWeight: "600" }}
        >
          {submitting ? "Submitting..." : isEdit ? "Submit / Resubmit" : "Submit Report"}
        </button>
      </div>
    </form>
  );
}
