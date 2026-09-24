import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Welcome from "./pages/Welcome";
import Login from "./pages/Login";
import VerifyOTP from "./pages/VerifyOTP";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { NotificationProvider } from "./context/NotificationContext";

import ProtectedRoute from "./components/common/ProtectedRoute";
import PublicAuthRoute from "./components/common/PublicAuthRoute";
import DashboardLayout from "./layouts/DashboardLayout";

// Employee Pages
import EmployeeDashboard from "./pages/employee/EmployeeDashboard";
import EmployeeProfile from "./pages/employee/EmployeeProfile";
import EmployeeAttendance from "./pages/employee/EmployeeAttendance";
import EmployeeProjects from "./pages/employee/EmployeeProjects";
import EmployeeApplyLeave from "./pages/employee/EmployeeApplyLeave";
import EmployeeComplaints from "./pages/employee/EmployeeComplaints";
import EmployeeAnnouncements from "./pages/employee/EmployeeAnnouncements";
import EmployeeWorkReports from "./pages/employee/EmployeeWorkReports";
import EmployeePerformance from "./pages/employee/EmployeePerformance";
import EmployeeNotifications from "./pages/employee/EmployeeNotifications";

// HR Pages
import HRDashboard from "./pages/hr/HRDashboard";
import HREmployees from "./pages/hr/HREmployees";
import HRPerformance from "./pages/hr/HRPerformance";
import HRProjects from "./pages/hr/HRProjects";
import HRAttendance from "./pages/hr/HRAttendance";
import HRProfile from "./pages/hr/HRProfile";
import LeaveRequests from "./pages/hr/LeaveRequests";
import LeaveTypes from "./pages/hr/LeaveTypes";
import LeaveBalances from "./pages/hr/LeaveBalances";
import ProjectRoles from "./pages/hr/ProjectRoles";
import HRComplaints from "./pages/hr/HRComplaints";
import HRAnnouncements from "./pages/hr/HRAnnouncements";
import HRAuditLogs from "./pages/hr/HRAuditLogs";
import HRWorkReports from "./pages/hr/HRWorkReports";
import HRNotifications from "./pages/hr/HRNotifications";
import WorkplacePolicies from "./pages/common/WorkplacePolicies";

import { getAuthToken } from "./api/apiClient";

function RoleRedirect() {
  const { token, loading, isInitializing, user } = useAuth();
  const storedToken = getAuthToken();

  if (isInitializing || (storedToken && loading)) return null;
  if (!token && !storedToken) return <Navigate to="/login" replace />;
  if (!user) return <Navigate to="/login" replace />;
  const verifiedRole = user?.role;
  if (verifiedRole === "hr") return <Navigate to="/hr/dashboard" replace />;
  return <Navigate to="/employee/dashboard" replace />;
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <Routes>
              {/* Public Authentication Pages (Guarded by PublicAuthRoute) */}
              <Route path="/" element={<PublicAuthRoute><Welcome /></PublicAuthRoute>} />
              <Route path="/login" element={<PublicAuthRoute><Login /></PublicAuthRoute>} />
              <Route path="/verify-otp" element={<PublicAuthRoute><VerifyOTP /></PublicAuthRoute>} />

              {/* General Dashboard Redirection */}
              <Route path="/dashboard" element={<RoleRedirect />} />

              {/* Employee Protected Pages */}
              <Route element={<ProtectedRoute allowedRoles={["employee"]} />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
                  <Route path="/employee/profile" element={<EmployeeProfile />} />
                  <Route path="/employee/attendance" element={<EmployeeAttendance />} />
                  <Route path="/employee/projects" element={<EmployeeProjects />} />
                  <Route path="/employee/apply-leave" element={<EmployeeApplyLeave />} />
                  <Route path="/employee/complaints" element={<EmployeeComplaints />} />
                  <Route path="/employee/announcements" element={<EmployeeAnnouncements />} />
                  <Route path="/employee/work-reports" element={<EmployeeWorkReports />} />
                  <Route path="/employee/performance" element={<EmployeePerformance />} />
                  <Route path="/employee/notifications" element={<EmployeeNotifications />} />
                  <Route path="/employee/policies" element={<WorkplacePolicies role="employee" />} />
                </Route>
              </Route>

              {/* HR Protected Pages */}
              <Route element={<ProtectedRoute allowedRoles={["hr"]} />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/hr/dashboard" element={<HRDashboard />} />
                  <Route path="/hr/employees" element={<HREmployees />} />
                  <Route path="/hr/performance" element={<HRPerformance />} />
                  <Route path="/hr/projects" element={<HRProjects />} />
                  <Route path="/hr/attendance" element={<HRAttendance />} />
                  <Route path="/hr/profile" element={<HRProfile />} />
                  <Route path="/hr/leave-requests" element={<LeaveRequests />} />
                  <Route path="/hr/leave-types" element={<LeaveTypes />} />
                  <Route path="/hr/leave-balances" element={<LeaveBalances />} />
                  <Route path="/hr/project-roles" element={<ProjectRoles />} />
                  <Route path="/hr/complaints" element={<HRComplaints />} />
                  <Route path="/hr/announcements" element={<HRAnnouncements />} />
                  <Route path="/hr/audit-logs" element={<HRAuditLogs />} />
                  <Route path="/hr/work-reports" element={<HRWorkReports />} />
                  <Route path="/hr/notifications" element={<HRNotifications />} />
                  <Route path="/hr/policies" element={<WorkplacePolicies role="hr" />} />
                </Route>
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;