import React, { useState, useRef } from "react";
import api from "../api/apiClient";

const sentences = [
  "Artificial intelligence improves recruitment systems.",
  "Machine learning enables smart candidate analysis.",
  "Cloud computing improves scalable applications.",
  "Psychometric evaluation measures human behavior.",
  "Frontend and backend integration is important."
];

export default function SentenceVerification() {
  const [sentence] = useState(
    sentences[Math.floor(Math.random() * sentences.length)]
  );

  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const startRecording = async () => {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.start();
      setRecording(true);
    } catch (err) {
      console.warn("Microphone error:", err);
      setError("Microphone access denied or device unavailable.");
    }
  };

  const stopRecording = async () => {
    if (!recorderRef.current) return;
    setLoading(true);

    recorderRef.current.onstop = async () => {
      try {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const form = new FormData();
        form.append("audio", blob);
        form.append("sentence", sentence);

        const data = await api.voice.verifySentence(form);

        if (!data.success) {
          throw new Error(data.message || "Verification failed");
        }

        setResult(data);
      } catch (err) {
        console.warn("Sentence verification error:", err);
        setError(err.message || "Sentence verification failed");
      } finally {
        setLoading(false);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
      }
    };

    recorderRef.current.stop();
    setRecording(false);
  };

  return (
    <div className="verify-box p-6 bg-white rounded-xl border border-slate-200 shadow-sm max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-slate-800 mb-2">Dynamic Sentence Verification</h2>
      <p className="text-sm text-slate-500 mb-2">Read this technical sentence out loud clearly:</p>
      <h3 className="text-base font-semibold text-indigo-600 bg-indigo-50 p-3 rounded-lg border border-indigo-100 mb-4">
        "{sentence}"
      </h3>

      {!recording ? (
        <button
          className="primary-button text-sm py-2 px-4"
          onClick={startRecording}
        >
          Start Voice Recording
        </button>
      ) : (
        <button
          className="secondary-button text-sm py-2 px-4 bg-rose-600 text-white hover:bg-rose-700"
          onClick={stopRecording}
        >
          Stop Recording & Verify
        </button>
      )}

      {loading && <p className="text-xs text-indigo-600 mt-3 font-semibold">Processing speech verification...</p>}

      {error && (
        <p className="text-xs text-rose-600 mt-3 bg-rose-50 p-2 rounded border border-rose-200">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
          <h3 className="font-bold text-slate-800 mb-1">Verification Result</h3>
          <p><span className="font-semibold">Transcript:</span> {result.transcript}</p>
          <p><span className="font-semibold">Accuracy:</span> {result.accuracy}%</p>
          <p><span className="font-semibold">Status:</span> {result.status}</p>
        </div>
      )}
    </div>
  );
}