import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./auth";
import { useAuth } from "./auth";
import Nav from "./components/Nav";
import RoleRoute from "./components/RoleRoute";
const WorkflowDashboard = React.lazy(() => import("./components/WorkflowDashboard"));

const Login = React.lazy(() => import("./pages/Login"));
const ModelSignup = React.lazy(() => import("./pages/ModelSignup"));
const PublicBooking = React.lazy(() => import("./pages/PublicBooking"));
const Portfolio = React.lazy(() => import("./pages/Portfolio"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Models = React.lazy(() => import("./pages/Models"));
const ModelPipeline = React.lazy(() => import("./pages/ModelPipeline"));
const Submissions = React.lazy(() => import("./pages/Submissions"));
const AdminBookings = React.lazy(() => import("./pages/AdminBookings"));
const Clients = React.lazy(() => import("./pages/Clients"));
const Analytics = React.lazy(() => import("./pages/Analytics"));
const Integrations = React.lazy(() => import("./pages/Integrations"));
const Team = React.lazy(() => import("./pages/Team"));
const Notifications = React.lazy(() => import("./pages/Notifications"));

const PageFallback = () => (
  <div style={{ padding: 40, textAlign: "center" }}>
    <p>Loading...</p>
  </div>
);

const ProtectedApp = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p>Loading session...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <>
      <Nav />
      <React.Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route
            path="/models"
            element={
              <RoleRoute routeKey="models">
                <Models />
              </RoleRoute>
            }
          />
          <Route
            path="/model-pipeline"
            element={
              <RoleRoute routeKey="model-pipeline">
                <ModelPipeline />
              </RoleRoute>
            }
          />
          <Route
            path="/submissions"
            element={
              <RoleRoute routeKey="submissions">
                <Submissions />
              </RoleRoute>
            }
          />
          <Route
            path="/bookings"
            element={
              <RoleRoute routeKey="bookings">
                <AdminBookings />
              </RoleRoute>
            }
          />
          <Route
            path="/clients"
            element={
              <RoleRoute routeKey="clients">
                <Clients />
              </RoleRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <RoleRoute routeKey="analytics">
                <Analytics />
              </RoleRoute>
            }
          />
          <Route
            path="/integrations"
            element={
              <RoleRoute routeKey="integrations">
                <Integrations />
              </RoleRoute>
            }
          />
          <Route
            path="/workflows"
            element={
              <RoleRoute routeKey="workflows">
                <WorkflowDashboard />
              </RoleRoute>
            }
          />
          <Route path="/team" element={<RoleRoute routeKey="team"><Team /></RoleRoute>} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </React.Suspense>
    </>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <React.Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/model-signup" element={<ModelSignup />} />
            <Route path="/book" element={<PublicBooking />} />
            <Route path="/talent/:id" element={<Portfolio />} />
            <Route path="/*" element={<ProtectedApp />} />
          </Routes>
        </React.Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
