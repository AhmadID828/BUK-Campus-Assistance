import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  AlertTriangle,
  BookOpen,
  Brain,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileQuestion,
  HelpCircle,
  Loader2,
  MapPin,
  TrendingUp,
} from "lucide-react";
import LockedFeatureModal from "../components/LockedFeatureModal";
import useApprovalGuard from "../hooks/useApprovalGuard";
import { useAuth } from "../context/AuthContext";
import { API_BASE_URL } from "../config";

const academicActions = [
  {
    title: "AI Chat",
    description: "Ask questions and get help with your studies",
    icon: Brain,
    path: "/chat",
    color: "bg-violet-600",
    protected: true,
  },
  {
    title: "Study Materials",
    description: "Review your approved learning materials",
    icon: BookOpen,
    path: "/materials",
    color: "bg-blue-600",
    protected: true,
  },
  {
    title: "Take a Quiz",
    description: "Test your understanding",
    icon: FileQuestion,
    path: "/quiz",
    color: "bg-indigo-600",
    protected: true,
  },
  {
    title: "Study Planner",
    description: "Organize your revision schedule",
    icon: Calendar,
    path: "/planner",
    color: "bg-sky-600",
    protected: true,
  },
];

const campusActions = [
  {
    title: "Campus Map",
    description: "Find buildings and directions",
    icon: MapPin,
    path: "/campus-map",
    color: "bg-teal-600",
  },
  {
    title: "FAQs",
    description: "Find answers to common questions",
    icon: HelpCircle,
    path: "/faqs",
    color: "bg-cyan-600",
  },
  {
    title: "Events",
    description: "See upcoming campus activities",
    icon: Calendar,
    path: "/events",
    color: "bg-blue-500",
  },
  {
    title: "Emergency Contacts",
    description: "Reach security and clinic support",
    icon: AlertTriangle,
    path: "/emergency",
    color: "bg-red-500",
  },
];

