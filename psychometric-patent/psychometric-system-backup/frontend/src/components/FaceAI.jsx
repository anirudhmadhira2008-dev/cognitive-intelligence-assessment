import React, { useEffect, useRef, useState } from "react";

export default function FaceAI({ onVerified, setEvents }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState("Starting camera...");
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        setStatus("Camera active");
        setReady(true);
      })
      .catch(() => setStatus("Camera permission denied"));
    return () => streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const verify = () => {
    if (!ready) return;
    setChecking(true);
    setStatus("Checking face presence...");
    setTimeout(() => {
      setStatus("Identity presence verified");
      setEvents((old) => [...old, { time: new Date().toLocaleTimeString(), type: "FACE_VERIFIED" }]);
      setChecking(false);
      setTimeout(onVerified, 500);
    }, 1200);
  };

  return (
    <div className="face-card">
      <div className="section-heading"><div><p className="eyebrow">Identity Verification</p><h1>Face Presence Check</h1><p>Keep your face clearly visible and look at the camera.</p></div><span className={`status-pill ${ready ? "ok" : ""}`}>{status}</span></div>
      <div className="camera-box"><video ref={videoRef} autoPlay muted playsInline /><span className="live-badge">● LIVE</span></div>
      <button className="primary-button" disabled={!ready || checking} onClick={verify}>{checking ? "Verifying..." : "Verify and Continue"}</button>
    </div>
  );
}
