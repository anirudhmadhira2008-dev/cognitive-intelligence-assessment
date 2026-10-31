import React, { useState, useEffect, useCallback } from "react";
import RealtimeMonitor from "./RealtimeMonitor";
import api from "../api/apiClient";
import { 
  Loader2, 
  Shield, 
  AlertCircle, 
  ArrowRight, 
  Brain, 
  Clock, 
  CheckCircle2, 
  Camera, 
  Mic, 
  Save,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Wifi,
  Activity,
  UserCheck,
  Bookmark,
  RotateCcw,
  Check,
  HelpCircle
} from "lucide-react";

export default function AdaptiveAssessment({ setup, sessionId, onComplete }) {
  const TOTAL_QUESTIONS = 6;
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [autosaveState, setAutosaveState] = useState("saved"); // "saved" | "saving" | "offline"
  const [error, setError] = useState(null);
  const [difficulty, setDifficulty] = useState(setup?.startingDifficulty || 2);
  const [attemptedIds, setAttemptedIds] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [questionHistory, setQuestionHistory] = useState([]); // Array of { question, options, domain, ... }
  const [reviewFlags, setReviewFlags] = useState(Array(TOTAL_QUESTIONS).fill(false));
  const [currentIndex, setCurrentIndex] = useState(0); // Which question number candidate is viewing (0..TOTAL_QUESTIONS-1)
  const [startedAt, setStartedAt] = useState(Date.now());
  const [monitor, setMonitor] = useState({ risk: 0, events: [], attention: 90, facesCount: 1 });
  const [selectedOption, setSelectedOption] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Live Proctoring UI State
  const [proctoringCollapsed, setProctoringCollapsed] = useState(false);
  const [isAssessmentCompleted, setIsAssessmentCompleted] = useState(false);

  // Timer countdown simulation (e.g. 15 minutes overall)
  const [secondsLeft, setSecondsLeft] = useState(900);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timer);
          handleAutoSubmitOnExpiry();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleAutoSubmitOnExpiry = useCallback(() => {
    setIsAssessmentCompleted(true);
    onComplete({
      mcq: {
        answers: answers,
        correct: answers.filter((a) => a.correct).length,
        total: answers.length || 1
      },
      monitor,
      difficultyReached: difficulty,
      timeExpired: true
    });
  }, [answers, monitor, difficulty, onComplete]);

  const fetchNextQuestion = useCallback(
    async (currDifficulty, currentAttempted, targetIdx = null) => {
      setLoading(true);
      setError(null);
      setSelectedOption(null);
      try {
        const data = await api.assessment.getNextQuestion(
          currDifficulty,
          currentAttempted,
          null,
          sessionId
        );

        if (data.completed || !data.question) {
          setShowConfirmModal(true);
          return;
        }

        const newQ = data.question;
        setQuestion(newQ);
        setQuestionHistory((prev) => {
          const updated = [...prev];
          const insertIdx = targetIdx !== null ? targetIdx : prev.length;
          updated[insertIdx] = newQ;
          return updated;
        });
        setStartedAt(Date.now());
      } catch (err) {
        console.error("Failed to fetch next question:", err);
        setError("Unable to load next adaptive question from server. Please verify your connection.");
        setAutosaveState("offline");
      } finally {
        setLoading(false);
      }
    },
    [sessionId]
  );

  useEffect(() => {
    let isMounted = true;

    const initializeAssessment = async () => {
      let initDiff = difficulty;
      let initAttempted = attemptedIds;

      if (sessionId) {
        try {
          const res = await api.assessment.getSessionById(sessionId);
          if (res?.session) {
            const serverResponses = res.session.responses || [];
            if (serverResponses.length > 0) {
              const serverAttempted = res.session.adaptiveState?.attemptedQuestionIds?.length
                ? res.session.adaptiveState.attemptedQuestionIds
                : serverResponses.map((r) => r.questionId);
              const serverDiff = res.session.adaptiveState?.currentDifficulty || difficulty;

              if (isMounted) {
                setAnswers(serverResponses);
                setAttemptedIds(serverAttempted);
                setCurrentIndex(serverResponses.length < TOTAL_QUESTIONS ? serverResponses.length : TOTAL_QUESTIONS - 1);
                setDifficulty(serverDiff);
              }
              initDiff = serverDiff;
              initAttempted = serverAttempted;
            }
          }
        } catch (err) {
          console.warn("Could not load prior session responses, proceeding with local state:", err);
        }
      }

      if (isMounted) {
        fetchNextQuestion(initDiff, initAttempted, 0);
      }
    };

    initializeAssessment();

    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  const metric = useCallback(
    (m) => {
      setMonitor((prev) => {
        const newEvents = m.event ? [m.event, ...prev.events] : prev.events;
        if (m.event && sessionId) {
          api.assessment.recordProgress({ sessionId, events: [m.event] }).catch(() => {});
        }
        return {
          risk: m.risk,
          attention: Math.max(30, Math.round(100 - m.risk * 0.5)),
          events: newEvents,
          facesCount: m.facesCount !== undefined ? m.facesCount : prev.facesCount
        };
      });
    },
    [sessionId]
  );

  // Sync selectedOption when candidate views a previously answered question
  useEffect(() => {
    if (question && question.questionId) {
      const existingAnswer = answers.find((a) => a.questionId === question.questionId);
      if (existingAnswer && existingAnswer.choice !== undefined) {
        setSelectedOption(existingAnswer.choice);
      } else {
        setSelectedOption(null);
      }
    }
  }, [currentIndex, question, answers]);

  const handleNavigateToQuestion = (idx) => {
    // Only allow navigating to questions already reached
    if (idx > answers.length && idx !== currentIndex) return;
    if (idx === currentIndex) return;

    setCurrentIndex(idx);
    if (questionHistory[idx]) {
      setQuestion(questionHistory[idx]);
      const prevAns = answers.find((a) => a.questionId === questionHistory[idx].questionId);
      setSelectedOption(prevAns ? prevAns.choice : null);
    }
  };

  const handleToggleMarkReview = () => {
    setReviewFlags((prev) => {
      const updated = [...prev];
      updated[currentIndex] = !updated[currentIndex];
      return updated;
    });
  };

  const handleClearSelection = () => {
    setSelectedOption(null);
  };

  const handleConfirmAnswer = async (choiceIndex) => {
    if (choiceIndex === null || !question || submittingAnswer) return;

    setSubmittingAnswer(true);
    setAutosaveState("saving");
    const ms = Date.now() - startedAt;

    try {
      const verifyRes = await api.assessment.recordAnswer({
        sessionId,
        questionId: question.questionId,
        choiceIndex,
        responseMs: ms,
        confidence: 70,
        allowUpdate: true
      });

      setAutosaveState("saved");
      const isCorrect = Boolean(verifyRes.isCorrect);
      const nextDiff = verifyRes.nextDifficulty || difficulty;

      const entry = {
        questionId: question.questionId,
        domain: question.domain,
        bloom: question.bloom,
        competency: question.competency,
        choice: choiceIndex,
        correct: isCorrect,
        responseMs: ms,
        difficulty: question.difficulty
      };

      // Upsert into answers array
      const existingIdx = answers.findIndex((a) => a.questionId === question.questionId);
      let updatedAnswers;
      if (existingIdx >= 0) {
        updatedAnswers = [...answers];
        updatedAnswers[existingIdx] = entry;
      } else {
        updatedAnswers = [...answers, entry];
      }
      setAnswers(updatedAnswers);

      const updatedAttempted = Array.from(new Set([...attemptedIds, question.questionId]));
      setAttemptedIds(updatedAttempted);
      setDifficulty(nextDiff);

      const nextIndex = currentIndex + 1;
      if (verifyRes.completedMcq || nextIndex >= TOTAL_QUESTIONS) {
        setShowConfirmModal(true);
      } else {
        setCurrentIndex(nextIndex);
        if (questionHistory[nextIndex]) {
          setQuestion(questionHistory[nextIndex]);
          const existing = updatedAnswers.find((a) => a.questionId === questionHistory[nextIndex].questionId);
          setSelectedOption(existing ? existing.choice : null);
        } else {
          fetchNextQuestion(nextDiff, updatedAttempted, nextIndex);
        }
      }
    } catch (err) {
      console.error("Error submitting answer:", err);
      setError("Failed to record answer to server. Click retry.");
      setAutosaveState("offline");
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const finalizeAssessmentSubmission = () => {
    setShowConfirmModal(false);
    setIsAssessmentCompleted(true);
    onComplete({
      mcq: {
        answers: answers,
        correct: answers.filter((a) => a.correct).length,
        total: answers.length || 1
      },
      monitor,
      difficultyReached: Math.max(...answers.map((a) => a.difficulty || 1), difficulty)
    });
  };

  if (loading && !question) {
    return (
      <div className="assessment-shell flex items-center justify-center p-12 min-h-[500px]">
        <div className="text-center">
          <Loader2 className="spinner-icon text-indigo-500 mx-auto mb-4 animate-spin" size={52} />
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Selecting Adaptive Question...
          </h3>
          <p className="text-sm text-gray-500 mt-2">
            Calibrating difficulty tier to candidate performance using Bloom's Taxonomy
          </p>
        </div>
      </div>
    );
  }

  if (error && !question) {
    return (
      <div className="assessment-shell p-8 max-w-xl mx-auto text-center">
        <AlertCircle className="text-rose-500 mx-auto mb-3" size={48} />
        <h3 className="text-xl font-bold text-gray-900">Connection Interrupted</h3>
        <p className="text-gray-600 mt-2 mb-6">{error}</p>
        <button
          className="primary-button"
          onClick={() => fetchNextQuestion(difficulty, attemptedIds, currentIndex)}
        >
          Retry Question Retrieval
        </button>
      </div>
    );
  }

  const difficultyNames = ["Foundation", "Intermediate", "Advanced"];
  const currentDiffName = difficultyNames[difficulty - 1] || "Intermediate";

  // Event counts for Live Proctoring
  const totalEvents = monitor.events.length;
  const warningCount = monitor.events.filter((e) => e.severity === "Warning").length;
  const criticalCount = monitor.events.filter((e) => e.severity === "Critical").length;

  const totalAnswered = answers.length;
  const totalMarked = reviewFlags.filter(Boolean).length;
  const totalUnanswered = TOTAL_QUESTIONS - totalAnswered;

  return (
    <div className="assessment-shell">
      {/* Background Proctoring Monitor */}
      <RealtimeMonitor 
        onMetrics={metric} 
        isSubmitted={isAssessmentCompleted} 
        sessionId={sessionId}
        currentDifficulty={difficulty}
        questionBloom={question?.bloom}
      />

      {/* Assessment Header */}
      <header className="assessment-top-bar">
        <div className="bar-brand">
          <div className="brand-badge-sm">
            <Brain size={18} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="assessment-title-text">{setup?.role || "Multimodal Engineering Evaluation"}</h2>
            <span className="assessment-subtitle-text">Server-Authoritative Adaptive Engine</span>
          </div>
        </div>

        <div className="bar-right-metrics">
          <div className="question-count-badge">
            <span>Question <strong>{currentIndex + 1}</strong> of {TOTAL_QUESTIONS}</span>
          </div>

          <div className="timer-badge">
            <Clock size={15} />
            <span>{formatTimer(secondsLeft)}</span>
          </div>
        </div>
      </header>

      {/* Realtime Candidate Proctoring Notice Banner */}
      {monitor.events.length > 0 && monitor.events[0] && (monitor.events[0].severity === "high" || monitor.events[0].severity === "critical" || monitor.events[0].severity === "medium") && (
        <div className={`p-3 mx-6 mt-3 rounded-lg text-xs font-semibold flex items-center justify-between shadow-sm border ${
          monitor.events[0].severity === "critical" || monitor.events[0].severity === "high"
            ? "bg-rose-50 text-rose-800 border-rose-200" 
            : "bg-amber-50 text-amber-800 border-amber-200"
        }`}>
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>PROCTORING NOTICE: {monitor.events[0].details || monitor.events[0].type.replace(/_/g, " ")} ({monitor.events[0].status})</span>
          </div>
          <span className="text-[11px] font-normal text-slate-500">Recorded at {monitor.events[0].time}</span>
        </div>
      )}

      {/* Progress Track */}
      <div className="assessment-progress-wrapper">
        <div 
          className="assessment-progress-fill" 
          style={{ width: `${Math.min(100, ((currentIndex + 1) / TOTAL_QUESTIONS) * 100)}%` }} 
        />
      </div>

      {/* QUESTION PALETTE & LEGEND COMPONENT */}
      <div className="assessment-palette-wrapper">
        <div className="palette-header-row">
          <span className="palette-title">
            <Activity size={15} className="text-indigo-600" />
            Question Palette
          </span>

          <div className="palette-legend">
            <div className="legend-item">
              <span className="legend-swatch answered" />
              <span>Answered</span>
            </div>
            <div className="legend-item">
              <span className="legend-swatch marked" />
              <span>Marked for Review</span>
            </div>
            <div className="legend-item">
              <span className="legend-swatch answered-marked" />
              <span>Answered & Marked</span>
            </div>
            <div className="legend-item">
              <span className="legend-swatch unanswered" />
              <span>Unanswered</span>
            </div>
            <div className="legend-item">
              <span className="legend-swatch current" />
              <span>Current</span>
            </div>
          </div>
        </div>

        <div className="palette-grid">
          {Array.from({ length: TOTAL_QUESTIONS }).map((_, idx) => {
            const isAnswered = answers[idx] !== undefined;
            const isMarked = reviewFlags[idx];
            const isCurrent = idx === currentIndex;
            const isAccessible = idx <= answers.length;

            let statusClass = "status-unanswered";
            if (isAnswered && isMarked) statusClass = "status-answered-marked";
            else if (isAnswered) statusClass = "status-answered";
            else if (isMarked) statusClass = "status-marked";

            return (
              <button
                key={idx}
                type="button"
                disabled={!isAccessible}
                onClick={() => handleNavigateToQuestion(idx)}
                className={`palette-btn ${statusClass} ${isCurrent ? "active-current" : ""}`}
                title={`Question ${idx + 1} (${isAnswered ? "Answered" : "Not Answered"}${isMarked ? ", Marked for Review" : ""})`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Question Body */}
      <main className="question-container">
        {/* Meta badges */}
        <div className="question-header-badges">
          <span className="meta-chip chip-domain">
            Category: {question?.domain || "Software Architecture"}
          </span>
          <span className="meta-chip chip-difficulty">
            Difficulty: {currentDiffName} (Tier {difficulty}/3)
          </span>
          {question?.competency && (
            <span className="meta-chip chip-competency">
              Competency: {question.competency}
            </span>
          )}
        </div>

        {/* Question Statement Card */}
        <div className="question-statement-card">
          <h2 className="statement-text">{question?.question}</h2>
        </div>

        {/* Interactive Option Cards */}
        <div className="options-container-grid">
          {question?.options?.map((optionText, idx) => {
            const isSelected = selectedOption === idx;
            const letter = String.fromCharCode(65 + idx);

            return (
              <button
                key={idx}
                disabled={submittingAnswer}
                onClick={() => setSelectedOption(idx)}
                className={`option-card-button ${isSelected ? "selected" : ""}`}
              >
                <div className="option-badge">{letter}</div>
                <span className="option-text-label">{optionText}</span>
                {isSelected && (
                  <div className="option-selected-icon">
                    <CheckCircle2 size={20} className="text-indigo-600" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Question Controls & Review Action Row */}
        <div className="flex items-center justify-between mt-4 px-2 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`mark-review-btn ${reviewFlags[currentIndex] ? "is-marked" : ""}`}
              onClick={handleToggleMarkReview}
            >
              <Bookmark size={15} className={reviewFlags[currentIndex] ? "fill-purple-600" : ""} />
              <span>{reviewFlags[currentIndex] ? "Marked for Review" : "Mark for Review"}</span>
            </button>

            {selectedOption !== null && (
              <button
                type="button"
                className="clear-response-btn"
                onClick={handleClearSelection}
              >
                <RotateCcw size={14} />
                <span>Clear Choice</span>
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 font-medium">
            {answers[currentIndex] !== undefined ? "✓ Previously Recorded" : "Unsubmitted"}
          </div>
        </div>

        {/* Navigation Action Row */}
        <div className="question-action-bar">
          <button 
            type="button"
            className="secondary-button" 
            onClick={() => handleNavigateToQuestion(currentIndex - 1)} 
            disabled={currentIndex === 0 || submittingAnswer}
          >
            <ChevronLeft size={16} />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-3">
            {currentIndex === TOTAL_QUESTIONS - 1 && (
              <button
                type="button"
                className="mark-review-btn bg-slate-100 hover:bg-slate-200"
                onClick={() => setShowConfirmModal(true)}
              >
                Review & Finish
              </button>
            )}

            <button
              type="button"
              className="primary-button"
              disabled={selectedOption === null || submittingAnswer}
              onClick={() => handleConfirmAnswer(selectedOption)}
            >
              <span>
                {submittingAnswer 
                  ? "Recording Answer..." 
                  : currentIndex === TOTAL_QUESTIONS - 1 
                  ? "Submit Assessment" 
                  : "Next Question"}
              </span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </main>

      {/* SUBMISSION CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="modal-overlay-backdrop">
          <div className="confirm-modal-box">
            <div className="modal-header-section">
              <HelpCircle className="text-indigo-600 shrink-0" size={32} />
              <div>
                <h3 className="text-lg font-bold text-slate-900">Final Assessment Submission</h3>
                <p className="text-xs text-slate-500">Please review your question completion summary before confirming.</p>
              </div>
            </div>

            <div className="modal-summary-grid">
              <div className="modal-summary-card">
                <div className="number text-emerald-600">{totalAnswered}</div>
                <div className="label">Answered</div>
              </div>
              <div className="modal-summary-card">
                <div className="number text-purple-600">{totalMarked}</div>
                <div className="label">Marked Review</div>
              </div>
              <div className="modal-summary-card">
                <div className="number text-rose-500">{totalUnanswered}</div>
                <div className="label">Unanswered</div>
              </div>
            </div>

            {totalUnanswered > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2 mb-4">
                <AlertCircle size={16} className="shrink-0" />
                <span>You have <strong>{totalUnanswered}</strong> unanswered question(s). Unanswered questions will receive 0 score.</span>
              </div>
            )}

            <div className="modal-actions-row">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowConfirmModal(false)}
              >
                Return to Questions
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={finalizeAssessmentSubmission}
              >
                <Check size={16} />
                <span>Confirm & Finalize</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIVE PROCTORING REAL-TIME EVENT TABLE SECTION */}
      <section className="live-proctoring-panel">
        <div 
          className="proctoring-panel-header"
          onClick={() => setProctoringCollapsed(!proctoringCollapsed)}
        >
          <div className="header-left">
            <span className={`live-status-dot ${isAssessmentCompleted ? "stopped" : "active-pulse"}`} />
            <h3 className="proctoring-title">LIVE PROCTORING</h3>
            <span className={`proctoring-status-badge ${isAssessmentCompleted ? "badge-stopped" : "badge-active"}`}>
              ● {isAssessmentCompleted ? "Stopped (Summary Generated)" : "Active"}
            </span>
          </div>

          <div className="header-indicators">
            <span className="indicator-pill ok">● Camera: Active</span>
            <span className={`indicator-pill ${monitor.facesCount === 1 ? "ok" : "warn"}`}>
              ● Face: {monitor.facesCount === 1 ? "Verified" : monitor.facesCount === 0 ? "Not Detected" : "Multiple"}
            </span>
            <span className="indicator-pill ok">● Liveness: Active</span>
            <span className="indicator-pill ok">● Network: Stable</span>
          </div>

          <div className="header-counts-and-toggle">
            <div className="summary-counts-pills">
              <span className="count-pill">Total: <strong>{totalEvents}</strong></span>
              <span className="count-pill pill-warning">Warnings: <strong>{warningCount}</strong></span>
              <span className="count-pill pill-critical">Critical: <strong>{criticalCount}</strong></span>
            </div>

            <button type="button" className="collapse-toggle-btn" aria-label="Toggle Proctoring Panel">
              {proctoringCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </button>
          </div>
        </div>

        {!proctoringCollapsed && (
          <div className="proctoring-table-scroll-container">
            <table className="proctoring-event-table">
              <thead>
                <tr>
                  <th style={{ width: "12%" }}>Time</th>
                  <th style={{ width: "25%" }}>Event</th>
                  <th style={{ width: "20%" }}>Status</th>
                  <th style={{ width: "15%" }}>Severity</th>
                  <th style={{ width: "28%" }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {monitor.events.length > 0 ? (
                  monitor.events.map((ev) => (
                    <tr key={ev.id} className={`event-row-${(ev.severity || "normal").toLowerCase()}`}>
                      <td className="time-cell">{ev.time}</td>
                      <td className="event-cell font-mono font-bold text-slate-800">{ev.type}</td>
                      <td className="status-cell">
                        <span className={`status-tag tag-${(ev.severity || "normal").toLowerCase()}`}>
                          {ev.status || "✓ Stable"}
                        </span>
                      </td>
                      <td className="severity-cell">
                        <span className={`severity-chip chip-${(ev.severity || "normal").toLowerCase()}`}>
                          {ev.severity || "Normal"}
                        </span>
                      </td>
                      <td className="details-cell text-xs text-slate-600">
                        {ev.details || `${ev.type.replace(/_/g, " ")} observed`}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="empty-proctoring-row text-center py-4 text-xs text-slate-500">
                      <Activity size={16} className="inline mr-2 text-emerald-500 animate-pulse" />
                      <span>Live monitoring active. Continuous face presence, single-person environment, and focus verified.</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Proctoring & Autosave Status Footer */}
      <footer className="assessment-bottom-status">
        <div className="status-indicators-group">
          <span className="status-item live">
            <Camera size={14} className="text-emerald-400" />
            <span>Camera Stream Active</span>
          </span>
          <span className="status-item live">
            <Mic size={14} className="text-emerald-400" />
            <span>Microphone Input Ready</span>
          </span>
          <span className={`status-item ${monitor.risk > 30 ? "warn" : "live"}`}>
            <Shield size={14} />
            <span>Integrity: {100 - monitor.risk}% ({monitor.risk > 30 ? "Notice" : "Stable"})</span>
          </span>
        </div>

        <div className="autosaved-pill">
          {autosaveState === "saving" && <Loader2 size={13} className="text-indigo-400 animate-spin" />}
          {autosaveState === "saved" && <Save size={13} className="text-indigo-400" />}
          {autosaveState === "offline" && <AlertCircle size={13} className="text-amber-400" />}
          <span>
            {autosaveState === "saving" 
              ? "Saving Answer..." 
              : autosaveState === "offline" 
              ? "Autosave Offline" 
              : "Server Autosaved"}
          </span>
        </div>
      </footer>
    </div>
  );
}
