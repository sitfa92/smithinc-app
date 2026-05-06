import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./auth";
import { useAuth } from "./auth";
import Nav from "./components/Nav";
import RoleRoute from "./components/RoleRoute";
import { getArticleFaqBySlug } from "./content/insights";
import {
  BOOKING_FAQ_ENTITIES,
  DEFAULT_META,
  MODEL_DEVELOPMENT_FAQ_ENTITIES,
  PUBLIC_ROUTE_META,
  TALENT_ROUTE_META,
} from "./content/routeSeo";

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
const LegalAssistant = React.lazy(() => import("./pages/LegalAssistant"));
const VoiceReviews = React.lazy(() => import("./pages/VoiceReviews"));
const LeaveReview = React.lazy(() => import("./pages/LeaveReview"));
const InsightsHub = React.lazy(() => import("./pages/InsightsHub"));
const InsightsArticle = React.lazy(() => import("./pages/InsightsArticle"));

const PRIVATE_ROUTE_PREFIXES = [
  "/dashboard",
  "/models",
  "/model-pipeline",
  "/submissions",
  "/bookings",
  "/partners",
  "/partner-pipeline",
  "/partner-submissions",
  "/brand-ambassadors",
  "/brand-ambassador-pipeline",
  "/brand-ambassador-submissions",
  "/analytics",
  "/integrations",
  "/voice-reviews",
  "/workflows",
  "/team",
  "/notifications",
  "/onboarding",
  "/digitals",
  "/portfolio",
  "/event-response",
];

const upsertMeta = (selector, attributes) => {
  let node = document.head.querySelector(selector);
  if (!node) {
    node = document.createElement("meta");
    if (attributes.name) node.setAttribute("name", attributes.name);
    if (attributes.property) node.setAttribute("property", attributes.property);
    document.head.appendChild(node);
  }
  Object.entries(attributes).forEach(([key, value]) => {
    if (value == null) return;
    node.setAttribute(key, String(value));
  });
};

const upsertLink = (rel, href) => {
  let node = document.head.querySelector(`link[rel="${rel}"]`);
  if (!node) {
    node = document.createElement("link");
    node.setAttribute("rel", rel);
    document.head.appendChild(node);
  }
  node.setAttribute("href", href);
};

const upsertJsonLd = (id, payload) => {
  let node = document.head.querySelector(`script#${id}`);
  if (!node) {
    node = document.createElement("script");
    node.setAttribute("type", "application/ld+json");
    node.setAttribute("id", id);
    document.head.appendChild(node);
  }
  node.textContent = JSON.stringify(payload);
};

const removeJsonLd = (id) => {
  const node = document.head.querySelector(`script#${id}`);
  if (node) node.remove();
};

function RouteSeo() {
  const location = useLocation();

  React.useEffect(() => {
    const path = location.pathname || "/";
    const isTalentRoute = path.startsWith("/talent/");
    const isPrivate = PRIVATE_ROUTE_PREFIXES.some((prefix) => path.startsWith(prefix));
    const routeMeta = PUBLIC_ROUTE_META[path] || (isTalentRoute ? TALENT_ROUTE_META : null);

    const defaultMeta = {
      ...DEFAULT_META,
      robots: isPrivate ? "noindex, nofollow" : "index, follow",
    };

    const meta = routeMeta || defaultMeta;
    const canonicalUrl = `${window.location.origin}${path}`;

    document.title = meta.title;
    upsertMeta('meta[name="description"]', { name: "description", content: meta.description });
    upsertMeta('meta[name="robots"]', { name: "robots", content: meta.robots });
    upsertMeta('meta[property="og:title"]', { property: "og:title", content: meta.title });
    upsertMeta('meta[property="og:description"]', { property: "og:description", content: meta.description });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: meta.title });
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: meta.description });
    upsertLink("canonical", canonicalUrl);

    if (path === "/book") {
      upsertJsonLd("route-faq-jsonld", {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: BOOKING_FAQ_ENTITIES,
      });
      removeJsonLd("route-article-jsonld");
      removeJsonLd("route-breadcrumb-jsonld");
    } else if (path === "/model-development" || path === "/") {
      upsertJsonLd("route-faq-jsonld", {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: MODEL_DEVELOPMENT_FAQ_ENTITIES,
      });
      removeJsonLd("route-article-jsonld");
      removeJsonLd("route-breadcrumb-jsonld");
    } else if (path.startsWith("/insights/") && path !== "/insights") {
      const slug = path.split("/").filter(Boolean)[1] || "insight";
      const faq = getArticleFaqBySlug(slug);
      upsertJsonLd("route-article-jsonld", {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: meta.title,
        description: meta.description,
        author: {
          "@type": "Organization",
          name: "Smith Inc",
        },
        publisher: {
          "@type": "Organization",
          name: "Meet Serenity",
          logo: {
            "@type": "ImageObject",
            url: `${window.location.origin}/favicon.svg`,
          },
        },
        mainEntityOfPage: canonicalUrl,
        dateModified: "2026-05-06",
        articleSection: "Model Growth Insights",
        keywords: [slug.replace(/-/g, " "), "model development", "fashion consulting", "booking readiness"],
      });
      upsertJsonLd("route-breadcrumb-jsonld", {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${window.location.origin}/` },
          { "@type": "ListItem", position: 2, name: "Insights", item: `${window.location.origin}/insights` },
          { "@type": "ListItem", position: 3, name: meta.title, item: canonicalUrl },
        ],
      });
      if (faq.length) {
        upsertJsonLd("route-faq-jsonld", {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: {
              "@type": "Answer",
              text: item.a,
            },
          })),
        });
      } else {
        removeJsonLd("route-faq-jsonld");
      }
    } else {
      removeJsonLd("route-faq-jsonld");
      removeJsonLd("route-article-jsonld");
      removeJsonLd("route-breadcrumb-jsonld");
    }
  }, [location.pathname]);

  return null;
}

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
          <Route
            path="/voice-reviews"
            element={
              <RoleRoute routeKey="voice-reviews">
                <VoiceReviews />
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
      <RouteSeo />
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
              <Route path="/leave-review" element={<LeaveReview />} />
              <Route path="/legal-attorney-ai" element={<LegalAssistant />} />
              <Route path="/insights" element={<InsightsHub />} />
              <Route path="/insights/:slug" element={<InsightsArticle />} />
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
