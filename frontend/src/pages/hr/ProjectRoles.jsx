import { useState, useEffect, useCallback } from "react";
import { projectApi } from "../../api/projectApi";
import SectionHeader from "../../components/common/SectionHeader";
import StatCard from "../../components/common/StatCard";
import {
  LoadingState,
  EmptyState,
  ErrorAlert,
} from "../../components/common/FeedbackStates";
import {
  ProjectRolesIcon,
  CheckCircleIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  CloseIcon,
  ShieldIcon,
  ClockIcon,
} from "../../components/icons/Icons";

export default function ProjectRoles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null); // null = Add, object = Edit
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  // Delete confirmation modal
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    is_active: true,
  });

  const loadRoles = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await projectApi.getProjectRoles();
      const list = Array.isArray(data?.roles) ? data.roles : Array.isArray(data) ? data : [];
      setRoles(list);
    } catch (err) {
      setError(err.message || "Failed to load project roles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  // Open Add modal
  const handleOpenAdd = () => {
    setEditingRole(null);
    setFormData({
      name: "",
      code: "",
      description: "",
      is_active: true,
    });
    setModalError("");
    setIsModalOpen(true);
  };

  // Open Edit modal
  const handleOpenEdit = (role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      code: role.code,
      description: role.description || "",
      is_active: role.is_active,
    });
    setModalError("");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (submitting) return;
    setIsModalOpen(false);
    setEditingRole(null);
    setModalError("");
  };

  // Submit Add / Edit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError("");

    if (!formData.name.trim()) {
      setModalError("Project role name is required.");
      return;
    }
    if (!formData.code.trim()) {
      setModalError("Project role code is required.");
      return;
    }

    try {
      setSubmitting(true);
      if (editingRole) {
        await projectApi.updateProjectRole(editingRole.id, {
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          description: formData.description.trim() || null,
          is_active: formData.is_active,
        });
        setSuccessMsg(`Project role "${formData.name}" updated successfully!`);
      } else {
        await projectApi.createProjectRole({
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          description: formData.description.trim() || null,
          is_active: formData.is_active,
        });
        setSuccessMsg(`Project role "${formData.name}" created successfully!`);
      }
      handleCloseModal();
      loadRoles();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setModalError(err.message || "Operation failed.");
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Activate / Deactivate
  const handleToggleActive = async (role) => {
    try {
      setError("");
      if (role.is_active) {
        await projectApi.deactivateProjectRole(role.id);
        setSuccessMsg(`Project role "${role.name}" deactivated.`);
      } else {
        await projectApi.activateProjectRole(role.id);
        setSuccessMsg(`Project role "${role.name}" activated.`);
      }
      loadRoles();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setError(err.message || "Failed to toggle role status.");
    }
  };

  // Delete flow
  const handleOpenDelete = (role) => {
    setRoleToDelete(role);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!roleToDelete) return;
    try {
      setDeleting(true);
      setError("");
      await projectApi.deleteProjectRole(roleToDelete.id);
      setSuccessMsg(`Project role "${roleToDelete.name}" deleted successfully.`);
      setDeleteConfirmOpen(false);
      setRoleToDelete(null);
      loadRoles();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setError(err.message || "Failed to delete project role.");
      setDeleteConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const activeCount = roles.filter((r) => r.is_active).length;
  const inactiveCount = roles.length - activeCount;

  return (
    <div className="page-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <SectionHeader title="Project Roles" />
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <PlusIcon size={16} />
          <span>Add Project Role</span>
        </button>
      </div>

      {/* Top Stat Cards */}
      <div className="stats-grid" style={{ marginBottom: "24px" }}>
        <StatCard
          icon={ProjectRolesIcon}
          number={loading ? null : roles.length}
          loading={loading}
          label="Total Project Roles"
          color="purple"
        />
        <StatCard
          icon={CheckCircleIcon}
          number={loading ? null : activeCount}
          loading={loading}
          label="Active Roles"
          color="green"
        />
        <StatCard
          icon={ClockIcon}
          number={loading ? null : inactiveCount}
          loading={loading}
          label="Inactive Roles"
          color="blue"
        />
      </div>

      {error && <ErrorAlert message={error} onRetry={loadRoles} />}

      {successMsg && (
        <div
          style={{
            background: "#dcfce7",
            color: "#166534",
            padding: "12px 18px",
            borderRadius: "10px",
            fontSize: "13.5px",
            marginBottom: "20px",
            border: "1px solid #bbf7d0",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <CheckCircleIcon size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Roles Table Card */}
      <div className="table-card">
        <div className="table-header-bar">
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-heading)", margin: 0 }}>
              Configured Project Roles
            </h3>
            <span style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
              Define roles available for assignment across all projects
            </span>
          </div>
        </div>

        {loading ? (
          <LoadingState message="Loading project roles..." />
        ) : roles.length === 0 ? (
          <EmptyState
            icon={ProjectRolesIcon}
            title="No Project Roles Found"
            description="Create project roles like Frontend Developer, QA Engineer, or Project Manager to assign team members."
            action={
              <button className="btn btn-primary btn-sm" onClick={handleOpenAdd}>
                <PlusIcon size={14} /> Add First Role
              </button>
            }
          />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Role Name</th>
                  <th>Code</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "8px",
                            background: role.is_active ? "#eff6ff" : "#f1f5f9",
                            color: role.is_active ? "var(--primary)" : "var(--text-muted)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <ShieldIcon size={16} />
                        </div>
                        <span style={{ fontWeight: "600", color: "var(--text-heading)", fontSize: "13.5px" }}>
                          {role.name}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: "var(--bg-card-subtle)",
                          color: "var(--text-main)",
                          fontFamily: "monospace",
                          fontSize: "11px",
                          fontWeight: "600",
                          border: "1px solid var(--border-color)",
                          padding: "3px 8px",
                        }}
                      >
                        {role.code}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: "13px", maxWidth: "260px" }}>
                      {role.description || "—"}
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: role.is_active ? "#dcfce7" : "#fee2e2",
                          color: role.is_active ? "#15803d" : "#b91c1c",
                          fontSize: "11.5px",
                          padding: "3px 10px",
                          borderRadius: "12px",
                        }}
                      >
                        {role.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                        <button
                          type="button"
                          className="action-icon-btn"
                          onClick={() => handleOpenEdit(role)}
                          title="Edit role"
                        >
                          <EditIcon size={14} />
                        </button>

                        <button
                          type="button"
                          className="btn"
                          style={{
                            fontSize: "11.5px",
                            padding: "4px 10px",
                            background: role.is_active ? "#fef2f2" : "#f0fdf4",
                            color: role.is_active ? "#b91c1c" : "#166534",
                            border: `1px solid ${role.is_active ? "#fecaca" : "#bbf7d0"}`,
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontWeight: "500",
                          }}
                          onClick={() => handleToggleActive(role)}
                        >
                          {role.is_active ? "Deactivate" : "Activate"}
                        </button>

                        <button
                          type="button"
                          className="action-icon-btn danger"
                          onClick={() => handleOpenDelete(role)}
                          title="Delete role"
                        >
                          <TrashIcon size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================
          CREATE / EDIT ROLE MODAL
      ======================================================== */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "520px" }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">
                  {editingRole ? "Edit Project Role" : "Create Project Role"}
                </h3>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {editingRole ? "Update role configuration" : "Add a new role for project assignments"}
                </span>
              </div>
              <button className="modal-close-btn" onClick={handleCloseModal} disabled={submitting}>
                <CloseIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {modalError && (
                  <div style={{ background: "#fee2e2", color: "#b91c1c", padding: "10px 14px", borderRadius: "8px", fontSize: "13px" }}>
                    {modalError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="role-name">
                    Role Name <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    id="role-name"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Frontend Developer"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="role-code">
                    Role Code <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    id="role-code"
                    type="text"
                    className="form-input"
                    placeholder="e.g. FRONTEND_DEV"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    required
                    disabled={submitting}
                  />
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                    Unique identifier used in system references and logging
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="role-description">
                    Description
                  </label>
                  <textarea
                    id="role-description"
                    className="form-textarea"
                    rows={3}
                    placeholder="Optional details regarding role responsibilities..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    disabled={submitting}
                  />
                </div>

                <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    id="role-active"
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    disabled={submitting}
                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  <label htmlFor="role-active" style={{ fontSize: "13px", color: "var(--text-heading)", cursor: "pointer" }}>
                    Active (Available for new project assignments)
                  </label>
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
                  {submitting ? "Saving..." : editingRole ? "Update Role" : "Create Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          DELETE CONFIRMATION MODAL
      ======================================================== */}
      {deleteConfirmOpen && roleToDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteConfirmOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "440px" }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: "#b91c1c" }}>
                Confirm Deletion
              </h3>
              <button
                className="modal-close-btn"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={deleting}
              >
                <CloseIcon size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: "13.5px", color: "var(--text-main)", margin: 0, lineHeight: 1.5 }}>
                Are you sure you want to delete the project role{" "}
                <strong>&quot;{roleToDelete.name}&quot;</strong>?
              </p>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px", lineHeight: 1.4 }}>
                If this role is currently assigned to team members on active or historical projects, the system will prevent deletion and instruct you to deactivate it instead.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Role"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
