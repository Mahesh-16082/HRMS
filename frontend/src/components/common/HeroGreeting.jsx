import { useState, useEffect } from "react";
import { ClockIcon } from "../icons/Icons";

export default function HeroGreeting({
  name,
  breadcrumb,
  subtitle,
}) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hours = currentTime.getHours();
    if (hours < 12) return "Good Morning";
    if (hours < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const formattedTime = currentTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const formattedDate = currentTime.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="greeting-section">
      <div className="greeting-text-area">
        {breadcrumb && <span className="greeting-breadcrumb">{breadcrumb}</span>}
        <h1 className="greeting-heading">
          {getGreeting()}, <strong>{name || "User"}</strong>
        </h1>
        {subtitle && <p className="greeting-subtext">{subtitle}</p>}
      </div>

      <div className="clock-widget">
        <div className="clock-icon-wrapper">
          <ClockIcon size={28} />
        </div>
        <div className="clock-details">
          <span className="clock-time">{formattedTime}</span>
          <span className="clock-date">{formattedDate}</span>
        </div>
      </div>
    </div>
  );
}
