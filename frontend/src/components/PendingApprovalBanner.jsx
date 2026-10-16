/* eslint-disable no-unused-vars */
import { useState } from "react";
import { AlertTriangle, Clock, X, CheckCircle, Mail, Moon, Sun } from "lucide-react";

const PendingApprovalBanner = ({ user }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  if (!user || user.is_approved || !isVisible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 animate-slideDown">
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 dark:from-blue-800 dark:via-blue-900 dark:to-indigo-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-full animate-pulse">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-sm md:text-base">
                  Account Pending Approval
                </p>
                <p className="text-xs md:text-sm text-blue-100">
                  You can browse but cannot use services yet.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="hidden sm:flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-sm transition-all"
              >
                <AlertTriangle className="w-4 h-4" />
                {showDetails ? "Hide" : "Details"}
              </button>

              <button
                onClick={() => setIsVisible(false)}
                className="p-1.5 hover:bg-white/20 rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {showDetails && (
            <div className="mt-3 pt-3 border-t border-white/20 animate-fadeIn">
              <div className="grid md:grid-cols-3 gap-3 text-sm">
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-medium">Allowed</span>
                  </div>
                  <p className="text-blue-100 text-xs">
                    Browse dashboard and campus information.
                  </p>
                </div>
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium">Restricted</span>
                  </div>
                  <p className="text-blue-100 text-xs">
                    AI Chat, Quizzes, Study Planner, Uploads.
                  </p>
                </div>
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Mail className="w-4 h-4" />
                    <span className="font-medium">Next Step</span>
                  </div>
                  <p className="text-blue-100 text-xs">
                    Wait for admin approval to unlock everything.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PendingApprovalBanner;
