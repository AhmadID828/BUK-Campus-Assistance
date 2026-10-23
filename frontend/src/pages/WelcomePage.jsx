import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
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

const campusSlides = [
  {
    title: "Welcome to Bayero University Kano",
    description: "Welcome to Bayero University Kano.",
    image: "/BUk%20main%20gate.jpg",
  },
  {
    title: "Faculty of Computing",
    description: "The Faculty of Computing at Bayero University Kano.",
    image: "/faculty-of-computing.webp",
  },
  {
    title: "Bayero University Kano",
    description: "Aerial view of the BUK campus.",
    image: "/buk-campus-aerial.jpg",
  },
  {
    title: "Old Site Main Gate",
    description: "The historic main entrance at BUK Old Site.",
    image: "/old-site-main-gate.webp",
  },
  {
    title: "Students' Affairs",
    description: "Students' Affairs Division at Bayero University Kano.",
    image: "/students-affairs.jpg",
  },
  {
    title: "Senate Building",
    description: "Abubakar Rasheed Senate Building at Bayero University Kano.",
    image: "/senate-building.jpg",
  },
  {
    title: "BUK Hostels",
    description: "Student hostel accommodation at Bayero University Kano.",
    image: "/hostel.jpg",
  },
];

function CampusCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [unavailableImages, setUnavailableImages] = useState(() => new Set());
  const [paused, setPaused] = useState(false);
  const activeSlide = campusSlides[activeIndex];
  const imageUnavailable = unavailableImages.has(activeSlide.image);
  const slideCount = campusSlides.length;

  useEffect(() => {
    if (paused) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % slideCount);
    }, 1300);
    return () => window.clearInterval(timer);
  }, [paused, slideCount]);

  const changeSlide = (offset) => {
    setActiveIndex((index) => (index + offset + slideCount) % slideCount);
  };

  return (
    <div
      className="relative mb-6 h-48 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-900 sm:h-56"
      aria-roledescription="carousel"
      aria-label="Bayero University Kano campus highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      {!imageUnavailable ? (
        <img
          key={activeSlide.image}
          src={activeSlide.image}
          alt={activeSlide.title}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() =>
            setUnavailableImages((current) =>
              new Set(current).add(activeSlide.image),
            )
          }
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(ellipse_at_75%_5%,rgba(125,211,252,0.42),transparent_36%),linear-gradient(135deg,#1d4ed8,#312e81_58%,#0f172a)]">
          <div className="flex h-32 w-44 items-end justify-center rounded-t-[2.5rem] border-x-4 border-t-4 border-white/50 bg-white/10 px-5 pb-3 shadow-2xl backdrop-blur-sm">
            <Building2 className="mb-1 h-16 w-16 text-white/90" strokeWidth={1.4} />
          </div>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/10 to-transparent" />
      {imageUnavailable && (
        <span className="absolute right-3 top-3 rounded-full bg-slate-950/60 px-2.5 py-1 text-[11px] font-medium text-white">
          Illustrated highlight
        </span>
      )}
      <div className="absolute inset-x-3 top-1/2 flex -translate-y-1/2 justify-between">
        <button
          type="button"
          onClick={() => changeSlide(-1)}
          aria-label="Previous campus highlight"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/45 text-white backdrop-blur hover:bg-slate-950/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          onClick={() => changeSlide(1)}
          aria-label="Next campus highlight"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/45 text-white backdrop-blur hover:bg-slate-950/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3">
        <div aria-live="polite" aria-atomic="true">
          <p className="text-sm font-semibold text-white">{activeSlide.title}</p>
          <p className="mt-1 line-clamp-1 text-xs text-white/80">{activeSlide.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {campusSlides.map((slide, index) => (
            <button
              key={slide.title}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Show ${slide.title}`}
              aria-current={activeIndex === index ? "true" : undefined}
              className={`h-2.5 rounded-full transition-all ${
                activeIndex === index ? "w-6 bg-white" : "w-2.5 bg-white/60 hover:bg-white"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-indigo-100 text-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 dark:text-slate-100">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-y-3 px-5 py-5 sm:px-8">
        <Link to="/" className="flex items-center gap-3" aria-label="BUK Campus Assistant System home">
          <img src="/BUk%20logo%202.webp" alt="" className="h-11 w-11 rounded-2xl bg-white/70 p-0.5 object-contain opacity-90 shadow-md shadow-blue-200/60 transition-opacity hover:opacity-100" />
          <span className="font-bold tracking-tight">BUK Campus Assistant System</span>
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <Link to="/locations" className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800 sm:px-4">
            <MapPin size={17} />
            <span className="hidden sm:inline">Campus map</span>
          </Link>
          <Link to="/faqs" className="hidden items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800 sm:flex">
            <HelpCircle size={17} />
            FAQs
          </Link>
          <Link to="/login" className="rounded-xl px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-slate-800">
            Sign in
          </Link>
          <Link to="/signup" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-blue-200 hover:bg-blue-700">
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-10 sm:px-8 md:grid-cols-2 md:pb-24 md:pt-16">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm dark:border-blue-900 dark:bg-slate-900/80 dark:text-blue-300">
            <ShieldCheck size={15} />
            Your study and campus companion
          </div>
          <h1 className="max-w-xl text-4xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
            Make every study session <span className="text-blue-600">count.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
            Bring your materials, revision plan, AI study help, and useful BUK
            campus information into one simple place.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700">
              Create your account
              <ArrowRight size={18} />
            </Link>
            <Link to="/faqs" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-800 dark:hover:text-blue-300">
              Explore FAQs
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Student accounts are reviewed by an administrator after registration.
          </p>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-blue-200/60 to-indigo-200/40 blur-2xl dark:from-blue-900/40 dark:to-indigo-900/30" />
          <div className="relative rounded-[2rem] border border-white bg-white/90 p-5 shadow-2xl shadow-blue-900/10 dark:border-slate-700 dark:bg-slate-900/90 sm:p-7">
            <CampusCarousel />
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">A better study routine</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Everything you need, in one workspace</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Brain size={20} />
              </span>
            </div>
            <div className="space-y-3">
              {features.map(({ icon: Icon, title, description }, index) => (
                <div key={title} className="flex gap-3 rounded-2xl border border-slate-100 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${index % 2 ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300" : "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300"}`}>
                    <Icon size={19} />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 text-center text-xs text-slate-400 dark:text-slate-500">
              Built for Bayero University Kano students
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
