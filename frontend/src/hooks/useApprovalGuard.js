import { useCallback, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const useApprovalGuard = () => {
  const { isLoggedIn, isApproved, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [showLockedModal, setShowLockedModal] = useState(false);
  const [lockedFeatureName, setLockedFeatureName] = useState("");

  const guard = useCallback((featureName = "this feature") => {
    if (!isLoggedIn) {
      navigate("/login");
      return false;
    }

    if (isAdmin || isApproved) return true;

    setLockedFeatureName(featureName);
    setShowLockedModal(true);
    return false;
  }, [isAdmin, isApproved, isLoggedIn, navigate]);

  const closeModal = useCallback(() => {
    setShowLockedModal(false);
    setLockedFeatureName("");
  }, []);

  return {
    guard,
    showLockedModal,
    lockedFeatureName,
    closeModal,
    isApproved,
    isAdmin,
  };
};

export default useApprovalGuard;
