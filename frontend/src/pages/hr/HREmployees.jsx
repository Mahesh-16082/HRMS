import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { employeeApi } from "../../api/employeeApi";
import SectionHeader from "../../components/common/SectionHeader";
import {
  LoadingState,
  EmptyState,
  ErrorAlert,
} from "../../components/common/FeedbackStates";
import {
  SearchIcon,
  UsersIcon,
  EditIcon,
  TrashIcon,
  CheckCircleIcon,
  CloseIcon,
  LockIcon,
  ChevronLeft,
  ChevronRight,
  PlusIcon,
  AlertCircleIcon,
} from "../../components/icons/Icons";

function normalizeToISODate(val) {
  if (!val || typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed) return null;

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // MM/DD/YYYY or M/D/YYYY
  const mdyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mdyMatch) {
    const month = mdyMatch[1].padStart(2, "0");
    const day = mdyMatch[2].padStart(2, "0");
    const year = mdyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // YYYY/MM/DD
  const ymdMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, "0");
    const day = ymdMatch[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Fallback try standard Date parsing
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return trimmed;
}

export default function HREmployees() {
  const { user } = useAuth(); // Current logged-in HR user

  // State
  const [employees, setEmployees] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 10;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Modals
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Add form state
  const initialAddForm = {
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    joining_date: "",
    address: "",
  };
  const [addForm, setAddForm] = useState(initialAddForm);
  const [savingAdd, setSavingAdd] = useState(false);
  const [addError, setAddError] = useState("");
  const addModalBodyRef = useRef(null);

  // Edit form state
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    date_of_birth: "",
    address: "",
    joining_date: "",
    department_id: "",
    designation_id: "",
    employment_status: "ACTIVE",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Status form state
  const [newStatus, setNewStatus] = useState("ACTIVE");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Fetch employees
  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = {
        page,
        limit,
      };
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.employment_status = statusFilter;

      const data = await employeeApi.listEmployees(params);
      setEmployees(data.employees || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message || "Failed to fetch employees.");
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, statusFilter]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Lock background page scroll while any modal is open
  const anyModalOpen =
    addModalOpen ||
    viewModalOpen ||
    editModalOpen ||
    statusModalOpen ||
    archiveModalOpen;

  useEffect(() => {
    if (anyModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow || "";
      };
    }
  }, [anyModalOpen]);

  // Open Add Employee Modal
  const handleOpenAdd = () => {
    setAddForm(initialAddForm);
    setAddError("");
    setAddModalOpen(true);
  };

  // Close Add Employee Modal
  const handleCloseAdd = () => {
    if (savingAdd) return;
    setAddModalOpen(false);
    setAddError("");
  };

  // Submit Add Form
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setSavingAdd(true);
    setAddError("");

    try {
      const fName = addForm.first_name.trim();
      const lName = addForm.last_name.trim();
      const email = addForm.email.trim();

      if (!fName) {
        throw new Error("First name is required.");
      }
      if (!lName) {
        throw new Error("Last name is required.");
      }
      if (!email) {
        throw new Error("Email address is required.");
      }

      const payload = {
        email: email,
        first_name: fName,
        last_name: lName,
        phone: addForm.phone.trim() || null,
        date_of_birth: normalizeToISODate(addForm.date_of_birth),
        joining_date: normalizeToISODate(addForm.joining_date),
        address: addForm.address.trim() || null,
      };

      await employeeApi.createEmployee(payload);
      setSuccessMessage(`Employee ${fName} ${lName} created successfully.`);
      setAddModalOpen(false);
      setAddForm(initialAddForm);
      setPage(1);
      fetchEmployees();
    } catch (err) {
      let errMsg = "Failed to create employee.";
      if (
        err.status === 409 ||
        (typeof err?.data?.detail === "string" && err.data.detail.toLowerCase().includes("already exists")) ||
        (err.message && err.message.toLowerCase().includes("already exists"))
      ) {
        errMsg = "An employee with this email already exists.";
      } else if (typeof err?.data?.detail === "string") {
        errMsg = err.data.detail;
      } else if (Array.isArray(err?.data?.detail)) {
        errMsg = err.data.detail
          .map((d) => `${d.loc?.slice(1).join(".") || "field"}: ${d.msg}`)
          .join(", ");
      } else if (err.message) {
        errMsg = err.message;
      }

      setAddError(errMsg);

      // Scroll modal body to top smoothly so the error banner is immediately visible
      if (addModalBodyRef.current) {
        addModalBodyRef.current.scrollTo({ top: 0, behavior: "smooth" });
      }
    } finally {
      setSavingAdd(false);
    }
  };

  // Open View Modal
  const handleView = (emp) => {
    setSelectedEmployee(emp);
    setViewModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (emp) => {
    setSelectedEmployee(emp);
    setEditForm({
      first_name: emp.first_name || "",
      last_name: emp.last_name || "",
      phone: emp.phone || "",
      date_of_birth: emp.date_of_birth || "",
      address: emp.address || "",
      joining_date: emp.joining_date || "",
      department_id: emp.department_id !== null ? String(emp.department_id) : "",
      designation_id: emp.designation_id !== null ? String(emp.designation_id) : "",
      employment_status: emp.employment_status || "ACTIVE",
    });
    setEditModalOpen(true);
  };

  // Submit Edit Form
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) return;

    setSavingEdit(true);
    setError("");

    try {
      const payload = {
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        phone: editForm.phone.trim() || null,
        date_of_birth: editForm.date_of_birth || null,
        address: editForm.address.trim() || null,
        joining_date: editForm.joining_date || null,
        department_id: editForm.department_id ? Number(editForm.department_id) : null,
        designation_id: editForm.designation_id ? Number(editForm.designation_id) : null,
        employment_status: editForm.employment_status,
      };

      await employeeApi.updateEmployee(selectedEmployee.id, payload);
      setSuccessMessage(`Employee ${editForm.first_name} updated successfully.`);
      setEditModalOpen(false);
      fetchEmployees();
    } catch (err) {
      setError(err.message || "Failed to update employee.");
    } finally {
      setSavingEdit(false);
    }
  };

  // Open Status Change Modal
  const handleOpenStatus = (emp) => {
    setSelectedEmployee(emp);
    setNewStatus(emp.employment_status || "ACTIVE");
    setStatusModalOpen(true);
  };

  // Submit Status Change
  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) return;

    setUpdatingStatus(true);
    setError("");

    try {
      await employeeApi.updateEmployeeStatus(selectedEmployee.id, newStatus);
      setSuccessMessage(`Employment status changed to ${newStatus}.`);
      setStatusModalOpen(false);
      fetchEmployees();
    } catch (err) {
      setError(err.message || "Failed to change status.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Quick Activate / Deactivate toggle
  const handleToggleActive = async (emp) => {
    const isCurrentlyActive = emp.employment_status === "ACTIVE";
    const action = isCurrentlyActive ? "deactivate" : "activate";

    try {
      setError("");
      if (isCurrentlyActive) {
        await employeeApi.deactivateEmployee(emp.id);
        setSuccessMessage(`Employee ${emp.first_name} deactivated.`);
      } else {
        await employeeApi.activateEmployee(emp.id);
        setSuccessMessage(`Employee ${emp.first_name} activated.`);
      }
      fetchEmployees();
    } catch (err) {
      setError(err.message || `Failed to ${action} employee.`);
    }
  };

  // Open Archive Modal
  const handleOpenArchive = (emp) => {
    setSelectedEmployee(emp);
    setArchiveModalOpen(true);
  };

  // Confirm Archive
  const handleArchiveConfirm = async () => {
    if (!selectedEmployee) return;

    try {
      setError("");
      await employeeApi.archiveEmployee(selectedEmployee.id);
      setSuccessMessage(`Employee record archived.`);
      setArchiveModalOpen(false);
      fetchEmployees();
    } catch (err) {
      setError(err.message || "Failed to archive employee.");
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="page-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "8px" }}>
        <SectionHeader title="Employee Management" />
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenAdd}
            aria-label="+ Add Employee"
            title="+ Add Employee"
            id="add-employee-btn"
          >
            <PlusIcon size={16} />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="alert alert-success" style={{ marginBottom: "16px" }}>
          <CheckCircleIcon size={18} />
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage("")}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit" }}
          >
            <CloseIcon size={16} />
          </button>
        </div>
      )}

      {error && <ErrorAlert message={error} onRetry={fetchEmployees} />}

      <div className="table-card">
        {/* Table Filter & Search Controls */}
        <div className="table-header-bar">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, maxWidth: "340px" }}>
            <div className="search-bar" style={{ padding: "6px 14px" }}>
              <SearchIcon size={15} />
              <input
                type="text"
                placeholder="Search name, code, email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          <div className="table-actions-group">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="form-select"
              style={{ width: "auto", padding: "6px 14px", fontSize: "13px" }}
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ON_NOTICE">On Notice</option>
              <option value="TERMINATED">Terminated</option>
            </select>
          </div>
        </div>

        {/* Employee Table */}
        {loading ? (
          <LoadingState message="Loading employees..." />
        ) : employees.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title="No employees found"
            description="No employees match your search and filter criteria."
          />
        ) : (
          <div className="table-responsive-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Code</th>
                  <th>Contact</th>
                  <th>Joining Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const isSelf = user && emp.user_id === user.id;
                  const fullName = `${emp.first_name} ${emp.last_name}`;
                  const initial = (fullName.charAt(0) || "E").toUpperCase();

                  return (
                    <tr key={emp.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          {emp.profile_photo_url ? (
                            <img
                              src={emp.profile_photo_url}
                              alt={fullName}
                              className="user-avatar-circle"
                              style={{ width: "34px", height: "34px" }}
                            />
                          ) : (
                            <div
                              className="user-avatar-circle"
                              style={{ width: "34px", height: "34px", fontSize: "13px" }}
                            >
                              {initial}
                            </div>
                          )}
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontWeight: "700", color: "var(--text-heading)" }}>
                                {fullName}
                              </span>
                              {isSelf && (
                                <span className="badge badge-self" title="This is your own account">
                                  You (Protected)
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                              {emp.user?.email || "—"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span style={{ fontWeight: "600", fontFamily: "monospace", fontSize: "13px" }}>
                          {emp.employee_code}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: "13px", color: "var(--text-main)" }}>
                          {emp.phone || "—"}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                          {emp.joining_date || "—"}
                        </span>
                      </td>

                      <td>
                        <span className={`badge badge-${(emp.employment_status || "ACTIVE").toLowerCase()}`}>
                          {emp.employment_status}
                        </span>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          {/* View Details */}
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleView(emp)}
                            title="View Employee Details"
                          >
                            View
                          </button>

                          {/* Edit Details */}
                          <button
                            className="action-icon-btn"
                            onClick={() => handleOpenEdit(emp)}
                            title="Edit Employee"
                          >
                            <EditIcon size={15} />
                          </button>

                          {/* Self Protection Guards */}
                          {isSelf ? (
                            <span
                              title="HR Self-Protection: You cannot modify your own status or delete your account"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "11px",
                                color: "var(--text-subtle)",
                                padding: "4px 8px",
                              }}
                            >
                              <LockIcon size={13} />
                            </span>
                          ) : (
                            <>
                              {/* Status Change Modal Button */}
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleOpenStatus(emp)}
                                title="Change Employment Status"
                                style={{ fontSize: "11px", padding: "4px 8px" }}
                              >
                                Status
                              </button>

                              {/* Activate / Deactivate Quick Toggle */}
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleToggleActive(emp)}
                                title={emp.employment_status === "ACTIVE" ? "Deactivate" : "Activate"}
                                style={{
                                  fontSize: "11px",
                                  padding: "4px 8px",
                                  color: emp.employment_status === "ACTIVE" ? "#b91c1c" : "#15803d",
                                }}
                              >
                                {emp.employment_status === "ACTIVE" ? "Deactivate" : "Activate"}
                              </button>

                              {/* Archive Button */}
                              <button
                                className="action-icon-btn danger"
                                onClick={() => handleOpenArchive(emp)}
                                title="Archive Employee"
                              >
                                <TrashIcon size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="pagination-bar">
          <span>
            Showing {employees.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
            {Math.min(page * limit, total)} of {total} employees
          </span>
          <div className="pagination-controls">
            <button
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
              className="pagination-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next Page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          VIEW EMPLOYEE MODAL
      ======================================================== */}
      {viewModalOpen && selectedEmployee && (
        <div className="modal-overlay" onClick={() => setViewModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Employee Details</h3>
              <button className="modal-close-btn" onClick={() => setViewModalOpen(false)}>
                <CloseIcon size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: "flex", alignItems: "center", gap: "16px", paddingBottom: "16px", borderBottom: "1px solid var(--border-color)" }}>
                {selectedEmployee.profile_photo_url ? (
                  <img
                    src={selectedEmployee.profile_photo_url}
                    alt={selectedEmployee.first_name}
                    className="photo-avatar-preview"
                    style={{ width: "64px", height: "64px" }}
                  />
                ) : (
                  <div className="photo-avatar-preview" style={{ width: "64px", height: "64px", fontSize: "24px" }}>
                    {(selectedEmployee.first_name?.[0] || "E").toUpperCase()}
                  </div>
                )}
                <div>
                  <h4 style={{ margin: 0, fontSize: "18px", color: "var(--text-heading)" }}>
                    {selectedEmployee.first_name} {selectedEmployee.last_name}
                  </h4>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    {selectedEmployee.employee_code}
                  </span>
                  <div style={{ marginTop: "6px" }}>
                    <span className={`badge badge-${(selectedEmployee.employment_status || "ACTIVE").toLowerCase()}`}>
                      {selectedEmployee.employment_status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="form-grid">
                <div>
                  <span className="form-label">Email Address</span>
                  <span style={{ fontSize: "14px", color: "var(--text-main)" }}>
                    {selectedEmployee.user?.email || "—"}
                  </span>
                </div>
                <div>
                  <span className="form-label">Phone Number</span>
                  <span style={{ fontSize: "14px", color: "var(--text-main)" }}>
                    {selectedEmployee.phone || "—"}
                  </span>
                </div>
                <div>
                  <span className="form-label">Date of Birth</span>
                  <span style={{ fontSize: "14px", color: "var(--text-main)" }}>
                    {selectedEmployee.date_of_birth || "—"}
                  </span>
                </div>
                <div>
                  <span className="form-label">Joining Date</span>
                  <span style={{ fontSize: "14px", color: "var(--text-main)" }}>
                    {selectedEmployee.joining_date || "—"}
                  </span>
                </div>
                <div>
                  <span className="form-label">Department ID</span>
                  <span style={{ fontSize: "14px", color: "var(--text-main)" }}>
                    {selectedEmployee.department_id ?? "—"}
                  </span>
                </div>
                <div>
                  <span className="form-label">Designation ID</span>
                  <span style={{ fontSize: "14px", color: "var(--text-main)" }}>
                    {selectedEmployee.designation_id ?? "—"}
                  </span>
                </div>
                <div className="form-group full-width">
                  <span className="form-label">Residential Address</span>
                  <span style={{ fontSize: "14px", color: "var(--text-main)" }}>
                    {selectedEmployee.address || "—"}
                  </span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setViewModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          EDIT EMPLOYEE MODAL (HR FULL UPDATE)
      ======================================================== */}
      {editModalOpen && selectedEmployee && (
        <div className="modal-overlay" onClick={() => setEditModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-header">
                <h3 className="modal-title">Edit Employee: {selectedEmployee.first_name}</h3>
                <button type="button" className="modal-close-btn" onClick={() => setEditModalOpen(false)}>
                  <CloseIcon size={18} />
                </button>
              </div>

              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">First Name *</label>
                    <input
                      type="text"
                      value={editForm.first_name}
                      onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                      required
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Last Name *</label>
                    <input
                      type="text"
                      value={editForm.last_name}
                      onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                      required
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Date of Birth</label>
                    <input
                      type="date"
                      value={editForm.date_of_birth}
                      onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Joining Date</label>
                    <input
                      type="date"
                      value={editForm.joining_date}
                      onChange={(e) => setEditForm({ ...editForm, joining_date: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Employment Status</label>
                    <select
                      value={editForm.employment_status}
                      onChange={(e) => setEditForm({ ...editForm, employment_status: e.target.value })}
                      className="form-select"
                      disabled={user && selectedEmployee.user_id === user.id}
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                      <option value="ON_NOTICE">ON_NOTICE</option>
                      <option value="TERMINATED">TERMINATED</option>
                    </select>
                  </div>

                  <div className="form-group full-width">
                    <label className="form-label">Address</label>
                    <input
                      type="text"
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingEdit}
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          CHANGE STATUS MODAL
      ======================================================== */}
      {statusModalOpen && selectedEmployee && (
        <div className="modal-overlay" onClick={() => setStatusModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleStatusSubmit}>
              <div className="modal-header">
                <h3 className="modal-title">Update Employment Status</h3>
                <button type="button" className="modal-close-btn" onClick={() => setStatusModalOpen(false)}>
                  <CloseIcon size={18} />
                </button>
              </div>

              <div className="modal-body">
                <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
                  Change status for{" "}
                  <strong>
                    {selectedEmployee.first_name} {selectedEmployee.last_name}
                  </strong>{" "}
                  ({selectedEmployee.employee_code}):
                </p>

                <div className="form-group">
                  <label className="form-label">New Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="form-select"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="ON_NOTICE">ON_NOTICE</option>
                    <option value="TERMINATED">TERMINATED</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setStatusModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={updatingStatus}>
                  {updatingStatus ? "Updating..." : "Update Status"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          ARCHIVE CONFIRMATION MODAL
      ======================================================== */}
      {archiveModalOpen && selectedEmployee && (
        <div className="modal-overlay" onClick={() => setArchiveModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: "#ef4444" }}>
                Archive Employee
              </h3>
              <button className="modal-close-btn" onClick={() => setArchiveModalOpen(false)}>
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: "14px", color: "var(--text-heading)", lineHeight: "1.5" }}>
                Are you sure you want to archive{" "}
                <strong>
                  {selectedEmployee.first_name} {selectedEmployee.last_name}
                </strong>{" "}
                ({selectedEmployee.employee_code})?
              </p>
              <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                This will soft-delete the employee profile and deactivate their account access.
              </p>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setArchiveModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleArchiveConfirm}>
                Confirm Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          ADD EMPLOYEE MODAL (HR CREATE EMPLOYEE)
      ======================================================== */}
      {addModalOpen && (
        <div className="modal-overlay" onClick={handleCloseAdd}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "600px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <form
              onSubmit={handleAddSubmit}
              style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                maxHeight: "inherit",
                minHeight: 0,
                overflow: "hidden",
                flex: "1 1 auto",
              }}
            >
              <div
                className="modal-header"
                style={{
                  flexShrink: 0,
                  position: "sticky",
                  top: 0,
                  zIndex: 10,
                  background: "var(--bg-card)",
                }}
              >
                <h3 className="modal-title">Add New Employee</h3>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={handleCloseAdd}
                  disabled={savingAdd}
                >
                  <CloseIcon size={18} />
                </button>
              </div>

              <div
                className="modal-body"
                ref={addModalBodyRef}
                style={{
                  flex: "1 1 auto",
                  overflowY: "auto",
                  minHeight: 0,
                  overscrollBehavior: "contain",
                }}
              >
                {addError && (
                  <div
                    className="alert alert-danger"
                    style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}
                  >
                    <AlertCircleIcon size={18} style={{ flexShrink: 0 }} />
                    <span>{addError}</span>
                  </div>
                )}

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">First Name *</label>
                    <input
                      type="text"
                      placeholder="First Name"
                      value={addForm.first_name}
                      onChange={(e) => setAddForm({ ...addForm, first_name: e.target.value })}
                      required
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Last Name *</label>
                    <input
                      type="text"
                      placeholder="Last Name"
                      value={addForm.last_name}
                      onChange={(e) => setAddForm({ ...addForm, last_name: e.target.value })}
                      required
                      className="form-input"
                    />
                  </div>

                  <div className="form-group full-width">
                    <label className="form-label">Email Address *</label>
                    <input
                      type="email"
                      placeholder="employee@example.com"
                      value={addForm.email}
                      onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                      required
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="e.g. +91 8790242942"
                      value={addForm.phone}
                      onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Date of Birth</label>
                    <input
                      type="date"
                      value={addForm.date_of_birth}
                      onChange={(e) => setAddForm({ ...addForm, date_of_birth: e.target.value })}
                      onClick={(e) => {
                        try {
                          e.target.showPicker?.();
                        } catch (_) {}
                      }}
                      className="form-input"
                      style={{ cursor: "pointer" }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Joining Date</label>
                    <input
                      type="date"
                      value={addForm.joining_date}
                      onChange={(e) => setAddForm({ ...addForm, joining_date: e.target.value })}
                      onClick={(e) => {
                        try {
                          e.target.showPicker?.();
                        } catch (_) {}
                      }}
                      className="form-input"
                      style={{ cursor: "pointer" }}
                    />
                  </div>

                  <div className="form-group full-width">
                    <label className="form-label">Residential Address</label>
                    <input
                      type="text"
                      placeholder="Street, City, Postal Code"
                      value={addForm.address}
                      onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>
              </div>

              <div
                className="modal-footer"
                style={{
                  flexShrink: 0,
                  position: "sticky",
                  bottom: 0,
                  zIndex: 10,
                  background: "var(--bg-card-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                {addError ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      color: "#ef4444",
                      fontSize: "13px",
                      fontWeight: 500,
                      maxWidth: "60%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={addError}
                  >
                    <AlertCircleIcon size={16} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{addError}</span>
                  </div>
                ) : (
                  <div />
                )}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCloseAdd}
                    disabled={savingAdd}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={savingAdd}
                    title="Create Employee"
                    aria-label="Create Employee"
                  >
                    {savingAdd ? "Creating..." : "Create Employee"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
