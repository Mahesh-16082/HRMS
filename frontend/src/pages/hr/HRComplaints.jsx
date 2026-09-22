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
  SearchIcon,
  UsersIcon,
} from "../../components/icons/Icons";
import HRComplaintDetails from "../../components/complaints/HRComplaintDetails";

export default function HRComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [countsData, setCountsData] = useState({
    total: 0,
    by_status: { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [countsLoading, setCountsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Search & Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  // Modal
  const [selectedComplaint, setSelectedComplaint] = useState(null);

  // Debounce search input by 350ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Load counts for stat cards
  const loadCounts = useCallback(async () => {
    try {
      setCountsLoading(true);
      const data = await complaintApi.getComplaintCounts();
      if (data) {
        setCountsData({
          total: data.total ?? 0,
          by_status: data.by_status || {},
        });
      }
    } catch {
      // Non-critical: stat counts can fallback silently
    } finally {
      setCountsLoading(false);
    }
  }, []);

  // Load complaints list using server-side filters
  const loadComplaints = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const data = await complaintApi.getComplaints(params);
      const list = Array.isArray(data?.complaints) ? data.complaints : [];
      setComplaints(list);
      setTotalCount(data?.total ?? list.length);
    } catch (err) {
      setError(err.message || "Failed to load complaints.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, categoryFilter, debouncedSearch]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

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

  // Callback when a complaint status or remarks are updated
  const handleComplaintUpdated = (updated) => {
    setSuccessMsg(`Complaint #${updated.id} updated successfully.`);
    setSelectedComplaint(updated);
    loadComplaints();
    loadCounts();
    setTimeout(() => setSuccessMsg(""), 5000);
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <SectionHeader title="Complaints Management" />

      {/* Stat Cards */}
      <div className="stats-row complaint-stats-grid hr-complaint-stats" style={{ marginBottom: "20px" }}>
        <StatCard
          icon={ComplaintsIcon}
          number={countsData.total}
          loading={countsLoading}
          label="Total Complaints"
          color="blue"
        />
        <StatCard
          icon={ClockIcon}
          number={countsData.by_status?.OPEN ?? 0}
          loading={countsLoading}
          label="Open"
          color="purple"
        />
        <StatCard
          icon={ClockIcon}
          number={countsData.by_status?.IN_PROGRESS ?? 0}
          loading={countsLoading}
          label="In Progress"
          color="amber"
        />
        <StatCard
          icon={CheckCircleIcon}
          number={countsData.by_status?.RESOLVED ?? 0}
          loading={countsLoading}
          label="Resolved"
          color="green"
        />
        <StatCard
          icon={CheckCircleIcon}
          number={countsData.by_status?.CLOSED ?? 0}
          loading={countsLoading}
          label="Closed"
          color="emerald"
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
        {/* Table Filters & Search Bar */}
        <div className="table-header-bar" style={{ flexWrap: "wrap", gap: "12px" }}>
          {/* Search Box */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "260px" }}>
            <div className="search-bar" style={{ padding: "6px 14px", width: "100%" }}>
              <SearchIcon size={15} />
              <input
                type="text"
                placeholder="Search subject, description, category, employee..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Filter Dropdowns */}
          <div className="table-actions-group" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-select"
              style={{ width: "auto", padding: "6px 12px", fontSize: "12.5px" }}
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="form-select"
              style={{ width: "auto", padding: "6px 12px", fontSize: "12.5px" }}
            >
              <option value="">All Priorities</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="form-select"
              style={{ width: "auto", padding: "6px 12px", fontSize: "12.5px" }}
            >
              <option value="">All Categories</option>
              <option value="Facilities">Facilities</option>
              <option value="IT Support">IT Support</option>
              <option value="Workplace & Environment">Workplace &amp; Environment</option>
              <option value="Payroll & Compensation">Payroll &amp; Compensation</option>
              <option value="Equipment & Hardware">Equipment &amp; Hardware</option>
              <option value="Management & Leadership">Management &amp; Leadership</option>
              <option value="Policy & HR">Policy &amp; HR</option>
            </select>
          </div>
        </div>

        {/* Complaints Table */}
        {loading ? (
          <LoadingState message="Loading complaints..." />
        ) : complaints.length === 0 ? (
          <EmptyState
            icon={ComplaintsIcon}
            title="No complaints found"
            description={
              search || statusFilter || priorityFilter || categoryFilter
                ? "No complaints match your active filter and search criteria."
                : "There are currently no employee complaints in the system."
            }
          />
        ) : (
          <div className="table-responsive-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: "50px" }}>#</th>
                  <th>Employee</th>
                  <th>Subject</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Updated</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((item) => {
                  const statusBadge = getStatusBadge(item.status);
                  const priorityBadge = getPriorityBadge(item.priority);
                  const empName = item.employee
                    ? `${item.employee.first_name} ${item.employee.last_name}`
                    : `Employee #${item.employee_id}`;
                  const empCode = item.employee?.employee_code;

                  return (
                    <tr key={item.id}>
                      <td style={{ color: "var(--text-muted)", fontWeight: "600", fontSize: "12px" }}>
                        #{item.id}
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: "600", color: "var(--text-heading)", fontSize: "13px" }}>
                            {empName}
                          </span>
                          {empCode && (
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                              {empCode}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: "600",
                            color: "var(--text-heading)",
                            display: "block",
                            maxWidth: "260px",
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
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedComplaint(item)}
                          style={{ padding: "4px 10px", fontSize: "12px" }}
                        >
                          Review / Update
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
          HR REVIEW & STATUS UPDATE MODAL
      ======================================================== */}
      {selectedComplaint && (
        <HRComplaintDetails
          complaint={selectedComplaint}
          onClose={() => setSelectedComplaint(null)}
          onUpdated={handleComplaintUpdated}
        />
      )}
    </div>
  );
}
