import { useEffect, useState } from "react";
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
      setSuccess(`Quiz generated: ${data.title || "Success"}`);
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
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border p-4">
              <p className="font-medium text-gray-800 dark:text-white mb-3">
                {i + 1}. {q.question}
              </p>
              <div className="space-y-2">
                {(Array.isArray(q.options)
                  ? q.options.map((option, index) => [String.fromCharCode(65 + index), option])
                  : Object.entries(q.options || {})
                ).map(([value, option]) => {
                  const label = typeof option === "string" ? option : option.label || option;
                  return (
                    <label key={value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name={`q-${i}`}
                        value={value}
                        checked={answers[String(i)] === value}
                        onChange={() =>
                          setAnswers({ ...answers, [String(i)]: value })
                        }

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
            className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium"
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
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Review each answer to see what you got right and what to improve.
          </p>
          <button
            onClick={() => setQuizResult(null)}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm"
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
              <p className="mt-2 text-sm">
                Your answer: <strong>{item.selected_answer || "Not answered"}</strong>
              </p>
              <p className="text-sm">
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

      <div className="bg-white dark:bg-gray-800 rounded-xl border p-5 mb-6">
        <h3 className="font-semibold text-gray-800 dark:text-white mb-3">Generate New Quiz</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedMaterial}
            onChange={(e) => setSelectedMaterial(e.target.value)}
            disabled={materials.length === 0 || generating}
            className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border rounded-lg text-sm disabled:opacity-60"
          >
            <option value="">Select material</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
          <select
            value={questionCount}
            onChange={(e) => setQuestionCount(e.target.value)}
            disabled={generating}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border rounded-lg text-sm"
            aria-label="Number of quiz questions"
          >
            <option value="3">3 questions (fast)</option>
            <option value="5">5 questions</option>
            <option value="10">10 questions</option>
            <option value="20">20 questions</option>
            <option value="30">30 questions</option>
            <option value="50">50 questions</option>
          </select>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            disabled={generating}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border rounded-lg text-sm"
            aria-label="Quiz AI provider"
          >
            <option value="ollama">Local Ollama (public)</option>
            <option value="groq">Groq (faster)</option>
          </select>
          <button
            onClick={handleGenerate}
            disabled={generating || !selectedMaterial}
            className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-sm"
          >
            <Brain className="w-4 h-4" />
            {generating ? `Generating ${questionCount} questions...` : "Generate Quiz"}
          </button>
        </div>
        {materials.length === 0 && !loading && (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Upload a study material before creating a quiz.
          </p>
        )}
      </div>

      <h3 className="font-semibold text-gray-800 dark:text-white mb-3">Saved Quizzes</h3>
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
              className="bg-white dark:bg-gray-800 rounded-xl border p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-gray-800 dark:text-white">{quiz.title}</p>
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