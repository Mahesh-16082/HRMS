import { useNavigate } from "react-router-dom";
import "../styles/Welcome.css";

function Welcome() {
  const navigate = useNavigate();

  const goToLogin = () => {
    navigate("/login");
  };

  return (
    <main className="welcome-page">
      {/* =====================================================
          BACKGROUND
      ===================================================== */}
      <div className="welcome-background">
        <div className="background-overlay"></div>
      </div>

      {/* =====================================================
          MAIN CONTENT
          Column flow: header -> hero. Nothing is absolutely
          positioned on top of the copy, so nothing overlaps.
      ===================================================== */}
      <div className="welcome-container">

        {/* ===================================================
            HEADER
        =================================================== */}
        <header className="welcome-header">
          <button
            className="brand"
            onClick={() => navigate("/")}
            type="button"
            aria-label="Go to home"
          >
            <span className="brand-logo">
              <svg
                viewBox="0 0 52 44"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* middle (back) figure */}
                <circle cx="26" cy="13" r="6.5" fill="#8C6BE8" />
                <path
                  d="M15.5 38c0-7.1 4.7-11.5 10.5-11.5S36.5 30.9 36.5 38v1.5h-21V38Z"
                  fill="#8C6BE8"
                />

                {/* left figure */}
                <circle cx="15" cy="10" r="7.5" fill="#4B3BE0" />
                <path
                  d="M2.5 37.5C2.5 29 7.9 24 15 24s12.5 5 12.5 13.5V40h-25v-2.5Z"
                  fill="#4B3BE0"
                />

                {/* right figure */}
                <circle cx="37" cy="10" r="7.5" fill="#F2882F" />
                <path
                  d="M24.5 37.5C24.5 29 29.9 24 37 24s12.5 5 12.5 13.5V40h-25v-2.5Z"
                  fill="#F2882F"
                />
              </svg>
            </span>

            <span className="brand-name">HRMS</span>
          </button>

          <button
            className="get-started-button"
            onClick={goToLogin}
            type="button"
          >
            <span>Get Started</span>
            <span className="button-arrow" aria-hidden="true">→</span>
          </button>
        </header>


        {/* ===================================================
            HERO CONTENT
        =================================================== */}
        <section className="hero-section">

          <div className="hero-content">

            <div className="hero-label">
              <span>PEOPLE</span>
              <span>•</span>
              <span>PROCESS</span>
              <span>•</span>
              <span>PROGRESS</span>
            </div>


            <h1 className="hero-title">
              <span className="title-line-one">Human Resources</span>

              <span className="title-line-two">Management System</span>
            </h1>


            <p className="hero-description">
              A smarter way to connect HR and employees.
              <br />
              Manage, engage and empower your workforce
              <br />
              to build a better tomorrow.
            </p>


            <button
              className="begin-button"
              onClick={goToLogin}
              type="button"
            >
              <span>Let's Begin</span>
              <span className="button-arrow" aria-hidden="true">→</span>
            </button>


            {/* =================================================
                FEATURES
            ================================================= */}
            <div className="feature-list">

              {/* Employee */}
              <div className="feature-item">
                <div className="feature-icon employee">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="9" cy="8" r="3" />
                    <circle cx="17" cy="9" r="2.5" />
                    <path d="M3.5 20c.5-3.8 2.5-6 5.5-6s5 2.2 5.5 6" />
                    <path d="M14.5 15.5c2.7-.2 5 1.6 5.5 4.5" />
                  </svg>
                </div>

                <span>Employee</span>
                <span>Management</span>
              </div>


              {/* Attendance */}
              <div className="feature-item">
                <div className="feature-icon attendance">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="4" y="5" width="16" height="15" rx="2" />
                    <path d="M8 3v4" />
                    <path d="M16 3v4" />
                    <path d="M4 10h16" />
                    <path d="M8 14h2" />
                    <path d="M14 14h2" />
                    <path d="M8 17h2" />
                  </svg>
                </div>

                <span>Attendance</span>
                <span>Tracking</span>
              </div>


              {/* Leave */}
              <div className="feature-item">
                <div className="feature-icon leave">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 3h9l4 4v14H6z" />
                    <path d="M14 3v5h5" />
                    <path d="M9 13h6" />
                    <path d="M9 17h4" />
                  </svg>
                </div>

                <span>Leave</span>
                <span>Management</span>
              </div>

            </div>


            {/* =================================================
                QUOTE
            ================================================= */}
            <div className="bottom-quote">
              <span>“Empowering people. Enabling growth.”</span>
              <span className="quote-line"></span>
            </div>

          </div>
        </section>


        {/* ===================================================
            RIGHT VISUAL PANEL
            Decorative part of the landing design - not a nav
            sidebar, and it carries no links.
        =================================================== */}
        <aside className="visual-panel" aria-hidden="true">

          <div className="panel-glow"></div>

          <div className="panel-line panel-line-top"></div>

          <div className="panel-message">
            <span>Work</span>
            <span>People</span>
            <span>Achieve</span>
            <span>Together</span>
          </div>

          <div className="panel-line panel-line-bottom"></div>

        </aside>


        {/* ===================================================
            BOTTOM WHITE CURVE
            Sits outside the panel so it can sweep across the
            photo, and is sized off the page (not the panel).
        =================================================== */}
        <div className="panel-bottom" aria-hidden="true">

          <div className="panel-bottom-text">
            <span>A Better</span>
            <span>Workplace</span>
            <span>A Brighter</span>
            <span>Tomorrow</span>
          </div>

          <div className="orange-underline"></div>

        </div>


        {/* ===================================================
            DECORATIVE CURVES
        =================================================== */}
        <div className="decorative-curve curve-left" aria-hidden="true"></div>

        <div className="decorative-curve curve-bottom" aria-hidden="true"></div>

      </div>
    </main>
  );
}

export default Welcome;