function ActionCard({ action, onProtectedAction }) {
  const content = (
    <>
      <div className={`w-11 h-11 rounded-xl ${action.color} text-white flex items-center justify-center mb-3`}>
        <action.icon size={20} />
      </div>
      <h3 className="font-semibold text-slate-800 transition group-hover:text-blue-600 dark:text-slate-100">
        {action.title}
      </h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{action.description}</p>
    </>
  );

  if (action.protected) {
    return (
      <button
        type="button"
        onClick={() => onProtectedAction(action.path, action.title)}
        className="group rounded-2xl border border-blue-100 bg-white p-5 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-700"
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      to={action.path}
      className="group rounded-2xl border border-blue-100 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-700"
    >
      {content}
    </Link>
  );
}

function ProgressCard({ label, value, detail, icon: Icon, accent }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
        </div>
        <span className={`rounded-xl p-2.5 ${accent}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{detail}</p>
    </article>
  );
}

function getNextStep(isApproved, overview, progress, nextTopic) {
  if (!isApproved) {
    return {
      eyebrow: "While you wait",
      title: "Explore campus information",
      description: "Browse campus FAQs and locations while an administrator reviews your account.",
      path: "/faqs",
      label: "Browse FAQs",
      icon: Clock3,
      color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    };
  }
  if (!overview || !progress) return null;
  if (!overview.materials.length) {
    return {
      eyebrow: "Recommended next step",
      title: "Add your first study material",
      description: "Upload lecture notes to create a personal foundation for quizzes and study planning.",
      path: "/materials",
      label: "Open study materials",
      icon: BookOpen,
      color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    };
  }
  if (!progress.total_topics) {
    return {
      eyebrow: "Recommended next step",
      title: "Turn a lecture into a study topic",
      description: "Choose a registered course and add an uploaded material to your planner.",
      path: "/planner",
      label: "Set up your planner",
      icon: Calendar,
      color: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    };
  }
  if (progress.pending_topics === 0) {
    return {
      eyebrow: "Great progress",
      title: "Your current topics are complete",
      description: "Test your understanding with a quiz, or add new topics to keep building your study plan.",
      path: "/quiz",
      label: "Take a quiz",
      icon: TrendingUp,
      color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    };
  }
  if (!overview.plan) {
    return {
      eyebrow: "Recommended next step",
      title: "Build your revision schedule",
      description: "Generate a plan from your topics, course exam dates, and recent quiz results.",
      path: "/planner",
      label: "Generate a study plan",
      icon: Calendar,
      color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    };
  }
  if (nextTopic) {
    return {
      eyebrow: "Keep your momentum",
      title: nextTopic.topic,
      description: `${nextTopic.course || "Study topic"} · ${nextTopic.hours || 2} hours planned`,
      path: "/planner",
      label: "Continue studying",
      icon: CheckCircle2,
      color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    };
  }
  return {
    eyebrow: "Great progress",
    title: "Your current plan is complete",
    description: "Test your understanding with a quiz, or regenerate your plan when you add new topics.",
    path: "/quiz",
    label: "Take a quiz",
    icon: TrendingUp,
    color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  };
}

function Dashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const { guard, showLockedModal, lockedFeatureName, closeModal } = useApprovalGuard();
  const [overview, setOverview] = useState(null);
  const [overviewError, setOverviewError] = useState("");
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewRetryKey, setOverviewRetryKey] = useState(0);

  const openProtectedAction = (path, featureName) => {
    guard(() => navigate(path), featureName)();
  };

  useEffect(() => {
    if (!token || !user?.is_approved) {
      setOverview(null);
      setOverviewLoading(false);
      return undefined;
    }

    let active = true;
    let requestController;
    const loadOverview = async (silent = false) => {
      if (document.visibilityState !== "visible") return;
      requestController?.abort();
      requestController = new AbortController();
      if (!silent) setOverviewLoading(true);

      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [progressResponse, coursesResponse, materialsResponse, planResponse] =
          await Promise.all([
            fetch(`${API_BASE_URL}/planner/progress`, {
              headers,
              signal: requestController.signal,
            }),
            fetch(`${API_BASE_URL}/planner/courses`, {
              headers,
              signal: requestController.signal,
            }),
            fetch(`${API_BASE_URL}/materials/?limit=50`, {
              headers,
              signal: requestController.signal,
            }),
            fetch(`${API_BASE_URL}/planner/active`, {
              headers,
              signal: requestController.signal,
            }),
          ]);

        for (const [name, response] of [
          ["progress", progressResponse],
          ["courses", coursesResponse],
          ["study materials", materialsResponse],
        ]) {
          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.detail || `Unable to load ${name}.`);
          }
        }
        if (!planResponse.ok && planResponse.status !== 404) {
          const data = await planResponse.json().catch(() => ({}));
          throw new Error(data.detail || "Unable to load your study plan.");
        }

        const [progress, courseData, materialData, plan] = await Promise.all([
          progressResponse.json(),
          coursesResponse.json(),
          materialsResponse.json(),
          planResponse.ok ? planResponse.json() : Promise.resolve(null),
        ]);
        if (!active) return;
        setOverview({
          progress,
          courses: courseData.courses || [],
          materials: materialData.materials || [],
          materialsHasNext: materialData.has_next,
          plan,
        });
        setOverviewError("");
      } catch (requestError) {
        if (active && requestError.name !== "AbortError" && !silent) {
          setOverviewError(requestError.message || "Unable to load your study overview.");
        }
      } finally {
        if (active && !silent) setOverviewLoading(false);
      }
    };

    void loadOverview();
    const refreshIfVisible = () => void loadOverview(true);
    const intervalId = window.setInterval(refreshIfVisible, 15_000);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      active = false;
      requestController?.abort();
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [token, user?.is_approved, overviewRetryKey]);

  const progress = overview?.progress;
  const completionRate = Math.min(
    100,
    Math.max(0, Number(progress?.completion_rate) || 0),
  );
  const nextTopic = overview?.plan?.plan?.find((item) => !item.completed);
  const nextStep = getNextStep(user?.is_approved, overview, progress, nextTopic);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-24">
      <header className="mb-7">
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
          Welcome back{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}
        </h1>
      </header>

      {user?.is_approved && (
        <>
          <section className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Learning progress">
            <ProgressCard
              label="Topics completed"
              value={overviewLoading && !overview ? "—" : `${progress?.completed_topics ?? 0}/${progress?.total_topics ?? 0}`}
              detail={`${completionRate}% of your tracked topics`}
              icon={CheckCircle2}
              accent="text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300"
            />
            <ProgressCard
              label="Quiz average"
              value={overviewLoading && !overview ? "—" : `${Math.round(Number(progress?.average_quiz_score) || 0)}%`}
              detail={(progress?.average_quiz_score ?? 0) > 0 ? "Across completed quizzes" : "Take a quiz to start tracking"}
              icon={TrendingUp}
              accent="text-violet-600 bg-violet-50 dark:bg-violet-900/30 dark:text-violet-300"
            />
            <ProgressCard
              label="Study materials"
              value={
                overviewLoading && !overview
                  ? "—"
                  : overview?.materialsHasNext
                    ? `${overview.materials.length}+`
                    : overview?.materials?.length ?? 0
              }
              detail="Available in your library"
              icon={BookOpen}
              accent="text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300"
            />
            <ProgressCard
              label="Registered courses"
              value={overviewLoading && !overview ? "—" : overview?.courses?.length ?? 0}
              detail="Organizing your study"
              icon={Calendar}
              accent="text-sky-600 bg-sky-50 dark:bg-sky-900/30 dark:text-sky-300"
            />
          </section>

          <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                  <h2 className="font-semibold text-slate-900 dark:text-white">Your study progression</h2>
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {progress?.total_topics
                    ? `${progress.completed_topics} of ${progress.total_topics} topics completed`
                    : "Add topics to your planner to start tracking your progress."}
                </p>
              </div>
              <span className="text-lg font-bold text-blue-700 dark:text-blue-300">{completionRate}%</span>
            </div>
            <div
              className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"
              role="progressbar"
              aria-label="Study topic completion"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={completionRate}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-[width] duration-700"
                style={{ width: `${completionRate}%` }}
              />
            </div>
            {overviewLoading && !overview && (
              <p className="mt-3 flex items-center gap-2 text-xs text-slate-400" role="status">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading your latest progress…
              </p>
            )}
          </section>
        </>
      )}

      {overviewError && !overview && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <span>{overviewError} The dashboard will retry automatically.</span>
          <button
            type="button"
            onClick={() => setOverviewRetryKey((attempt) => attempt + 1)}
            className="shrink-0 rounded-lg border border-amber-300 px-3 py-1.5 font-semibold hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/40"
          >
            Try again
          </button>
        </div>
      )}

      {nextStep && (
        <section className="mb-10 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-4">
              <span className={`rounded-2xl p-3 ${nextStep.color}`}>
                <nextStep.icon className="h-6 w-6" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                  {nextStep.eyebrow}
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{nextStep.title}</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {nextStep.description}
                </p>
              </div>
            </div>
            {nextStep.path === "/faqs" ? (
              <Link
                to={nextStep.path}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
              >
                {nextStep.label}<ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => openProtectedAction(nextStep.path, nextStep.title)}
                disabled={user?.is_approved && overviewLoading && !overview}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60"
              >
                {nextStep.label}<ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </section>
      )}

      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
            <BookOpen size={18} />
          </div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Academic Support</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {academicActions.map((action) => (
            <ActionCard
              key={action.title}
              action={action}
              onProtectedAction={openProtectedAction}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-600 dark:bg-teal-950 dark:text-teal-300">
            <MapPin size={18} />
          </div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Campus Life</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {campusActions.map((action) => (
            <ActionCard key={action.title} action={action} />
          ))}
        </div>
      </section>

      <LockedFeatureModal
        isOpen={showLockedModal}
        onClose={closeModal}
        featureName={lockedFeatureName}
      />
    </div>
  );
}

export default Dashboard;