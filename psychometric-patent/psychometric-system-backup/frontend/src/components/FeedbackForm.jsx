import React, { useState } from "react";

export default function FeedbackForm({ name = "Candidate" }) {
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [message, setMessage] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    try {
      await fetch("http://localhost:5000/api/feedback/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, rating, feedback }) });
    } catch {}
    localStorage.setItem("latest_feedback", JSON.stringify({ name, rating, feedback }));
    setMessage("Thank you. Feedback submitted successfully.");
    setFeedback("");
  };

  return <form className="feedback-box" onSubmit={submit}><h2>Candidate Feedback</h2><select value={rating} onChange={(e) => setRating(e.target.value)}><option value="5">Excellent</option><option value="4">Good</option><option value="3">Average</option><option value="2">Poor</option><option value="1">Very poor</option></select><textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Share your experience" required /><button className="primary-button">Submit Feedback</button>{message && <p className="success-text">{message}</p>}</form>;
}
