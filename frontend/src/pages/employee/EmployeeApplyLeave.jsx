import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { leaveApi } from "../../api/leaveApi";
import SectionHeader from "../../components/common/SectionHeader";
import StatCard from "../../components/common/StatCard";
import {
  LoadingState,
  ErrorAlert,
} from "../../components/common/FeedbackStates";
import {
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowRight,
} from "../../components/icons/Icons";

export default function EmployeeApplyLeave() {
  const navigate = useNavigate();

  const [leaveTypes, setLeaveTypes] = useState([]);
  const [userBalances, setUserBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Load active leave types and employee's balances
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [typesRes, balancesRes] = await Promise.allSettled([
        leaveApi.getActiveLeaveTypes(),
        leaveApi.getMyBalances(),
      ]);

      const rawTypes = typesRes.status === "fulfilled" ? typesRes.value?.leave_types || [] : [];
      const types = rawTypes.filter(
        (t) => t.is_active !== false && t.code !== "ANNUAL"
      );

      const rawBalances = balancesRes.status === "fulfilled" ? balancesRes.value?.balances || [] : [];
      const currentYear = new Date().getFullYear();
      const balances = rawBalances.filter(
        (b) =>
          b.leave_type &&
          b.leave_type.is_active !== false &&
          b.leave_type.code !== "ANNUAL" &&
          (!b.year || b.year === currentYear)
      );

      setLeaveTypes(types);
      setUserBalances(balances.length > 0 ? balances : rawBalances.filter(b => b.leave_type?.is_active !== false && b.leave_type?.code !== "ANNUAL"));

      if (types.length > 0) {
        setSelectedTypeId(String(types[0].id));
      }
    } catch (err) {
      setError(err.message || "Failed to load leave configuration.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Calculate day count
  const calculateDays = () => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) return -1;
    const diffTime = Math.abs(end - start);
    return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const calculatedDays = calculateDays();

  // Selected balance info
  const selectedBalance = userBalances.find(
    (b) => String(b.leave_type_id) === String(selectedTypeId)
  );

  const totalAvailableBalance = userBalances.reduce(
    (sum, b) => sum + (Number(b.available) || 0),
    0
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!selectedTypeId) {
      setError("Please select a leave policy type.");
      return;
    }
    if (!startDate) {
      setError("Please select a start date.");
      return;
    }
    if (!endDate) {
      setError("Please select an end date.");
      return;
    }
    if (calculatedDays === -1) {
      setError("End date cannot be earlier than start date.");
      return;
    }
    if (!reason.trim()) {
      setError("Please provide a reason for your leave request.");
      return;
    }

    try {
      setSubmitting(true);
      await leaveApi.applyLeave({
        leave_type_id: Number(selectedTypeId),
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim(),
      });

      setSuccessMsg("Leave request submitted successfully! Status: PENDING. Redirecting to dashboard...");

      // Reload balances
      const updatedBalancesRes = await leaveApi.getMyBalances();
      setUserBalances(updatedBalancesRes?.balances || []);

      setTimeout(() => {
        navigate("/employee-dashboard");
      }, 1600);
    } catch (err) {
      setError(err.message || "Failed to submit leave request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      <SectionHeader
        title="Apply for Leave"
        actionText="← Back to Dashboard"
        actionTo="/employee-dashboard"
      />

      {/* Top Overview Cards */}
      <div className="stats-grid" style={{ marginBottom: "20px" }}>
        <StatCard
          icon={CalendarIcon}
          number={loading ? null : (totalAvailableBalance !== null && totalAvailableBalance !== undefined ? totalAvailableBalance : 0)}
          loading={loading}
          label="Total Leave Available"
          color="purple"
        />
        <StatCard
          icon={CheckCircleIcon}
          number={loading ? null : leaveTypes.length}
          loading={loading}
          label="Active Leave Policies"
          color="blue"
        />
        <StatCard
          icon={ClockIcon}
          number={loading ? null : (selectedBalance ? Number(selectedBalance.available).toFixed(1) : "0.0")}
          loading={loading}
          label="Selected Policy Available"
          color="green"
        />
      </div>

      {error && <ErrorAlert message={error} onRetry={loadInitialData} />}

      {successMsg && (
        <div
          style={{
            background: "#dcfce7",
            color: "#166534",
            padding: "14px 20px",
            borderRadius: "10px",
            fontSize: "14px",
            marginBottom: "20px",
            border: "1px solid #bbf7d0",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <CheckCircleIcon size={20} />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <LoadingState message="Loading leave application form..." />
      ) : (
        <div className="table-card" style={{ maxWidth: "760px", margin: "0 auto", width: "100%" }}>
          <div className="table-header-bar">
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-heading)", margin: 0 }}>
                Leave Application Form
              </h3>
              <span style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
                Fill out the details below to submit your leave request
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Leave Policy Selector */}
              <div className="form-group">
                <label className="form-label" htmlFor="apply-leave-type">
                  Select Leave Policy <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  id="apply-leave-type"
                  className="form-select"
                  value={selectedTypeId}
                  onChange={(e) => setSelectedTypeId(e.target.value)}
                  disabled={submitting}
                >
                  {leaveTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name} ({type.code}) — Quota: {type.annual_quota} days/year
                    </option>
                  ))}
                </select>

                {/* Real-time policy balance details */}
                {selectedBalance ? (
                  <div
                    style={{
                      display: "flex",
                      gap: "16px",
                      marginTop: "6px",
                      padding: "8px 12px",
                      background: "var(--bg-card-subtle)",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "var(--text-muted)",
                      flexWrap: "wrap",
                    }}
                  >
                    <span>Allocated: <strong style={{ color: "var(--text-main)" }}>{selectedBalance.allocated}</strong></span>
                    <span>Used: <strong style={{ color: "var(--text-main)" }}>{selectedBalance.used}</strong></span>
                    <span style={{ color: "#16a34a", fontWeight: "700" }}>
                      Available Balance: {selectedBalance.available} days
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: "12px", color: "#b45309", marginTop: "4px" }}>
                    Note: No leave balance record found for this policy in current calendar year.
                  </div>
                )}
              </div>

              {/* Date Range Selection */}
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label" htmlFor="apply-start-date">
                    Start Date <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    id="apply-start-date"
                    type="date"
                    className="form-input"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={submitting}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="apply-end-date">
                    End Date <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    id="apply-end-date"
                    type="date"
                    className="form-input"
                    min={startDate}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* Calculated Duration Indicator */}
              {calculatedDays !== null && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: calculatedDays === -1 ? "#fee2e2" : "var(--bg-card-subtle)",
                    fontSize: "13px",
                    color: calculatedDays === -1 ? "#991b1b" : "var(--text-main)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    border: calculatedDays === -1 ? "1px solid #fecaca" : "1px solid var(--border-color)",
                  }}
                >
                  <span style={{ fontWeight: "600" }}>Requested Duration:</span>
                  <strong style={{ fontSize: "15px" }}>
                    {calculatedDays === -1
                      ? "Invalid: End date cannot be before Start date"
                      : `${calculatedDays} Calendar Day${calculatedDays === 1 ? "" : "s"}`}
                  </strong>
                </div>
              )}

              {/* Reason For Leave */}
              <div className="form-group">
                <label className="form-label" htmlFor="apply-reason">
                  Reason for Leave <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <textarea
                  id="apply-reason"
                  className="form-textarea"
                  rows={4}
                  placeholder="Describe the reason for your leave request (medical, personal, travel, etc.)..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={submitting}
                />
              </div>

              {/* Actions Footer */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  paddingTop: "10px",
                  borderTop: "1px solid var(--border-color)",
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => navigate("/employee-dashboard")}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || (calculatedDays !== null && calculatedDays < 1)}
                >
                  {submitting ? "Submitting..." : "Submit Leave Request"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
