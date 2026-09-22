import { useState, useEffect, useCallback } from "react";
import { leaveApi } from "../../api/leaveApi";
import { CloseIcon, CalendarIcon } from "../icons/Icons";

export default function ApplyLeaveModal({ isOpen, onClose, onSuccess, userBalances = [] }) {
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Handle escape key to close modal
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape" && !submitting) {
        onClose();
      }
    },
    [onClose, submitting]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "";
      };
    }
  }, [isOpen, handleKeyDown]);

  // Load active leave types when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setError("");
    setSuccessMsg("");
    setSubmitting(false);

    async function fetchTypes() {
      try {
        setLoadingTypes(true);
        const data = await leaveApi.getActiveLeaveTypes();
        const types = data?.leave_types || [];
        setLeaveTypes(types);
        if (types.length > 0) {
          setSelectedTypeId(String(types[0].id));
        }
      } catch (err) {
        setError(err.message || "Failed to load leave types");
      } finally {
        setLoadingTypes(false);
      }
    }

    fetchTypes();
  }, [isOpen]);

  if (!isOpen) return null;

  // Calculate day count
  const calculateDays = () => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) return -1;
    const diffTime = Math.abs(end - start);
    return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const calculatedDays = calculateDays();

  // Find balance for selected leave type
  const selectedBalance = userBalances.find(
    (b) => String(b.leave_type_id) === String(selectedTypeId)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!selectedTypeId) {
      setError("Please select a leave type.");
      return;
    }
    if (!startDate) {
      setError("Please select a start date.");
      return;
    }
    if (!endDate) {
      setError("Please select an end date.");
      return;
    }
    if (calculatedDays === -1) {
      setError("End date cannot be earlier than start date.");
      return;
    }
    if (!reason.trim()) {
      setError("Please provide a reason for your leave request.");
      return;
    }

    try {
      setSubmitting(true);
      await leaveApi.applyLeave({
        leave_type_id: Number(selectedTypeId),
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim(),
      });

      setSuccessMsg("Leave request submitted successfully! Status: PENDING.");
      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => {
        onClose();
        setStartDate("");
        setEndDate("");
        setReason("");
        setSuccessMsg("");
      }, 1400);
    } catch (err) {
      setError(err.message || "Failed to submit leave request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={submitting ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="apply-leave-modal-title"
    >
      <div
        className="modal-card"
        style={{ maxWidth: "540px" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "#dcfce7",
                color: "#16a34a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CalendarIcon size={20} />
            </div>
            <div>
              <h3 id="apply-leave-modal-title" className="modal-title">
                Apply for Leave
              </h3>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Submit a leave request for management review
              </span>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close modal"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div
                style={{
                  background: "#fee2e2",
                  color: "#991b1b",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  border: "1px solid #fecaca",
                }}
              >
                {error}
              </div>
            )}

            {successMsg && (
              <div
                style={{
                  background: "#dcfce7",
                  color: "#166534",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  border: "1px solid #bbf7d0",
                }}
              >
                {successMsg}
              </div>
            )}

            {/* Leave Type Selector */}
            <div className="form-group">
              <label className="form-label" htmlFor="leave-type-select">
                Leave Type <span style={{ color: "#ef4444" }}>*</span>
              </label>
              {loadingTypes ? (
                <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  Loading active leave types...
                </div>
              ) : (
                <select
                  id="leave-type-select"
                  className="form-select"
                  value={selectedTypeId}
                  onChange={(e) => setSelectedTypeId(e.target.value)}
                  disabled={submitting}
                >
                  {leaveTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name} ({type.code}) - Annual Quota: {type.annual_quota} days
                    </option>
                  ))}
                </select>
              )}

              {/* Balance information notice */}
              {selectedBalance && (
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--text-muted)",
                    marginTop: "4px",
                    display: "flex",
                    gap: "14px",
                  }}
                >
                  <span>Allocated: <strong>{selectedBalance.allocated}</strong></span>
                  <span>Used: <strong>{selectedBalance.used}</strong></span>
                  <span style={{ color: "#16a34a" }}>
                    Available: <strong>{selectedBalance.available} days</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Date Pickers */}
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="leave-start-date">
                  Start Date <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="leave-start-date"
                  type="date"
                  className="form-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="leave-end-date">
                  End Date <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="leave-end-date"
                  type="date"
                  className="form-input"
                  min={startDate}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            {/* Calculated duration indicator */}
            {calculatedDays !== null && (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  background: calculatedDays === -1 ? "#fee2e2" : "var(--bg-card-subtle)",
                  fontSize: "12.5px",
                  color: calculatedDays === -1 ? "#991b1b" : "var(--text-main)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>Calculated Duration:</span>
                <strong style={{ fontSize: "14px" }}>
                  {calculatedDays === -1
                    ? "Invalid (End date before Start date)"
                    : `${calculatedDays} Day${calculatedDays === 1 ? "" : "s"}`}
                </strong>
              </div>
            )}

            {/* Reason */}
            <div className="form-group">
              <label className="form-label" htmlFor="leave-reason">
                Reason for Leave <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <textarea
                id="leave-reason"
                className="form-textarea"
                rows={3}
                placeholder="State the reason for your leave request..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || (calculatedDays !== null && calculatedDays < 1)}
            >
              {submitting ? "Submitting..." : "Submit Leave Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
