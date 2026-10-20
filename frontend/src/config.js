export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";
const isLocalApi = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/i.test(
  API_BASE_URL,
);
export const CHIEF_ADMIN_EMAIL =
  import.meta.env.VITE_CHIEF_ADMIN_EMAIL ||
  (isLocalApi ? "admin@buk.edu.ng" : "aidsfaz@gmail.com");
