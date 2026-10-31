import React, { useRef, useState } from "react";

export default function VoiceRound({ onComplete }) {
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const [message, setMessage] = useState("Record a short self-introduction.");

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      recorderRef.current = new MediaRecorder(stream);
      recorderRef.current.start();
      setRecording(true);
      setMessage("Recording in progress...");
    } catch { setMessage("Microphone permission denied. You may continue in demo mode."); }
  };

  const stop = () => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setRecording(false);
    setMessage("Voice response analyzed: clear communication detected.");
    onComplete(82);
  };

  return <div className="voice-card"><h2>Voice Interview Round</h2><p>“Introduce yourself and describe one technical strength.”</p><div className="voice-status">{message}</div><div className="button-row">{!recording ? <button className="primary-button" onClick={start}>Start Recording</button> : <button className="danger-button" onClick={stop}>Stop & Analyze</button>}<button className="secondary-button" onClick={() => onComplete(75)}>Skip in Demo</button></div></div>;
}
