import { Component, lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { MaterialUploadProvider } from "./context/MaterialUploadContext";
import { ThemeProvider } from "./context/ThemeContext";
import ThemeSwitcher from "./components/ThemeSwitcher";
import ProtectedRoute from "./components/ProtectedRoute";

const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
const StudentLayout = lazy(() => import("./layouts/StudentLayout"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const EmergencyContacts = lazy(() => import("./pages/EmergencyContacts"));
const EventsPage = lazy(() => import("./pages/EventsPage"));
const FAQs = lazy(() => import("./pages/FAQs"));
const Chat = lazy(() => import("./pages/Chat"));
const Login = lazy(() => import("./pages/Login"));
const AdminPasswordSetup = lazy(() => import("./pages/AdminPasswordSetup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const MapPage = lazy(() => import("./pages/MapPage"));
const PublicCampusMap = lazy(() => import("./pages/PublicCampusMap"));
const MaterialsPage = lazy(() => import("./pages/MaterialsPage"));
const PlannerPage = lazy(() => import("./pages/PlannerPage"));
const Profile = lazy(() => import("./pages/Profile"));
const QuizPage = lazy(() => import("./pages/QuizPage"));
const Signup = lazy(() => import("./pages/Signup"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const ManageEmergencyContacts = lazy(() => import("./pages/admin/ManageEmergencyContacts"));
const ManageAdmins = lazy(() => import("./pages/admin/ManageAdmins"));
const ManageEvents = lazy(() => import("./pages/admin/ManageEvents"));
const ManageLocations = lazy(() => import("./pages/admin/ManageLocations"));
const PendingApprovals = lazy(() => import("./pages/admin/PendingApprovals"));
const StatisticsPage = lazy(() => import("./pages/admin/StatisticsPage"));
const StudentsPage = lazy(() => import("./pages/admin/StudentsPage"));
const ManageFAQs = lazy(() => import("./pages/admin/ManageFAQs"));
const WelcomePage = lazy(() => import("./pages/WelcomePage"));

function RouteLoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[40vh] items-center justify-center px-4 text-sm font-medium text-slate-600 dark:text-slate-300"
    >
      Loading page...
    </div>
  );
}

class RouteErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("Unable to load the requested page.", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center dark:bg-slate-950">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            This page could not be loaded
          </h1>
          <p className="max-w-md text-sm text-slate-600 dark:text-slate-300">
            Check your connection and reload the page to try again.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
          >
            Reload page
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <MaterialUploadProvider>
            <RouteErrorBoundary>
              <Suspense fallback={<RouteLoadingFallback />}>
                <Routes>
                  <Route
                    path="/"
                    element={<WelcomePage />}
                  />
                  <Route path="/login" element={<Login />} />
                  <Route path="/admin/set-password" element={<AdminPasswordSetup />} />
                  <Route
                    path="/admin/login"
                    element={<Navigate to="/login" replace />}
                  />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/faqs" element={<FAQs />} />
                  <Route path="/locations" element={<PublicCampusMap />} />
                  <Route
                    element={
                      <ProtectedRoute>
                        <StudentLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/materials" element={<MaterialsPage />} />
                    <Route path="/quiz" element={<QuizPage />} />
                    <Route
                      path="/planner"
                      element={
                        <ProtectedRoute
                          requireApproved
                          featureName="the Study Planner and Adaptive Planner"
                        >
                          <PlannerPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="/events" element={<EventsPage />} />
                    <Route
                      path="/chat"
                      element={
                        <ProtectedRoute requireApproved featureName="AI Chat">
                          <Chat />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="/emergency" element={<EmergencyContacts />} />
                    <Route path="/campus-map" element={<MapPage />} />
                  </Route>

                  <Route
                    element={
                      <ProtectedRoute requireAdmin>
                        <AdminLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/admin/students" element={<StudentsPage />} />
                    <Route path="/admin/admins" element={<ManageAdmins />} />
                    <Route path="/admin/register" element={<ManageAdmins />} />
                    <Route path="/admin/campus-faqs" element={<FAQs />} />
                    <Route path="/admin/pending" element={<PendingApprovals />} />
                    <Route path="/admin/statistics" element={<StatisticsPage />} />
                    <Route path="/admin/locations" element={<ManageLocations />} />
                    <Route path="/admin/events" element={<ManageEvents />} />
                    <Route path="/admin/faqs" element={<ManageFAQs />} />
                    <Route
                      path="/admin/emergency"
                      element={<ManageEmergencyContacts />}
                    />
                  </Route>

                  <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
              </Suspense>
            </RouteErrorBoundary>
            <div className="pointer-events-none fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] z-[600] sm:bottom-6 sm:right-6">
              <div className="pointer-events-auto">
                <ThemeSwitcher />
              </div>
            </div>
          </MaterialUploadProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
