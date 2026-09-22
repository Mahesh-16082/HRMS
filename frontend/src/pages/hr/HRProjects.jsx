import { useState, useEffect, useCallback } from "react";
import { projectApi } from "../../api/projectApi";
import { employeeApi } from "../../api/employeeApi";
import SectionHeader from "../../components/common/SectionHeader";
import StatCard from "../../components/common/StatCard";
import {
  LoadingState,
  EmptyState,
  ErrorAlert,
} from "../../components/common/FeedbackStates";
import {
  ProjectsIcon,
  ClipboardCheckIcon,
  UsersIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  CloseIcon,
  CheckCircleIcon,
  CalendarIcon,
} from "../../components/icons/Icons";

export default function HRProjects() {
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [totalProjects, setTotalProjects] = useState(null);
  const [activeProjects, setActiveProjects] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filters
  const [statusFilter, setStatusFilter] = useState("");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  // Assignments for selected project
  const [projectAssignments, setProjectAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [selectedEmployeeToAssign, setSelectedEmployeeToAssign] = useState("");
  const [assigning, setAssigning] = useState(false);

  // Create/Edit form states
  const [formData, setFormData] = useState({
    project_name: "",
    description: "",
    start_date: "",
    end_date: "",
  });
  const [newStatus, setNewStatus] = useState("PLANNED");
  const [submitting, setSubmitting] = useState(false);

  // Load employee list for project assignment dropdown
  useEffect(() => {
    employeeApi.listEmployees({ limit: 100 })
      .then((data) => setEmployees(data.employees || []))
      .catch((err) => console.warn("Failed to load employees for assignment:", err.message));
  }, []);

  // Fetch Projects and Stats
  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = {};
      if (statusFilter) params.status = statusFilter;

      const [listRes, countRes, activeCountRes] = await Promise.allSettled([
        projectApi.getProjects(params),
        projectApi.getProjectCount(),
        projectApi.getProjectCount({ status: "ACTIVE" }),
      ]);

      if (listRes.status === "fulfilled") {
        setProjects(listRes.value?.projects || []);
      }
      if (countRes.status === "fulfilled") {
        setTotalProjects(countRes.value?.count ?? 0);
      }
      if (activeCountRes.status === "fulfilled") {
        setActiveProjects(activeCountRes.value?.count ?? 0);
      }
    } catch (err) {
      setError(err.message || "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormData({
      project_name: "",
      description: "",
      start_date: "",
      end_date: "",
    });
    setCreateModalOpen(true);
  };

  // Submit Create Project
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const payload = {
        project_name: formData.project_name.trim(),
        description: formData.description.trim() || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
      };

      await projectApi.createProject(payload);
      setSuccessMsg("Project created successfully!");
      setCreateModalOpen(false);
      fetchProjects();
    } catch (err) {
      setError(err.message || "Failed to create project.");
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (proj) => {
    setSelectedProject(proj);
    setFormData({
      project_name: proj.project_name || "",
      description: proj.description || "",
      start_date: proj.start_date || "",
      end_date: proj.end_date || "",
    });
    setEditModalOpen(true);
  };

  // Submit Edit Project
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProject) return;

    setSubmitting(true);
    setError("");

    try {
      const payload = {
        project_name: formData.project_name.trim(),
        description: formData.description.trim() || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
      };

      await projectApi.updateProject(selectedProject.id, payload);
      setSuccessMsg("Project details updated.");
      setEditModalOpen(false);
      fetchProjects();
    } catch (err) {
      setError(err.message || "Failed to update project.");
    } finally {
      setSubmitting(false);
    }
  };

  // Open Status Modal
  const handleOpenStatus = (proj) => {
    setSelectedProject(proj);
    setNewStatus(proj.status || "PLANNED");
    setStatusModalOpen(true);
  };

  // Submit Status Change
  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProject) return;

    setSubmitting(true);
    setError("");

    try {
      await projectApi.updateProjectStatus(selectedProject.id, newStatus);
      setSuccessMsg(`Project status changed to ${newStatus}.`);
      setStatusModalOpen(false);
      fetchProjects();
    } catch (err) {
      setError(err.message || "Failed to update project status.");
    } finally {
      setSubmitting(false);
    }
  };

  // Open Assignments Modal
  const handleOpenAssignments = async (proj) => {
    setSelectedProject(proj);
    setAssignModalOpen(true);
    setSelectedEmployeeToAssign("");
    loadProjectAssignments(proj.id);
  };

  const loadProjectAssignments = async (projectId) => {
    try {
      setLoadingAssignments(true);
      const data = await projectApi.getProjectAssignments(projectId);
      setProjectAssignments(data.assignments || []);
    } catch (err) {
      console.warn("Failed to load project assignments:", err.message);
      setProjectAssignments([]);
    } finally {
      setLoadingAssignments(false);
    }
  };

  // Assign Employee
  const handleAssignEmployee = async (e) => {
    e.preventDefault();
    if (!selectedProject || !selectedEmployeeToAssign) return;

    setAssigning(true);
    setError("");

    try {
      await projectApi.assignEmployee(selectedProject.id, selectedEmployeeToAssign);
      setSuccessMsg("Employee assigned to project!");
      setSelectedEmployeeToAssign("");
      loadProjectAssignments(selectedProject.id);
    } catch (err) {
      setError(err.message || "Failed to assign employee.");
    } finally {
      setAssigning(false);
    }
  };

  // Remove Assignment
  const handleRemoveAssignment = async (assignmentId) => {
    try {
      setError("");
      await projectApi.removeAssignment(assignmentId);
      setSuccessMsg("Employee removed from project.");
      loadProjectAssignments(selectedProject.id);
    } catch (err) {
      setError(err.message || "Failed to remove employee.");
    }
  };

  // Open Archive Modal
  const handleOpenArchive = (proj) => {
    setSelectedProject(proj);
    setArchiveModalOpen(true);
  };

  // Confirm Archive
  const handleArchiveConfirm = async () => {
    if (!selectedProject) return;

    try {
      setError("");
      await projectApi.archiveProject(selectedProject.id);
      setSuccessMsg("Project archived successfully.");
      setArchiveModalOpen(false);
      fetchProjects();
    } catch (err) {
      setError(err.message || "Failed to archive project.");
    }
  };

  const getEmployeeName = (empId) => {
    const emp = employees.find((e) => e.id === empId);
    return emp ? `${emp.first_name} ${emp.last_name} (${emp.employee_code})` : `Employee #${empId}`;
  };

  return (
    <div className="page-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionHeader title="Projects &amp; Assignments" />
        <button className="btn btn-primary" onClick={handleOpenCreate}>
          <PlusIcon size={16} />
          <span>Create Project</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="stats-grid">
        <StatCard
          icon={ProjectsIcon}
          number={totalProjects}
          loading={loading}
          label="Total Projects"
          color="blue"
        />
        <StatCard
          icon={ClipboardCheckIcon}
          number={activeProjects}
          loading={loading}
          label="Active Projects"
          color="green"
        />
      </div>

      {successMsg && (
        <div className="alert alert-success">
          <CheckCircleIcon size={18} />
          <span>{successMsg}</span>
          <button
            onClick={() => setSuccessMsg("")}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit" }}
          >
            <CloseIcon size={16} />
          </button>
        </div>
      )}

      {error && <ErrorAlert message={error} onRetry={fetchProjects} />}

      <div className="table-card">
        {/* Filter Toolbar */}
        <div className="table-header-bar">
          <div className="section-header-title-group">
            <div className="section-accent-bar" />
            <h3 className="section-title" style={{ fontSize: "15px" }}>All Projects</h3>
          </div>

          <div className="table-actions-group">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-select"
              style={{ width: "auto", padding: "6px 14px", fontSize: "13px" }}
            >
              <option value="">All Statuses</option>
              <option value="PLANNED">PLANNED</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="ON_HOLD">ON_HOLD</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
        </div>

        {/* Project Table */}
        {loading ? (
          <LoadingState message="Loading projects..." />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={ProjectsIcon}
            title="No projects found"
            description="Create a project to start planning team assignments."
            action={
              <button className="btn btn-primary btn-sm" onClick={handleOpenCreate}>
                <PlusIcon size={14} /> Create First Project
              </button>
            }
          />
        ) : (
          <div className="table-responsive-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project Name</th>
                  <th>Code</th>
                  <th>Timeline</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((proj) => (
                  <tr key={proj.id}>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: "700", color: "var(--text-heading)" }}>
                          {proj.project_name}
                        </span>
                        {proj.description && (
                          <span
                            style={{
                              fontSize: "12px",
                              color: "var(--text-muted)",
                              maxWidth: "340px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {proj.description}
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <span style={{ fontWeight: "600", fontFamily: "monospace" }}>
                        {proj.project_code}
                      </span>
                    </td>

                    <td>
                      <span style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
                        {proj.start_date || "—"} to {proj.end_date || "—"}
                      </span>
                    </td>

                    <td>
                      <span className={`badge badge-${proj.status.toLowerCase()}`}>
                        {proj.status}
                      </span>
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        {/* Manage Assignments */}
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenAssignments(proj)}
                          title="Manage Project Team"
                        >
                          <UsersIcon size={14} />
                          <span>Team</span>
                        </button>

                        {/* Change Status */}
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenStatus(proj)}
                          title="Change Status"
                        >
                          Status
                        </button>

                        {/* Edit */}
                        <button
                          className="action-icon-btn"
                          onClick={() => handleOpenEdit(proj)}
                          title="Edit Project"
                        >
                          <EditIcon size={15} />
                        </button>

                        {/* Archive */}
                        <button
                          className="action-icon-btn danger"
                          onClick={() => handleOpenArchive(proj)}
                          title="Archive Project"
                        >
                          <TrashIcon size={15} />
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
          CREATE PROJECT MODAL
      ======================================================== */}
      {createModalOpen && (
        <div className="modal-overlay" onClick={() => setCreateModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleCreateSubmit}>
              <div className="modal-header">
                <h3 className="modal-title">Create New Project</h3>
                <button type="button" className="modal-close-btn" onClick={() => setCreateModalOpen(false)}>
                  <CloseIcon size={18} />
                </button>
              </div>

              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group full-width">
                    <label className="form-label">Project Name *</label>
                    <input
                      type="text"
                      value={formData.project_name}
                      onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                      required
                      placeholder="e.g. Employee Portal Redesign"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group full-width">
                    <label className="form-label">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Brief overview of project scope..."
                      className="form-textarea"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">End Date</label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          EDIT PROJECT MODAL
      ======================================================== */}
      {editModalOpen && selectedProject && (
        <div className="modal-overlay" onClick={() => setEditModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-header">
                <h3 className="modal-title">Edit Project: {selectedProject.project_name}</h3>
                <button type="button" className="modal-close-btn" onClick={() => setEditModalOpen(false)}>
                  <CloseIcon size={18} />
                </button>
              </div>

              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group full-width">
                    <label className="form-label">Project Name *</label>
                    <input
                      type="text"
                      value={formData.project_name}
                      onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                      required
                      className="form-input"
                    />
                  </div>

                  <div className="form-group full-width">
                    <label className="form-label">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="form-textarea"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">End Date</label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          CHANGE PROJECT STATUS MODAL
      ======================================================== */}
      {statusModalOpen && selectedProject && (
        <div className="modal-overlay" onClick={() => setStatusModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleStatusSubmit}>
              <div className="modal-header">
                <h3 className="modal-title">Update Project Status</h3>
                <button type="button" className="modal-close-btn" onClick={() => setStatusModalOpen(false)}>
                  <CloseIcon size={18} />
                </button>
              </div>

              <div className="modal-body">
                <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
                  Change status for <strong>{selectedProject.project_name}</strong> ({selectedProject.project_code}):
                </p>

                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="form-select"
                  >
                    <option value="PLANNED">PLANNED</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="ON_HOLD">ON_HOLD</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setStatusModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Updating..." : "Update Status"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MANAGE PROJECT ASSIGNMENTS MODAL
      ======================================================== */}
      {assignModalOpen && selectedProject && (
        <div className="modal-overlay" onClick={() => setAssignModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "620px" }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Project Team Assignments</h3>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {selectedProject.project_name} ({selectedProject.project_code})
                </span>
              </div>
              <button className="modal-close-btn" onClick={() => setAssignModalOpen(false)}>
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="modal-body">
              {/* Assign Form */}
              <form onSubmit={handleAssignEmployee} style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Assign New Employee</label>
                  <select
                    value={selectedEmployeeToAssign}
                    onChange={(e) => setSelectedEmployeeToAssign(e.target.value)}
                    required
                    className="form-select"
                  >
                    <option value="">Select an employee...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name} ({emp.employee_code})
                      </option>
                    ))}
                  </select>
                </div>

                <button type="submit" className="btn btn-primary" disabled={assigning || !selectedEmployeeToAssign}>
                  {assigning ? "Assigning..." : "Assign"}
                </button>
              </form>

              {/* Current Assignments List */}
              <div style={{ marginTop: "12px" }}>
                <h4 style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-heading)", marginBottom: "8px" }}>
                  Currently Assigned Members ({projectAssignments.length})
                </h4>

                {loadingAssignments ? (
                  <LoadingState message="Loading assigned members..." />
                ) : projectAssignments.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                    No employees currently assigned to this project.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {projectAssignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          background: "var(--bg-card-subtle)",
                          borderRadius: "10px",
                          border: "1px solid var(--border-color)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <UsersIcon size={16} className="text-muted" />
                          <span style={{ fontSize: "13.5px", fontWeight: "600", color: "var(--text-heading)" }}>
                            {getEmployeeName(assignment.employee_id)}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="action-icon-btn danger"
                          onClick={() => handleRemoveAssignment(assignment.id)}
                          title="Remove employee from project"
                        >
                          <TrashIcon size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setAssignModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          ARCHIVE CONFIRMATION MODAL
      ======================================================== */}
      {archiveModalOpen && selectedProject && (
        <div className="modal-overlay" onClick={() => setArchiveModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: "#ef4444" }}>Archive Project</h3>
              <button className="modal-close-btn" onClick={() => setArchiveModalOpen(false)}>
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: "14px", color: "var(--text-heading)", lineHeight: "1.5" }}>
                Are you sure you want to archive <strong>{selectedProject.project_name}</strong>?
              </p>
              <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                This project will be archived from active records.
              </p>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setArchiveModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleArchiveConfirm}>
                Confirm Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
