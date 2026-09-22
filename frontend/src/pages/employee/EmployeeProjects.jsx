import { useState, useEffect, useCallback } from "react";
import { projectApi } from "../../api/projectApi";
import SectionHeader from "../../components/common/SectionHeader";
import {
  LoadingState,
  EmptyState,
  ErrorAlert,
} from "../../components/common/FeedbackStates";
import {
  ProjectsIcon,
  CalendarIcon,
  CloseIcon,
  ArrowRight,
} from "../../components/icons/Icons";

export default function EmployeeProjects() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedProject, setSelectedProject] = useState(null);

  const loadAssignments = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await projectApi.getMyProjectAssignments();
      setAssignments(data.assignments || []);
    } catch (err) {
      setError(err.message || "Failed to load project assignments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  // Handle escape key to close modal
  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") {
      setSelectedProject(null);
    }
  }, []);

  useEffect(() => {
    if (selectedProject) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [selectedProject, handleKeyDown]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "Not specified";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "ACTIVE":
        return "badge-active";
      case "COMPLETED":
        return "badge-completed";
      case "ON_HOLD":
        return "badge-on_hold";
      case "CANCELLED":
        return "badge-cancelled";
      case "PLANNED":
      default:
        return "badge-planned";
    }
  };

  return (
    <div className="page-container">
      <SectionHeader title="My Projects &amp; Assignments" />

      {error && <ErrorAlert message={error} onRetry={loadAssignments} />}

      {loading ? (
        <LoadingState message="Loading your assigned projects..." />
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={ProjectsIcon}
          title="No Project Assignments"
          description="You are not currently assigned to any active projects. Contact HR or your team lead for assignments."
        />
      ) : (
        <div className="projects-card-grid">
          {assignments.map((item) => {
            const project = item.project;
            const projectName = project?.project_name || `Project #${item.project_id}`;
            const projectCode = project?.project_code || `PRJ-${item.project_id}`;
            const projectStatus = project?.status || "ASSIGNED";

            return (
              <div
                key={item.id}
                className="project-item-card"
                onClick={() => setSelectedProject(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedProject(item);
                  }
                }}
                aria-label={`View details for ${projectName}`}
              >
                <div className="project-card-top">
                  <div className="project-card-heading">
                    <div className="project-icon-badge">
                      <ProjectsIcon size={22} />
                    </div>
                    <div className="project-title-group">
                      <h3 className="project-card-title">{projectName}</h3>
                      <span className="project-code-badge">{projectCode}</span>
                    </div>
                  </div>

                  <span className={`badge ${getStatusBadgeClass(projectStatus)}`}>
                    {projectStatus}
                  </span>
                </div>

                {project?.description && (
                  <p className="project-card-desc">{project.description}</p>
                )}

                <div className="project-card-dates">
                  <div className="project-date-row">
                    <span className="date-label">Timeline:</span>
                    <span className="date-value">
                      {formatDate(project?.start_date)} — {formatDate(project?.end_date)}
                    </span>
                  </div>
                </div>

                <div className="project-card-footer">
                  <div className="project-assigned-date">
                    <CalendarIcon size={14} />
                    <span>Assigned on {formatDate(item.assigned_at)}</span>
                  </div>
                  <span className="view-details-link">
                    <span>Details</span>
                    <ArrowRight size={13} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================
          PROJECT DETAILS MODAL
      ======================================================== */}
      {selectedProject && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedProject(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-details-title"
        >
          <div
            className="modal-card project-details-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="modal-header">
              <div className="modal-title-wrap">
                <div className="project-icon-badge modal-badge">
                  <ProjectsIcon size={20} />
                </div>
                <div>
                  <h3 id="project-details-title" className="modal-title">
                    {selectedProject.project?.project_name || `Project #${selectedProject.project_id}`}
                  </h3>
                  <div className="modal-sub-meta">
                    <span className="project-code-badge">
                      {selectedProject.project?.project_code || `PRJ-${selectedProject.project_id}`}
                    </span>
                    <span
                      className={`badge ${getStatusBadgeClass(
                        selectedProject.project?.status || "ASSIGNED"
                      )}`}
                    >
                      {selectedProject.project?.status || "ASSIGNED"}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedProject(null)}
                aria-label="Close project details modal"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body">
              {/* Description */}
              <div className="detail-section">
                <label className="detail-label">Project Description</label>
                <div className="detail-content-box">
                  {selectedProject.project?.description ? (
                    <p className="detail-text">{selectedProject.project.description}</p>
                  ) : (
                    <span className="detail-text-empty">No description provided for this project.</span>
                  )}
                </div>
              </div>

              {/* Timeline & Schedule Grid */}
              <div className="detail-grid">
                <div className="detail-card-tile">
                  <div className="detail-tile-icon">
                    <CalendarIcon size={16} />
                  </div>
                  <div className="detail-tile-content">
                    <span className="detail-label">Start Date</span>
                    <span className="detail-value">
                      {formatDate(selectedProject.project?.start_date)}
                    </span>
                  </div>
                </div>

                <div className="detail-card-tile">
                  <div className="detail-tile-icon">
                    <CalendarIcon size={16} />
                  </div>
                  <div className="detail-tile-content">
                    <span className="detail-label">End Date</span>
                    <span className="detail-value">
                      {formatDate(selectedProject.project?.end_date)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Assignment Information */}
              <div className="detail-grid">
                <div className="detail-card-tile">
                  <div className="detail-tile-icon">
                    <CalendarIcon size={16} />
                  </div>
                  <div className="detail-tile-content">
                    <span className="detail-label">Assigned Date</span>
                    <span className="detail-value">
                      {formatDate(selectedProject.assigned_at)}
                    </span>
                  </div>
                </div>

                <div className="detail-card-tile">
                  <div className="detail-tile-icon">
                    <ProjectsIcon size={16} />
                  </div>
                  <div className="detail-tile-content">
                    <span className="detail-label">Assignment ID</span>
                    <span className="detail-value">#{selectedProject.id}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedProject(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
