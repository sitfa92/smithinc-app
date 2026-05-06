import React from "react";
import { Link } from "react-router-dom";

const INSIGHT_LINKS = [
  { to: "/insights/model-development-nigeria", label: "Model Development in Nigeria" },
  { to: "/insights/model-development-kenya", label: "Model Development in Kenya" },
  { to: "/insights/model-development-uk", label: "Model Development in the UK" },
  { to: "/insights/model-development-uganda", label: "Model Development in Uganda" },
  { to: "/insights/model-development-ivory-coast", label: "Model Development in Ivory Coast" },
  { to: "/insights/fashion-consulting-us", label: "Fashion Consulting in the US" },
  { to: "/insights/partner-consulting-playbook", label: "Partner Consulting Playbook" },
  { to: "/insights/booking-operations-guide", label: "Booking Operations Guide" },
  { to: "/insights/casting-prep-checklist", label: "Casting Prep Checklist" },
  { to: "/insights/brand-ambassador-growth", label: "Brand Ambassador Growth Strategy" },
];

export default function SeoTopicCluster({ title = "Explore growth guides" }) {
  return (
    <section style={{ marginTop: 18, borderTop: "1px solid #e8e4dc", paddingTop: 14 }}>
      <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888" }}>
        {title}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {INSIGHT_LINKS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            style={{ textDecoration: "none", padding: "8px 10px", borderRadius: 8, border: "1px solid #e8e4dc", color: "#111", fontSize: 12 }}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
