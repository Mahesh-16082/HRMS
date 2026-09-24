import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { projectApi } from "../../api/projectApi";
import { leaveApi } from "../../api/leaveApi";
import { announcementApi } from "../../api/announcementApi";
import { getTodayWorkReportStatus } from "../../api/workReportApi";
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

  // Announcements data state
  const [announcements, setAnnouncements] = useState([]);
  const [announcementCount, setAnnouncementCount] = useState(null);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [errorAnnouncements, setErrorAnnouncements] = useState("");

  // Fetch actual published announcements for the authenticated employee
  useEffect(() => {
    let isMounted = true;
    async function loadEmployeeAnnouncements() {
      try {
        setLoadingAnnouncements(true);
        setErrorAnnouncements("");
        const data = await announcementApi.getMyAnnouncements({ limit: 5 });
        if (isMounted) {
          const list = Array.isArray(data?.announcements) ? data.announcements : [];
          setAnnouncements(list);
          setAnnouncementCount(data?.total ?? list.length);
        }
      } catch (err) {
        console.warn("Could not load employee announcements:", err.message);
        if (isMounted) {
          setErrorAnnouncements(err.message || "Failed to load announcements.");
          setAnnouncements([]);
          setAnnouncementCount(0);
        }
      } finally {
        if (isMounted) setLoadingAnnouncements(false);
      }
    }
    loadEmployeeAnnouncements();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch today's work report submission status
  const [todayReport, setTodayReport] = useState(null);
  const [todayReportLoading, setTodayReportLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadTodayWorkReport() {
      try {
        setTodayReportLoading(true);
        const res = await getTodayWorkReportStatus();
        if (isMounted) {
          setTodayReport(res?.report || null);
        }
      } catch (err) {
        console.warn("Could not load today's report status:", err.message);
        if (isMounted) setTodayReport(null);
      } finally {
        if (isMounted) setTodayReportLoading(false);
      }
    }
    loadTodayWorkReport();
    return () => {
      isMounted = false;
    };
  }, []);

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
  useEffect(() => {
    let isMounted = true;
    async function loadLeaveBalances() {
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
        if (isMounted) {
          setLeaveBalances(activeBalances.length > 0 ? activeBalances : rawBalances.filter(b => b.leave_type?.is_active !== false && b.leave_type?.code !== "ANNUAL"));
        }
      } catch (err) {
        console.warn("Could not load employee leave balances:", err.message);
        if (isMounted) setLeaveBalances([]);
      } finally {
        if (isMounted) setLoadingBalances(false);
      }
    }
    loadLeaveBalances();
    return () => {
      isMounted = false;
    };
  }, []);

  // Calculate total available leave days across all active balances
  const totalAvailableBalance = leaveBalances.reduce(
    (sum, b) => sum + (Number(b.available) || 0),
    0
  );

  const employeeName = profile
    ? `${profile.first_name} ${profile.last_name}`
    : user?.full_name || "Team Member";

  const formatAnnouncementDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="page-container">
      {/* Hero Greeting with Dynamic Greeting & Dynamic Live Clock */}
      <HeroGreeting
        breadcrumb="Employee Dashboard"
        name={employeeName}
        subtitle="Welcome to your self-service dashboard. Check leave allowances, log attendance, and manage tasks."
      />

      {/* Top Stat Cards Row */}
      <div className="stats-grid employee-dashboard-stats-grid">
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
          number={loadingAnnouncements ? null : announcementCount}
          loading={loadingAnnouncements}
          label="Announcements"
          color="orange"
          onClick={() => navigate("/employee/announcements")}
        />
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

          {/* Daily Report Submission */}
          <div
            className="employee-action-card clickable"
            role="button"
            tabIndex={0}
            onClick={() => {
              if (!todayReport) {
                navigate("/employee/work-reports?action=new");
              } else if (todayReport.status === "DRAFT") {
                navigate("/employee/work-reports?action=draft");
              } else if (todayReport.status === "REJECTED") {
                navigate("/employee/work-reports?action=edit-rejected");
              } else {
                navigate("/employee/work-reports?action=today");
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (!todayReport) {
                  navigate("/employee/work-reports?action=new");
                } else if (todayReport.status === "DRAFT") {
                  navigate("/employee/work-reports?action=draft");
                } else if (todayReport.status === "REJECTED") {
                  navigate("/employee/work-reports?action=edit-rejected");
                } else {
                  navigate("/employee/work-reports?action=today");
                }
              }
            }}
          >
            <div
              className="employee-action-icon-wrap"
              style={{
                background: !todayReport
                  ? "#ffe4e6"
                  : todayReport.status === "APPROVED"
                  ? "#dcfce7"
                  : todayReport.status === "SUBMITTED"
                  ? "#fef3c7"
                  : todayReport.status === "REJECTED"
                  ? "#fee2e2"
                  : "#f1f5f9",
                color: !todayReport
                  ? "#e11d48"
                  : todayReport.status === "APPROVED"
                  ? "#16a34a"
                  : todayReport.status === "SUBMITTED"
                  ? "#d97706"
                  : todayReport.status === "REJECTED"
                  ? "#dc2626"
                  : "#475569",
              }}
            >
              <WorkReportsIcon size={22} />
            </div>
            <div className="employee-action-info">
              <span className="employee-action-title">Daily Report Submission</span>
              <span className="employee-action-sub">
                {todayReportLoading
                  ? "Checking status..."
                  : !todayReport
                  ? "Submit your daily work report"
                  : todayReport.status === "DRAFT"
                  ? "Draft saved • Click to complete"
                  : todayReport.status === "SUBMITTED"
                  ? "Submitted • Pending HR review"
                  : todayReport.status === "APPROVED"
                  ? "Report approved by HR"
                  : "Rejected • Revisions required"}
              </span>
            </div>
            <button className="governance-arrow-btn" aria-label="Daily Report Submission">
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Performance & Reviews */}
          <div
            className="employee-action-card"
            onClick={() => navigate("/employee/performance")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate("/employee/performance");
              }
            }}
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
            actionTo="/employee/announcements"
          />
          {loadingAnnouncements ? (
            <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              Loading announcements...
            </div>
          ) : errorAnnouncements ? (
            <div style={{ padding: "16px 0", textAlign: "center", color: "var(--danger, #ef4444)", fontSize: "13px" }}>
              {errorAnnouncements}
            </div>
          ) : announcements.length === 0 ? (
            <div style={{ padding: "20px 0", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <span style={{ fontWeight: "600", fontSize: "13.5px", color: "var(--text-heading)" }}>
                No announcements available
              </span>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Check back later for company updates and news.
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {announcements.slice(0, 2).map((announcement, idx) => {
                const isNew = (() => {
                  if (idx === 0) return true;
                  const dateStr = announcement.published_at || announcement.created_at;
                  if (!dateStr) return false;
                  const diffDays = (new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24);
                  return diffDays >= 0 && diffDays <= 7;
                })();

                return (
                  <div
                    key={announcement.id}
                    onClick={() => navigate("/employee/announcements")}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      cursor: "pointer",
                      paddingBottom: idx < Math.min(announcements.length, 2) - 1 ? "12px" : 0,
                      borderBottom: idx < Math.min(announcements.length, 2) - 1 ? "1px solid var(--border-subtle, rgba(255,255,255,0.06))" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#2563eb", flexShrink: 0 }} />
                        <span style={{ fontWeight: "700", fontSize: "14px", color: "var(--text-heading)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {announcement.title}
                        </span>
                        {isNew && (
                          <span className="badge" style={{ background: "#eff6ff", color: "#2563eb", fontSize: "10px", flexShrink: 0 }}>
                            New
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: "11px", color: "var(--text-subtle)", whiteSpace: "nowrap", flexShrink: 0 }}>
                        {formatAnnouncementDate(announcement.published_at || announcement.created_at)}
                      </span>
                    </div>
                    <p style={{
                      fontSize: "12.5px",
                      color: "var(--text-muted)",
                      margin: 0,
                      paddingLeft: "16px",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      lineHeight: "1.45"
                    }}>
                      {announcement.description}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
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
