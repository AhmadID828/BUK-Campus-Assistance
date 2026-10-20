import { useState, useMemo, useEffect } from "react";
import {
  HelpCircle,
  Search,
  ChevronDown,
  ChevronUp,
  MapPin,
  MessageCircle,
  ArrowLeft,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { useAuth } from "../context/AuthContext";

const fallbackFaqs = [
  {
    id: "registration",
    category: "registration",
    question: "How do I register as a student?",
    answer: "Complete the registration form with your student details and wait for administrator approval.",
  },
  {
    id: "campus-map",
    category: "navigation",
    question: "Where can I find campus locations?",
    answer: "Open the Campus Map from the student navigation menu to view important campus locations.",
  },
  {
    id: "emergency",
    category: "emergency",
    question: "How do I find emergency contacts?",
    answer: "Open Emergency Contacts from the student navigation menu for the latest campus support numbers.",
  },
];

function FAQs() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, isAdmin } = useAuth();
  const [faqs, setFaqs] = useState(fallbackFaqs);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    fetch(`${API_BASE_URL}/faqs/`)
      .then((response) => {
        if (!response.ok) throw new Error("Campus FAQs are temporarily unavailable.");
        return response.json();
      })
      .then((data) => {
        if (data?.faqs?.length) setFaqs(data.faqs);
        setLoadError("");
      })
      .catch((error) => setLoadError(error.message));
  }, []);

  const filtered = useMemo(() => {
    let result = faqs;

    if (selectedCategory !== "all") {
      result = result.filter((f) => f.category === selectedCategory);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((f) => {
        const question = String(f.question || "").toLowerCase();
        const answer = String(f.answer || "").toLowerCase();
        return question.includes(q) || answer.includes(q);
      });
    }

    return result;
  }, [search, selectedCategory, faqs]);

  const categories = [
    { id: "all", label: "All" },
    { id: "registration", label: "Registration" },
    { id: "hostel", label: "Hostel" },
    { id: "academic", label: "Academic" },
    { id: "student_affairs", label: "Student Affairs" },
    { id: "navigation", label: "Navigation" },
    { id: "emergency", label: "Emergency" },
  ];

  const toggle = (id) => {
    setOpenId((currentId) => (currentId === id ? null : id));
  };

  const goBack = () => {
    if (location.key !== "default") {
      navigate(-1);
      return;
    }

    navigate(isLoggedIn ? (isAdmin ? "/admin" : "/dashboard") : "/");
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
      {/* Header */}
      <div className="mb-6">
        <button
          type="button"
          onClick={goBack}
          className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-blue-50 hover:text-blue-700 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <ArrowLeft size={18} />
          Back
        </button>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <HelpCircle className="text-blue-600" size={26} />
          Campus FAQs
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Quick answers to common administrative and campus questions
        </p>
        <Link
          to="/locations"
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
        >
          <MapPin size={16} />
          Explore campus map
        </Link>
        <Link
          to="/chat"
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
        >
          <MessageCircle size={16} />
          Ask the AI campus assistant
        </Link>
      </div>

      {loadError && (
        <p role="status" className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {loadError} Showing general FAQs for now.
        </p>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          placeholder="Search questions or answers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-blue-100 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
        />
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-5 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition ${
              selectedCategory === cat.id
                ? "bg-blue-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-blue-50"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* FAQ List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-blue-100">
          <HelpCircle className="mx-auto text-blue-300 mb-3" size={40} />
          <p className="text-slate-600 font-medium">No FAQs found</p>
          <p className="text-sm text-slate-400 mt-1">
            Try a different search or category
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((faq) => {
            const isOpen = openId === faq.id;
            return (
              <div
                key={faq.id}
                className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => toggle(faq.id)}
                  className="w-full flex items-start justify-between gap-3 px-5 py-4 text-left hover:bg-blue-50/50 transition"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 text-sm leading-snug">
                      {faq.question}
                    </p>
                    {faq.category && (
                      <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[11px] font-medium capitalize">
                        {faq.category.replace("_", " ")}
                      </span>
                    )}
                  </div>
                  {isOpen ? (
                    <ChevronUp size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <ChevronDown size={18} className="text-slate-400 flex-shrink-0 mt-0.5" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-5 pb-4 pt-0">
                    <div className="text-sm text-slate-600 leading-relaxed border-t border-blue-50 pt-3 whitespace-pre-wrap">
                      {faq.answer}
                    </div>

                    {faq.related_location_id && (
                      <Link
                        to="/locations"
                        className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-blue-600 hover:underline"
                      >
                        <MapPin size={13} />
                        View on Campus Map
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
 
export default FAQs;