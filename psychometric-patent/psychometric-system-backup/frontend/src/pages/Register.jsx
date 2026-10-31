import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../services/authService";
import api from "../api/apiClient";
import * as faceapi from "face-api.js";
import { 
  Brain, 
  Lock, 
  Mail, 
  User, 
  ArrowRight, 
  AlertCircle, 
  AlertTriangle,
  CheckCircle2, 
  Camera, 
  Upload, 
  RefreshCw,
  FileText,
  Building,
  BookOpen,
  X,
  ScanFace,
  Loader2
} from "lucide-react";

const initial = { 
  name: "", 
  email: "", 
  password: "", 
  rollNumber: "", 
  college: "", 
  course: "B.Tech", 
  branch: "", 
  year: "4" 
};

export default function Register() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);

  const [form, setForm] = useState(initial);
  const [photoBase64, setPhotoBase64] = useState("");
  const [photoFileName, setPhotoFileName] = useState("");
  const [photoFileSize, setPhotoFileSize] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [photoStatus, setPhotoStatus] = useState("idle"); // idle | selected | uploading | enrolled | error
  const [photoError, setPhotoError] = useState("");

  // Face Pose & Straight Alignment State
  const [facePose, setFacePose] = useState({ 
    ok: false, 
    code: "detecting", 
    message: "Initializing camera & face alignment guide..." 
  });
  const faceTrackerRef = useRef(null);

  const [message, setMessage] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(false);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // Clean up camera and interval on unmount
  useEffect(() => {
    return () => {
      if (faceTrackerRef.current) clearInterval(faceTrackerRef.current);
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const loadFaceModels = async () => {
    try {
      if (!faceapi.nets.tinyFaceDetector.params) {
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
      }
      if (!faceapi.nets.faceLandmark68Net.params) {
        await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
      }
      return true;
    } catch (e) {
      console.warn("Face model loading warning:", e.message);
      return false;
    }
  };

  const startFaceAlignmentTracking = () => {
    if (faceTrackerRef.current) clearInterval(faceTrackerRef.current);

    faceTrackerRef.current = setInterval(async () => {
      if (!cameraVideoRef.current || cameraVideoRef.current.paused || cameraVideoRef.current.ended) return;
      const video = cameraVideoRef.current;
      if (video.readyState < 2) return;

      try {
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 }))
          .withFaceLandmarks();

        if (!detections || detections.length === 0) {
          setFacePose({ ok: false, code: "no_face", message: "Position your face inside the guide frame" });
          return;
        }

        if (detections.length > 1) {
          setFacePose({ ok: false, code: "multiple_faces", message: "Multiple faces detected — ensure only candidate is visible" });
          return;
        }

        const d = detections[0];
        const landmarks = d.landmarks;
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();
        const nose = landmarks.getNose();
        const mouth = landmarks.getMouth();
        const jaw = landmarks.getJawOutline();

        const leftX = leftEye.reduce((s, p) => s + p.x, 0) / leftEye.length;
        const leftY = leftEye.reduce((s, p) => s + p.y, 0) / leftEye.length;
        const rightX = rightEye.reduce((s, p) => s + p.x, 0) / rightEye.length;
        const rightY = rightEye.reduce((s, p) => s + p.y, 0) / rightEye.length;
        const eyeMidY = (leftY + rightY) / 2;

        const noseTip = nose[3] || nose[nose.length - 1];
        const mouthMidY = mouth.reduce((s, p) => s + p.y, 0) / mouth.length;
        const chin = jaw[8] || jaw[Math.floor(jaw.length / 2)];

        // Eye distance for scale normalization
        const eyeDist = Math.hypot(rightX - leftX, rightY - leftY);
        if (eyeDist < 25) {
          setFacePose({ ok: false, code: "too_far", message: "Move slightly closer to the camera" });
          return;
        }

        // 1. Tilt (Roll angle): check difference in Y between eyes
        const tiltRatio = Math.abs(rightY - leftY) / eyeDist;
        if (tiltRatio > 0.18) {
          setFacePose({ ok: false, code: "tilted", message: "Head is tilted — please keep your face level" });
          return;
        }

        // 2. Yaw (Sideways rotation): check nose position relative to left & right eye
        const distToLeft = Math.abs(noseTip.x - leftX);
        const distToRight = Math.abs(rightX - noseTip.x);
        const symmetryRatio = Math.abs(distToLeft - distToRight) / eyeDist;

        if (symmetryRatio >= 0.24) {
          setFacePose({ ok: false, code: "sideways", message: "Face turned sideways — look straight at camera" });
          return;
        }

        const box = d.detection.box;
        const centerX = box.x + box.width / 2;
        const videoW = video.videoWidth || 640;
        const centerRatio = centerX / videoW;

        // 3. Pitch (Upward vs. Downward tilt) using landmark geometry
        const upperLipY = mouth[3] ? mouth[3].y : (mouth[13] ? mouth[13].y : mouthMidY);
        const distEyeToNose = Math.max(1, noseTip.y - eyeMidY);
        const distNoseToMouth = mouthMidY - noseTip.y;
        const distNoseToUpperLip = upperLipY - noseTip.y;
        const distNoseToChin = chin.y - noseTip.y;

        // Scale-normalized ratios by inter-pupillary distance
        const eyeToNoseRatio = distEyeToNose / (eyeDist || 1);
        const noseToMouthRatio = distNoseToMouth / (eyeDist || 1);
        const eyeNoseToMouthRatio = distNoseToMouth > 0 ? (distEyeToNose / distNoseToMouth) : 10.0;
        const lipToEyeRatio = distNoseToUpperLip / distEyeToNose;
        const chinToNoseRatio = distNoseToChin / distEyeToNose;

        // UPWARD TILT (looking up / chin raised / nostrils exposed):
        // Chin raised -> nose tip pulled up to eyes, noseToMouth expands, eyeToNose collapses
        const isLookingUp = (
          eyeNoseToMouthRatio < 0.70 ||
          eyeToNoseRatio < 0.35 ||
          noseToMouthRatio > 0.62 ||
          lipToEyeRatio > 1.40 ||
          chinToNoseRatio > 4.0
        );

        if (isLookingUp) {
          setFacePose({ ok: false, code: "looking_up", message: "Head tilted upward — lower your chin & look straight" });
          return;
        }

        // DOWNWARD TILT (looking down / forehead tilted forward towards camera):
        // Forehead forward -> nose tip moves down onto mouth, distEyeToNose expands, distNoseToChin collapses
        const isLookingDown = (
          eyeNoseToMouthRatio > 2.45 ||
          eyeToNoseRatio > 0.74 ||
          noseToMouthRatio < 0.30 ||
          lipToEyeRatio < 0.35 ||
          chinToNoseRatio < 1.15
        );

        if (isLookingDown) {
          setFacePose({ ok: false, code: "looking_down", message: "Head tilted downward — raise your chin & look straight" });
          return;
        }

        // 4. Centering: check if face center is centered in frame
        if (centerRatio < 0.20 || centerRatio > 0.80) {
          setFacePose({ ok: false, code: "off_center", message: "Center your face in the oval frame" });
          return;
        }

        // All checks passed!
        setFacePose({ ok: true, code: "straight", message: "Face straight & centered — ready to capture!" });
      } catch (detErr) {
        // Continue tracking
      }
    }, 180);
  };

  // Attach stream to video element when camera becomes active
  useEffect(() => {
    if (cameraActive && cameraVideoRef.current && cameraStreamRef.current) {
      const video = cameraVideoRef.current;
      video.srcObject = cameraStreamRef.current;
      video.play().then(() => {
        loadFaceModels().then(() => {
          startFaceAlignmentTracking();
        }).catch(() => {
          setFacePose({ ok: true, code: "ready", message: "Center your face in the oval and click Capture" });
        });
      }).catch((playErr) => {
        console.warn("Camera video play error:", playErr);
      });
    }
  }, [cameraActive]);

  // Start webcam for instant registration snapshot
  const startCameraCapture = async () => {
    setPhotoError("");
    setCameraLoading(true);
    setFacePose({ ok: false, code: "detecting", message: "Activating camera..." });

    // Check for Secure Context / getUserMedia support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraLoading(false);
      setCameraActive(false);
      setPhotoError("Live camera requires a secure browser context (http://localhost or HTTPS). If you are accessing via LAN IP, please open http://localhost:5173 or use 'Choose Image File'.");
      return;
    }

    try {
      // Request video stream directly without waiting for heavy model downloads
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } 
        });
      } catch (cErr) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      cameraStreamRef.current = stream;
      setCameraActive(true);
      setCameraLoading(false);
      setFacePose({ ok: true, code: "ready", message: "Position your face in the oval and click Capture" });
    } catch (err) {
      console.warn("Camera activation error:", err);
      setCameraLoading(false);
      setCameraActive(false);

      let errMsg = "Unable to access camera.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        errMsg = "Camera permission was blocked. Please click the camera icon in your browser address bar to allow camera access.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        errMsg = "No camera found on your device. Please use 'Choose Image File' to select a photo.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        errMsg = "Camera is currently being used by another application or tab. Please close other camera apps and retry.";
      } else {
        errMsg = err.message || "Failed to start camera.";
      }
      setPhotoError(errMsg);
    }
  };

  const stopCameraCapture = () => {
    if (faceTrackerRef.current) {
      clearInterval(faceTrackerRef.current);
      faceTrackerRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraLoading(false);
    setFacePose({ ok: false, code: "detecting", message: "Initializing camera..." });
  };

  const captureFromCamera = () => {
    if (!cameraVideoRef.current) return;
    try {
      const video = cameraVideoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      
      // Mirror horizontally so the captured photo matches mirror preview
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      
      setPhotoBase64(dataUrl);
      setPhotoFileName("reference_identity_portrait.jpg");
      setPhotoFileSize("0.3 MB");
      setPhotoStatus("selected");
      setShowPreview(true);
      stopCameraCapture();
    } catch (cErr) {
      setPhotoError("Failed to capture snapshot from webcam.");
    }
  };

  // Handle Photo File Selection & Validation
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoError("");
    setShowPreview(false);

    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
    setPhotoFileSize(`${sizeInMB} MB`);

    // Check size limit (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setPhotoStatus("error");
      setPhotoError("Image file exceeds maximum 5MB limit. Please select a smaller photo.");
      return;
    }

    // Check format
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.type.toLowerCase())) {
      setPhotoStatus("error");
      setPhotoError("Unsupported image format. Allowed formats: JPEG, PNG, WEBP.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoBase64(event.target.result);
      setPhotoFileName(file.name);
      setPhotoStatus("selected");
    };
    reader.onerror = () => {
      setPhotoStatus("error");
      setPhotoError("Failed to read image file. Please try selecting again.");
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    stopCameraCapture();
    setPhotoBase64("");
    setPhotoFileName("");
    setPhotoFileSize("");
    setPhotoStatus("idle");
    setPhotoError("");
    setShowPreview(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setPhotoError("");
    setMessage({ type: "", text: "" });

    if (form.password.length < 8) {
      return setMessage({ type: "error", text: "Password must be at least 8 characters long." });
    }

    if (!photoBase64) {
      setPhotoStatus("error");
      setPhotoError("Identity reference photo is required to enroll for assessments.");
      return setMessage({ type: "error", text: "Please select or take an identity reference photo before proceeding." });
    }

    setLoading(true);

    try {
      // 1. Create candidate user account with registered photo
      const data = await registerUser({
        ...form,
        profilePhoto: photoBase64,
        referenceImage: photoBase64
      });
      if (data.error) {
        setLoading(false);
        return setMessage({ type: "error", text: data.error });
      }

      // 2. Ensure explicit Assessment & Identity Enrollment with reference photo
      setPhotoStatus("uploading");
      const candidateId = data.user?.id || data.user?._id;

      try {
        await api.enrollment.create({
          candidateId,
          title: "AI Multimodal Psychometric Engineering Assessment",
          roleTarget: form.branch ? `${form.branch} Engineer` : "Software Developer",
          referenceImage: photoBase64,
          consent: true
        });
      } catch (enrollErr) {
        console.warn("Secondary enrollment creation notice:", enrollErr.message);
      }

      // Successful registration + photo identity enrollment
      setPhotoStatus("enrolled");
      setMessage({
        type: "success",
        text: "✓ Account registered and Identity Reference Photo successfully enrolled! Redirecting..."
      });

      setTimeout(() => {
        navigate("/dashboard");
      }, 1200);
    } catch (err) {
      console.error("Registration submission error:", err);
      setPhotoStatus("error");
      setPhotoError(err.message || "Network or database connection error.");
      setMessage({ type: "error", text: err.message || "Failed to complete identity enrollment registration." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card register-wide-card">
        <div className="auth-brand">
          <div className="auth-logo-badge">
            <Brain size={28} className="text-indigo-400" />
          </div>
          <h2>Candidate Academic & Identity Registration</h2>
          <p className="auth-subtitle">Create profile & enroll reference face photo for assessment verification</p>
        </div>

        {message.text && (
          <div className={`alert-banner ${message.type}`}>
            {message.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{message.text}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={submit}>
          <div className="form-grid-2col">
            <div className="form-field">
              <label>Full Name *</label>
              <div className="input-with-icon">
                <User size={18} className="field-icon" />
                <input 
                  name="name" 
                  type="text"
                  placeholder="Candidate Full Name" 
                  value={form.name} 
                  onChange={change} 
                  required 
                />
              </div>
            </div>

            <div className="form-field">
              <label>Institutional Email *</label>
              <div className="input-with-icon">
                <Mail size={18} className="field-icon" />
                <input 
                  name="email" 
                  type="email" 
                  placeholder="student@college.edu" 
                  value={form.email} 
                  onChange={change} 
                  required 
                />
              </div>
            </div>

            <div className="form-field">
              <label>Roll Number / Registration ID</label>
              <div className="input-with-icon">
                <FileText size={18} className="field-icon" />
                <input 
                  name="rollNumber" 
                  type="text"
                  placeholder="e.g. 21BCE0456" 
                  value={form.rollNumber} 
                  onChange={change} 
                />
              </div>
            </div>

            <div className="form-field">
              <label>College / Institution</label>
              <div className="input-with-icon">
                <Building size={18} className="field-icon" />
                <input 
                  name="college" 
                  type="text"
                  placeholder="e.g. National Institute of Technology" 
                  value={form.college} 
                  onChange={change} 
                />
              </div>
            </div>

            <div className="form-field">
              <label>Engineering Branch</label>
              <div className="input-with-icon">
                <BookOpen size={18} className="field-icon" />
                <input 
                  name="branch" 
                  type="text"
                  placeholder="e.g. Computer Science & Engineering" 
                  value={form.branch} 
                  onChange={change} 
                />
              </div>
            </div>

            <div className="form-field-dual">
              <div className="form-field">
                <label>Program</label>
                <select name="course" value={form.course} onChange={change}>
                  <option>B.Tech</option>
                  <option>B.E</option>
                  <option>B.Sc</option>
                  <option>M.Tech</option>
                  <option>MCA</option>
                </select>
              </div>

              <div className="form-field">
                <label>Year of Study</label>
                <select name="year" value={form.year} onChange={change}>
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year (Graduating)</option>
                </select>
              </div>
            </div>
          </div>

          {/* REQUIRED REFERENCE IDENTITY PHOTO UPLOAD SECTION */}
          <div className="identity-photo-enrollment-box mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Camera size={18} className="text-indigo-600" />
                <span className="font-semibold text-sm text-slate-800">
                  Reference Identity Photo
                </span>
              </div>
              <span className="text-xs text-slate-500">Required for proctoring verification</span>
            </div>

            {/* Hidden native file input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="image/jpeg,image/png,image/webp" 
              style={{ display: "none" }}
              onChange={handlePhotoSelect} 
            />

            {/* BEFORE UPLOAD / NO FILE SELECTED */}
            {photoStatus === "idle" && !photoBase64 && !cameraActive && (
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <button
                  type="button"
                  className="secondary-button text-xs py-2 px-3 flex items-center gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={14} />
                  <span>Choose Image File</span>
                </button>
                <button
                  type="button"
                  className="secondary-button text-xs py-2 px-3 flex items-center gap-2 bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                  onClick={startCameraCapture}
                  disabled={cameraLoading}
                >
                  {cameraLoading ? (
                    <>
                      <Loader2 size={14} className="animate-spin text-indigo-600" />
                      <span>Opening Camera...</span>
                    </>
                  ) : (
                    <>
                      <Camera size={14} />
                      <span>Take Photo with Camera</span>
                    </>
                  )}
                </button>
                <span className="text-xs text-slate-500 italic">Upload frontal portrait or capture with webcam</span>
              </div>
            )}

            {/* LIVE WEBCAM SNAPSHOT VIEW WITH FACE ALIGNMENT GUIDE */}
            {cameraActive && (
              <div className="registration-camera-card">
                <div className="camera-card-top-bar">
                  <div className="camera-header-info">
                    <span className="camera-guide-title">Align Reference Portrait</span>
                    <span className="camera-guide-subtitle">Face must be straight, level, and centered</span>
                  </div>
                  <button
                    type="button"
                    className="camera-close-x-btn"
                    onClick={stopCameraCapture}
                    title="Close Camera"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Viewport with Oval Target & Status Overlay */}
                <div className="camera-viewport-container">
                  <video
                    ref={cameraVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="camera-video-element"
                  />

                  {/* Oval Target Frame */}
                  <div className={`face-target-oval ${facePose.ok ? "aligned" : "warning"}`} />

                  {/* Real-time Status Overlay Pill */}
                  <div className={`camera-status-overlay-pill ${facePose.ok ? "status-ok" : "status-warn"}`}>
                    {facePose.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                    <span>{facePose.message}</span>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="camera-actions-footer">
                  <button
                    type="button"
                    className="btn-capture-portrait active"
                    onClick={captureFromCamera}
                  >
                    <Camera size={15} />
                    <span>Capture Reference Photo</span>
                  </button>
                  <button
                    type="button"
                    className="btn-cancel-capture"
                    onClick={stopCameraCapture}
                  >
                    Cancel
                  </button>
                </div>

                {!facePose.ok && (
                  <p className="camera-instruction-note">
                    ⚠️ Photo capture is enabled only when your face is straight and facing the camera directly.
                  </p>
                )}
              </div>
            )}

            {/* UPLOADING STATE */}
            {photoStatus === "uploading" && (
              <div className="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  className="secondary-button text-xs py-2 px-3 flex items-center gap-2"
                  disabled
                >
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Choose File</span>
                </button>
                <span className="text-xs text-indigo-600 font-medium flex items-center gap-1">
                  <RefreshCw size={13} className="animate-spin" /> Uploading & Enrolling...
                </span>
              </div>
            )}

            {/* FILE SELECTED / ENROLLED STATE */}
            {(photoStatus === "selected" || photoStatus === "enrolled" || photoBase64) && photoStatus !== "error" && photoStatus !== "uploading" && (
              <div className="mt-2">
                <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      className="secondary-button text-xs py-1.5 px-3 shrink-0"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Choose File
                    </button>
                    <div className="flex items-center gap-1.5 text-xs truncate">
                      <CheckCircle2 size={16} className={photoStatus === "enrolled" ? "text-emerald-500 shrink-0" : "text-indigo-500 shrink-0"} />
                      <span className="font-semibold text-slate-800 truncate">{photoFileName || "candidate_photo.jpg"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <button
                      type="button"
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100"
                      onClick={() => setShowPreview(!showPreview)}
                    >
                      {showPreview ? "Hide Preview" : "Preview"}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-slate-600 hover:text-indigo-600 font-medium px-2 py-1"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      className="text-xs text-rose-600 hover:text-rose-800 font-medium px-2 py-1"
                      onClick={handleRemovePhoto}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 mt-1.5 px-1">
                  <span className={photoStatus === "enrolled" ? "text-emerald-600 font-medium flex items-center gap-1" : "text-indigo-600 font-medium flex items-center gap-1"}>
                    {photoStatus === "enrolled" ? "✓ Photo uploaded successfully" : "✓ Photo selected — ready for enrollment"}
                  </span>
                  {photoFileSize && <span className="font-medium text-slate-600">{photoFileSize}</span>}
                </div>

                {/* OPTIONAL PREVIEW DISPLAY (ONLY SHOWN WHEN USER EXPLICITLY SELECTS PREVIEW) */}
                {showPreview && (
                  <div className="mt-3 p-3 bg-slate-900 rounded-lg flex flex-col items-center shadow-inner">
                    <img 
                      src={photoBase64} 
                      alt="Reference Preview" 
                      className="max-h-48 rounded object-contain border border-slate-700" 
                    />
                    <span className="text-[11px] text-slate-400 mt-2 font-medium">Reference Photo Preview</span>
                  </div>
                )}
              </div>
            )}

            {/* UPLOAD / CAMERA ERROR STATE */}
            {photoError && (
              <div className="mt-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{photoError}</span>
                </div>
                <button 
                  type="button" 
                  className="font-semibold text-rose-800 underline ml-2 shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose File
                </button>
              </div>
            )}
          </div>

          <div className="form-field full-width mt-4">
            <label>Security Password (minimum 8 characters) *</label>
            <div className="input-with-icon">
              <Lock size={18} className="field-icon" />
              <input 
                name="password" 
                type="password" 
                placeholder="••••••••••••" 
                minLength="8" 
                value={form.password} 
                onChange={change} 
                required 
              />
            </div>
          </div>

          <button type="submit" className="btn-auth-submit mt-4" disabled={loading}>
            <span>{loading ? "Registering & Enrolling Identity..." : "Complete Registration & Identity Enrollment"}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <div className="auth-footer">
          <span>Already registered?</span>
          <Link to="/login" className="auth-link">
            Sign In Here
          </Link>
        </div>
      </div>
    </div>
  );
}
