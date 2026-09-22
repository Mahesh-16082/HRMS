import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { projectApi } from "../../api/projectApi";
import { leaveApi } from "../../api/leaveApi";
import HeroGreeting from "../../components/common/HeroGreeting";
import StatCard from "../../components/common/StatCard";
import SectionHeader from "../../components/common/SectionHeader";
import {
  UsersIcon,
  CalendarIcon,
  AnnouncementsIcon,
  ClockIcon,
  WorkReportsIcon,
  PerformanceIcon,
  ArrowRight,
  CheckCircleIcon,
} from "../../components/icons/Icons";

export default function EmployeeDashboard() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  const [projectCount, setProjectCount] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Leave Service data state
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [loadingBalances, setLoadingBalances] = useState(true);
  const [selectedBalanceIndex, setSelectedBalanceIndex] = useState(0);

  // Fetch actual project assignments for the authenticated employee
  useEffect(() => {
    let isMounted = true;
    async function loadEmployeeProjects() {
      try {
        setLoadingProjects(true);
        const data = await projectApi.getMyProjectAssignments();
        if (isMounted) {
          setProjectCount(data?.total ?? (data?.assignments?.length || 0));
        }
      } catch (err) {
        console.warn("Could not load employee projects:", err.message);
        if (isMounted) setProjectCount(0);
      } finally {
        if (isMounted) setLoadingProjects(false);
      }
    }
    loadEmployeeProjects();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch actual leave balances for the authenticated employee
  const loadLeaveBalances = useCallback(async () => {
    try {
      setLoadingBalances(true);
      const data = await leaveApi.getMyBalances();
      const rawBalances = data?.balances || [];
      const currentYear = new Date().getFullYear();
      const activeBalances = rawBalances.filter(
        (b) =>
          b.leave_type &&
          b.leave_type.is_active !== false &&
          b.leave_type.code !== "ANNUAL" &&
          (!b.year || b.year === currentYear)
      );
      setLeaveBalances(activeBalances.length > 0 ? activeBalances : rawBalances.filter(b => b.leave_type?.is_active !== false && b.leave_type?.code !== "ANNUAL"));
    } catch (err) {
      console.warn("Could not load employee leave balances:", err.message);
      setLeaveBalances([]);
    } finally {
      setLoadingBalances(false);
    }
  }, []);

  useEffect(() => {
    loadLeaveBalances();
  }, [loadLeaveBalances]);

  // Calculate total available leave days across all active balances
  const totalAvailableBalance = leaveBalances.reduce(
    (sum, b) => sum + (Number(b.available) || 0),
    0
  );

  const employeeName = profile
    ? `${profile.first_name} ${profile.last_name}`
    : user?.full_name || "Team Member";

  return (
    <div className="page-container">
      {/* Hero Greeting with Dynamic Greeting & Dynamic Live Clock */}
      <HeroGreeting
        breadcrumb="Employee Dashboard"
        name={employeeName}
        subtitle="Welcome to your self-service dashboard. Check leave allowances, log attendance, and manage tasks."
      />

      {/* Top Stat Cards Row */}
      <div className="stats-grid">
        <StatCard
          icon={UsersIcon}
          number={projectCount}
          loading={loadingProjects}
          label="My Projects"
          color="blue"
          onClick={() => navigate("/employee/projects")}
        />
        <StatCard
          icon={CalendarIcon}
          number={loadingBalances ? null : (totalAvailableBalance !== null && totalAvailableBalance !== undefined ? totalAvailableBalance : 0)}
          loading={loadingBalances}
          label="Leave Balance"
          color="purple"
        />
        <StatCard
          icon={AnnouncementsIcon}
          number={3}
          label="Announcements"
          color="orange"
        />
      </div>

      {/* Mid Row: Leave Quota & My Schedule */}
      <div className="employee-top-cards-row">
        {/* Leave Entitlements & Quotas */}
        <div className="leave-quota-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div className="section-header-title-group">
              <div className="section-accent-bar" />
              <div>
                <h2 className="section-title">Leave Entitlements &amp; Quotas</h2>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  Your real-time assigned leave allowances for the current calendar year
                </span>
              </div>
            </div>
            <span
              className="badge"
              style={{ background: "#dbeafe", color: "#1d4ed8", padding: "4px 10px", fontSize: "11px" }}
            >
              Year {new Date().getFullYear()}
            </span>
          </div>

          {loadingBalances ? (
            <div style={{ padding: "28px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              Loading leave entitlements...
            </div>
          ) : leaveBalances.length === 0 ? (
            <div style={{ padding: "24px 0", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <span style={{ fontWeight: "600", fontSize: "14px", color: "var(--text-heading)" }}>
                No Leave Entitlements Assigned
              </span>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                No active leave quotas are configured for this year. Please contact HR.
              </span>
            </div>
          ) : (
            <>
              {/* If multiple leave types exist, render type selector tabs */}
              {leaveBalances.length > 1 && (
                <div style={{ display: "flex", gap: "6px", margin: "10px 0 4px", flexWrap: "wrap" }}>
                  {leaveBalances.map((b, idx) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedBalanceIndex(idx)}
                      style={{
                        padding: "3px 10px",
                        fontSize: "11px",
                        borderRadius: "12px",
                        border: "1px solid",
                        borderColor: selectedBalanceIndex === idx ? "var(--primary)" : "var(--border-color)",
                        background: selectedBalanceIndex === idx ? "var(--primary)" : "transparent",
                        color: selectedBalanceIndex === idx ? "#fff" : "var(--text-muted)",
                        cursor: "pointer",
                        fontWeight: selectedBalanceIndex === idx ? "600" : "400",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {b.leave_type?.name || `Type #${b.leave_type_id}`}
                    </button>
                  ))}
                </div>
              )}

              {(() => {
                const currentBalance = leaveBalances[selectedBalanceIndex] || leaveBalances[0];
                return (
                  <>
                    <div className="leave-quota-card-inner">
                      <div className="leave-quota-icon">
                        <CalendarIcon size={28} />
                      </div>
                      <div className="leave-quota-numbers">
                        <span className="leave-quota-title">
                          {currentBalance.leave_type?.name || "Leave Quota"}
                        </span>
                        <span className="leave-quota-val">
                          {Number(currentBalance.available).toFixed(1)}
                        </span>
                        <span className="leave-quota-sub">Days Remaining Available</span>
                      </div>
                    </div>

                    <div className="leave-quota-footer">
                      <span>Total Allocated: {Number(currentBalance.allocated).toFixed(2)}</span>
                      <span>Used: {Number(currentBalance.used).toFixed(2)}</span>
                    </div>
                  </>
                );
              })()}
            </>
          )}
        </div>

        {/* My Schedule */}
        <div className="schedule-card">
          <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="section-header-title-group">
              <div className="section-accent-bar" />
              <h2 className="section-title">My Schedule</h2>
            </div>
            <span className="section-link-btn" style={{ fontSize: "12px" }}>
              View Calendar <ArrowRight size={13} />
            </span>
          </div>

          <div style={{ padding: "20px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
            <div className="schedule-empty-icon">
              <CalendarIcon size={32} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontWeight: "700", fontSize: "13px", color: "var(--text-heading)" }}>Today</span>
            </div>
            <span className="schedule-empty-title">No events for today</span>
            <span className="schedule-empty-sub">Enjoy your productive day!</span>
          </div>
        </div>
      </div>

      {/* Quick Actions & Services */}
      <div>
        <div style={{ marginBottom: "14px" }}>
          <div className="section-header-title-group">
            <div className="section-accent-bar" />
            <h2 className="section-title">Quick Actions &amp; Services</h2>
          </div>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "14px" }}>
            Direct access to attendance check-ins, leave requests, and reports
          </span>
        </div>

        <div className="employee-actions-grid">
          {/* Apply for Leave */}
          <Link
            to="/employee/apply-leave"
            className="employee-action-card"
          >
            <div className="employee-action-icon-wrap" style={{ background: "#dcfce7", color: "#16a34a" }}>
              <CalendarIcon size={22} />
            </div>
            <div className="employee-action-info">
              <span className="employee-action-title">Apply for Leave</span>
              <span className="employee-action-sub">Submit a leave request for approval</span>
            </div>
            <button className="governance-arrow-btn" aria-label="Apply for Leave">
              <ArrowRight size={14} />
            </button>
          </Link>

          {/* Daily Attendance (Fully Functional!) */}
          <Link to="/employee/attendance" className="employee-action-card">
            <div className="employee-action-icon-wrap" style={{ background: "#dbeafe", color: "#2563eb" }}>
              <ClockIcon size={22} />
            </div>
            <div className="employee-action-info">
              <span className="employee-action-title">Daily Attendance</span>
              <span className="employee-action-sub">Check-in or view attendance logs</span>
            </div>
            <button className="governance-arrow-btn" aria-label="Daily Attendance">
              <ArrowRight size={14} />
            </button>
          </Link>

          {/* Daily Report Submission (Placeholder) */}
          <div
            className="employee-action-card"
            onClick={() => alert("Work Report Service is scheduled for a future update.")}
          >
            <div className="employee-action-icon-wrap" style={{ background: "#ffe4e6", color: "#e11d48" }}>
              <WorkReportsIcon size={22} />
            </div>
            <div className="employee-action-info">
              <span className="employee-action-title">Daily Report Submission</span>
              <span className="employee-action-sub">Submit your daily work report</span>
            </div>
            <button className="governance-arrow-btn" aria-label="Daily Report Submission">
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Performance & Reviews (Placeholder) */}
          <div
            className="employee-action-card"
            onClick={() => alert("Performance Service is scheduled for a future update.")}
          >
            <div className="employee-action-icon-wrap" style={{ background: "#f3e8ff", color: "#9333ea" }}>
              <PerformanceIcon size={22} />
            </div>
            <div className="employee-action-info">
              <span className="employee-action-title">Performance &amp; Reviews</span>
              <span className="employee-action-sub">View your performance details</span>
            </div>
            <button className="governance-arrow-btn" aria-label="Performance Reviews">
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Announcements & Recent Activity */}
      <div className="employee-bottom-grid">
        {/* Announcements */}
        <div className="bottom-card">
          <SectionHeader
            title="Announcements"
            actionText="View All"
            onActionClick={() => alert("Announcements Service is scheduled for a future update.")}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#2563eb" }} />
                <span style={{ fontWeight: "700", fontSize: "14px", color: "var(--text-heading)" }}>
                  Annual Day Celebration
                </span>
                <span className="badge" style={{ background: "#eff6ff", color: "#2563eb", fontSize: "10px" }}>
                  New
                </span>
              </div>
              <span style={{ fontSize: "11px", color: "var(--text-subtle)" }}>
                {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
            <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: 0, paddingLeft: "16px" }}>
              We are pleased to announce our upcoming company events and quarterly townhall gatherings.
            </p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bottom-card">
          <SectionHeader
            title="Recent Activity"
            actionText="View All"
            actionTo="/employee/attendance"
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div className="activity-item">
              <div className="activity-icon-wrap" style={{ background: "#dcfce7", color: "#16a34a" }}>
                <CheckCircleIcon size={16} />
              </div>
              <div className="activity-details">
                <span className="activity-text">Logged in to HRMS</span>
                <span className="activity-time">Active authenticated session</span>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-icon-wrap" style={{ background: "#f3e8ff", color: "#9333ea" }}>
                <ClockIcon size={16} />
              </div>
              <div className="activity-details">
                <span className="activity-text">Attendance &amp; Tasks Ready</span>
                <span className="activity-time">Access attendance and project assignments</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
