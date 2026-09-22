import { useState, useEffect, useCallback } from "react";
import { leaveApi } from "../../api/leaveApi";
import { employeeApi } from "../../api/employeeApi";
import SectionHeader from "../../components/common/SectionHeader";
import StatCard from "../../components/common/StatCard";
import {
  LoadingState,
  EmptyState,
  ErrorAlert,
} from "../../components/common/FeedbackStates";
import {
  LeaveBalancesIcon,
  CheckCircleIcon,
  UsersIcon,
  PlusIcon,
  EditIcon,
  CloseIcon,
  CalendarIcon,
} from "../../components/icons/Icons";

export default function LeaveBalances() {
  const [balances, setBalances] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filters
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState("");
  const [selectedYearFilter, setSelectedYearFilter] = useState(String(new Date().getFullYear()));

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBalance, setEditingBalance] = useState(null); // null = Create, object = Edit
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  const [formData, setFormData] = useState({
    employee_id: "",
    leave_type_id: "",
    year: new Date().getFullYear(),
    allocated: 12,
    used: 0,
  });

  // Load employee and leave type options for dropdowns
  useEffect(() => {
    employeeApi.listEmployees({ limit: 100 })
      .then((data) => setEmployees(data.employees || []))
      .catch((err) => console.warn("Could not load employee options:", err.message));

    leaveApi.getAllLeaveTypes()
      .then((data) => setLeaveTypes(data.leave_types || []))
      .catch((err) => console.warn("Could not load leave types:", err.message));
  }, []);

  // Load Balances
  const loadBalances = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (selectedEmployeeFilter) params.employee_id = selectedEmployeeFilter;
      if (selectedYearFilter) params.year = selectedYearFilter;

      const data = await leaveApi.getAllBalances(params);
      setBalances(data?.balances || []);
    } catch (err) {
      setError(err.message || "Failed to load leave balances.");
    } finally {
      setLoading(false);
    }
  }, [selectedEmployeeFilter, selectedYearFilter]);

  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingBalance(null);
    setFormData({
      employee_id: employees.length > 0 ? String(employees[0].id) : "",
      leave_type_id: leaveTypes.length > 0 ? String(leaveTypes[0].id) : "",
      year: new Date().getFullYear(),
      allocated: 12,
      used: 0,
    });
    setModalError("");
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (bal) => {
    setEditingBalance(bal);
    setFormData({
      employee_id: String(bal.employee_id),
      leave_type_id: String(bal.leave_type_id),
      year: bal.year,
      allocated: bal.allocated,
      used: bal.used,
    });
    setModalError("");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (submitting) return;
    setIsModalOpen(false);
    setEditingBalance(null);
    setModalError("");
  };

  // Submit Modal
  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError("");

    if (!formData.employee_id) {
      setModalError("Please select an employee.");
      return;
    }
    if (!formData.leave_type_id) {
      setModalError("Please select a leave policy type.");
      return;
    }
    if (Number(formData.allocated) < 0) {
      setModalError("Allocated days must be 0 or greater.");
      return;
    }

    try {
      setSubmitting(true);
      if (editingBalance) {
        await leaveApi.updateBalance(editingBalance.id, {
          allocated: Number(formData.allocated),
          used: Number(formData.used),
        });
        setSuccessMsg("Leave balance updated successfully.");
      } else {
        await leaveApi.createBalance({
          employee_id: Number(formData.employee_id),
          leave_type_id: Number(formData.leave_type_id),
          year: Number(formData.year),
          allocated: Number(formData.allocated),
          used: Number(formData.used || 0),
        });
        setSuccessMsg("Leave balance allocated successfully.");
      }
      setIsModalOpen(false);
      loadBalances();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setModalError(err.message || "Failed to save balance.");
    } finally {
      setSubmitting(false);
    }
  };

  // Escape key for modal
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" && isModalOpen && !submitting) {
        handleCloseModal();
      }
    };
    if (isModalOpen) {
      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
    }
  }, [isModalOpen, submitting]);

  const uniqueEmployeesWithBalances = new Set(balances.map((b) => b.employee_id)).size;

  return (
    <div className="page-container">
      <SectionHeader
        title="Employee Leave Balances"
        actionText="+ Allocate Balance"
        actionClick={handleOpenCreate}
      />

      {/* Overview Stat Cards */}
      <div className="stats-grid" style={{ marginBottom: "20px" }}>
        <StatCard
          icon={LeaveBalancesIcon}
          number={loading ? null : balances.length}
          loading={loading}
          label="Total Balance Records"
          color="blue"
        />
        <StatCard
          icon={UsersIcon}
          number={loading ? null : uniqueEmployeesWithBalances}
          loading={loading}
          label="Employees with Balances"
          color="green"
        />
      </div>

      {error && <ErrorAlert message={error} onRetry={loadBalances} />}
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

      {/* Balances Table Card */}
      <div className="table-card">
        <div className="table-header-bar">
          <div>
            <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-heading)", margin: 0 }}>
              Assigned Employee Balances
            </h3>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Official backend balances and entitlements
            </span>
          </div>

          <div className="table-actions-group">
            <select
              className="form-select"
              style={{ width: "190px", padding: "6px 12px", fontSize: "12px" }}
              value={selectedEmployeeFilter}
              onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
            >
              <option value="">All Employees</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} ({emp.employee_code})
                </option>
              ))}
            </select>

            <select
              className="form-select"
              style={{ width: "130px", padding: "6px 12px", fontSize: "12px" }}
              value={selectedYearFilter}
              onChange={(e) => setSelectedYearFilter(e.target.value)}
            >
              <option value="">All Years</option>
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>

            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: "12px", padding: "6px 14px" }}
              onClick={handleOpenCreate}
            >
              <PlusIcon size={14} /> Allocate Balance
            </button>
          </div>
        </div>

        {loading ? (
          <LoadingState message="Loading employee balances..." />
        ) : balances.length === 0 ? (
          <EmptyState
            icon={LeaveBalancesIcon}
            title="No Balances Found"
            description="No leave balances configured for the selected filters. Click '+ Allocate Balance' to configure employee entitlements."
          />
        ) : (
          <div className="table-responsive-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Leave Type</th>
                  <th>Year</th>
                  <th>Allocated</th>
                  <th>Used</th>
                  <th>Available</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((bal) => (
                  <tr key={bal.id}>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <strong style={{ color: "var(--text-heading)" }}>
                          {bal.employee
                            ? `${bal.employee.first_name} ${bal.employee.last_name}`
                            : `Employee #${bal.employee_id}`}
                        </strong>
                        <span style={{ fontSize: "11px", color: "var(--text-subtle)" }}>
                          {bal.employee?.employee_code || `ID: ${bal.employee_id}`}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{ background: "#eff6ff", color: "#2563eb", fontSize: "11px" }}
                      >
                        {bal.leave_type?.name || `Type #${bal.leave_type_id}`}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: "600" }}>{bal.year}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: "600" }}>{bal.allocated.toFixed(1)}</span>
                      <span style={{ fontSize: "11px", color: "var(--text-subtle)", marginLeft: "4px" }}>
                        days
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: "600", color: bal.used > 0 ? "#b45309" : "var(--text-muted)" }}>
                        {bal.used.toFixed(1)}
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--text-subtle)", marginLeft: "4px" }}>
                        days
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontWeight: "700",
                          color: bal.available > 0 ? "#16a34a" : "#dc2626",
                          background: bal.available > 0 ? "#dcfce7" : "#fee2e2",
                          padding: "2px 8px",
                          borderRadius: "6px",
                          fontSize: "12px",
                        }}
                      >
                        {bal.available.toFixed(1)} days
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: "4px 10px", fontSize: "11px" }}
                        onClick={() => handleOpenEdit(bal)}
                        title="Adjust balance"
                      >
                        <EditIcon size={13} /> Adjust
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Allocate / Adjust Modal */}
      {isModalOpen && (
        <div
          className="modal-overlay"
          onClick={handleCloseModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-card"
            style={{ maxWidth: "480px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: "#dbeafe",
                    color: "#2563eb",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <LeaveBalancesIcon size={20} />
                </div>
                <div>
                  <h3 className="modal-title">
                    {editingBalance ? "Adjust Leave Balance" : "Allocate Leave Balance"}
                  </h3>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    {editingBalance ? "Modify employee entitlement" : "Assign leave quota to an employee"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseModal}
                disabled={submitting}
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {modalError && (
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
                    {modalError}
                  </div>
                )}

                {/* Employee Selector */}
                <div className="form-group">
                  <label className="form-label" htmlFor="bal-employee">
                    Employee <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select
                    id="bal-employee"
                    className="form-select"
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                    disabled={submitting || !!editingBalance}
                  >
                    <option value="">Select an employee...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name} ({emp.employee_code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Leave Type Selector */}
                <div className="form-group">
                  <label className="form-label" htmlFor="bal-type">
                    Leave Type <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select
                    id="bal-type"
                    className="form-select"
                    value={formData.leave_type_id}
                    onChange={(e) => setFormData({ ...formData, leave_type_id: e.target.value })}
                    disabled={submitting || !!editingBalance}
                  >
                    <option value="">Select a policy...</option>
                    {leaveTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name} ({type.code}) - Quota: {type.annual_quota} days
                      </option>
                    ))}
                  </select>
                </div>

                {/* Year */}
                <div className="form-group">
                  <label className="form-label" htmlFor="bal-year">
                    Calendar Year <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    id="bal-year"
                    type="number"
                    className="form-input"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    disabled={submitting || !!editingBalance}
                  />
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label" htmlFor="bal-allocated">
                      Allocated (Days) <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      id="bal-allocated"
                      type="number"
                      step="0.5"
                      min="0"
                      className="form-input"
                      value={formData.allocated}
                      onChange={(e) => setFormData({ ...formData, allocated: e.target.value })}
                      disabled={submitting}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="bal-used">
                      Used (Days)
                    </label>
                    <input
                      id="bal-used"
                      type="number"
                      step="0.5"
                      min="0"
                      className="form-input"
                      value={formData.used}
                      onChange={(e) => setFormData({ ...formData, used: e.target.value })}
                      disabled={submitting}
                    />
                  </div>
                </div>

                {/* Live Preview */}
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    background: "var(--bg-card-subtle)",
                    fontSize: "12.5px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: "var(--text-muted)" }}>Calculated Available:</span>
                  <strong
                    style={{
                      color: Number(formData.allocated) - Number(formData.used) >= 0 ? "#16a34a" : "#dc2626",
                    }}
                  >
                    {(Number(formData.allocated) - Number(formData.used)).toFixed(1)} days
                  </strong>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCloseModal}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Saving..." : editingBalance ? "Update Balance" : "Allocate Balance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
