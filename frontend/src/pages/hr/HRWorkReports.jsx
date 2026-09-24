import { useState, useEffect, useCallback } from "react";
import { getWorkReportsHR, revokeWorkReportHR } from "../../api/workReportApi";
import { employeeApi } from "../../api/employeeApi";
import { projectApi } from "../../api/projectApi";
import SectionHeader from "../../components/common/SectionHeader";
import StatCard from "../../components/common/StatCard";
import {
  LoadingState,
  EmptyState,
  ErrorAlert,
} from "../../components/common/FeedbackStates";
import {
  WorkReportsIcon,
  CheckCircleIcon,
  ClockIcon,
  AlertCircleIcon,
  SearchIcon,
  PaperclipIcon,
  ChevronLeft,
  ChevronRight,
  EyeIcon,
  UsersIcon,
  CloseIcon,
} from "../../components/icons/Icons";
import HRWorkReportDetails from "../../components/work_reports/HRWorkReportDetails";
import "../../styles/workReports.css";

const PAGE_SIZE = 20;

export default function HRWorkReports() {
  const [reports, setReports] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Pagination
  const [page, setPage] = useState(1);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [workDate, setWorkDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  // Metadata dropdowns
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);

  // Stat summary numbers from API
  const [stats, setStats] = useState({
    total: 0,
    submitted: 0,
    approved: 0,
    rejected: 0,
  });

  // Selected report for review / view modal
  const [selectedReport, setSelectedReport] = useState(null);

  // Revoke confirmation modal state
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState("");

  // Load employee and project lists for filters
  useEffect(() => {
    async function loadMetadata() {
      try {
        const [empRes, projRes] = await Promise.all([
          employeeApi.listEmployees({ limit: 100 }),
          projectApi.getProjects(),
        ]);
        const empList = Array.isArray(empRes?.employees)
          ? empRes.employees
          : Array.isArray(empRes)
          ? empRes
          : [];
        setEmployees(empList);

        const projList = Array.isArray(projRes?.projects)
          ? projRes.projects
          : Array.isArray(projRes)
          ? projRes
          : [];
        setProjects(projList);
      } catch (err) {
        console.warn("Could not load employees/projects for HR filter:", err.message);
      }
    }
    loadMetadata();
  }, []);

  // Load global counts for stats cards
  const loadStats = useCallback(async () => {
    try {
      const [totalRes, subRes, appRes, rejRes] = await Promise.all([
        getWorkReportsHR({ limit: 1 }),
        getWorkReportsHR({ limit: 1, status: "SUBMITTED" }),
        getWorkReportsHR({ limit: 1, status: "APPROVED" }),
        getWorkReportsHR({ limit: 1, status: "REJECTED" }),
      ]);
      setStats({
        total: totalRes?.total ?? 0,
        submitted: subRes?.total ?? 0,
        approved: appRes?.total ?? 0,
        rejected: rejRes?.total ?? 0,
      });
    } catch {
      // Non-critical: stat cards fail gracefully
    }
  }, []);

  // Fetch paginated work reports
  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const skip = (page - 1) * PAGE_SIZE;
      const params = {
        skip,
        limit: PAGE_SIZE,
      };

      if (statusFilter) params.status = statusFilter;
      if (employeeFilter) params.employee_id = employeeFilter;
      if (projectFilter) params.project_id = projectFilter;
      if (workDate) params.work_date = workDate;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (appliedSearch.trim()) params.search = appliedSearch.trim();

      const data = await getWorkReportsHR(params);
      const list = Array.isArray(data?.work_reports) ? data.work_reports : [];
      setReports(list);
      setTotalCount(data?.total ?? list.length);
    } catch (err) {
      setError(err.message || "Failed to load work reports.");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, employeeFilter, projectFilter, workDate, startDate, endDate, appliedSearch]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setAppliedSearch(searchTerm);
    setPage(1);
  };

  const handleResetFilters = () => {
    setStatusFilter("");
    setEmployeeFilter("");
    setProjectFilter("");
    setWorkDate("");
    setStartDate("");
    setEndDate("");
    setSearchTerm("");
    setAppliedSearch("");
    setPage(1);
  };

  const handleConfirmRevoke = async () => {
    if (!revokeTarget) return;
    try {
      setRevoking(true);
      setRevokeError("");
      const updated = await revokeWorkReportHR(revokeTarget.id);
      setRevokeTarget(null);
      setSuccessMsg(`Approval for work report #${updated.id} has been revoked and moved to Submitted.`);
      setTimeout(() => setSuccessMsg(""), 4000);
      loadReports();
      loadStats();
    } catch (err) {
      setRevokeError(err.message || "Failed to revoke work report approval.");
    } finally {
      setRevoking(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "DRAFT":
        return <span className="badge-status-draft">Draft</span>;
      case "SUBMITTED":
        return <span className="badge-status-submitted">Submitted</span>;
      case "APPROVED":
        return <span className="badge-status-approved">Approved</span>;
      case "REJECTED":
        return <span className="badge-status-rejected">Rejected</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

  return (
    <div className="page-container">
      <SectionHeader
        title="Work Reports Management"
        subtitle="Review employee daily deliverables, inspect supporting documents, and approve or reject submissions"
      />

      {successMsg && (
        <div
          style={{
            padding: "12px 16px",
            background: "#dcfce7",
            color: "#15803d",
            borderRadius: "8px",
            fontSize: "13.5px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <CheckCircleIcon size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Top Stat Cards */}
      <div className="stats-grid" style={{ marginBottom: "24px" }}>
        <StatCard
          icon={WorkReportsIcon}
          number={stats.total}
          loading={loading}
          label="Total Reports"
          color="blue"
        />
        <StatCard
          icon={ClockIcon}
          number={stats.submitted}
          loading={loading}
          label="Needs Review"
          color="orange"
          onClick={() => {
            setStatusFilter("SUBMITTED");
            setPage(1);
          }}
        />
        <StatCard
          icon={CheckCircleIcon}
          number={stats.approved}
          loading={loading}
          label="Approved"
          color="green"
          onClick={() => {
            setStatusFilter("APPROVED");
            setPage(1);
          }}
        />
        <StatCard
          icon={AlertCircleIcon}
          number={stats.rejected}
          loading={loading}
          label="Rejected"
          color="red"
          onClick={() => {
            setStatusFilter("REJECTED");
            setPage(1);
          }}
        />
      </div>

      {/* Search and Filters Bar */}
      {/* Search and Filters Toolbar Card */}
      <div className="wr-filters-card">
        {/* Search Row */}
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
          <div className="wr-search-wrap" style={{ flex: 1 }}>
            <div className="wr-search-icon">
              <SearchIcon size={16} />
            </div>
            <input
              type="text"
              className="wr-filter-input"
              placeholder="Search reports by title, tasks, employee name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ height: "42px", padding: "0 20px", fontSize: "13px" }}>
            Search
          </button>
        </form>

        {/* Filter Dropdowns Row */}
        <div className="wr-filters-grid">
          {/* Status filter */}
          <div className="wr-filter-item fixed-sm">
            <label htmlFor="hr-filter-status" className="wr-filter-label">
              Status
            </label>
            <select
              id="hr-filter-status"
              className="wr-filter-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="SUBMITTED">Submitted (Needs Review)</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="DRAFT">Draft</option>
            </select>
          </div>

          {/* Employee filter */}
          <div className="wr-filter-item fixed-md">
            <label htmlFor="hr-filter-emp" className="wr-filter-label">
              Employee
            </label>
            <select
              id="hr-filter-emp"
              className="wr-filter-select"
              value={employeeFilter}
              onChange={(e) => {
                setEmployeeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Employees</option>
              {employees.map((emp) => {
                const name = `${emp.first_name || ""} ${emp.last_name || ""}`.trim() || `Employee #${emp.id}`;
                return (
                  <option key={emp.id} value={emp.id}>
                    {name}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Project filter */}
          <div className="wr-filter-item fixed-md">
            <label htmlFor="hr-filter-project" className="wr-filter-label">
              Project
            </label>
            <select
              id="hr-filter-project"
              className="wr-filter-select"
              value={projectFilter}
              onChange={(e) => {
                setProjectFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Projects</option>
              {projects.map((proj) => {
                const pId = proj.id || proj.project_id;
                const pName = proj.project_name || proj.name || proj.title || `Project #${pId}`;
                return (
                  <option key={pId} value={pId}>
                    {pName}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Specific Work Date */}
          <div className="wr-filter-item fixed-sm">
            <label htmlFor="hr-filter-date" className="wr-filter-label">
              Work Date
            </label>
            <input
              id="hr-filter-date"
              type="date"
              className="wr-filter-date"
              value={workDate}
              onChange={(e) => {
                setWorkDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Reset Filters Action */}
          {(statusFilter || employeeFilter || projectFilter || workDate || startDate || endDate || appliedSearch) && (
            <div className="wr-filter-actions">
              <button
                type="button"
                className="wr-btn-reset"
                onClick={handleResetFilters}
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Reports Table / State */}
      {loading ? (
        <LoadingState message="Loading work reports..." />
      ) : error ? (
        <ErrorAlert message={error} onRetry={loadReports} />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={WorkReportsIcon}
          title="No Work Reports Found"
          description={
            statusFilter || employeeFilter || projectFilter || workDate || appliedSearch
              ? "No employee reports match your current filter and search criteria."
              : "No employee work reports have been submitted yet."
          }
        />
      ) : (
        <div className="table-card">
          <div className="table-responsive-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Work Date</th>
                  <th>Title &amp; Tasks</th>
                  <th>Project</th>
                  <th>Hours</th>
                  <th>Attachment</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => {
                  const empName = report.employee
                    ? `${report.employee.first_name || ""} ${report.employee.last_name || ""}`.trim() || `Emp #${report.employee_id}`
                    : `Emp #${report.employee_id}`;

                  return (
                    <tr key={report.id}>
                      <td>
                        <div style={{ fontWeight: "600", color: "var(--text-heading)" }}>
                          {empName}
                        </div>
                        <div style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                          {report.employee?.department?.name || report.employee?.designation?.title || report.employee?.email || ""}
                        </div>
                      </td>
                      <td style={{ fontWeight: "500", whiteSpace: "nowrap" }}>
                        {formatDate(report.work_date)}
                      </td>
                      <td>
                        <div style={{ fontWeight: "600", color: "var(--text-heading)", marginBottom: "2px" }}>
                          {report.title}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", maxWidth: "280px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {report.tasks_completed}
                        </div>
                      </td>
                      <td style={{ fontSize: "12.5px" }}>
                        {report.project ? (report.project.project_name || report.project.name) : <span style={{ color: "var(--text-muted)" }}>Internal</span>}
                      </td>
                      <td style={{ fontWeight: "600", whiteSpace: "nowrap" }}>
                        {report.hours_worked} hrs
                      </td>
                      <td>
                        {report.attachment ? (
                          <a
                            href={report.attachment.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="badge"
                            style={{ background: "#ede9fe", color: "#5746e8", display: "inline-flex", alignItems: "center", gap: "4px", textDecoration: "none" }}
                            title={report.attachment.original_filename}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <PaperclipIcon size={12} />
                            Doc
                          </a>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>—</span>
                        )}
                      </td>
                      <td>{getStatusBadge(report.status)}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
                          {report.status === "SUBMITTED" && (
                            <button
                              type="button"
                              className="btn btn-primary"
                              style={{ padding: "4px 10px", fontSize: "11.5px", borderRadius: "8px" }}
                              onClick={() => setSelectedReport(report)}
                              title="Review Report"
                            >
                              Review
                            </button>
                          )}
                          {report.status === "APPROVED" && (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{
                                padding: "4px 10px",
                                fontSize: "11.5px",
                                borderRadius: "8px",
                                color: "#b45309",
                                borderColor: "#fde68a",
                                background: "#fffbeb",
                              }}
                              onClick={() => {
                                setRevokeTarget(report);
                                setRevokeError("");
                              }}
                              title="Revoke Approval"
                            >
                              Revoke
                            </button>
                          )}
                          <button
                            type="button"
                            className="action-btn"
                            title="View Details"
                            aria-label="View Details"
                            onClick={() => setSelectedReport(report)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "32px",
                              height: "32px",
                              borderRadius: "8px",
                              border: "1px solid var(--border-color, #e2e8f0)",
                              background: "var(--bg-card, #ffffff)",
                              color: "var(--text-main, #0f172a)",
                              cursor: "pointer",
                            }}
                          >
                            <EyeIcon size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 20px",
                borderTop: "1px solid var(--border-color)",
                fontSize: "13px",
                color: "var(--text-muted)",
              }}
            >
              <span>
                Showing {(page - 1) * PAGE_SIZE + 1} to{" "}
                {Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} reports
              </span>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: "4px 8px" }}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontWeight: "600" }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: "4px 8px" }}
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* HR Details & Review Modal */}
      {selectedReport && (
        <HRWorkReportDetails
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onReviewed={(updatedReport) => {
            setSelectedReport(null);
            setSuccessMsg(
              updatedReport.status === "APPROVED"
                ? `Work report #${updatedReport.id} approved.`
                : updatedReport.status === "SUBMITTED"
                ? `Work report #${updatedReport.id} approval revoked.`
                : `Work report #${updatedReport.id} rejected with feedback.`
            );
            setTimeout(() => setSuccessMsg(""), 4000);
            loadReports();
            loadStats();
          }}
        />
      )}

      {/* Revoke Approval Confirmation Modal */}
      {revokeTarget && (
        <div
          className="modal-overlay"
          onClick={() => !revoking && setRevokeTarget(null)}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "460px" }}
          >
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: "var(--text-heading)" }}>
                Revoke Approval?
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setRevokeTarget(null)}
                disabled={revoking}
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="modal-body">
              {revokeError && (
                <div
                  className="alert alert-danger"
                  style={{
                    marginBottom: "14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <AlertCircleIcon size={16} style={{ flexShrink: 0 }} />
                  <span>{revokeError}</span>
                </div>
              )}
              <p style={{ fontSize: "14px", color: "var(--text-main)", lineHeight: "1.5", margin: 0 }}>
                This will move the work report back to the Submitted stage for review.
              </p>
            </div>

            <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRevokeTarget(null)}
                disabled={revoking}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  background: "#d97706",
                  borderColor: "#d97706",
                  color: "#ffffff",
                }}
                onClick={handleConfirmRevoke}
                disabled={revoking}
              >
                {revoking ? "Revoking..." : "Revoke"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
