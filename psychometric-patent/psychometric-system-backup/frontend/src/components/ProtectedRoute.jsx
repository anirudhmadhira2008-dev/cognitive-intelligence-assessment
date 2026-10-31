import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isAuthenticated, getUser } from "../services/authService";

export default function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();
  const authed = isAuthenticated();
  const user = getUser();

  if (!authed || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const userRole = user.role || "student";
    if (!allowedRoles.includes(userRole)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
}
