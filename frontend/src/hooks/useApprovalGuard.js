import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";




const useApprovalGuard = () => {
  const { isLoggedIn, isApproved, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [showLockedModal, setShowLockedModal] = useState(false);
  const [lockedFeatureName, setLockedFeatureName] = useState("");

  const guard = (action, featureName = "this feature") => {
    return (...args) => {
      if (!isLoggedIn) {
        navigate("/login");
        return;
      }

      // Admins always have access
      if (isAdmin) {
        return action(...args);
      }

      // Students need approval
      if (!isApproved) {
        setLockedFeatureName(featureName);
        setShowLockedModal(true);
        return;
      }

      return action(...args);
    };
  };

  const closeModal = () => {
    setShowLockedModal(false);
    setLockedFeatureName("");
  };

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
