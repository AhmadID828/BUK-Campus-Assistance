export const canAccess = (user, requiredAttributes = {}) => {
  if (!user) return false;

  // Always allow admins (unless explicitly blocked)
  if (user.role === "admin") return true;

  // Check each required attribute
  for (const [key, value] of Object.entries(requiredAttributes)) {
    if (Array.isArray(value)) {
      // Example: level must be one of [300, 400]
      if (!value.includes(user[key])) return false;
    } else {
      if (user[key] !== value) return false;
    }
  }

  return true;
};
