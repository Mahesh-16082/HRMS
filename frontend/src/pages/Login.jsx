import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Login.css";

const API_URL = "http://localhost:8000";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendOTP = async (event) => {
    event.preventDefault();

    setError("");

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError("Please enter your registered email.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: trimmedEmail,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to send OTP.");
      }

      // Save email for OTP verification page
      sessionStorage.setItem("hrms_login_email", trimmedEmail);

      // Move to OTP verification page
      navigate("/verify-otp");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      {/* ================= BACKGROUND PHOTO ================= */}

      <div className="login-background">
        <div className="login-background-overlay"></div>
      </div>

      {/* ================= TOP-RIGHT TAGLINE ================= */}

      <p className="login-tagline">People Make Progress</p>

      {/* ================= MAIN LAYOUT ================= */}

      <div className="login-layout">
        {/* ---------- LEFT NAVY PANEL ---------- */}

        <section className="login-info-panel">
          {/* Brand */}
          <div className="login-brand">
            <div className="login-brand-logo">
              <svg
                viewBox="0 0 48 42"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <circle cx="15" cy="10" r="7" fill="#5746E8" />
                <circle cx="32" cy="10" r="7" fill="#F28A32" />
                <circle cx="24" cy="15" r="7" fill="#746BE8" />
                <path
                  d="M4 35C4 26.7 8.9 22 15 22s11 4.7 11 13v2H4v-2Z"
                  fill="#5746E8"
                />
                <path
                  d="M22 35c0-7.2 4-12 10-12s10 4.8 10 12v2H22v-2Z"
                  fill="#F28A32"
                />
              </svg>
            </div>

            <span>HRMS</span>
          </div>

          <div className="login-info-line"></div>

          {/* Main message */}
          <div className="login-info-content">
            <h1>
              Same People.
              <br />
              A Stronger
              <br />
              <span>Tomorrow.</span>
            </h1>

            <p>
              An intelligent HRMS platform that simplifies HR operations and
              keeps your organization connected.
            </p>
          </div>

          {/* Features */}
          <ul className="login-features">
            <li className="login-feature">
              <div className="login-feature-icon profile-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="8" r="3" />
                  <path d="M5 20c.7-4 3-6 7-6s6.3 2 7 6" strokeLinecap="round" />
                </svg>
              </div>
              <span>Manage Your Profile</span>
            </li>

            <li className="login-feature">
              <div className="login-feature-icon attendance-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  aria-hidden="true"
                >
                  <rect x="4" y="5" width="16" height="15" rx="2" />
                  <path d="M8 3v4" />
                  <path d="M16 3v4" />
                  <path d="M4 10h16" />
                  <path d="M8 14h2M14 14h2M8 17h2" strokeLinecap="round" />
                </svg>
              </div>
              <span>Track Attendance</span>
            </li>

            <li className="login-feature">
              <div className="login-feature-icon leave-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  aria-hidden="true"
                >
                  <path d="M6 3h9l4 4v14H6z" />
                  <path d="M14 3v5h5" />
                  <path
                    d="M9 14l2 2 4-4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span>Apply for Leaves</span>
            </li>
          </ul>

          {/* Footer */}
          <div className="login-info-footer">
            <span>People</span>
            <span aria-hidden="true">•</span>
            <span>Growth</span>
            <span aria-hidden="true">•</span>
            <span>Success</span>
          </div>
        </section>

        {/* ---------- LOGIN CARD ---------- */}

        <section className="login-card-wrapper">
          <div className="login-card">
            <div className="login-card-icon">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect
                  x="3"
                  y="5"
                  width="18"
                  height="14"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M4 7L12 13L20 7"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <h2>Welcome Back</h2>

            <p className="login-card-subtitle">Login to your HRMS account</p>

            <form className="login-form" onSubmit={handleSendOTP}>
              <div className="input-wrapper">
                <svg className="input-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect
                    x="3"
                    y="5"
                    width="18"
                    height="14"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                  <path
                    d="M4 7L12 13L20 7"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>

                <input
                  type="email"
                  name="email"
                  inputMode="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError("");
                  }}
                  placeholder="Enter your registered email"
                  aria-label="Registered email"
                  aria-describedby="email-helper"
                  aria-invalid={error ? "true" : "false"}
                  autoComplete="email"
                  disabled={loading}
                />
              </div>

              <p className="email-helper" id="email-helper">
                We'll send a secure verification code to your email.
              </p>

              {error && (
                <div className="login-error" role="alert">
                  {error}
                </div>
              )}

              <button type="submit" className="verify-button" disabled={loading}>
                {loading ? (
                  <>
                    <span className="button-spinner"></span>
                    Sending...
                  </>
                ) : (
                  <>
                    <span>Get OTP</span>
                    <span className="verify-arrow" aria-hidden="true">
                      →
                    </span>
                  </>
                )}
              </button>
            </form>

            <div className="login-security">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 2.5L20 5.8V11.4C20 16.4 16.7 20.3 12 21.9C7.3 20.3 4 16.4 4 11.4V5.8L12 2.5Z"
                  fill="currentColor"
                />
                <path
                  d="M8.6 12.1L11 14.5L15.6 9.7"
                  stroke="#ffffff"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              <span>Your information is secure with us.</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default Login;