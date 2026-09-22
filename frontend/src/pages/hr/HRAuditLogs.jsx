import { useState, useEffect, useCallback } from "react";
import { auditApi } from "../../api/auditApi";
import SectionHeader from "../../components/common/SectionHeader";
import StatCard from "../../components/common/StatCard";
import {
  LoadingState,
  EmptyState,
  ErrorAlert,
} from "../../components/common/FeedbackStates";
import {
  AuditLogsIcon,
  ShieldIcon,
  CheckCircleIcon,
  ClockIcon,
  SearchIcon,
  ChevronLeft,
  ChevronRight,
} from "../../components/icons/Icons";
import AuditLogDetailsModal from "../../components/audit/AuditLogDetailsModal";
import "../../styles/audit.css";

const PAGE_SIZE = 20;

export default function HRAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Pagination state (1-indexed for display, mapped to skip/limit)
  const [page, setPage] = useState(1);

  // Overall stat counts from API
  const [stats, setStats] = useState({
    total: 0,
    success: 0,
    failed: 0,
    loginCount: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Filter input states
  const [actionFilter, setActionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Active filters applied to query
  const [appliedFilters, setAppliedFilters] = useState({
    action: "",
    status: "",
    email: "",
    start_date: "",
    end_date: "",
    search: "",
  });

  // Selected audit log for details modal
  const [selectedLogId, setSelectedLogId] = useState(null);

  // Load general stats from the API
  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const [totalRes, successRes, failedRes, loginRes] = await Promise.all([
        auditApi.getAuditLogs({ limit: 1 }),
        auditApi.getAuditLogs({ limit: 1, status: "SUCCESS" }),
        auditApi.getAuditLogs({ limit: 1, status: "FAILED" }),
        auditApi.getAuditLogs({ limit: 1, action: "LOGIN" }),
      ]);

      setStats({
        total: totalRes?.total ?? 0,
        success: successRes?.total ?? 0,
        failed: failedRes?.total ?? 0,
        loginCount: loginRes?.total ?? 0,
      });
    } catch {
      // Non-critical: stat cards handle failure gracefully
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch paginated audit logs based on active filters
  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const skip = (page - 1) * PAGE_SIZE;
      const params = {
        skip,
        limit: PAGE_SIZE,
      };

      if (appliedFilters.action) params.action = appliedFilters.action;
      if (appliedFilters.status) params.status = appliedFilters.status;
      if (appliedFilters.email) params.email = appliedFilters.email;
      if (appliedFilters.search) params.search = appliedFilters.search;
      if (appliedFilters.start_date) {
        params.start_date = new Date(`${appliedFilters.start_date}T00:00:00`).toISOString();
      }
      if (appliedFilters.end_date) {
        params.end_date = new Date(`${appliedFilters.end_date}T23:59:59`).toISOString();
      }

      const res = await auditApi.getAuditLogs(params);
      setLogs(Array.isArray(res?.audit_logs) ? res.audit_logs : []);
      setTotal(res?.total ?? 0);
    } catch (err) {
      setError(err.message || "Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  }, [page, appliedFilters]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Handle Apply Filters
  const handleApplyFilters = (e) => {
    if (e) e.preventDefault();
    setPage(1);
    setAppliedFilters({
      action: actionFilter,
      status: statusFilter,
      email: emailFilter.trim(),
      start_date: startDate,
      end_date: endDate,
      search: searchTerm.trim(),
    });
  };

  // Handle Clear Filters
  const handleClearFilters = () => {
    setActionFilter("");
    setStatusFilter("");
    setEmailFilter("");
    setStartDate("");
    setEndDate("");
    setSearchTerm("");
    setPage(1);
    setAppliedFilters({
      action: "",
      status: "",
      email: "",
      start_date: "",
      end_date: "",
      search: "",
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const getActionBadgeClass = (action) => {
    switch (action) {
      case "LOGIN":
        return "badge badge-action-login";
      case "LOGOUT":
        return "badge badge-action-logout";
      case "OTP_VERIFICATION":
        return "badge badge-action-otp";
      default:
        return "badge";
    }
  };

  const getStatusBadgeClass = (status) => {
    return status === "SUCCESS"
      ? "badge badge-audit-success"
      : "badge badge-audit-failed";
  };

  const formatDate = (isoString) => {
    if (!isoString) return "—";
    return new Date(isoString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const hasActiveFilters = Boolean(
    appliedFilters.action ||
    appliedFilters.status ||
    appliedFilters.email ||
    appliedFilters.start_date ||
    appliedFilters.end_date ||
    appliedFilters.search
  );

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <SectionHeader title="Audit Logs" />
        <p style={{ margin: "4px 0 0", fontSize: "13.5px", color: "var(--text-muted)" }}>
          Enterprise authentication activity monitor. Real-time logging of employee and administrator logins, OTP verifications, and session sign-outs.
        </p>
      </div>

      {/* Stat Cards */}
      <div
        className="stats-row"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        <StatCard
          icon={AuditLogsIcon}
          number={stats.total}
          loading={statsLoading}
          label="Total Audit Logs"
          color="blue"
        />
        <StatCard
          icon={CheckCircleIcon}
          number={stats.success}
          loading={statsLoading}
          label="Successful Events"
          color="green"
        />
        <StatCard
          icon={ClockIcon}
          number={stats.failed}
          loading={statsLoading}
          label="Failed Events"
          color="amber"
        />
        <StatCard
          icon={ShieldIcon}
          number={stats.loginCount}
          loading={statsLoading}
          label="Login Attempts"
          color="purple"
        />
      </div>

      {/* Filter Toolbar Card */}
      <div className="audit-filters-card">
        <form onSubmit={handleApplyFilters}>
          <div className="audit-filters-grid">
            {/* Action Filter */}
            <div className="audit-filter-item">
              <label htmlFor="filter-action" className="audit-filter-label">
                Event Action
              </label>
              <select
                id="filter-action"
                className="form-select"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              >
                <option value="">All Actions</option>
                <option value="LOGIN">LOGIN</option>
                <option value="LOGOUT">LOGOUT</option>
                <option value="OTP_VERIFICATION">OTP_VERIFICATION</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="audit-filter-item">
              <label htmlFor="filter-status" className="audit-filter-label">
                Event Status
              </label>
              <select
                id="filter-status"
                className="form-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="SUCCESS">SUCCESS</option>
                <option value="FAILED">FAILED</option>
              </select>
            </div>

            {/* Email Filter */}
            <div className="audit-filter-item">
              <label htmlFor="filter-email" className="audit-filter-label">
                User Email
              </label>
              <input
                id="filter-email"
                type="email"
                className="form-input"
                placeholder="Filter by email..."
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value)}
              />
            </div>

            {/* Start Date */}
            <div className="audit-filter-item">
              <label htmlFor="filter-start-date" className="audit-filter-label">
                From Date
              </label>
              <input
                id="filter-start-date"
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* End Date */}
            <div className="audit-filter-item">
              <label htmlFor="filter-end-date" className="audit-filter-label">
                To Date
              </label>
              <input
                id="filter-end-date"
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {/* General Search */}
            <div className="audit-filter-item">
              <label htmlFor="filter-search" className="audit-filter-label">
                Search
              </label>
              <div className="search-bar" style={{ padding: "5px 12px", width: "100%" }}>
                <SearchIcon size={14} />
                <input
                  id="filter-search"
                  type="text"
                  placeholder="IP, details, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="audit-filter-actions">
              <button
                type="submit"
                className="btn btn-primary"
                style={{ padding: "8px 16px", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <SearchIcon size={14} />
                <span>Apply</span>
              </button>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleClearFilters}
                  style={{ padding: "8px 14px", fontSize: "13px" }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {error && <ErrorAlert message={error} onRetry={loadLogs} />}

      {/* Main Table Card */}
      <div className="table-card">
        {loading ? (
          <LoadingState message="Loading audit records..." />
        ) : logs.length === 0 ? (
          <EmptyState
            icon={AuditLogsIcon}
            title="No audit logs found"
            description={
              hasActiveFilters
                ? "No authentication events match your current filter parameters."
                : "There are currently no recorded authentication logs in the system."
            }
            action={
              hasActiveFilters ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleClearFilters}
                >
                  Clear Filters
                </button>
              ) : null
            }
          />
        ) : (
          <>
            {/* Desktop & Tablet Table */}
            <div className="table-responsive-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: "65px" }}>ID</th>
                    <th>Action</th>
                    <th>Status</th>
                    <th>User / Email</th>
                    <th>IP Address</th>
                    <th>User Agent</th>
                    <th>Details</th>
                    <th>Timestamp</th>
                    <th style={{ textAlign: "right" }}>Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((item) => {
                    const actionBadge = getActionBadgeClass(item.action);
                    const statusBadge = getStatusBadgeClass(item.status);
                    const userDisplay = item.user?.full_name || item.email || "Anonymous";

                    return (
                      <tr key={item.id}>
                        <td className="audit-mono" style={{ fontWeight: 600 }}>
                          #{item.id}
                        </td>
                        <td>
                          <span className={actionBadge}>{item.action}</span>
                        </td>
                        <td>
                          <span className={statusBadge}>
                            {item.status === "SUCCESS" ? "SUCCESS" : "FAILED"}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontWeight: 600, color: "var(--text-heading)", fontSize: "13px" }}>
                              {userDisplay}
                            </span>
                            {item.email && (
                              <span className="audit-mono" style={{ fontSize: "11px" }}>
                                {item.email}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="audit-mono">
                            {item.ip_address || "—"}
                          </span>
                        </td>
                        <td>
                          <span
                            className="audit-ua-truncate"
                            title={item.user_agent || "No User Agent"}
                          >
                            {item.user_agent || "—"}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: "12.5px",
                              color: "var(--text-main)",
                              display: "block",
                              maxWidth: "200px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={item.details || ""}
                          >
                            {item.details || "—"}
                          </span>
                        </td>
                        <td style={{ fontSize: "12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                          {formatDate(item.created_at)}
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSelectedLogId(item.id)}
                            style={{ padding: "4px 10px", fontSize: "12px" }}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="pagination-bar">
              <span>
                Showing {logs.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0} to{" "}
                {Math.min(page * PAGE_SIZE, total)} of {total} logs
              </span>
              <div className="pagination-controls">
                <button
                  type="button"
                  className="pagination-btn"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous Page"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="page-indicator">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  className="pagination-btn"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Next Page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Details Modal */}
      {selectedLogId && (
        <AuditLogDetailsModal
          logId={selectedLogId}
          onClose={() => setSelectedLogId(null)}
        />
      )}
    </div>
  );
}
