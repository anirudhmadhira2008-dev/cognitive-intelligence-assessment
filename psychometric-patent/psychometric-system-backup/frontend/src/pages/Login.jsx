import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { loginUser } from "../services/authService";
import { Brain, Lock, Mail, ArrowRight, AlertCircle, ShieldCheck } from "lucide-react";

export default function Login({ setUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname || "/dashboard";

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const data = await loginUser(form);
    setLoading(false);

    if (data.error) {
      return setMessage(data.error);
    }

    if (setUser) setUser(data.user);

    // Route based on role
    if (data.user?.role === "admin" || data.user?.role === "evaluator") {
      navigate("/admin");
    } else {
      navigate(from === "/login" || from === "/" ? "/dashboard" : from);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo-badge">
            <Brain size={28} className="text-indigo-400" />
          </div>
          <h2>Sign In to Assessment Platform</h2>
          <p className="auth-subtitle">AI Multimodal Psychometric & Interview Confidence System</p>
        </div>

        {message && (
          <div className="alert-banner error">
            <AlertCircle size={16} />
            <span>{message}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={submit}>
          <div className="form-field">
            <label>Email Address</label>
            <div className="input-with-icon">
              <Mail size={18} className="field-icon" />
              <input 
                type="email" 
                placeholder="name@institute.edu" 
                value={form.email} 
                onChange={(e) => setForm({ ...form, email: e.target.value })} 
                required 
              />
            </div>
          </div>

          <div className="form-field">
            <label>Password</label>
            <div className="input-with-icon">
              <Lock size={18} className="field-icon" />
              <input 
                type="password" 
                placeholder="••••••••" 
                value={form.password} 
                onChange={(e) => setForm({ ...form, password: e.target.value })} 
                required 
              />
            </div>
          </div>

          <button type="submit" className="btn-auth-submit" disabled={loading}>
            <span>{loading ? "Verifying Credentials..." : "Sign In to Portal"}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <div className="auth-footer">
          <span>Don't have an account?</span>
          <Link to="/register" className="auth-link">
            Register as New Candidate
          </Link>
        </div>

        <div className="auth-demo-hint">
          <ShieldCheck size={14} className="text-indigo-400" />
          <small>Candidate or Evaluator / Admin credentials authenticated via secure JWT.</small>
        </div>
      </div>
    </div>
  );
}
