import { useState, useEffect, useCallback } from "react";
import { attendanceApi } from "../../api/attendanceApi";
import SectionHeader from "../../components/common/SectionHeader";
import {
  LoadingState,
  EmptyState,
  ErrorAlert,
} from "../../components/common/FeedbackStates";
import {
  AttendanceIcon,
  ClockIcon,
  CheckCircleIcon,
  CalendarIcon,
  CloseIcon,
} from "../../components/icons/Icons";

export default function EmployeeAttendance() {
  const [todayRecord, setTodayRecord] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingToday, setLoadingToday] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Check in/out remarks dialog state
  const [actionType, setActionType] = useState(null); // 'check-in' | 'check-out' | null
  const [remarks, setRemarks] = useState("");

  // Filters for history
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Load today's attendance
  const loadTodayAttendance = useCallback(async () => {
    try {
      setLoadingToday(true);
      const data = await attendanceApi.getMyTodayAttendance();
      setTodayRecord(data);
    } catch (err) {
      console.warn("Error loading today's attendance:", err.message);
    } finally {
      setLoadingToday(false);
    }
  }, []);

  // Load attendance history
  const loadHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      setError("");
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (statusFilter) params.status = statusFilter;

      const data = await attendanceApi.getMyAttendance(params);
      setHistory(data.attendance || []);
    } catch (err) {
      setError(err.message || "Failed to load attendance history.");
    } finally {
      setLoadingHistory(false);
    }
  }, [startDate, endDate, statusFilter]);

  useEffect(() => {
    loadTodayAttendance();
    loadHistory();
  }, [loadTodayAttendance, loadHistory]);

  // Handle Check-in / Check-out submit
  const handleActionSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccessMsg("");

    try {
      if (actionType === "check-in") {
        const result = await attendanceApi.checkIn(remarks.trim() || null);
        setTodayRecord(result);
        setSuccessMsg("Checked in successfully!");
      } else if (actionType === "check-out") {
        const result = await attendanceApi.checkOut(remarks.trim() || null);
        setTodayRecord(result);
        setSuccessMsg("Checked out successfully!");
      }
      setActionType(null);
      setRemarks("");
      loadHistory();
    } catch (err) {
      setError(err.message || `Failed to ${actionType}.`);
    } finally {
      setSubmitting(false);
    }
  };

  const isCheckedIn = !!todayRecord?.check_in;
  const isCheckedOut = !!todayRecord?.check_out;

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  return (
    <div className="page-container">
      <SectionHeader title="Daily Attendance" />

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

      {error && <ErrorAlert message={error} />}

      {/* Today's Attendance Overview Card */}
      <div className="table-card" style={{ padding: "24px", marginBottom: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: isCheckedIn ? "#dcfce7" : "#dbeafe",
                color: isCheckedIn ? "#16a34a" : "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ClockIcon size={28} />
            </div>
            <div>
              <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>
                Today: {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
                <h3 style={{ fontSize: "20px", fontWeight: "800", color: "var(--text-heading)", margin: 0 }}>
                  {loadingToday
                    ? "Loading..."
                    : isCheckedOut
                    ? "Checked Out"
                    : isCheckedIn
                    ? "Currently Checked In"
                    : "Not Checked In Today"}
                </h3>
                {todayRecord && (
                  <span className={`badge badge-${todayRecord.status.toLowerCase()}`}>
                    {todayRecord.status}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {!isCheckedIn && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setActionType("check-in");
                  setRemarks("");
                }}
                disabled={loadingToday}
              >
                <ClockIcon size={16} />
                <span>Check In</span>
              </button>
            )}

            {isCheckedIn && !isCheckedOut && (
              <button
                className="btn btn-danger"
                onClick={() => {
                  setActionType("check-out");
                  setRemarks("");
                }}
                disabled={loadingToday}
              >
                <ClockIcon size={16} />
                <span>Check Out</span>
              </button>
            )}

            {isCheckedOut && (
              <span style={{ fontSize: "13px", color: "#16a34a", fontWeight: "600" }}>
                ✓ Completed for today
              </span>
            )}
          </div>
        </div>

        {/* Timestamps */}
        {todayRecord && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "16px",
              marginTop: "20px",
              paddingTop: "20px",
              borderTop: "1px solid var(--border-color)",
            }}
          >
            <div>
              <span className="form-label" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Check-In Time
              </span>
              <span style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-heading)" }}>
                {formatDateTime(todayRecord.check_in)}
              </span>
            </div>

            <div>
              <span className="form-label" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Check-Out Time
              </span>
              <span style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-heading)" }}>
                {formatDateTime(todayRecord.check_out)}
              </span>
            </div>

            <div>
              <span className="form-label" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Remarks
              </span>
              <span style={{ fontSize: "13px", color: "var(--text-main)" }}>
                {todayRecord.remarks || "—"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Attendance History Section */}
      <div className="table-card">
        <div className="table-header-bar">
          <div className="section-header-title-group">
            <div className="section-accent-bar" />
            <h3 className="section-title" style={{ fontSize: "15px" }}>Attendance History</h3>
          </div>

          <div className="table-actions-group">
            <input
              type="date"
              placeholder="Start Date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="form-input"
              style={{ width: "auto", padding: "6px 10px", fontSize: "12px" }}
              title="Filter from date"
            />
            <input
              type="date"
              placeholder="End Date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="form-input"
              style={{ width: "auto", padding: "6px 10px", fontSize: "12px" }}
              title="Filter to date"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-select"
              style={{ width: "auto", padding: "6px 10px", fontSize: "12px" }}
            >
              <option value="">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="ON_LEAVE">On Leave</option>
            </select>
          </div>
        </div>

        {loadingHistory ? (
          <LoadingState message="Loading attendance history..." />
        ) : history.length === 0 ? (
          <EmptyState
            icon={AttendanceIcon}
            title="No attendance records"
            description="No logs found for the selected period."
          />
        ) : (
          <div className="table-responsive-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {history.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <CalendarIcon size={16} className="text-muted" />
                        <span style={{ fontWeight: "600" }}>{record.attendance_date}</span>
                      </div>
                    </td>
                    <td>{formatDateTime(record.check_in)}</td>
                    <td>{formatDateTime(record.check_out)}</td>
                    <td>
                      <span className={`badge badge-${record.status.toLowerCase()}`}>
                        {record.status}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {record.remarks || "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Check In / Out Modal */}
      {actionType && (
        <div className="modal-overlay" onClick={() => setActionType(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleActionSubmit}>
              <div className="modal-header">
                <h3 className="modal-title">
                  {actionType === "check-in" ? "Daily Check In" : "Daily Check Out"}
                </h3>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setActionType(null)}
                >
                  <CloseIcon size={18} />
                </button>
              </div>

              <div className="modal-body">
                <p style={{ fontSize: "13.5px", color: "var(--text-muted)", margin: 0 }}>
                  Record your attendance timestamp for today (
                  {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}).
                </p>

                <div className="form-group">
                  <label className="form-label">Remarks (Optional)</label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="e.g. Working from office, remote morning, etc."
                    className="form-textarea"
                    maxLength={500}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setActionType(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={actionType === "check-in" ? "btn btn-primary" : "btn btn-danger"}
                  disabled={submitting}
                >
                  {submitting
                    ? "Recording..."
                    : actionType === "check-in"
                    ? "Confirm Check In"
                    : "Confirm Check Out"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
