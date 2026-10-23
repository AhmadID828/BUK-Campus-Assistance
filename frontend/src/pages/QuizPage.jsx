import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
/* eslint-disable react-hooks/exhaustive-deps */
import { useAuth } from "../context/AuthContext";
import { API_BASE_URL } from "../config";
import useApprovalGuard from "../hooks/useApprovalGuard";
import PageHeader from "../components/PageHeader";
import LockedFeatureModal from "../components/LockedFeatureModal";
import {
  Brain,
} from "lucide-react";

const QuizPage = () => {
  const { token } = useAuth();
  const { guard, showLockedModal, lockedFeatureName, closeModal } = useApprovalGuard();

  const [materials, setMaterials] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [savedQuizzes, setSavedQuizzes] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [questionCount, setQuestionCount] = useState("3");
  const [provider, setProvider] = useState("groq");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizResult, setQuizResult] = useState(null);
  const [latestQuizId, setLatestQuizId] = useState(null);
  const [attemptId, setAttemptId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [remaining, setRemaining] = useState(0);

  const fetchData = async () => {
    if (!token) return;
    try {
      const [matRes, attRes, quizRes] = await Promise.all([
        fetch(`${API_BASE_URL}/materials/?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/quiz/attempts`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/quiz/quizzes`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!matRes.ok || !attRes.ok || !quizRes.ok) {
        throw new Error("Unable to load quiz data. Please refresh or sign in again.");
      }

      const matData = await matRes.json();
      const attData = await attRes.json();
      const quizData = await quizRes.json();

      setMaterials(matData.materials || matData || []);
      setAttempts(attData.attempts || []);
      setSavedQuizzes(quizData.quizzes || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = () => {
    setLoading(true);
    fetchData();
  };

  useEffect(() => {
    const fetchTimer = window.setTimeout(fetchData, 0);
    return () => window.clearTimeout(fetchTimer);
  }, [token]);

  // Timer
  useEffect(() => {
    if (!attemptId || !activeQuiz) return;
    let localRemaining = remaining;
    let expired = false;
    let timer;
    let countdownTimer;
    const syncRemaining = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/quiz/remaining-time/${attemptId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Unable to synchronize quiz time");
        const data = await res.json();
        if (expired) return;
        localRemaining = data.remaining_seconds || 0;
        setRemaining(localRemaining);
        if (data.is_expired) {
          expired = true;
          clearInterval(timer);
          clearInterval(countdownTimer);
          setActiveQuiz(null);
          setAttemptId(null);
          setError("Time is up. This quiz is no longer available.");
          fetchData();
        }
      } catch (timerError) {
        console.error(timerError);
      }
    };
    void syncRemaining();
    timer = setInterval(syncRemaining, 15000);
    countdownTimer = setInterval(() => {
      localRemaining = Math.max(localRemaining - 1, 0);
      setRemaining(localRemaining);
      if (localRemaining === 0 && !expired) {
        expired = true;
        clearInterval(timer);
        clearInterval(countdownTimer);
        fetch(`${API_BASE_URL}/quiz/remaining-time/${attemptId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((response) => {
            if (!response.ok) throw new Error("Unable to finalize the expired quiz");
          })
          .then(() => fetchData())
          .catch((timerError) => {
            console.error(timerError);
            fetchData();
          });
        setActiveQuiz(null);
        setAttemptId(null);
        setError("Time is up. This quiz is no longer available.");
      }
    }, 1000);
    return () => {
      clearInterval(timer);
      clearInterval(countdownTimer);
    };
  }, [attemptId, activeQuiz, token]);

  const handleGenerate = guard(async () => {
    if (!selectedMaterial) {
      setError("Select a material first");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const response = await fetch(      `${API_BASE_URL}/quiz/generate/${selectedMaterial}?num_questions=${questionCount}&provider=${provider}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to generate quiz");
      }
      const data = await response.json();
      setSuccess(`Your quiz is ready. “${data.title || "New quiz"}” is at the top of Your quizzes.`);
      setLatestQuizId(data.quiz_id);
      setSavedQuizzes((currentQuizzes) => [
        {
          quiz_id: data.quiz_id,
          title: data.title,
          subject: data.subject,
          total_questions: data.num_questions,
          time_limit: data.time_limit,
          is_available: true,
        },
        ...currentQuizzes,
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }, "Quiz Generation");

  const handleStart = guard(async (quizId) => {
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/quiz/start/${quizId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to start quiz");
      const data = await response.json();
      setActiveQuiz(data);
      setAttemptId(data.attempt_id);
      setRemaining(data.time_limit || 600);
      setAnswers({});
    } catch (err) {
      setError(err.message);
    }
  }, "Start Quiz");

  const handleSubmit = async () => {
    if (!attemptId) return;
    try {
      const response = await fetch(`${API_BASE_URL}/quiz/submit/${attemptId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ answers }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to submit quiz");
      }
      const data = await response.json();
      setSuccess(`Quiz submitted. Score: ${data.score}%`);
      setQuizResult(data);
      setActiveQuiz(null);
      setAttemptId(null);
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const viewAttempt = async (attemptIdToView) => {
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/quiz/attempts/${attemptIdToView}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Unable to load quiz review");
      const data = await response.json();
      const review = (data.questions || []).map((question) => {
        const index = data.questions.indexOf(question);
        const selected = data.answers?.[String(index)];
        const correct = question.correct_answer || "";
        return {
          question: question.question || "",
          options: question.options || {},
          selected_answer: selected,
          correct_answer: correct,
          is_correct: Boolean(selected && selected.toUpperCase() === correct.toUpperCase()),
          explanation: question.explanation || "",
        };
      });
      setQuizResult({ ...data, review });
    } catch (err) {
      setError(err.message);
    }
  };

  if (activeQuiz) {
    return (
      <div>
        <PageHeader
          title={activeQuiz.title || "Quiz in Progress"}
          subtitle={`Time remaining: ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`}
        />
        <div className="space-y-4">
          {(activeQuiz.questions || []).map((q, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <p className="mb-3 font-medium text-gray-800 dark:text-white">
                {i + 1}. {q.question}
              </p>
              <div className="space-y-2">
                {(Array.isArray(q.options)
                  ? q.options.map((option, index) => [String.fromCharCode(65 + index), option])
                  : Object.entries(q.options || {})
                ).map(([value, option]) => {
                  const label = typeof option === "string" ? option : option.label || option;
                  return (
                    <label key={value} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                      <input
                        type="radio"
                        name={`q-${i}`}
                        value={value}
                        checked={answers[String(i)] === value}
                        onChange={() => setAnswers({ ...answers, [String(i)]: value })}
                      />
                      <span>{value}. {label}</span>
                    </label>
                  );
                })}
              </div>
              {generating && (
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  Generating with {provider === "groq" ? "Groq" : "Ollama"} from your selected material. Larger quizzes can take longer.
                </p>
              )}
            </div>
          ))}
          <button
            onClick={handleSubmit}
            className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700"
          >
            Submit Quiz
          </button>
        </div>
      </div>
    );
  }

  if (quizResult) {
    return (
      <div>
        <PageHeader
          title="Quiz Review"
          subtitle={`${quizResult.quiz_title || "Completed quiz"} · Score: ${quizResult.score ?? 0}%`}
        />
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Review each answer to see what you got right and what to improve.
          </p>
          <button
            onClick={() => setQuizResult(null)}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
          >
            Back to Quiz Center
          </button>
        </div>
        <div className="space-y-4">
          {(quizResult.review || []).map((item, index) => (
            <div
              key={index}
              className={`rounded-xl border p-4 ${
                item.is_correct
                  ? "border-green-200 bg-green-50 dark:bg-green-900/20"
                  : "border-red-200 bg-red-50 dark:bg-red-900/20"
              }`}
            >
              <p className="font-medium text-gray-800 dark:text-white">
                {index + 1}. {item.question}
              </p>
              <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">
                Your answer: <strong>{item.selected_answer || "Not answered"}</strong>
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-200">
                Correct answer: <strong>{item.correct_answer}</strong>
              </p>
              {item.explanation && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  Explanation: {item.explanation}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Quiz Center"
        subtitle="Generate and attempt quizzes from your study materials"
        showRefresh={true}
        onRefresh={refreshData}
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl text-sm">{error}</div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 rounded-xl text-sm">{success}</div>
      )}

      <section className="mb-7 overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-amber-100 bg-amber-50/70 px-5 py-4 dark:border-gray-700 dark:bg-amber-900/10">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-amber-100 p-2.5 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
              <Brain className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Create a quiz from your notes</h2>
              <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">
                Choose a material, set the quiz length and AI provider, then generate.
              </p>
            </div>
          </div>
          <ol className="mt-4 grid grid-cols-1 gap-2 text-xs text-gray-600 dark:text-gray-300 sm:grid-cols-3">
            <li className="flex items-center gap-2 rounded-lg bg-white/80 px-3 py-2 dark:bg-gray-800">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-800">1</span>
              Select your uploaded notes
            </li>
            <li className="flex items-center gap-2 rounded-lg bg-white/80 px-3 py-2 dark:bg-gray-800">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-800">2</span>
              Choose questions and AI
            </li>
            <li className="flex items-center gap-2 rounded-lg bg-white/80 px-3 py-2 dark:bg-gray-800">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-800">3</span>
              Generate, then take your quiz
            </li>
          </ol>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200 sm:col-span-2">
            Study material
            <select
              value={selectedMaterial}
              onChange={(event) => setSelectedMaterial(event.target.value)}
              disabled={materials.length === 0 || generating}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm dark:border-gray-600 dark:bg-gray-700 disabled:opacity-60"
            >
              <option value="">Choose the notes for this quiz</option>
              {materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.title}{material.subject ? ` · ${material.subject}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Number of questions
            <select
              value={questionCount}
              onChange={(event) => setQuestionCount(event.target.value)}
              disabled={generating}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm dark:border-gray-600 dark:bg-gray-700"
            >
              <option value="3">3 questions · quickest</option>
              <option value="5">5 questions</option>
              <option value="10">10 questions</option>
              <option value="20">20 questions</option>
              <option value="30">30 questions</option>
              <option value="50">50 questions</option>
            </select>
          </label>

          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
            AI provider
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              disabled={generating}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm dark:border-gray-600 dark:bg-gray-700"
            >
              <option value="groq">Groq · faster</option>
              <option value="ollama">Ollama · local model</option>
            </select>
          </label>

          {materials.length === 0 && !loading ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-700/40 dark:text-gray-300 sm:col-span-2">
              <p className="font-medium text-gray-800 dark:text-white">No study materials yet</p>
              <p className="mt-1">Upload lecture notes first. You can return here after upload; they will appear in the material list.</p>
              <Link
                to="/materials"
                className="mt-3 inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700"
              >
                Go to Study Materials
              </Link>
            </div>
          ) : (
            <div className="sm:col-span-2">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating || !selectedMaterial}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {generating ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Creating your quiz...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4" />
                    Generate quiz
                  </>
                )}
              </button>
              {generating && (
                <p role="status" aria-live="polite" className="mt-2 text-xs text-gray-500 dark:text-gray-300">
                  Creating {questionCount} questions from your selected material. You can wait here; this may take a short while.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      <div id="saved-quizzes" className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-800 dark:text-white">Your quizzes</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            New quizzes appear here and are ready to take.
          </p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
          {savedQuizzes.length} total
        </span>
      </div>
      {loading ? (
        <div className="flex justify-center h-32 items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
        </div>
      ) : savedQuizzes.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-8 text-center text-gray-500">
          No generated quizzes yet
        </div>
      ) : (
        <div className="space-y-3">
          {savedQuizzes.map((quiz) => (
            <div
              key={quiz.quiz_id}
              className={`flex items-center justify-between gap-3 rounded-xl border p-4 ${
                quiz.quiz_id === latestQuizId
                  ? "border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-900/10"
                  : "border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800"
              }`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-gray-800 dark:text-white">{quiz.title}</p>
                  {quiz.quiz_id === latestQuizId && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                      JUST CREATED
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {quiz.total_questions} questions · {Math.floor(quiz.time_limit / 60)} minutes
                </p>
              </div>
              {quiz.is_available ? (
                <button
                  onClick={() => handleStart(quiz.quiz_id)}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                >
                  Take Test
                </button>
              ) : (
                <span className="text-sm text-gray-500">Submitted</span>
              )}
            </div>
          ))}
        </div>
      )}

      {attempts.some((attempt) => attempt.is_completed) && (
        <>
          <h3 className="font-semibold text-gray-800 dark:text-white mt-8 mb-3">Past Attempts</h3>
          <div className="space-y-3">
            {attempts.filter((attempt) => attempt.is_completed).map((attempt) => (
              <div key={attempt.attempt_id} className="bg-white dark:bg-gray-800 rounded-xl border p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800 dark:text-white">{attempt.quiz_title}</p>
                  <p className="text-xs text-gray-500">Score: {attempt.score ?? "—"}% · {attempt.total_questions} questions</p>
                </div>
                <button onClick={() => viewAttempt(attempt.attempt_id)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                  Review
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <LockedFeatureModal
        isOpen={showLockedModal}
        onClose={closeModal}
        featureName={lockedFeatureName}
      />
    </div>
  );
};

export default QuizPage;