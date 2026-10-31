import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api from "../api/apiClient";
import { 
  ShieldCheck, 
  ShieldAlert, 
  ShieldX, 
  CheckCircle2, 
  AlertCircle, 
  FileCheck, 
  UploadCloud, 
  Search, 
  Key, 
  Hash, 
  Layers, 
  ArrowLeft,
  Lock,
  RefreshCw,
  FileCode,
  X,
  Shield,
  HelpCircle
} from "lucide-react";

export default function ReportVerification() {
  const [searchParams] = useSearchParams();
  const initialReportId = searchParams.get("reportId") || "";

  const [activeTab, setActiveTab] = useState(initialReportId ? "id" : "json");
  const [reportIdInput, setReportIdInput] = useState(initialReportId);
  const [jsonInput, setJsonInput] = useState("");
  const [showJsonTextarea, setShowJsonTextarea] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);

  const [loading, setLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [formError, setFormError] = useState("");

  const fileInputRef = useRef(null);

  // Method 1: Verify by Report ID
  const handleVerifyById = async (idToVerify) => {
    const id = (idToVerify || reportIdInput).trim();
    if (!id) {
      setFormError("Please enter a valid Report ID (e.g., REP-2026-XXXXXXXX).");
      return;
    }

    setLoading(true);
    setFormError("");
    setVerificationResult(null);

    try {
      const res = await api.reports.verify({ reportId: id });
      setVerificationResult(res);
    } catch (err) {
      setFormError(err.message || "Failed to complete signature verification.");
    } finally {
      setLoading(false);
    }
  };

  // Method 2: Verify Signed JSON Artifact
  const handleVerifyJson = async () => {
    if (!jsonInput.trim()) {
      setFormError("Please select a signed report JSON file or paste the payload.");
      return;
    }

    setLoading(true);
    setFormError("");
    setVerificationResult(null);

    try {
      let parsed = null;
      try {
        parsed = JSON.parse(jsonInput);
      } catch (e) {
        throw new Error("Invalid JSON format. Please ensure the file contains valid JSON.");
      }

      const res = await api.reports.verify(parsed);
      setVerificationResult(res);
    } catch (err) {
      setFormError(err.message || "Failed to verify JSON signature.");
    } finally {
      setLoading(false);
    }
  };

  // Handle Drag & Drop / File Select
  const handleFileDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) processSelectedFile(file);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) processSelectedFile(file);
  };

  const processSelectedFile = (file) => {
    setFormError("");
    if (!file.name.endsWith(".json")) {
      setFormError("Only valid .json signed report artifacts are supported.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setFormError("File exceeds maximum allowed size (2 MB).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result;
        setJsonInput(content);
        setUploadedFile({
          name: file.name,
          sizeKb: (file.size / 1024).toFixed(1)
        });
      } catch (err) {
        setFormError("Failed to read the selected file.");
      }
    };
    reader.readAsText(file);
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setJsonInput("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Auto-run if query param present
  useEffect(() => {
    if (initialReportId) {
      handleVerifyById(initialReportId);
    }
  }, [initialReportId]);

  return (
    <div className="verify-portal-wrapper">
      {/* BREADCRUMB */}
      <nav aria-label="Breadcrumb" className="verify-breadcrumb">
        <Link to="/dashboard">Dashboard</Link>
        <span>/</span>
        <span style={{ color: "#f8fafc", fontWeight: "600" }}>Verify Report</span>
      </nav>

      {/* HEADER SECTION */}
      <div className="verify-header-block">
        <div className="verify-badge-pill">
          <Lock size={12} />
          <span>Cryptographic Integrity</span>
        </div>
        <h1 className="verify-main-title">Verify Assessment Report</h1>
        <p className="verify-main-subtitle">
          Validate the cryptographic RSA-PSS SHA-256 digital signature and detect any alterations to an official candidate evaluation report.
        </p>
      </div>

      {/* MAIN VERIFICATION CARD */}
      <div className="verify-main-card">
        {/* SEGMENTED TABS */}
        <div className="verify-tabs-bar" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === "id"}
            onClick={() => { setActiveTab("id"); setFormError(""); }}
            className={`verify-tab-button ${activeTab === "id" ? "active" : ""}`}
          >
            <Hash size={16} />
            <span>Verify by Report ID</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === "json"}
            onClick={() => { setActiveTab("json"); setFormError(""); }}
            className={`verify-tab-button ${activeTab === "json" ? "active" : ""}`}
          >
            <FileCode size={16} />
            <span>Verify a Signed JSON Report</span>
          </button>
        </div>

        {/* METHOD 1: VERIFY BY REPORT ID */}
        {activeTab === "id" && (
          <div>
            <div className="verify-input-group">
              <label htmlFor="report-id-input" className="verify-input-label">
                Official Report ID
              </label>
              <div className="input-icon-wrapper">
                <Search className="input-icon-left" size={18} />
                <input
                  id="report-id-input"
                  type="text"
                  value={reportIdInput}
                  onChange={(e) => setReportIdInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleVerifyById(); }}
                  placeholder="e.g. REP-2026-53B0CC42"
                  className="verify-text-input"
                  autoComplete="off"
                />
              </div>
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                Enter the unique credential identifier issued on the assessment certificate.
              </span>
            </div>

            <button
              onClick={() => handleVerifyById()}
              disabled={loading || !reportIdInput.trim()}
              className="verify-submit-btn"
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin" size={16} />
                  <span>Verifying Cryptographic Signature...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={18} />
                  <span>Verify Report</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* METHOD 2: VERIFY SIGNED JSON ARTIFACT */}
        {activeTab === "json" && (
          <div>
            {/* Hidden native input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />

            {!uploadedFile ? (
              <div 
                className="upload-dropzone-box"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
              >
                <div className="dropzone-icon-wrap">
                  <UploadCloud size={24} />
                </div>
                <h4 className="dropzone-title">Upload Official Signed JSON Report</h4>
                <p className="dropzone-subtext">Drag and drop your exported report artifact here, or browse files</p>
                <button
                  type="button"
                  className="custom-file-input-btn"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                >
                  <FileCode size={15} />
                  <span>Choose JSON File</span>
                </button>
              </div>
            ) : (
              <div className="file-chosen-banner">
                <div className="file-info-col">
                  <FileCode size={18} style={{ color: "#818cf8" }} />
                  <div>
                    <strong>{uploadedFile.name}</strong>
                    <span className="file-size-tag"> ({uploadedFile.sizeKb} KB)</span>
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={handleRemoveFile} 
                  className="btn-remove-file"
                  title="Remove selected file"
                >
                  <X size={15} style={{ verticalAlign: "middle" }} />
                  <span>Remove file</span>
                </button>
              </div>
            )}

            {/* Paste JSON Toggle */}
            <div style={{ textAlign: "right", marginBottom: "8px" }}>
              <span 
                className="paste-json-toggle"
                onClick={() => setShowJsonTextarea(!showJsonTextarea)}
              >
                {showJsonTextarea ? "Hide Raw JSON Textarea" : "Or paste raw JSON payload directly"}
              </span>
            </div>

            {showJsonTextarea && (
              <div>
                <label htmlFor="raw-json-textarea" className="verify-input-label" style={{ display: "block", marginBottom: "6px" }}>
                  Raw Signed Report JSON
                </label>
                <textarea
                  id="raw-json-textarea"
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder="Paste complete exported JSON payload including cryptographicSignature..."
                  className="json-input-textarea"
                  spellCheck="false"
                />
              </div>
            )}

            <button
              onClick={handleVerifyJson}
              disabled={loading || !jsonInput.trim()}
              className="verify-submit-btn"
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin" size={16} />
                  <span>Validating Cryptographic Hash...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={18} />
                  <span>Verify Digital Signature</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* INLINE ERROR BANNER */}
        {formError && (
          <div className="verify-error-banner" role="alert">
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{formError}</span>
          </div>
        )}

        {/* VERIFICATION RESULT STATES */}
        {verificationResult && (
          <div 
            className={`verify-result-panel ${
              verificationResult.valid 
                ? "valid" 
                : verificationResult.status === "TAMPERED_CONTENT" 
                ? "tampered" 
                : "unknown"
            }`}
            aria-live="polite"
          >
            {/* SUCCESS / VALID STATE */}
            {verificationResult.valid ? (
              <div>
                <div className="result-status-header">
                  <div className="result-icon-badge valid">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h3 className="result-heading-text" style={{ color: "#34d399" }}>
                      Signature Valid — Report Authentic &amp; Unaltered
                    </h3>
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                      Status Code: {verificationResult.status || "VALID"}
                    </span>
                  </div>
                </div>

                <p className="result-message-text">
                  The mathematical RSA-PSS SHA-256 signature precisely matches the canonical hash of this report under the platform's trusted public verification key. The contents have not been modified since issuance.
                </p>

                {verificationResult.details && (
                  <table className="crypto-details-table">
                    <tbody>
                      {verificationResult.details.keyId && (
                        <tr>
                          <td className="crypto-label-cell">Signing Key ID:</td>
                          <td className="crypto-value-cell">{verificationResult.details.keyId}</td>
                        </tr>
                      )}
                      {verificationResult.details.algorithm && (
                        <tr>
                          <td className="crypto-label-cell">Signature Algorithm:</td>
                          <td className="crypto-value-cell">{verificationResult.details.algorithm}</td>
                        </tr>
                      )}
                      {verificationResult.details.canonicalHash && (
                        <tr>
                          <td className="crypto-label-cell">Canonical SHA-256 Hash:</td>
                          <td className="crypto-value-cell">{verificationResult.details.canonicalHash}</td>
                        </tr>
                      )}
                      {verificationResult.details.verifiedAt && (
                        <tr>
                          <td className="crypto-label-cell">Verification Timestamp:</td>
                          <td className="crypto-value-cell">
                            {new Date(verificationResult.details.verifiedAt).toUTCString()}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            ) : verificationResult.status === "TAMPERED_CONTENT" ? (
              /* TAMPERED / FORGED STATE */
              <div>
                <div className="result-status-header">
                  <div className="result-icon-badge tampered">
                    <ShieldX size={24} />
                  </div>
                  <div>
                    <h3 className="result-heading-text" style={{ color: "#f87171" }}>
                      Verification Failed — Content Altered or Forged
                    </h3>
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                      Status Code: TAMPERED_CONTENT
                    </span>
                  </div>
                </div>

                <p className="result-message-text" style={{ color: "#fca5a5" }}>
                  {verificationResult.reason || "The calculated hash of this report does not match the cryptographic signature. One or more fields (e.g., scores, competencies, or dates) have been altered since signing."}
                </p>

                {verificationResult.details?.computedHash && (
                  <table className="crypto-details-table">
                    <tbody>
                      <tr>
                        <td className="crypto-label-cell">Computed Payload Hash:</td>
                        <td className="crypto-value-cell" style={{ color: "#f87171" }}>
                          {verificationResult.details.computedHash}
                        </td>
                      </tr>
                      {verificationResult.details.keyId && (
                        <tr>
                          <td className="crypto-label-cell">Target Key ID:</td>
                          <td className="crypto-value-cell">{verificationResult.details.keyId}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            ) : (
              /* UNKNOWN / NOT FOUND STATE */
              <div>
                <div className="result-status-header">
                  <div className="result-icon-badge unknown">
                    <ShieldAlert size={24} />
                  </div>
                  <div>
                    <h3 className="result-heading-text" style={{ color: "#fbbf24" }}>
                      Report Not Found or Unknown Verification Key
                    </h3>
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                      Status Code: {verificationResult.status || "UNKNOWN"}
                    </span>
                  </div>
                </div>

                <p className="result-message-text">
                  {verificationResult.message || verificationResult.reason || "Unable to locate a matching signed report record with this identifier in the platform repository."}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* TRUST & SECURITY INFORMATION */}
      <div className="verify-trust-card">
        <div className="trust-card-icon">
          <Shield size={20} />
        </div>
        <div className="trust-card-body">
          <h4>About Digital Verification</h4>
          <p>
            Cryptographic verification uses RSA-PSS with SHA-256 and RFC 8785 canonicalization to verify that the signed report has not been modified after completion. A valid digital signature confirms data integrity and origin authenticity under the platform's trusted private key. It reflects measured performance on standardized tasks and does not represent a clinical or psychiatric determination.
          </p>
        </div>
      </div>
    </div>
  );
}
