import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Welcome from "./pages/Welcome";
import Login from "./pages/Login";
import VerifyOTP from "./pages/VerifyOTP";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";

import ProtectedRoute from "./components/common/ProtectedRoute";
import DashboardLayout from "./layouts/DashboardLayout";

// Employee Pages
import EmployeeDashboard from "./pages/employee/EmployeeDashboard";
import EmployeeProfile from "./pages/employee/EmployeeProfile";
import EmployeeAttendance from "./pages/employee/EmployeeAttendance";
import EmployeeProjects from "./pages/employee/EmployeeProjects";

// HR Pages
import HRDashboard from "./pages/hr/HRDashboard";
import HREmployees from "./pages/hr/HREmployees";
import HRProjects from "./pages/hr/HRProjects";
import HRAttendance from "./pages/hr/HRAttendance";
import HRProfile from "./pages/hr/HRProfile";

import { getAuthToken } from "./api/apiClient";

function RoleRedirect() {
  const { role, token, loading, user } = useAuth();
  const storedToken = getAuthToken();

  if (loading || (storedToken && !user)) return null;
  if (!token && !storedToken) return <Navigate to="/login" replace />;
  const effectiveRole = role || user?.role;
  if (effectiveRole === "hr") return <Navigate to="/hr-dashboard" replace />;
  return <Navigate to="/employee-dashboard" replace />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Authentication Pages (Untouched) */}
            <Route path="/" element={<Welcome />} />
            <Route path="/login" element={<Login />} />
            <Route path="/verify-otp" element={<VerifyOTP />} />

            {/* General Dashboard Redirection */}
            <Route path="/dashboard" element={<RoleRedirect />} />

            {/* Employee Protected Pages */}
            <Route element={<ProtectedRoute allowedRoles={["employee"]} />}>
              <Route element={<DashboardLayout />}>
                <Route path="/employee-dashboard" element={<EmployeeDashboard />} />
                <Route path="/employee/profile" element={<EmployeeProfile />} />
                <Route path="/employee/attendance" element={<EmployeeAttendance />} />
                <Route path="/employee/projects" element={<EmployeeProjects />} />
              </Route>
            </Route>

            {/* HR Protected Pages */}
            <Route element={<ProtectedRoute allowedRoles={["hr"]} />}>
              <Route element={<DashboardLayout />}>
                <Route path="/hr-dashboard" element={<HRDashboard />} />
                <Route path="/hr/employees" element={<HREmployees />} />
                <Route path="/hr/projects" element={<HRProjects />} />
                <Route path="/hr/attendance" element={<HRAttendance />} />
                <Route path="/hr/profile" element={<HRProfile />} />
              </Route>
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;