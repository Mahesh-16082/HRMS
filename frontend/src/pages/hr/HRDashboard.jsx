import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { employeeApi } from "../../api/employeeApi";
import { projectApi } from "../../api/projectApi";
import { attendanceApi } from "../../api/attendanceApi";
import HeroGreeting from "../../components/common/HeroGreeting";
import StatCard from "../../components/common/StatCard";
import SectionHeader from "../../components/common/SectionHeader";
import {
  UsersIcon,
  ClipboardCheckIcon,
  CalendarIcon,
  AnnouncementsIcon,
  WorkReportsIcon,
  MessageSquareIcon,
  NotificationsIcon,
  ShieldIcon,
  AuditLogsIcon,
  ArrowRight,
} from "../../components/icons/Icons";

export default function HRDashboard() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalEmployees: null,
    activeEmployees: null,
    activeProjects: null,
    attendanceCount: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      try {
        setLoading(true);

        const [employeeCounts, projectCountData, attendanceData] = await Promise.allSettled([
          employeeApi.getEmployeeCounts(),
          projectApi.getProjectCount({ status: "ACTIVE" }),
          attendanceApi.getAttendanceCount(),
        ]);

        if (!isMounted) return;

        setStats({
          totalEmployees:
            employeeCounts.status === "fulfilled"
              ? employeeCounts.value?.total_employees ?? 0
              : 0,
          activeEmployees:
            employeeCounts.status === "fulfilled"
              ? employeeCounts.value?.active_employees ?? 0
              : 0,
          activeProjects:
            projectCountData.status === "fulfilled"
              ? projectCountData.value?.count ?? 0
              : 0,
          attendanceCount:
            attendanceData.status === "fulfilled"
              ? attendanceData.value?.count ?? 0
              : 0,
        });
      } catch (err) {
        console.error("Failed to load HR dashboard data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  const hrName = profile
    ? `${profile.first_name} ${profile.last_name}`
    : user?.full_name || "HR Admin";

  return (
    <div className="page-container">
      {/* Hero Greeting with Dynamic Greeting & Dynamic Live Clock */}
      <HeroGreeting name={hrName} />

      {/* Top Stat Cards Row with Real Backend Numbers */}
      <div className="stats-grid hr-dashboard-stats-grid">
        <StatCard
          icon={UsersIcon}
          number={stats.totalEmployees}
          loading={loading}
          label="Total Employees"
          color="blue"
          onClick={() => navigate("/hr/employees")}
        />
        <StatCard
          icon={ClipboardCheckIcon}
          number={stats.activeProjects}
          loading={loading}
          label="Active Projects"
          color="green"
        />
        <StatCard
          icon={CalendarIcon}
          number={stats.attendanceCount !== null ? stats.attendanceCount : 0}
          loading={loading}
          label="Open Requests / Attendance"
          color="purple"
          onClick={() => navigate("/hr/attendance")}
        />
        <StatCard
          icon={AnnouncementsIcon}
          number={3}
          label="New Announcements"
          color="orange"
        />
      </div>

      {/* Quick Actions Section */}
      <div>
        <SectionHeader title="Quick Actions" />

        <div className="quick-actions-circles-row">
          {/* Daily Work Reports */}
          <Link to="/hr/work-reports" className="quick-action-circle-item">
            <div className="quick-action-round-btn" style={{ background: "#dbeafe", color: "#2563eb" }}>
              <WorkReportsIcon size={24} />
            </div>
            <span className="quick-action-label">Daily Work Reports</span>
          </Link>

          {/* Mark Attendance (Functional -> links to HR Attendance) */}
          <Link to="/hr/attendance" className="quick-action-circle-item">
            <div className="quick-action-round-btn" style={{ background: "#dcfce7", color: "#16a34a" }}>
              <CalendarIcon size={24} />
            </div>
            <span className="quick-action-label">Mark Attendance</span>
          </Link>

          {/* View Audit Logs */}
          <Link to="/hr/audit-logs" className="quick-action-circle-item">
            <div className="quick-action-round-btn" style={{ background: "#ffedd5", color: "#ea580c" }}>
              <AuditLogsIcon size={24} />
            </div>
            <span className="quick-action-label">View Audit Logs</span>
          </Link>

          {/* Check Notifications */}
          <div
            className="quick-action-circle-item"
            onClick={() => alert("Notification Service is scheduled for a future update.")}
          >
            <div className="quick-action-round-btn" style={{ background: "#dbeafe", color: "#2563eb" }}>
              <NotificationsIcon size={24} />
            </div>
            <span className="quick-action-label">Check Notifications</span>
          </div>
        </div>
      </div>

      {/* Governance & Accountability Section */}
      <div>
        <SectionHeader title="Governance &amp; Accountability" />

        <div className="governance-grid">
          {/* Workplace Complaints */}
          <div
            className="governance-card clickable"
            onClick={() => navigate("/hr/complaints")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate("/hr/complaints");
              }
            }}
          >
            <div className="governance-icon-wrap" style={{ background: "#dbeafe", color: "#2563eb" }}>
              <MessageSquareIcon size={24} />
            </div>
            <div className="governance-content">
              <span className="governance-title">Workplace Complaints</span>
              <span className="governance-desc">
                Review employee concerns, manage grievances, and track resolutions.
              </span>
            </div>
            <button
              type="button"
              className="governance-arrow-btn"
              aria-label="View Workplace Complaints"
              onClick={(e) => {
                e.stopPropagation();
                navigate("/hr/complaints");
              }}
            >
              <ArrowRight size={15} />
            </button>
          </div>

          {/* System Audit Logs */}
          <div
            className="governance-card clickable"
            onClick={() => navigate("/hr/audit-logs")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate("/hr/audit-logs");
              }
            }}
          >
            <div className="governance-icon-wrap" style={{ background: "#f3e8ff", color: "#9333ea" }}>
              <AuditLogsIcon size={24} />
            </div>
            <div className="governance-content">
              <span className="governance-title">System Audit Logs</span>
              <span className="governance-desc">
                Review authentication activity, system events, and administrative actions.
              </span>
            </div>
            <button
              type="button"
              className="governance-arrow-btn"
              aria-label="View System Audit Logs"
              onClick={(e) => {
                e.stopPropagation();
                navigate("/hr/audit-logs");
              }}
            >
              <ArrowRight size={15} />
            </button>
          </div>

          {/* Security & Privileges */}
          <div className="governance-card">
            <div className="governance-icon-wrap" style={{ background: "#dbeafe", color: "#2563eb" }}>
              <ShieldIcon size={24} />
            </div>
            <div className="governance-content">
              <span className="governance-title">Security &amp; Privileges</span>
              <span className="governance-desc">
                Review administrator access and account authorization status.
              </span>
            </div>
            <button
              className="governance-arrow-btn"
              aria-label="View Security Privileges"
              onClick={() => alert("Admin Authorization controls are active.")}
            >
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
