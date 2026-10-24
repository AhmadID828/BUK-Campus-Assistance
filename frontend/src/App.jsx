import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { MaterialUploadProvider } from "./context/MaterialUploadContext";
import { ThemeProvider } from "./context/ThemeContext";
import ThemeSwitcher from "./components/ThemeSwitcher";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminLayout from "./layouts/AdminLayout";
import StudentLayout from "./layouts/StudentLayout";
import Dashboard from "./pages/Dashboard";
import EmergencyContacts from "./pages/EmergencyContacts";
import EventsPage from "./pages/EventsPage";
import FAQs from "./pages/FAQs";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import MapPage from "./pages/MapPage";
import PublicCampusMap from "./pages/PublicCampusMap";
import MaterialsPage from "./pages/MaterialsPage";
import PlannerPage from "./pages/PlannerPage";
import Profile from "./pages/Profile";
import QuizPage from "./pages/QuizPage";
import Signup from "./pages/Signup";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ManageEmergencyContacts from "./pages/admin/ManageEmergencyContacts";
import ManageAdmins from "./pages/admin/ManageAdmins";
import ManageEvents from "./pages/admin/ManageEvents";
import ManageLocations from "./pages/admin/ManageLocations";
import PendingApprovals from "./pages/admin/PendingApprovals";
import StatisticsPage from "./pages/admin/StatisticsPage";
import StudentsPage from "./pages/admin/StudentsPage";
import ManageFAQs from "./pages/admin/ManageFAQs";
import WelcomePage from "./pages/WelcomePage";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <MaterialUploadProvider>
            <Routes>
              <Route
                path="/"
                element={<WelcomePage />}
              />
              <Route path="/login" element={<Login />} />
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
