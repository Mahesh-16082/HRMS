import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { leaveApi } from "../../api/leaveApi";
import SectionHeader from "../../components/common/SectionHeader";
import StatCard from "../../components/common/StatCard";
import {
  LoadingState,
  EmptyState,
  ErrorAlert,
} from "../../components/common/FeedbackStates";
import {
  LeaveTypesIcon,
  CheckCircleIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  CloseIcon,
  ChevronLeft,
} from "../../components/icons/Icons";

export default function LeaveTypes() {
  const navigate = useNavigate();
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState(null); // null = Add, object = Edit
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    annual_quota: 12,
  });

  const loadLeaveTypes = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await leaveApi.getAllLeaveTypes();
      setLeaveTypes(data?.leave_types || []);
    } catch (err) {
      setError(err.message || "Failed to load leave types.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeaveTypes();
  }, [loadLeaveTypes]);

  // Open Add modal
  const handleOpenAdd = () => {
    setEditingType(null);
    setFormData({
      name: "",
      code: "",
      description: "",
      annual_quota: 12,
    });
    setModalError("");
    setIsModalOpen(true);
  };

  // Open Edit modal
  const handleOpenEdit = (type) => {
    setEditingType(type);
    setFormData({
      name: type.name,
      code: type.code,
      description: type.description || "",
      annual_quota: type.annual_quota,
    });
    setModalError("");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (submitting) return;
    setIsModalOpen(false);
    setEditingType(null);
    setModalError("");
  };

  // Submit Add / Edit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError("");

    if (!formData.name.trim()) {
      setModalError("Leave type name is required.");
      return;
    }
    if (!formData.code.trim()) {
      setModalError("Leave type code is required.");
      return;
    }
    if (formData.annual_quota < 0) {
      setModalError("Annual quota must be 0 or greater.");
      return;
    }

    try {
      setSubmitting(true);
      if (editingType) {
        await leaveApi.updateLeaveType(editingType.id, {
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          description: formData.description.trim() || null,
          annual_quota: Number(formData.annual_quota),
        });
        setSuccessMsg(`Leave type "${formData.name}" updated successfully.`);
      } else {
        await leaveApi.createLeaveType({
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          description: formData.description.trim() || null,
          annual_quota: Number(formData.annual_quota),
          is_active: true,
        });
        setSuccessMsg(`Leave type "${formData.name}" created successfully.`);
      }
      setIsModalOpen(false);
      loadLeaveTypes();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setModalError(err.message || "Operation failed.");
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle active status
  const handleToggleStatus = async (type) => {
    try {
      setError("");
      if (type.is_active) {
        await leaveApi.deactivateLeaveType(type.id);
        setSuccessMsg(`Leave type "${type.name}" deactivated.`);
      } else {
        await leaveApi.activateLeaveType(type.id);
        setSuccessMsg(`Leave type "${type.name}" activated.`);
      }
      loadLeaveTypes();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setError(err.message || "Failed to update leave type status.");
    }
  };

  // Delete leave type
  const handleDelete = async (type) => {
    if (!window.confirm(`Are you sure you want to delete leave type "${type.name}"?`)) {
      return;
    }

    try {
      setError("");
      await leaveApi.deleteLeaveType(type.id);
      setSuccessMsg(`Leave type "${type.name}" deleted successfully.`);
      loadLeaveTypes();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setError(err.message || "Cannot delete leave type.");
    }
  };

  // Escape key listener for modal
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" && isModalOpen && !submitting) {
        handleCloseModal();
      }
    };
    if (isModalOpen) {
      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
    }
  }, [isModalOpen, submitting]);

  const activeCount = leaveTypes.filter((t) => t.is_active).length;

  return (
    <div className="page-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "8px" }}>
        <SectionHeader title="Leave Types Management" />
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/hr/leave-requests")}
            title="Back to Leave Requests"
          >
            <ChevronLeft size={16} />
            <span>Back to Leave Requests</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenAdd}
          >
            <PlusIcon size={14} />
            <span>Add Leave Type</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="stats-grid" style={{ marginBottom: "20px" }}>
        <StatCard
          icon={LeaveTypesIcon}
          number={loading ? null : leaveTypes.length}
          loading={loading}
          label="Total Leave Types"
          color="blue"
        />
        <StatCard
          icon={CheckCircleIcon}
          number={loading ? null : activeCount}
          loading={loading}
          label="Active Leave Types"
          color="green"
        />
      </div>

      {error && <ErrorAlert message={error} onRetry={loadLeaveTypes} />}
      {successMsg && (
        <div
          style={{
            background: "#dcfce7",
            color: "#166534",
            padding: "12px 18px",
            borderRadius: "10px",
            fontSize: "13.5px",
            marginBottom: "16px",
            border: "1px solid #bbf7d0",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <CheckCircleIcon size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Leave Types Table */}
      {loading ? (
        <LoadingState message="Loading leave types..." />
      ) : leaveTypes.length === 0 ? (
        <EmptyState
          icon={LeaveTypesIcon}
          title="No Leave Types Found"
          description="Create your first leave policy type by clicking '+ Add Leave Type'."
        />
      ) : (
        <div className="table-card">
          <div className="table-header-bar">
            <div>
              <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-heading)", margin: 0 }}>
                Configured Leave Policies
              </h3>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Organization-wide leave entitlements and quotas
              </span>
            </div>
          </div>

          <div className="table-responsive-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Leave Policy Name</th>
                  <th>Code</th>
                  <th>Description</th>
                  <th>Annual Quota</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaveTypes.map((type) => (
                  <tr key={type.id}>
                    <td>
                      <strong style={{ color: "var(--text-heading)" }}>{type.name}</strong>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: "#e0e7ff",
                          color: "#3730a3",
                          fontWeight: "600",
                          fontSize: "11px",
                        }}
                      >
                        {type.code}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-muted)", maxWidth: "300px" }}>
                      {type.description || "—"}
                    </td>
                    <td>
                      <span style={{ fontWeight: "600" }}>{type.annual_quota}</span>
                      <span style={{ fontSize: "11px", color: "var(--text-subtle)", marginLeft: "4px" }}>
                        days/yr
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${type.is_active ? "badge-active" : "badge-cancelled"}`}
                      >
                        {type.is_active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: "4px 8px", fontSize: "11px" }}
                          onClick={() => handleOpenEdit(type)}
                          title="Edit leave type"
                        >
                          <EditIcon size={13} /> Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{
                            padding: "4px 8px",
                            fontSize: "11px",
                            color: type.is_active ? "#b45309" : "#15803d",
                          }}
                          onClick={() => handleToggleStatus(type)}
                          title={type.is_active ? "Deactivate policy" : "Activate policy"}
                        >
                          {type.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: "4px 8px", fontSize: "11px", color: "#dc2626" }}
                          onClick={() => handleDelete(type)}
                          title="Safely delete leave type"
                        >
                          <TrashIcon size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div
          className="modal-overlay"
          onClick={handleCloseModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-card"
            style={{ maxWidth: "500px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: "#e0e7ff",
                    color: "#4f46e5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <LeaveTypesIcon size={20} />
                </div>
                <div>
                  <h3 className="modal-title">
                    {editingType ? "Edit Leave Type" : "Add New Leave Type"}
                  </h3>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    {editingType ? "Update policy details" : "Configure a new organization leave quota"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseModal}
                disabled={submitting}
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {modalError && (
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
                    {modalError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="type-name">
                    Leave Policy Name <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    id="type-name"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Parental Leave, Sick Leave"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={submitting}
                  />
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label" htmlFor="type-code">
                      Policy Code <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      id="type-code"
                      type="text"
                      className="form-input"
                      placeholder="e.g. SICK, MATERNITY"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      disabled={submitting}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="type-quota">
                      Annual Quota (Days) <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      id="type-quota"
                      type="number"
                      step="0.5"
                      min="0"
                      className="form-input"
                      value={formData.annual_quota}
                      onChange={(e) => setFormData({ ...formData, annual_quota: e.target.value })}
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="type-desc">
                    Description
                  </label>
                  <textarea
                    id="type-desc"
                    className="form-textarea"
                    rows={3}
                    placeholder="Provide details about eligible circumstances for this leave..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCloseModal}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Saving..." : editingType ? "Save Changes" : "Create Leave Type"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
