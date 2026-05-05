import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./auth";
import { useAuth } from "./auth";
import Nav from "./components/Nav";
import RoleRoute from "./components/RoleRoute";

// ── Error Boundary — prevents entire app crash from showing a blank screen ──
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(err, info) {
    console.error("App Error Boundary caught:", err, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: "center", fontFamily: "'Inter', sans-serif", color: "#4a4a4a" }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>✦</div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, color: "#111", marginBottom: 8 }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: "10px 24px", background: "#111", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
const WorkflowDashboard = React.lazy(() => import("./components/WorkflowDashboard"));

const Login = React.lazy(() => import("./pages/Login"));
const ModelSignup = React.lazy(() => import("./pages/ModelSignup"));
const PublicBooking = React.lazy(() => import("./pages/PublicBooking"));
const PublicPartnerSubmission = React.lazy(() => import("./pages/PublicPartnerSubmission"));
const PublicBrandAmbassadorSubmission = React.lazy(() => import("./pages/PublicBrandAmbassadorSubmission"));
const Portfolio = React.lazy(() => import("./pages/Portfolio"));
const DigitalsUpload = React.lazy(() => import("./pages/DigitalsUpload"));
const PortfolioUpload = React.lazy(() => import("./pages/PortfolioUpload"));
const EventResponse = React.lazy(() => import("./pages/EventResponse"));
const Onboarding = React.lazy(() => import("./pages/Onboarding"));
const ModelDevelopment = React.lazy(() => import("./pages/ModelDevelopment"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Models = React.lazy(() => import("./pages/Models"));
const ModelPipeline = React.lazy(() => import("./pages/ModelPipeline"));
const Submissions = React.lazy(() => import("./pages/Submissions"));
const AdminBookings = React.lazy(() => import("./pages/AdminBookings"));
const Partners = React.lazy(() => import("./pages/Partners"));
const PartnerPipeline = React.lazy(() => import("./pages/PartnerPipeline"));
const PartnerSubmissions = React.lazy(() => import("./pages/PartnerSubmissions"));
const BrandAmbassadors = React.lazy(() => import("./pages/BrandAmbassadors"));
const BrandAmbassadorPipeline = React.lazy(() => import("./pages/BrandAmbassadorPipeline"));
const BrandAmbassadorSubmissions = React.lazy(() => import("./pages/BrandAmbassadorSubmissions"));
const Analytics = React.lazy(() => import("./pages/Analytics"));
const Integrations = React.lazy(() => import("./pages/Integrations"));
const Team = React.lazy(() => import("./pages/Team"));
const TeamDocs = React.lazy(() => import("./pages/TeamDocs"));
const Notifications = React.lazy(() => import("./pages/Notifications"));
const ContactTeam = React.lazy(() => import("./pages/ContactTeam"));

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
      <AppErrorBoundary>
        <React.Suspense fallback={<PageFallback />}>
          <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
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
            path="/partners"
            element={
              <RoleRoute routeKey="partners">
                <Partners />
              </RoleRoute>
            }
          />
          <Route
            path="/partner-pipeline"
            element={
              <RoleRoute routeKey="partner-pipeline">
                <PartnerPipeline />
              </RoleRoute>
            }
          />
          <Route path="/clients" element={<Navigate to="/partners" replace />} />
          <Route path="/client-pipeline" element={<Navigate to="/partner-pipeline" replace />} />
          <Route
            path="/partner-submissions"
            element={
              <RoleRoute routeKey="partner-submissions">
                <PartnerSubmissions />
              </RoleRoute>
            }
          />
          <Route
            path="/brand-ambassadors"
            element={
              <RoleRoute routeKey="brand-ambassadors">
                <BrandAmbassadors />
              </RoleRoute>
            }
          />
          <Route
            path="/brand-ambassador-pipeline"
            element={
              <RoleRoute routeKey="brand-ambassador-pipeline">
                <BrandAmbassadorPipeline />
              </RoleRoute>
            }
          />
          <Route
            path="/brand-ambassador-submissions"
            element={
              <RoleRoute routeKey="brand-ambassador-submissions">
                <BrandAmbassadorSubmissions />
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
          <Route path="/team-docs" element={<TeamDocs />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </React.Suspense>
      </AppErrorBoundary>
    </>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppErrorBoundary>
          <React.Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<ModelDevelopment />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/login" element={<Login />} />
              <Route path="/model-development" element={<ModelDevelopment />} />
              <Route path="/model-signup" element={<ModelSignup />} />
              <Route path="/book" element={<PublicBooking />} />
              <Route path="/partner-submit" element={<PublicPartnerSubmission />} />
              <Route path="/brand-ambassador-submit" element={<PublicBrandAmbassadorSubmission />} />
              <Route path="/talent/:id" element={<Portfolio />} />
              <Route path="/contact-team" element={<ContactTeam />} />
              <Route path="/digitals/:id" element={<DigitalsUpload />} />
              <Route path="/portfolio/:id" element={<PortfolioUpload />} />
              <Route path="/event-response" element={<EventResponse />} />
              <Route path="/*" element={<ProtectedApp />} />
            </Routes>
          </React.Suspense>
        </AppErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
