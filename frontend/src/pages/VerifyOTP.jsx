import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/VerifyOTP.css";

const API_URL = "http://localhost:8000";

function VerifyOTP() {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [countdown, setCountdown] = useState(60);

  const inputRefs = useRef([]);


  /* =====================================================
     GET EMAIL
  ===================================================== */

  useEffect(() => {
    const savedEmail =
      sessionStorage.getItem("hrms_login_email");

    if (!savedEmail) {
      navigate("/login", {
        replace: true,
      });

      return;
    }

    setEmail(savedEmail);

    inputRefs.current[0]?.focus();
  }, [navigate]);


  /* =====================================================
     COUNTDOWN
  ===================================================== */

  useEffect(() => {
    if (countdown <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setCountdown((previous) =>
        previous - 1
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);


  /* =====================================================
     OTP INPUT
  ===================================================== */

  const handleOtpChange = (
    index,
    value
  ) => {
    if (!/^\d?$/.test(value)) {
      return;
    }

    const newOtp = [...otp];

    newOtp[index] = value;

    setOtp(newOtp);

    setError("");

    if (
      value &&
      index < 5
    ) {
      inputRefs.current[
        index + 1
      ]?.focus();
    }
  };


  /* =====================================================
     BACKSPACE
  ===================================================== */

  const handleKeyDown = (
    index,
    event
  ) => {

    if (
      event.key === "Backspace" &&
      !otp[index] &&
      index > 0
    ) {
      inputRefs.current[
        index - 1
      ]?.focus();
    }
  };


  /* =====================================================
     PASTE OTP
  ===================================================== */

  const handlePaste = (event) => {
    event.preventDefault();

    const pastedData =
      event.clipboardData
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, 6);

    if (!pastedData) {
      return;
    }

    const newOtp = [
      "",
      "",
      "",
      "",
      "",
      "",
    ];

    pastedData
      .split("")
      .forEach((digit, index) => {
        newOtp[index] = digit;
      });

    setOtp(newOtp);

    const nextIndex =
      Math.min(
        pastedData.length,
        5
      );

    inputRefs.current[
      nextIndex
    ]?.focus();
  };


  /* =====================================================
     VERIFY OTP
  ===================================================== */

  const handleVerifyOTP = async (
    event
  ) => {
    event.preventDefault();

    setError("");

    const enteredOTP =
      otp.join("");

    if (
      enteredOTP.length !== 6
    ) {
      setError(
        "Please enter the complete 6-digit OTP."
      );

      return;
    }

    if (!email) {
      setError(
        "Email session expired. Please login again."
      );

      return;
    }

    setLoading(true);

    try {

      const response =
        await fetch(
          `${API_URL}/api/auth/verify-otp`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              email,
              otp: enteredOTP,
            }),
          }
        );


      const data =
        await response.json();


      if (!response.ok) {
        throw new Error(
          data.detail ||
          "Invalid OTP."
        );
      }


      /* ================================================
         SAVE AUTH TOKEN
      ================================================ */

      localStorage.setItem(
        "hrms_access_token",
        data.access_token
      );


      localStorage.setItem(
        "hrms_token_type",
        data.token_type || "bearer"
      );


      /* ================================================
         CLEAR LOGIN EMAIL
      ================================================ */

      sessionStorage.removeItem(
        "hrms_login_email"
      );


      /* ================================================
         INITIALIZE AUTH CONTEXT & VERIFY VIA /api/auth/me
      ================================================ */

      let role = null;

      try {
        if (loginWithToken) {
          const authResult = await loginWithToken(
            data.access_token,
            data.token_type || "bearer"
          );
          if (authResult?.role) {
            role = authResult.role;
          }
        }
      } catch (authErr) {
        console.warn("Auth initialization error:", authErr);
      }

      // Fallback: decode role from JWT payload if not retrieved from authResult
      if (!role) {
        try {
          const tokenParts = data.access_token.split(".");
          const payload = JSON.parse(
            atob(
              tokenParts[1]
                .replace(/-/g, "+")
                .replace(/_/g, "/")
            )
          );
          role = payload.role;
        } catch {
          role = null;
        }
      }

      /* ================================================
         REDIRECT TO CORRESPONDING DASHBOARD
      ================================================ */

      if (role === "hr") {
        navigate(
          "/hr-dashboard",
          {
            replace: true,
          }
        );
      } else if (role === "employee") {
        navigate(
          "/employee-dashboard",
          {
            replace: true,
          }
        );
      } else {
        navigate(
          "/dashboard",
          {
            replace: true,
          }
        );
      }


    } catch (err) {

      setError(
        err.message ||
        "Unable to verify OTP."
      );

      setOtp([
        "",
        "",
        "",
        "",
        "",
        "",
      ]);

      inputRefs.current[0]?.focus();

    } finally {
      setLoading(false);
    }
  };


  /* =====================================================
     RESEND OTP
  ===================================================== */

  const handleResendOTP =
    async () => {

      if (
        countdown > 0 ||
        loading
      ) {
        return;
      }

      setError("");

      try {

        const response =
          await fetch(
            `${API_URL}/api/auth/send-otp`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                email,
              }),
            }
          );


        const data =
          await response.json();


        if (!response.ok) {
          throw new Error(
            data.detail ||
            "Unable to resend OTP."
          );
        }


        setOtp([
          "",
          "",
          "",
          "",
          "",
          "",
        ]);


        setCountdown(60);


        inputRefs.current[0]?.focus();


      } catch (err) {

        setError(
          err.message ||
          "Unable to resend OTP."
        );

      }
    };


  /* =====================================================
     FORMAT EMAIL
  ===================================================== */

  const maskedEmail =
    email
      ? email
      : "your email";


  return (
    <main className="verify-page">

      {/* =================================================
          BACKGROUND
      ================================================= */}

      <div className="verify-background">
        <span className="blob blob-violet"></span>
        <span className="blob blob-blue"></span>
        <span className="blob blob-peach"></span>
        <span className="blob blob-pink"></span>
      </div>


      {/* =================================================
          HEADER
      ================================================= */}

      <header className="verify-header">

        <button
          className="back-login-button"
          onClick={() => navigate("/login")}
        >
          <span className="back-arrow">←</span>
          <span>Back to Login</span>
        </button>

      </header>


      {/* =================================================
          OTP CARD
      ================================================= */}

      <div className="verify-wrapper">

        <section className="verify-card">

          {/* Card Icon */}

          <div className="verify-card-icon">
            <svg viewBox="0 0 24 24" fill="none">
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
          </div>


          {/* Heading */}

          <h2>Verify OTP</h2>

          <p className="verify-card-description">
            We've sent a 6-digit verification code to
            <br />
            <strong>{maskedEmail}</strong>
          </p>


          {/* OTP FORM */}

          <form className="otp-form" onSubmit={handleVerifyOTP}>

            <div className="otp-inputs" onPaste={handlePaste}>
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => {
                    inputRefs.current[index] = element;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(event) =>
                    handleOtpChange(index, event.target.value)
                  }
                  onKeyDown={(event) => handleKeyDown(index, event)}
                  className={digit ? "otp-input filled" : "otp-input"}
                  aria-label={`OTP digit ${index + 1}`}
                  disabled={loading}
                />
              ))}
            </div>

            <p className="otp-helper">
              Enter the 6-digit code sent to your email
            </p>

            {error && <div className="verify-error">{error}</div>}

            <button
              type="submit"
              className="otp-verify-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="otp-spinner"></span>
                  Verifying...
                </>
              ) : (
                <>
                  <span>Verify OTP</span>
                  <span className="otp-arrow">→</span>
                </>
              )}
            </button>

          </form>


          {/* RESEND */}

          <div className="resend-section">
            <span>Didn't receive the code?</span>

            {countdown > 0 ? (
              <span className="resend-disabled">
                Resend OTP
                <span>
                  {" "}
                  ({`00:${String(countdown).padStart(2, "0")}`})
                </span>
              </span>
            ) : (
              <button
                className="resend-button"
                onClick={handleResendOTP}
                disabled={loading}
              >
                Resend OTP
              </button>
            )}
          </div>


          {/* SECURITY BOX */}

          <div className="verify-security">
            <div className="security-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3L19 6V11C19 16 16.1 19.5 12 21C7.9 19.5 5 16 5 11V6L12 3Z"
                  fill="currentColor"
                />
                <path
                  d="M9 12L11 14L15 10"
                  stroke="#ffffff"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div>
              <strong>Your information is secure with us.</strong>
              <span>We never share your details with anyone.</span>
            </div>
          </div>

        </section>

      </div>

    </main>
  );
}

export default VerifyOTP;