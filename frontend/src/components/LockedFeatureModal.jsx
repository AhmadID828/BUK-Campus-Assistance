import { Lock, X, Mail, ShieldAlert } from "lucide-react";


const LockedFeatureModal = ({ isOpen, onClose, featureName = "this feature" }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-scaleIn">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2.5 rounded-full">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Feature Locked</h3>
                <p className="text-blue-100 text-sm">Pending Approval</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <ShieldAlert className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
              You cannot use <span className="font-semibold text-gray-900 dark:text-white">{featureName}</span> yet because your account is still pending admin approval.
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-5">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Once an administrator approves your account, you will get full access to all features including AI Chat, Quizzes, Study Planner, and more.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl font-medium transition"
            >
              Got it
            </button>
            <button
              onClick={() => {
                // You can trigger a request email here later
                alert("We will notify you when your account is approved.");
                onClose();
              }}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl font-medium transition flex items-center justify-center gap-2"
            >
              <Mail className="w-4 h-4" />
              Notify Me
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LockedFeatureModal;
