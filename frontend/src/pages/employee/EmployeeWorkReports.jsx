import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  getMyWorkReports,
  getTodayWorkReportStatus,
  createWorkReport,
  updateMyWorkReport,
  submitMyWorkReport,
  deleteMyWorkReport,
  uploadAttachment,
} from "../../api/workReportApi";
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
  CloseIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  EyeIcon,
  PaperclipIcon,
  CalendarIcon,
  AlertCircleIcon,
  LockIcon,
  ChevronLeft,
  ChevronRight,
} from "../../components/icons/Icons";
import WorkReportForm from "../../components/work_reports/WorkReportForm";
import WorkReportDetails from "../../components/work_reports/WorkReportDetails";
import "../../styles/workReports.css";

const PAGE_SIZE = 20;

export default function EmployeeWorkReports() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [reports, setReports] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Pagination
  const [page, setPage] = useState(1);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Today's report state
  const [todayReport, setTodayReport] = useState(null);
  const [todayLoading, setTodayLoading] = useState(true);

  // Assigned projects for filtering
  const [projects, setProjects] = useState([]);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [editingReport, setEditingReport] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  // Load projects for filter dropdown
  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await projectApi.getMyProjectAssignments();
        const list = Array.isArray(res?.assignments)
          ? res.assignments
          : Array.isArray(res)
          ? res
          : [];
        setProjects(list);
      } catch (err) {
        console.warn("Could not load projects for filter:", err.message);
      }
    }
    loadProjects();
  }, []);

  // Fetch today's submission status
  const loadTodayStatus = useCallback(async () => {
    try {
      setTodayLoading(true);
      const res = await getTodayWorkReportStatus();
      setTodayReport(res?.report || null);
      return res?.report || null;
    } catch (err) {
      console.warn("Could not load today's report status:", err.message);
      setTodayReport(null);
      return null;
    } finally {
      setTodayLoading(false);
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
      if (projectFilter) params.project_id = projectFilter;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const data = await getMyWorkReports(params);
      const list = Array.isArray(data?.work_reports) ? data.work_reports : [];
      setReports(list);
      setTotalCount(data?.total ?? list.length);
    } catch (err) {
      setError(err.message || "Failed to load work reports.");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, projectFilter, startDate, endDate]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    loadTodayStatus().then((todayRep) => {
      // Check query params to auto-open modal if navigated from Dashboard
      const action = searchParams.get("action");
      if (action === "new") {
        setIsCreateModalOpen(true);
      } else if (action === "draft" || action === "edit-rejected") {
        if (todayRep && (todayRep.status === "DRAFT" || todayRep.status === "REJECTED")) {
          setEditingReport(todayRep);
        } else if (!todayRep) {
          setIsCreateModalOpen(true);
        }
      } else if (action === "today") {
        if (todayRep) {
          setSelectedReport(todayRep);
        }
      }
      // Clean query params so refresh doesn't reopen unexpectedly
      if (action) {
        setSearchParams({}, { replace: true });
      }
    });
  }, [loadTodayStatus, searchParams, setSearchParams]);

  // Overall counts
  const draftCount = reports.filter((r) => r.status === "DRAFT").length;
  const submittedCount = reports.filter((r) => r.status === "SUBMITTED").length;
  const approvedCount = reports.filter((r) => r.status === "APPROVED").length;
  const rejectedCount = reports.filter((r) => r.status === "REJECTED").length;

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

  // Handle Create new report
  const handleCreateSubmit = async (payload, stagedFile, isSubmit) => {
    try {
      setSubmitting(true);
      setModalError("");

      let createdReport;

      if (stagedFile) {
        // If file staged, create as DRAFT first, upload file, then submit if requested
        createdReport = await createWorkReport({ ...payload, submit: false });
        try {
          await uploadAttachment(createdReport.id, stagedFile);
        } catch (uploadErr) {
          console.warn("Attachment upload warning:", uploadErr.message);
        }
        if (isSubmit) {
          createdReport = await submitMyWorkReport(createdReport.id);
        }
      } else {
        createdReport = await createWorkReport(payload);
      }

      setIsCreateModalOpen(false);
      setSuccessMsg(
        isSubmit
          ? "Work report submitted successfully."
          : "Work report draft saved successfully."
      );
      setTimeout(() => setSuccessMsg(""), 4000);
      loadReports();
      loadTodayStatus();
    } catch (err) {
      setModalError(err.message || "Failed to create work report.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Edit existing report
  const handleEditSubmit = async (payload, stagedFile, isSubmit) => {
    if (!editingReport) return;
    try {
      setSubmitting(true);
      setModalError("");

      let updated = await updateMyWorkReport(editingReport.id, payload);

      if (isSubmit) {
        updated = await submitMyWorkReport(editingReport.id);
      }

      setEditingReport(null);
      setSelectedReport(null);
      setSuccessMsg(
        isSubmit
          ? "Work report submitted successfully."
          : "Work report updated successfully."
      );
      setTimeout(() => setSuccessMsg(""), 4000);
      loadReports();
      loadTodayStatus();
    } catch (err) {
      setModalError(err.message || "Failed to update work report.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle submit from details view
  const handleSubmitDraft = async (report) => {
    if (!window.confirm("Submit this work report for HR review?")) return;
    try {
      await submitMyWorkReport(report.id);
      setSelectedReport(null);
      setSuccessMsg("Work report submitted successfully.");
      setTimeout(() => setSuccessMsg(""), 4000);
      loadReports();
      loadTodayStatus();
    } catch (err) {
      alert(err.message || "Failed to submit work report.");
    }
  };

  // Handle delete draft
  const handleDeleteDraft = async (report) => {
    if (!window.confirm(`Are you sure you want to delete draft report #${report.id}?`)) return;
    try {
      await deleteMyWorkReport(report.id);
      setSelectedReport(null);
      setSuccessMsg("Draft report deleted.");
      setTimeout(() => setSuccessMsg(""), 4000);
      loadReports();
      loadTodayStatus();
    } catch (err) {
      alert(err.message || "Failed to delete work report.");
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

  return (
    <div className="page-container">
      <SectionHeader
        title="My Work Reports"
        subtitle="Log your daily achievements, track work deliverables, and manage supporting attachments"
        actionComponent={
          <button
            className="btn btn-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            onClick={() => {
              setModalError("");
              setIsCreateModalOpen(true);
            }}
          >
            <PlusIcon size={16} />
            Create Work Report
          </button>
        }
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

      {/* Top Banner: Today's Report Status */}
      {!todayLoading && (
        <div
          className={`wr-today-banner ${
            todayReport ? todayReport.status.toLowerCase() : "unsubmitted"
          }`}
        >
          <div className="wr-today-info">
            <div className="wr-today-icon">
              <CalendarIcon size={24} />
            </div>
            <div className="wr-today-details">
              <h4>
                Today's Report Status —{" "}
                {todayReport ? todayReport.status : "Not Submitted"}
              </h4>
              <p>
                {!todayReport &&
                  "You haven't submitted your work report for today. Complete it before the end of the day."}
                {todayReport?.status === "DRAFT" &&
                  "You have a draft saved for today. Finish and submit it for HR review."}
                {todayReport?.status === "SUBMITTED" &&
                  "Today's report has been submitted and is currently pending HR review."}
                {todayReport?.status === "APPROVED" &&
                  "Today's report has been reviewed and approved by HR."}
                {todayReport?.status === "REJECTED" &&
                  "Today's report requires revision based on HR feedback. Please update and resubmit."}
              </p>
            </div>
          </div>

          <div className="wr-today-actions">
            {!todayReport && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setModalError("");
                  setIsCreateModalOpen(true);
                }}
              >
                Create Today's Report
              </button>
            )}
            {todayReport?.status === "DRAFT" && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setModalError("");
                  setEditingReport(todayReport);
                }}
              >
                Continue Draft
              </button>
            )}
            {todayReport?.status === "REJECTED" && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  setModalError("");
                  setEditingReport(todayReport);
                }}
              >
                Revise &amp; Resubmit
              </button>
            )}
            {todayReport && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedReport(todayReport)}
              >
                View Details
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stat Cards Row */}
      <div className="stats-grid" style={{ marginBottom: "24px" }}>
        <StatCard
          icon={WorkReportsIcon}
          number={totalCount}
          loading={loading}
          label="Total Reports"
          color="blue"
        />
        <StatCard
          icon={ClockIcon}
          number={submittedCount}
          loading={loading}
          label="Pending Review"
          color="orange"
        />
        <StatCard
          icon={CheckCircleIcon}
          number={approvedCount}
          loading={loading}
          label="Approved"
          color="green"
        />
        <StatCard
          icon={AlertCircleIcon}
          number={rejectedCount}
          loading={loading}
          label="Needs Revision"
          color="red"
        />
      </div>

      {/* Filter Controls Card */}
      <div className="wr-filters-card">
        <div className="wr-filters-grid">
          {/* Status filter */}
          <div className="wr-filter-item fixed-sm">
            <label htmlFor="wr-filter-status" className="wr-filter-label">
              Status
            </label>
            <select
              id="wr-filter-status"
              className="wr-filter-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Project filter */}
          <div className="wr-filter-item fixed-md">
            <label htmlFor="wr-filter-project" className="wr-filter-label">
              Project
            </label>
            <select
              id="wr-filter-project"
              className="wr-filter-select"
              value={projectFilter}
              onChange={(e) => {
                setProjectFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Projects</option>
              {projects.map((p) => {
                const pId = p.project_id || p.id;
                const pName = p.project_name || p.title || `Project #${pId}`;
                return (
                  <option key={pId} value={pId}>
                    {pName}
                  </option>
                );
              })}
            </select>
          </div>

          {/* From Date Filter */}
          <div className="wr-filter-item fixed-sm">
            <label htmlFor="wr-filter-start-date" className="wr-filter-label">
              From Date
            </label>
            <input
              id="wr-filter-start-date"
              type="date"
              className="wr-filter-date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* To Date Filter */}
          <div className="wr-filter-item fixed-sm">
            <label htmlFor="wr-filter-end-date" className="wr-filter-label">
              To Date
            </label>
            <input
              id="wr-filter-end-date"
              type="date"
              className="wr-filter-date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Reset Filters Action */}
          {(statusFilter || projectFilter || startDate || endDate) && (
            <div className="wr-filter-actions">
              <button
                type="button"
                className="wr-btn-reset"
                onClick={() => {
                  setStatusFilter("");
                  setProjectFilter("");
                  setStartDate("");
                  setEndDate("");
                  setPage(1);
                }}
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Reports Table / Content */}
      {loading ? (
        <LoadingState message="Loading your work reports..." />
      ) : error ? (
        <ErrorAlert message={error} onRetry={loadReports} />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={WorkReportsIcon}
          title="No Work Reports Found"
          description={
            statusFilter || projectFilter || startDate || endDate
              ? "No reports match your current filter selection."
              : "You have not submitted any daily work reports yet."
          }
          action={
            <button
              className="btn btn-primary"
              onClick={() => {
                setModalError("");
                setIsCreateModalOpen(true);
              }}
            >
              Create Today's Report
            </button>
          }
        />
      ) : (
        <div className="table-card">
          <div className="table-responsive-wrap">
            <table className="data-table">
              <thead>
                <tr>
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
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td style={{ fontWeight: "600", whiteSpace: "nowrap" }}>
                      {formatDate(report.work_date)}
                    </td>
                    <td>
                      <div style={{ fontWeight: "600", color: "var(--text-heading)", marginBottom: "2px" }}>
                        {report.title}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", maxWidth: "340px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {report.tasks_completed}
                      </div>
                    </td>
                    <td style={{ fontSize: "12.5px" }}>
                      {report.project ? report.project.name : <span style={{ color: "var(--text-muted)" }}>Internal</span>}
                    </td>
                    <td style={{ fontWeight: "600", whiteSpace: "nowrap" }}>
                      {report.hours_worked} hrs
                    </td>
                    <td>
                      {report.attachment ? (
                        report.status === "SUBMITTED" || report.status === "APPROVED" ? (
                          <span
                            className="badge"
                            style={{
                              background: "var(--bg-surface, #f8fafc)",
                              color: "var(--text-muted, #64748b)",
                              border: "1px solid var(--border-color, #e2e8f0)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                            title={`${report.attachment.original_filename} (Locked with submission)`}
                          >
                            <LockIcon size={11} />
                            Locked
                          </span>
                        ) : (
                          <a
                            href={report.attachment.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="badge"
                            style={{ background: "#ede9fe", color: "#5746e8", display: "inline-flex", alignItems: "center", gap: "4px", textDecoration: "none", cursor: "pointer" }}
                            title={report.attachment.original_filename}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <PaperclipIcon size={12} />
                            Document
                          </a>
                        )
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>—</span>
                      )}
                    </td>
                    <td>{getStatusBadge(report.status)}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ display: "inline-flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
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

                        {(report.status === "DRAFT" || report.status === "REJECTED") && (
                          <button
                            type="button"
                            className="action-btn"
                            title={report.status === "REJECTED" ? "Edit & Resubmit" : "Edit Draft"}
                            aria-label={report.status === "REJECTED" ? "Edit & Resubmit" : "Edit Draft"}
                            onClick={() => {
                              setModalError("");
                              setEditingReport(report);
                            }}
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
                            <EditIcon size={15} />
                          </button>
                        )}

                        {report.status === "DRAFT" && (
                          <button
                            type="button"
                            className="action-btn text-danger"
                            title="Delete Draft"
                            aria-label="Delete Draft"
                            onClick={() => handleDeleteDraft(report)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "32px",
                              height: "32px",
                              borderRadius: "8px",
                              border: "1px solid #fecaca",
                              background: "var(--bg-card, #ffffff)",
                              color: "#dc2626",
                              cursor: "pointer",
                            }}
                          >
                            <TrashIcon size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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

      {/* ========================================================
          CREATE REPORT MODAL
      ======================================================== */}
      {isCreateModalOpen && (
        <div className="modal-overlay" onClick={() => !submitting && setIsCreateModalOpen(false)}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "680px", width: "100%" }}
          >
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Create Daily Work Report</h3>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  Log your daily activity, deliverables, and attach one supporting document.
                </span>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={submitting}
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: "75vh", overflowY: "auto" }}>
              <WorkReportForm
                onSubmit={handleCreateSubmit}
                onCancel={() => setIsCreateModalOpen(false)}
                submitting={submitting}
                isEdit={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          EDIT DRAFT / REJECTED MODAL
      ======================================================== */}
      {editingReport && (
        <div className="modal-overlay" onClick={() => !submitting && setEditingReport(null)}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "680px", width: "100%" }}
          >
            <div className="modal-header">
              <div>
                <h3 className="modal-title">
                  {editingReport.status === "REJECTED" ? "Revise Rejected Report" : `Edit Draft Report #${editingReport.id}`}
                </h3>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  Work Date: {formatDate(editingReport.work_date)}
                </span>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setEditingReport(null)}
                disabled={submitting}
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: "75vh", overflowY: "auto" }}>
              {editingReport.status === "REJECTED" && (
                <div className="wr-rejection-alert">
                  <div className="wr-rejection-header">
                    <AlertCircleIcon size={16} />
                    <span>HR Rejection Feedback:</span>
                  </div>
                  <p className="wr-rejection-text">{editingReport.review_feedback}</p>
                </div>
              )}

              <WorkReportForm
                initialData={editingReport}
                onSubmit={handleEditSubmit}
                onCancel={() => setEditingReport(null)}
                submitting={submitting}
                isEdit={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          VIEW REPORT DETAILS MODAL
      ======================================================== */}
      {selectedReport && (
        <WorkReportDetails
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onEdit={(report) => {
            setSelectedReport(null);
            setEditingReport(report);
            setModalError("");
          }}
          onSubmit={handleSubmitDraft}
          onDelete={handleDeleteDraft}
          onAttachmentChange={(updatedAttachment) => {
            setSelectedReport((prev) =>
              prev ? { ...prev, attachment: updatedAttachment } : null
            );
            loadReports();
          }}
        />
      )}
    </div>
  );
}
