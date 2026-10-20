import { Link } from "react-router-dom";
import { ArrowLeft, HelpCircle, LogIn, MapPin } from "lucide-react";
import MapPage from "./MapPage";

export default function PublicCampusMap() {
  return (
    <div className="min-h-screen bg-sky-50">
      <header className="border-b border-blue-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-blue-700"
          >
            <ArrowLeft size={17} />
            <span className="hidden sm:inline">BUK Campus Assistant System</span>
            <span className="sm:hidden">Home</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              to="/faqs"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium text-blue-700 hover:bg-blue-50"
            >
              <HelpCircle size={17} />
              FAQs
            </Link>
            <Link
              to="/login"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <LogIn size={17} />
              Sign in
            </Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 pt-5 text-sm font-semibold text-blue-800 sm:px-6">
        <MapPin size={18} />
        Public campus map
        <span className="font-normal text-slate-500">· Browse locations without signing in</span>
      </div>
      <MapPage />
    </div>
  );
}
