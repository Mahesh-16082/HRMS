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
  LeaveRequestsIcon,
  LeaveTypesIcon,
  CheckCircleIcon,
  ClockIcon,
  CloseIcon,
  CalendarIcon,
  UsersIcon,
} from "../../components/icons/Icons";

export default function LeaveRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filters
  const [statusFilter, setStatusFilter] = useState("");

  // Rejection modal state
  const [rejectingRequest, setRejectingRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectionError, setRejectionError] = useState("");

  // Approval in progress
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (statusFilter) params.status = statusFilter;

      const data = await leaveApi.getAllRequests(params);
      setRequests(data?.requests || []);
    } catch (err) {
      setError(err.message || "Failed to load leave requests.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Handle Approve (no browser confirmation dialog, executes immediately)
  const handleApprove = async (request) => {
    try {
      setActionLoadingId(request.id);
      setError("");
      const updated = await leaveApi.approveRequest(request.id);
      setRequests((prev) =>
        prev.map((r) => (r.id === request.id ? { ...r, ...updated, status: "APPROVED" } : r))
      );
      setSuccessMsg(`Leave request #${request.id} approved successfully.`);
      loadRequests();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setError(err.message || "Failed to approve leave request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Revoke
  const handleRevoke = async (request) => {
    try {
      setActionLoadingId(request.id);
      setError("");
      const updated = await leaveApi.revokeRequest(request.id);
      setRequests((prev) =>
        prev.map((r) => (r.id === request.id ? { ...r, ...updated, status: "REVOKED" } : r))
      );
      setSuccessMsg("Leave request revoked successfully.");
      loadRequests();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setError(err.message || "Failed to revoke leave request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open Reject Modal
  const handleOpenRejectModal = (request) => {
    setRejectingRequest(request);
    setRejectionReason("");
    setRejectionError("");
  };

  const handleCloseRejectModal = () => {
    if (rejecting) return;
    setRejectingRequest(null);
    setRejectionReason("");
    setRejectionError("");
  };

  // Confirm Reject
  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      setRejectionError("Please provide a reason for rejecting this leave request.");
      return;
    }

    try {
      setRejecting(true);
      setRejectionError("");
      await leaveApi.rejectRequest(rejectingRequest.id, rejectionReason.trim());
      setSuccessMsg(`Leave request #${rejectingRequest.id} rejected.`);
      handleCloseRejectModal();
      loadRequests();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setRejectionError(err.message || "Failed to reject leave request.");
    } finally {
      setRejecting(false);
    }
  };

  // Escape key for reject modal
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" && rejectingRequest && !rejecting) {
        handleCloseRejectModal();
      }
    };
    if (rejectingRequest) {
      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
    }
  }, [rejectingRequest, rejecting]);

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
      case "APPROVED":
        return { className: "badge-active", label: "APPROVED" };
      case "REJECTED":
        return { className: "badge-cancelled", label: "REJECTED" };
      case "CANCELLED":
        return { className: "badge-on_hold", label: "CANCELLED" };
      case "REVOKED":
        return { className: "badge-on_notice", label: "REVOKED" };
      case "PENDING":
      default:
        return { className: "badge-planned", label: "PENDING" };
    }
  };

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;
  const approvedCount = requests.filter((r) => r.status === "APPROVED").length;

  return (
    <div className="page-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "8px" }}>
        <SectionHeader title="Employee Leave Requests" />
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/hr/leave-types")}
            title="Manage Leave Types"
          >
            <LeaveTypesIcon size={16} />
            <span>Leave Types</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="stats-grid" style={{ marginBottom: "20px" }}>
        <StatCard
          icon={LeaveRequestsIcon}
          number={loading ? null : requests.length}
          loading={loading}
          label="Total Requests"
          color="blue"
        />
        <StatCard
          icon={ClockIcon}
          number={loading ? null : pendingCount}
          loading={loading}
          label="Pending Review"
          color="orange"
        />
        <StatCard
          icon={CheckCircleIcon}
          number={loading ? null : approvedCount}
          loading={loading}
          label="Approved Requests"
          color="green"
        />
      </div>

      {error && <ErrorAlert message={error} onRetry={loadRequests} />}
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

      {/* Table Card with Filter Bar */}
      <div className="table-card">
        <div className="table-header-bar">
          <div>
            <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-heading)", margin: 0 }}>
              Organization Requests
            </h3>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Filter and process leave applications
            </span>
          </div>

          <div className="table-actions-group">
            <select
              className="form-select"
              style={{ width: "160px", padding: "6px 12px", fontSize: "12px" }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending Only</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="REVOKED">Revoked</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {loading ? (
          <LoadingState message="Loading employee leave requests..." />
        ) : requests.length === 0 ? (
          <EmptyState
            icon={LeaveRequestsIcon}
            title="No Leave Requests"
            description={
              statusFilter
                ? `No leave requests found with status "${statusFilter}".`
                : "No employee leave requests have been submitted yet."
            }
          />
        ) : (
          <div className="table-responsive-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Leave Type</th>
                  <th>Leave Balance</th>
                  <th>Timeline</th>
                  <th>Days</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => {
                  const statusInfo = getStatusBadge(req.status);
                  const isPending = req.status === "PENDING";
                  const isActionLoading = actionLoadingId === req.id;

                  return (
                    <tr key={req.id}>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <strong style={{ color: "var(--text-heading)" }}>
                            {req.employee
                              ? `${req.employee.first_name} ${req.employee.last_name}`
                              : `Employee #${req.employee_id}`}
                          </strong>
                          <span style={{ fontSize: "11px", color: "var(--text-subtle)" }}>
                            {req.employee?.employee_code || `ID: ${req.employee_id}`}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{ background: "#eff6ff", color: "#2563eb", fontSize: "11px" }}
                        >
                          {req.leave_type?.name || `Type #${req.leave_type_id}`}
                        </span>
                      </td>
                      <td>
                        {req.leave_balance ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <div>
                              <span
                                style={{
                                  fontSize: "12.5px",
                                  fontWeight: "700",
                                  color: req.leave_balance.available > 0 ? "var(--text-heading)" : "#dc2626",
                                }}
                              >
                                {req.leave_balance.available}
                              </span>
                              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "4px" }}>
                                remaining
                              </span>
                            </div>
                            <div style={{ fontSize: "10.5px", color: "var(--text-subtle)" }}>
                              Alloc: {req.leave_balance.allocated} • Used: {req.leave_balance.used}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: "11px", color: "var(--text-subtle)" }}>—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: "12px", color: "var(--text-main)" }}>
                          {formatDate(req.start_date)} → {formatDate(req.end_date)}
                        </div>
                      </td>
                      <td>
                        <strong style={{ color: "var(--text-heading)" }}>
                          {req.number_of_days}
                        </strong>{" "}
                        <span style={{ fontSize: "11px", color: "var(--text-subtle)" }}>
                          day{req.number_of_days === 1 ? "" : "s"}
                        </span>
                      </td>
                      <td style={{ maxWidth: "220px" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                          {req.reason}
                        </span>
                        {req.rejection_reason && (
                          <div
                            style={{
                              marginTop: "4px",
                              fontSize: "11px",
                              color: "#dc2626",
                              background: "#fee2e2",
                              padding: "2px 6px",
                              borderRadius: "4px",
                            }}
                          >
                            Reason: {req.rejection_reason}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${statusInfo.className}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "11px", color: "var(--text-subtle)" }}>
                          {formatDate(req.created_at)}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {isPending ? (
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                            <button
                              type="button"
                              className="btn btn-primary"
                              style={{
                                padding: "4px 10px",
                                fontSize: "11px",
                                background: "#16a34a",
                                borderColor: "#16a34a",
                              }}
                              onClick={() => handleApprove(req)}
                              disabled={isActionLoading}
                            >
                              {isActionLoading ? "Approving..." : "Approve"}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: "4px 10px", fontSize: "11px", color: "#dc2626" }}
                              onClick={() => handleOpenRejectModal(req)}
                              disabled={isActionLoading}
                            >
                              Reject
                            </button>
                          </div>
                        ) : req.status === "APPROVED" ? (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{
                              padding: "4px 10px",
                              fontSize: "11px",
                              color: "#b45309",
                              borderColor: "#f59e0b",
                              background: "rgba(245, 158, 11, 0.08)",
                              fontWeight: 600,
                            }}
                            onClick={() => handleRevoke(req)}
                            disabled={isActionLoading}
                          >
                            {isActionLoading ? "Revoking..." : "Revoke"}
                          </button>
                        ) : req.status === "REVOKED" ? (
                          <span style={{ fontSize: "11px", color: "var(--text-subtle)", fontWeight: 500 }}>
                            Revoked
                          </span>
                        ) : (
                          <span style={{ fontSize: "11px", color: "var(--text-subtle)" }}>
                            Processed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Request Modal */}
      {rejectingRequest && (
        <div
          className="modal-overlay"
          onClick={handleCloseRejectModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-card"
            style={{ maxWidth: "460px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3 className="modal-title" style={{ color: "#dc2626" }}>
                  Reject Leave Request
                </h3>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  Request #{rejectingRequest.id} for {rejectingRequest.employee?.first_name} {rejectingRequest.employee?.last_name}
                </span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseRejectModal}
                disabled={rejecting}
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmReject}>
              <div className="modal-body">
                <div
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    marginBottom: "14px",
                    fontSize: "12px",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                  }}
                >
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>Leave Type: </span>
                    <strong style={{ color: "var(--text-heading)" }}>
                      {rejectingRequest.leave_type?.name || `Type #${rejectingRequest.leave_type_id}`}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>Requested: </span>
                    <strong style={{ color: "var(--text-heading)" }}>
                      {rejectingRequest.number_of_days} day{rejectingRequest.number_of_days === 1 ? "" : "s"}
                    </strong>
                  </div>
                  <div style={{ gridColumn: "span 2" }}>
                    <span style={{ color: "var(--text-muted)" }}>Remaining Balance: </span>
                    <strong style={{ color: rejectingRequest.leave_balance?.available > 0 ? "#16a34a" : "#dc2626" }}>
                      {rejectingRequest.leave_balance ? `${rejectingRequest.leave_balance.available} days` : "—"}
                    </strong>
                    {rejectingRequest.leave_balance && (
                      <span style={{ color: "var(--text-subtle)", fontSize: "11px", marginLeft: "6px" }}>
                        (Allocated: {rejectingRequest.leave_balance.allocated}, Used: {rejectingRequest.leave_balance.used})
                      </span>
                    )}
                  </div>
                </div>

                {rejectionError && (
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
                    {rejectionError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="rejection-reason">
                    Rejection Reason <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <textarea
                    id="rejection-reason"
                    className="form-textarea"
                    rows={3}
                    placeholder="Provide detailed explanation for this rejection..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    disabled={rejecting}
                    required
                  />
                  <span style={{ fontSize: "11px", color: "var(--text-subtle)" }}>
                    This reason will be recorded and visible on the request record.
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCloseRejectModal}
                  disabled={rejecting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: "#dc2626", borderColor: "#dc2626" }}
                  disabled={rejecting}
                >
                  {rejecting ? "Rejecting..." : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
