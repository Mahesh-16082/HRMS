import { useState, useRef } from "react";
import {
  PaperclipIcon,
  DownloadIcon,
  FileTextIcon,
  TrashIcon,
  LockIcon,
  CheckCircleIcon,
  AlertCircleIcon,
} from "../icons/Icons";
import { uploadAttachment, deleteAttachment } from "../../api/workReportApi";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
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

export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function WorkReportAttachment({
  reportId,
  attachment,
  reportStatus,
  canManage = false, // true only if authenticated employee owns this DRAFT/REJECTED report
  onAttachmentChange, // callback when attachment is uploaded or deleted
}) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isLocked = reportStatus === "SUBMITTED" || reportStatus === "APPROVED";
  const isEditable = canManage && !isLocked;

  const validateFile = (file) => {
    if (!file) return "Please select a file to upload.";
    if (file.size > MAX_FILE_SIZE) {
      return `File size (${formatFileSize(file.size)}) exceeds the maximum allowed limit of 10 MB.`;
    }
    const parts = file.name.split(".");
    const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `Unsupported file format (.${ext}). Allowed: PDF, Word, Excel, PowerPoint, Images, Text, CSV.`;
    }
    return null;
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so change triggers even if same file chosen again
    e.target.value = "";

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!reportId) {
      // If report hasn't been created yet, parent handles initial file staging
      if (onAttachmentChange) {
        onAttachmentChange(file);
      }
      return;
    }

    try {
      setUploading(true);
      setError("");
      setSuccess("");
      const newAttachment = await uploadAttachment(reportId, file);
      setSuccess("Attachment uploaded successfully.");
      if (onAttachmentChange) {
        onAttachmentChange(newAttachment);
      }
    } catch (err) {
      setError(err.message || "Failed to upload attachment.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!attachment || !reportId) return;
    if (!window.confirm("Are you sure you want to remove this attachment?")) return;

    try {
      setDeleting(true);
      setError("");
      setSuccess("");
      await deleteAttachment(reportId, attachment.id);
      setSuccess("Attachment removed.");
      if (onAttachmentChange) {
        onAttachmentChange(null);
      }
    } catch (err) {
      setError(err.message || "Failed to delete attachment.");
    } finally {
      setDeleting(false);
    }
  };

  const handleReplace = () => {
    if (!isEditable) return;
    fileInputRef.current?.click();
  };

  return (
    <div className="wr-attachment-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <label className="input-label" style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
          <PaperclipIcon size={16} />
          Supporting Document Attachment
          <span style={{ fontSize: "11px", fontWeight: "400", color: "var(--text-muted)" }}>
            (Max 1 file, up to 10 MB)
          </span>
        </label>
        {isLocked && (
          <span style={{ fontSize: "11.5px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
            <LockIcon size={12} /> Attachment locked with submission
          </span>
        )}
      </div>

      {error && (
        <div style={{ padding: "8px 12px", background: "#fee2e2", color: "#b91c1c", borderRadius: "6px", fontSize: "12.5px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
          <AlertCircleIcon size={15} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div style={{ padding: "8px 12px", background: "#dcfce7", color: "#15803d", borderRadius: "6px", fontSize: "12.5px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
          <CheckCircleIcon size={15} />
          <span>{success}</span>
        </div>
      )}

      {/* Hidden single file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple={false}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.txt,.csv"
        style={{ display: "none" }}
        onChange={handleFileSelect}
        disabled={uploading || deleting}
      />

      {/* When an attachment exists */}
      {attachment ? (
        <div className="wr-attachment-card">
          <div className="wr-attachment-info">
            <div className="wr-attachment-icon">
              <FileTextIcon size={20} />
            </div>
            <div className="wr-attachment-meta">
              <span className="wr-attachment-name" title={attachment.original_filename || "Attachment"}>
                {attachment.original_filename || "Document"}
              </span>
              <span className="wr-attachment-sub">
                <span>{formatFileSize(attachment.file_size)}</span>
                {attachment.file_type && (
                  <>
                    <span>•</span>
                    <span>{attachment.file_type.split("/")[1]?.toUpperCase() || "FILE"}</span>
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="wr-attachment-actions">
            {isLocked ? (
              <span className="wr-attachment-locked-badge">
                <LockIcon size={13} />
                Attachment locked with submission
              </span>
            ) : (
              <a
                href={attachment.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ padding: "5px 12px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px", textDecoration: "none" }}
                title="View or download document"
              >
                <DownloadIcon size={14} />
                View / Download
              </a>
            )}

            {/* Replace / Delete buttons (author + editable only) */}
            {isEditable && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: "5px 10px", fontSize: "12px" }}
                  onClick={handleReplace}
                  disabled={uploading || deleting}
                  title="Replace with another file"
                >
                  {uploading ? "Uploading..." : "Replace"}
                </button>
                <button
                  type="button"
                  className="btn btn-danger-outline"
                  style={{ padding: "5px 10px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  onClick={handleDelete}
                  disabled={uploading || deleting}
                  title="Remove attachment"
                >
                  <TrashIcon size={14} />
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        /* No attachment yet */
        <>
          {isEditable ? (
            <div
              className="wr-file-dropzone"
              onClick={() => !uploading && fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              <div style={{ display: "flex", justifyContent: "center", color: "var(--primary, #5746e8)", marginBottom: "4px" }}>
                <PaperclipIcon size={24} />
              </div>
              <p className="wr-file-dropzone-text">
                {uploading ? "Uploading document..." : "Click to select a document attachment"}
              </p>
              <span className="wr-file-dropzone-hint">
                Allowed: PDF, Word, Excel, PowerPoint, PNG, JPG, Text, CSV (Max 10 MB)
              </span>
            </div>
          ) : (
            <div style={{ padding: "12px 16px", background: "var(--bg-surface, #f8fafc)", border: "1px dashed var(--border-color, #e2e8f0)", borderRadius: "8px", color: "var(--text-muted)", fontSize: "13px" }}>
              No document attached to this report.
            </div>
          )}
        </>
      )}
    </div>
  );
}
