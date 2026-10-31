import React, { useEffect, useState } from "react";
import questions from "../data/questions";

export default function MCQTest({ onFinish }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [time, setTime] = useState(45);

  useEffect(() => {
    if (time <= 0) return next();
    const timer = setTimeout(() => setTime((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  });

  const next = () => {
    if (index < questions.length - 1) { setIndex(index + 1); setTime(45); }
    else submit();
  };

  const submit = () => {
    // Legacy stub: actual evaluation is server-authoritative
    const answeredCount = Object.keys(answers).length;
    onFinish(answeredCount, questions.length);
  };

  const q = questions[index];
  return (
    <div className="exam-layout">
      <main className="main-panel">
        <div className="mcq-header"><div><p className="eyebrow">Knowledge Round</p><h2>Question {index + 1} of {questions.length}</h2></div><span className="timer">⏱ {time}s</span></div>
        <div className="progress-track"><div style={{ width: `${((index + 1) / questions.length) * 100}%` }} /></div>
        <section className="question-card"><h3>{q.question}</h3>{q.options.map((option, i) => <button key={option} className={`option ${answers[index] === i ? "selected" : ""}`} onClick={() => setAnswers({ ...answers, [index]: i })}>{String.fromCharCode(65 + i)}. {option}</button>)}</section>
        <div className="button-row"><button className="secondary-button" disabled={index === 0} onClick={() => { setIndex(index - 1); setTime(45); }}>Previous</button><button className="primary-button" onClick={next}>{index === questions.length - 1 ? "Submit MCQ" : "Next"}</button></div>
      </main>
      <aside className="palette"><h3>Questions</h3><div className="palette-grid">{questions.map((_, i) => <button key={i} className={`${i === index ? "current" : ""} ${answers[i] !== undefined ? "answered" : ""}`} onClick={() => { setIndex(i); setTime(45); }}>{i + 1}</button>)}</div></aside>
    </div>
  );
}
