import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getAuthToken } from "../../api/apiClient";

export default function ProtectedRoute({ allowedRoles = [] }) {
  const { token, loading, isInitializing, user } = useAuth();
  const storedToken = getAuthToken();

  // If AuthContext is initializing or storedToken exists but user is not resolved yet, do NOT redirect to /login
  if (isInitializing || loading || (storedToken && !user)) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        width: "100vw",
        background: "linear-gradient(135deg, #eef2ff 0%, #fdf2f8 50%, #f0fdf4 100%)",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "48px",
            height: "48px",
            border: "4px solid #e2e8f0",
            borderTopColor: "#2563eb",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "0 auto 16px",
          }} />
          <p style={{ color: "#64748b", fontSize: "14px", fontWeight: "500" }}>Loading session...</p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  const effectiveToken = token || storedToken;
  if (!effectiveToken || !user) {
    return <Navigate to="/login" replace />;
  }

  // The role returned by GET /api/auth/me (stored in user.role) is the authoritative authorization source
  const verifiedRole = user.role;

  if (allowedRoles.length > 0 && !allowedRoles.includes(verifiedRole)) {
    if (verifiedRole === "hr") {
      return <Navigate to="/hr/dashboard" replace />;
    } else if (verifiedRole === "employee") {
      return <Navigate to="/employee/dashboard" replace />;
    } else {
      return <Navigate to="/login" replace />;
    }
  }

  return <Outlet />;
}
