import { useNavigate, Link } from "react-router-dom";
import {
  AlertTriangle,
  BookOpen,
  Brain,
  Calendar,
  FileQuestion,
  HelpCircle,
  MapPin,
} from "lucide-react";
import LockedFeatureModal from "../components/LockedFeatureModal";
import useApprovalGuard from "../hooks/useApprovalGuard";
import { useAuth } from "../context/AuthContext";

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

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { guard, showLockedModal, lockedFeatureName, closeModal } = useApprovalGuard();

  const openProtectedAction = (path, featureName) => {
    guard(() => navigate(path), featureName)();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-24">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
          Welcome back{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">What would you like to do today?</p>
      </div>

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