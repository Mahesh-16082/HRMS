import { useState, useEffect, useCallback } from "react";
import { complaintApi } from "../../api/complaintApi";
import SectionHeader from "../../components/common/SectionHeader";
import StatCard from "../../components/common/StatCard";
import {
  LoadingState,
  EmptyState,
  ErrorAlert,
} from "../../components/common/FeedbackStates";
import {
  ComplaintsIcon,
  CheckCircleIcon,
  ClockIcon,
  CloseIcon,
  PlusIcon,
  EditIcon,
} from "../../components/icons/Icons";
import ComplaintForm from "../../components/complaints/ComplaintForm";
import ComplaintDetails from "../../components/complaints/ComplaintDetails";

export default function EmployeeComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filter
  const [statusFilter, setStatusFilter] = useState("");

  // Modals
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [editingComplaint, setEditingComplaint] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  const loadComplaints = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (statusFilter) params.status = statusFilter;

      const data = await complaintApi.getMyComplaints(params);
      const list = Array.isArray(data?.complaints) ? data.complaints : [];
      setComplaints(list);
      setTotalCount(data?.total ?? list.length);
    } catch (err) {
      setError(err.message || "Failed to load complaints.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  // Compute stats across the employee's complaints
  const openCount = complaints.filter((c) => c.status === "OPEN").length;
  const inProgressCount = complaints.filter((c) => c.status === "IN_PROGRESS").length;
  const resolvedCount = complaints.filter((c) => c.status === "RESOLVED" || c.status === "CLOSED").length;

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
      case "OPEN":
        return { className: "badge badge-planned", label: "Open" };
      case "IN_PROGRESS":
        return { className: "badge badge-on_hold", label: "In Progress" };
      case "RESOLVED":
        return { className: "badge badge-active", label: "Resolved" };
      case "CLOSED":
        return {
          className: "badge",
          label: "Closed",
          style: { background: "#f1f5f9", color: "#475569" },
        };
      default:
        return { className: "badge", label: status };
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case "HIGH":
        return {
          label: "High",
          style: { background: "#fee2e2", color: "#b91c1c" },
        };
      case "MEDIUM":
        return {
          label: "Medium",
          style: { background: "#fef3c7", color: "#b45309" },
        };
      case "LOW":
      default:
        return {
          label: "Low",
          style: { background: "#dcfce7", color: "#15803d" },
        };
    }
  };

  // Submit new complaint
  const handleCreateSubmit = async (formData) => {
    try {
      setSubmitting(true);
      setModalError("");
      const res = await complaintApi.createComplaint(formData);
      setIsSubmitModalOpen(false);
      setSuccessMsg(`Complaint #${res?.id || "new"} submitted successfully.`);
      loadComplaints();
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err) {
      setModalError(err.message || "Failed to submit complaint.");
    } finally {
      setSubmitting(false);
    }
  };

  // Edit open complaint
  const handleEditSubmit = async (formData) => {
    if (!editingComplaint) return;
    try {
      setSubmitting(true);
      setModalError("");
      const res = await complaintApi.updateMyComplaint(editingComplaint.id, formData);
      setEditingComplaint(null);
      setSelectedComplaint(res);
      setSuccessMsg(`Complaint #${editingComplaint.id} updated successfully.`);
      loadComplaints();
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err) {
      setModalError(err.message || "Failed to update complaint.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      {/* Header with Submit Button */}
      <div className="section-header-row">
        <div className="section-header-title-group">
          <div className="section-accent-bar" />
          <div>
            <h2 className="section-title">Complaints</h2>
            <span style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
              Submit workplace concerns or track resolution of your complaints.
            </span>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setModalError("");
            setIsSubmitModalOpen(true);
          }}
          style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
        >
          <PlusIcon size={16} />
          <span>Submit Complaint</span>
        </button>
      </div>

      {/* Stat Cards */}
      <div className="stats-row complaint-stats-grid employee-complaint-stats" style={{ marginTop: "16px", marginBottom: "20px" }}>
        <StatCard
          icon={ComplaintsIcon}
          number={totalCount}
          loading={loading}
          label="Total Filed"
          color="blue"
        />
        <StatCard
          icon={ClockIcon}
          number={openCount}
          loading={loading}
          label="Open"
          color="purple"
        />
        <StatCard
          icon={ClockIcon}
          number={inProgressCount}
          loading={loading}
          label="In Progress"
          color="amber"
        />
        <StatCard
          icon={CheckCircleIcon}
          number={resolvedCount}
          loading={loading}
          label="Resolved / Closed"
          color="green"
        />
      </div>

      {error && <ErrorAlert message={error} onRetry={loadComplaints} />}

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
            gap: "10px",
          }}
        >
          <CheckCircleIcon size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Table Card */}
      <div className="table-card">
        {/* Table Filter Bar */}
        <div className="table-header-bar">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-heading)" }}>
              My Complaints History
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: "600",
                padding: "2px 8px",
                background: "var(--bg-card-subtle)",
                borderRadius: "12px",
                color: "var(--text-muted)",
              }}
            >
              {complaints.length} records
            </span>
          </div>

          <div className="table-actions-group">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-select"
              style={{ width: "auto", padding: "6px 14px", fontSize: "12.5px" }}
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
        </div>

        {/* Complaints Table */}
        {loading ? (
          <LoadingState message="Loading your complaints..." />
        ) : complaints.length === 0 ? (
          <EmptyState
            icon={ComplaintsIcon}
            title="No complaints filed"
            description={
              statusFilter
                ? `You have no complaints with status "${statusFilter}".`
                : "You haven't submitted any complaints yet. Click 'Submit Complaint' to file an issue."
            }
            action={
              !statusFilter && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsSubmitModalOpen(true)}
                >
                  File First Complaint
                </button>
              )
            }
          />
        ) : (
          <div className="table-responsive-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: "60px" }}>#</th>
                  <th>Subject</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Updated</th>
                  <th>Resolved</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((item) => {
                  const statusBadge = getStatusBadge(item.status);
                  const priorityBadge = getPriorityBadge(item.priority);

                  return (
                    <tr key={item.id}>
                      <td style={{ color: "var(--text-muted)", fontWeight: "600", fontSize: "12px" }}>
                        #{item.id}
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: "600",
                            color: "var(--text-heading)",
                            display: "block",
                            maxWidth: "280px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={item.subject}
                        >
                          {item.subject}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "12.5px", color: "var(--text-main)" }}>
                          {item.category}
                        </span>
                      </td>
                      <td>
                        <span className="badge" style={priorityBadge.style}>
                          {priorityBadge.label}
                        </span>
                      </td>
                      <td>
                        <span className={statusBadge.className} style={statusBadge.style}>
                          {statusBadge.label}
                        </span>
                      </td>
                      <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {formatDate(item.created_at)}
                      </td>
                      <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {formatDate(item.updated_at)}
                      </td>
                      <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {item.resolved_at ? (
                          <span style={{ color: "#166534", fontWeight: "500" }}>
                            {formatDate(item.resolved_at)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedComplaint(item)}
                          style={{ padding: "4px 10px", fontSize: "12px" }}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================
          SUBMIT COMPLAINT MODAL
      ======================================================== */}
      {isSubmitModalOpen && (
        <div className="modal-overlay" onClick={() => !submitting && setIsSubmitModalOpen(false)}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "600px", width: "100%" }}
          >
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Submit a New Complaint</h3>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  Submit an issue or concern for HR review and resolution
                </span>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setIsSubmitModalOpen(false)}
                disabled={submitting}
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="modal-body">
              {modalError && (
                <div
                  style={{
                    background: "#fee2e2",
                    color: "#b91c1c",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    marginBottom: "16px",
                  }}
                >
                  {modalError}
                </div>
              )}

              <ComplaintForm
                onSubmit={handleCreateSubmit}
                onCancel={() => setIsSubmitModalOpen(false)}
                submitting={submitting}
                isEdit={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          VIEW COMPLAINT DETAILS MODAL
      ======================================================== */}
      {selectedComplaint && !editingComplaint && (
        <ComplaintDetails
          complaint={selectedComplaint}
          onClose={() => setSelectedComplaint(null)}
          onEdit={(complaint) => {
            setEditingComplaint(complaint);
            setModalError("");
          }}
        />
      )}

      {/* ========================================================
          EDIT OPEN COMPLAINT MODAL
      ======================================================== */}
      {editingComplaint && (
        <div className="modal-overlay" onClick={() => !submitting && setEditingComplaint(null)}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "600px", width: "100%" }}
          >
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Edit Complaint #{editingComplaint.id}</h3>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  Only complaints in OPEN status can be modified.
                </span>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setEditingComplaint(null)}
                disabled={submitting}
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="modal-body">
              {modalError && (
                <div
                  style={{
                    background: "#fee2e2",
                    color: "#b91c1c",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    marginBottom: "16px",
                  }}
                >
                  {modalError}
                </div>
              )}

              <ComplaintForm
                initialData={editingComplaint}
                onSubmit={handleEditSubmit}
                onCancel={() => setEditingComplaint(null)}
                submitting={submitting}
                isEdit={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
