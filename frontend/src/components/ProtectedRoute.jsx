import { Navigate } from "react-router-dom";
import LockedFeatureModal from "./LockedFeatureModal";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({
  children,
  requireApproved = false,
  requireAdmin = false,
  featureName = "this page",
}) => {
  const { isLoggedIn, isApproved, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sky-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireApproved && !isApproved && !isAdmin) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-sky-50 dark:bg-gray-900">
          <div className="text-center p-6 max-w-md">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
              Access Restricted
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Your account is pending approval. You cannot access{" "}
              <strong>{featureName}</strong> yet.
            </p>
            <button
              onClick={() => (window.location.href = "/dashboard")}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        <LockedFeatureModal
          isOpen={true}
          onClose={() => (window.location.href = "/dashboard")}
          featureName={featureName}
        />
      </>
    );
  }

  return children;
};

export default ProtectedRoute;
