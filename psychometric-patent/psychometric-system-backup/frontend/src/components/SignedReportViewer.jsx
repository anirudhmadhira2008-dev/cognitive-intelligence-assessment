import React, { useState } from "react";
import { Link } from "react-router-dom";
import { 
  ShieldCheck, 
  Download, 
  ExternalLink, 
  CheckCircle2, 
  Award, 
  Brain, 
  Layers, 
  AlertTriangle,
  FileText,
  Lock,
  Hash,
  Key
} from "lucide-react";

export default function SignedReportViewer({ report, onVerifyClick }) {
  const [downloading, setDownloading] = useState(false);

  if (!report) return null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/reports/${report.reportId || report._id}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${report.reportId || "Report"}_SignedReport.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert("Download failed. Please try again.");
      }
    } catch (e) {
      console.error("Download error:", e);
      alert("Error initiating report download.");
    } finally {
      setDownloading(false);
    }
  };

  const scoreBreakdown = report.scoreBreakdown || {};
  const difficultyBreakdown = report.difficultyBreakdown || {};
  const competencyScores = report.competencyScores ? 
    (report.competencyScores instanceof Map ? Object.fromEntries(report.competencyScores) : report.competencyScores) : {};

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* HEADER WITH DIGITAL SIGNATURE VERIFIED BADGE */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/40 p-6 border-b border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold">
              {report.reportId}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 font-medium">
              <ShieldCheck size={12} />
              <span>Digitally Signed (RSA-PSS SHA-256)</span>
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-100">Official Psychometric Assessment Report</h2>
          <p className="text-xs text-slate-400">
            Candidate: <strong className="text-slate-200">{report.candidateReference}</strong> · Issued: {new Date(report.issuedAt || report.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm"
          >
            <Download size={14} />
            <span>{downloading ? "Preparing..." : "Download Signed JSON"}</span>
          </button>

          <Link
            to={`/verify?reportId=${encodeURIComponent(report.reportId)}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <ExternalLink size={14} />
            <span>Verify Signature</span>
          </Link>
        </div>
      </div>

      {/* BODY CONTENT */}
      <div className="p-6 space-y-6">
        {/* OVERALL SCORE & METHODOLOGY HERO */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 text-center flex flex-col justify-center">
            <span className="text-xs text-slate-400 uppercase font-semibold">Overall Score</span>
            <span className="text-3xl font-extrabold text-indigo-400 mt-1">{report.overallScore}%</span>
            <span className="text-[11px] text-slate-500 mt-0.5">Calculated from 100 max pts</span>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 text-center flex flex-col justify-center">
            <span className="text-xs text-slate-400 uppercase font-semibold">Cognitive Index</span>
            <span className="text-3xl font-extrabold text-emerald-400 mt-1">{scoreBreakdown.cognitiveIndex || 0}%</span>
            <span className="text-[11px] text-slate-500 mt-0.5">Knowledge + Reasoning</span>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 text-center flex flex-col justify-center">
            <span className="text-xs text-slate-400 uppercase font-semibold">Integrity Index</span>
            <span className="text-3xl font-extrabold text-teal-400 mt-1">{scoreBreakdown.integrityScore !== undefined ? scoreBreakdown.integrityScore : 100}%</span>
            <span className="text-[11px] text-slate-500 mt-0.5">Proctoring Telemetry</span>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 text-center flex flex-col justify-center">
            <span className="text-xs text-slate-400 uppercase font-semibold">Interview Readiness</span>
            <span className="text-3xl font-extrabold text-purple-400 mt-1">{scoreBreakdown.readinessIndex || 0}%</span>
            <span className="text-[11px] text-slate-500 mt-0.5">Comprehensive Indicator</span>
          </div>
        </div>

        {/* DIFFICULTY BREAKDOWN */}
        <div className="bg-slate-950/40 p-5 rounded-xl border border-slate-800">
          <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
            <Layers size={16} className="text-indigo-400" />
            <span>Difficulty Mastery Breakdown</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-emerald-400 font-semibold">Easy Questions</span>
                <span className="font-bold text-slate-200">
                  {difficultyBreakdown.easy?.percentage !== null ? `${difficultyBreakdown.easy?.percentage}%` : "Not Tested"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">{difficultyBreakdown.easy?.earned || 0} of {difficultyBreakdown.easy?.available || 0} pts earned</p>
            </div>

            <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-amber-400 font-semibold">Medium Questions</span>
                <span className="font-bold text-slate-200">
                  {difficultyBreakdown.medium?.percentage !== null ? `${difficultyBreakdown.medium?.percentage}%` : "Not Tested"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">{difficultyBreakdown.medium?.earned || 0} of {difficultyBreakdown.medium?.available || 0} pts earned</p>
            </div>

            <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-rose-400 font-semibold">Hard Questions</span>
                <span className="font-bold text-slate-200">
                  {difficultyBreakdown.hard?.percentage !== null ? `${difficultyBreakdown.hard?.percentage}%` : "Not Tested"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">{difficultyBreakdown.hard?.earned || 0} of {difficultyBreakdown.hard?.available || 0} pts earned</p>
            </div>
          </div>
        </div>

        {/* STRENGTHS & RECOMMENDATIONS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800 space-y-2">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              <span>Verified Strengths</span>
            </h4>
            <ul className="text-xs text-slate-300 space-y-1 list-disc pl-5">
              {(report.strengths || []).map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>

          <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800 space-y-2">
            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wide flex items-center gap-1.5">
              <Award size={14} />
              <span>Targeted Recommendations</span>
            </h4>
            <ul className="text-xs text-slate-300 space-y-1 list-disc pl-5">
              {(report.recommendations || []).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* CRYPTOGRAPHIC AUDIT METADATA BLOCK */}
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1.5">
          <div className="flex items-center gap-2 text-indigo-300 font-semibold pb-1 border-b border-slate-800">
            <Lock size={13} />
            <span>Cryptographic Digital Signature Metadata</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
            <div>
              <span className="text-slate-500">Algorithm: </span>
              <span className="text-slate-300">{report.algorithm || "RSA-PSS-SHA256"}</span>
            </div>
            <div>
              <span className="text-slate-500">Signing Key ID: </span>
              <span className="text-slate-300">{report.keyId}</span>
            </div>
            <div className="md:col-span-2 truncate">
              <span className="text-slate-500">Canonical SHA-256 Hash: </span>
              <span className="text-emerald-400 select-all">{report.canonicalHash}</span>
            </div>
            <div className="md:col-span-2 truncate">
              <span className="text-slate-500">Signature: </span>
              <span className="text-slate-400 select-all">{report.signature ? `${report.signature.slice(0, 48)}...` : ""}</span>
            </div>
          </div>
        </div>

        {/* SCIENTIFIC & LEGAL BOUNDARY DISCLAIMER */}
        <div className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-800 pt-3">
          <strong>Scientific & Legal Boundary Disclosure:</strong> This document represents rules-based educational and professional readiness evaluation within engineering domains. It is not a clinical, psychiatric, or medical diagnostic instrument. The digital signature certifies payload authenticity and immutability since signing.
        </div>
      </div>
    </div>
  );
}
