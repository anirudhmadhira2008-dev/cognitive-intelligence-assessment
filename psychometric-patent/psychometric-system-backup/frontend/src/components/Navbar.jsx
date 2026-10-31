import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { logoutUser, getUser } from "../services/authService";
import { Shield, Brain, User as UserIcon, LogOut, LayoutDashboard, Settings, Award } from "lucide-react";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();

  if (!user) return null;

  const handleLogout = () => {
    logoutUser();
    navigate("/login");
  };

  const isAdmin = user.role === "admin" || user.role === "evaluator";
  const path = location.pathname;

  return (
    <header className="app-navbar">
      <div className="navbar-container">
        <Link to="/dashboard" className="navbar-brand">
          <div className="brand-logo-badge">
            <Brain className="w-5 h-5 text-indigo-600" size={22} />
          </div>
          <div className="brand-titles">
            <span className="brand-main">Psychometric AI</span>
            <span className="brand-sub">Patent Edition</span>
          </div>
        </Link>

        <nav className="navbar-links">
          <Link 
            to="/dashboard" 
            className={`nav-item ${path === "/dashboard" ? "active" : ""}`}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </Link>

          <Link 
            to="/assessment" 
            className={`nav-item ${path.startsWith("/assessment") ? "active" : ""}`}
          >
            <Award size={18} />
            <span>Assessment</span>
          </Link>

          {isAdmin && (
            <Link 
              to="/admin" 
              className={`nav-item ${path.startsWith("/admin") ? "active" : ""}`}
            >
              <Shield size={18} />
              <span>Admin Portal</span>
            </Link>
          )}

          <Link 
            to="/verify-report" 
            className={`nav-item ${path.startsWith("/verify") ? "active" : ""}`}
          >
            <Shield size={18} />
            <span>Verify Report</span>
          </Link>

          <Link 
            to="/profile" 
            className={`nav-item ${path === "/profile" ? "active" : ""}`}
          >
            <UserIcon size={18} />
            <span>Profile</span>
          </Link>
        </nav>

        <div className="navbar-user-section">
          <div className="user-pill">
            <div className="user-avatar">
              {(user.name || "U").charAt(0).toUpperCase()}
            </div>
            <div className="user-meta">
              <span className="user-name">{user.name || "Candidate"}</span>
              <span className={`user-role-badge role-${user.role || "student"}`}>
                {user.role ? user.role.toUpperCase() : "STUDENT"}
              </span>
            </div>
          </div>

          <button 
            onClick={handleLogout} 
            className="navbar-logout-btn" 
            title="Sign out"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
