import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Brain,
  CalendarDays,
  HelpCircle,
  MapPin,
  ShieldCheck,
} from "lucide-react";

const features = [
  {
    icon: BookOpen,
    title: "Study with your own materials",
    description: "Keep lecture notes together and turn them into concise summaries.",
  },
  {
    icon: Brain,
    title: "Practice with AI",
    description: "Ask study questions and generate quizzes based on your materials.",
  },
  {
    icon: CalendarDays,
    title: "Make a study plan",
    description: "Organize courses, plan revision, and keep track of progress.",
  },
  {
    icon: MapPin,
    title: "Find campus support",
    description: "Explore campus locations, useful FAQs, and important contacts.",
  },
];

export default function WelcomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-indigo-100 text-slate-800">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link to="/" className="flex items-center gap-3" aria-label="BUK EduAI home">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
            <BookOpen size={22} />
          </span>
          <span className="font-bold tracking-tight">BUK EduAI</span>
        </Link>
        <nav className="flex items-center gap-3">
          <Link to="/faqs" className="hidden items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-white sm:flex">
            <HelpCircle size={17} />
            FAQs
          </Link>
          <Link to="/login" className="rounded-xl px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">
            Sign in
          </Link>
          <Link to="/signup" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-blue-200 hover:bg-blue-700">
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-10 sm:px-8 md:grid-cols-2 md:pb-24 md:pt-16">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm">
            <ShieldCheck size={15} />
            Your study and campus companion
          </div>
          <h1 className="max-w-xl text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Make every study session <span className="text-blue-600">count.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
            Bring your materials, revision plan, AI study help, and useful BUK
            campus information into one simple place.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700">
              Create your account
              <ArrowRight size={18} />
            </Link>
            <Link to="/faqs" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700">
              Explore FAQs
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Student accounts are reviewed by an administrator after registration.
          </p>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-blue-200/60 to-indigo-200/40 blur-2xl" />
          <div className="relative rounded-[2rem] border border-white bg-white/90 p-5 shadow-2xl shadow-blue-900/10 sm:p-7">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">A better study routine</p>
                <p className="mt-1 text-xs text-slate-500">Everything you need, in one workspace</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Brain size={20} />
              </span>
            </div>
            <div className="space-y-3">
              {features.map(({ icon: Icon, title, description }, index) => (
                <div key={title} className="flex gap-3 rounded-2xl border border-slate-100 bg-white p-4">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${index % 2 ? "bg-indigo-50 text-indigo-600" : "bg-blue-50 text-blue-600"}`}>
                    <Icon size={19} />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 text-center text-xs text-slate-400">
              Built for Bayero University Kano students
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
