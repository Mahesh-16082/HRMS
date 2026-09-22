import { useState, useEffect, useCallback } from "react";
import { attendanceApi } from "../../api/attendanceApi";
import { employeeApi } from "../../api/employeeApi";
import SectionHeader from "../../components/common/SectionHeader";
import StatCard from "../../components/common/StatCard";
import {
  LoadingState,
  EmptyState,
  ErrorAlert,
} from "../../components/common/FeedbackStates";
import {
  AttendanceIcon,
  CheckCircleIcon,
  CalendarIcon,
  UsersIcon,
} from "../../components/icons/Icons";

export default function HRAttendance() {
  const [attendanceList, setAttendanceList] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [totalCount, setTotalCount] = useState(null);
  const [presentCount, setPresentCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Load employee list for dropdown
  useEffect(() => {
    employeeApi.listEmployees({ limit: 100 })
      .then((data) => setEmployees(data.employees || []))
      .catch((err) => console.warn("Could not load employee options:", err.message));
  }, []);

  // Fetch Attendance Data
  const fetchAttendance = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (statusFilter) params.status = statusFilter;

      let result;
      if (selectedEmployeeId) {
        result = await attendanceApi.getEmployeeAttendance(selectedEmployeeId, params);
      } else {
        result = await attendanceApi.getAllAttendance(params);
      }

      setAttendanceList(result.attendance || []);

      // Fetch overview counts
      const [allCount, presentData] = await Promise.allSettled([
        attendanceApi.getAttendanceCount(params),
        attendanceApi.getAttendanceCount({ ...params, status: "PRESENT" }),
      ]);

      if (allCount.status === "fulfilled") {
        setTotalCount(allCount.value?.count ?? 0);
      }
      if (presentData.status === "fulfilled") {
        setPresentCount(presentData.value?.count ?? 0);
      }
    } catch (err) {
      setError(err.message || "Failed to load attendance records.");
    } finally {
      setLoading(false);
    }
  }, [selectedEmployeeId, startDate, endDate, statusFilter]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Find employee name by employee_id helper
  const getEmployeeName = (empId) => {
    const emp = employees.find((e) => e.id === empId);
    return emp ? `${emp.first_name} ${emp.last_name} (${emp.employee_code})` : `Employee #${empId}`;
  };

  return (
    <div className="page-container">
      <SectionHeader title="Attendance Management" />

      {/* Attendance Stats Cards */}
      <div className="stats-grid">
        <StatCard
          icon={AttendanceIcon}
          number={totalCount}
          loading={loading}
          label="Total Records"
          color="blue"
        />
        <StatCard
          icon={CheckCircleIcon}
          number={presentCount}
          loading={loading}
          label="Present Marked"
          color="green"
        />
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchAttendance} />}

      <div className="table-card">
        {/* Filter Toolbar */}
        <div className="table-header-bar">
          <div className="table-actions-group" style={{ width: "100%", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {/* Employee Selector */}
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="form-select"
                style={{ width: "auto", minWidth: "180px", padding: "6px 12px", fontSize: "13px" }}
              >
                <option value="">All Employees</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} ({emp.employee_code})
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="form-select"
                style={{ width: "auto", padding: "6px 12px", fontSize: "13px" }}
              >
                <option value="">All Statuses</option>
                <option value="PRESENT">PRESENT</option>
                <option value="ABSENT">ABSENT</option>
                <option value="HALF_DAY">HALF_DAY</option>
                <option value="ON_LEAVE">ON_LEAVE</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="form-input"
                style={{ width: "auto", padding: "6px 10px", fontSize: "12px" }}
                title="From Date"
              />
              <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="form-input"
                style={{ width: "auto", padding: "6px 10px", fontSize: "12px" }}
                title="To Date"
              />
            </div>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <LoadingState message="Loading company attendance logs..." />
        ) : attendanceList.length === 0 ? (
          <EmptyState
            icon={AttendanceIcon}
            title="No attendance records found"
            description="No logs matching your selected filters were found."
          />
        ) : (
          <div className="table-responsive-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {attendanceList.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <UsersIcon size={16} className="text-muted" />
                        <span style={{ fontWeight: "600", color: "var(--text-heading)" }}>
                          {getEmployeeName(row.employee_id)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <CalendarIcon size={14} className="text-muted" />
                        <span>{row.attendance_date}</span>
                      </div>
                    </td>
                    <td>{formatDateTime(row.check_in)}</td>
                    <td>{formatDateTime(row.check_out)}</td>
                    <td>
                      <span className={`badge badge-${row.status.toLowerCase()}`}>
                        {row.status}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {row.remarks || "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
