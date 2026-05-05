import React from "react";
import { Link } from "react-router-dom";
import VoiceCallButton from "../components/VoiceCallButton";

const TEAM = [
  {
    key: "simi",
    name: "Simi",
    role: "Founder & Creative Director",
    email: "sitfa92@gmail.com",
    bio: "Handles creative direction, talent strategy, and overall agency vision.",
    initial: "S",
  },
  {
    key: "chizzy",
    name: "Chizzy",
    role: "Talent Agent",
    email: "chizzyboi72@gmail.com",
    bio: "Manages bookings, client relationships, and day-to-day model placement.",
    initial: "C",
  },
  {
    key: "mj",
    name: "MJ",
    role: "Virtual Assistant",
    email: "marthajohn223355@gmail.com",
    bio: "Supports scheduling, follow-ups, onboarding coordination, and admin tasks.",
    initial: "M",
  },
];

const C = {
  ink: "#111111", slate: "#4a4a4a", dust: "#888888",
  smoke: "#e8e4dc", ivory: "#faf8f4", canvas: "#f5f2ec",
  white: "#ffffff", gold: "#c9a84c",
};

export default function ContactTeam() {
  return (
    <div style={{ minHeight: "100vh", background: C.canvas, padding: "0 0 80px" }}>
      {/* Header bar */}
      <div style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${C.smoke}`, padding: "18px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <Link to="/" style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 17, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", color: C.ink, textDecoration: "none" }}>
          Meet Serenity
        </Link>
        <Link to="/book" style={{ padding: "10px 20px", background: C.ink, color: C.white, borderRadius: 8, fontSize: 11, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", fontFamily: "'Inter',sans-serif", textDecoration: "none" }}>
          Book a Session
        </Link>
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "56px 24px 0" }}>
        {/* Hero copy */}
        <div style={{ marginBottom: 48, textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: C.gold, marginBottom: 12 }}>
            Our Team
          </div>
          <h1 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: "clamp(34px,5vw,54px)", fontWeight: 500, color: C.ink, letterSpacing: "-0.02em", margin: "0 0 16px", lineHeight: 1.1 }}>
            Talk to someone real.
          </h1>
          <p style={{ fontSize: 15, color: C.slate, lineHeight: 1.8, maxWidth: 520, margin: "0 auto" }}>
            Click any card below to start a voice call with Serenity, who will connect you with the right person. No phone number needed — just your browser mic.
          </p>
        </div>

        {/* Team cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 20 }}>
          {TEAM.map((member) => (
            <TeamCard key={member.key} member={member} />
          ))}
        </div>

        {/* Bottom note */}
        <div style={{ marginTop: 56, textAlign: "center", borderTop: `1px solid ${C.smoke}`, paddingTop: 28 }}>
          <p style={{ fontSize: 13, color: C.dust, marginBottom: 16, lineHeight: 1.7 }}>
            Prefer to book a session directly?
          </p>
          <Link
            to="/book"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 28px", background: C.ink, color: C.white, borderRadius: 10, fontSize: 12, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", fontFamily: "'Inter',sans-serif", textDecoration: "none" }}
          >
            ✦ Book a Consultation
          </Link>
        </div>

        <div style={{ marginTop: 40, textAlign: "center" }}>
          <p style={{ fontSize: 11, color: C.dust, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            © {new Date().getFullYear()} Meet Serenity · All rights reserved
          </p>
        </div>
      </div>
    </div>
  );
}

function TeamCard({ member }) {
  return (
    <div style={{
      background: C.white, border: `1px solid ${C.smoke}`, borderRadius: 16,
      padding: "28px 24px", boxShadow: "0 2px 12px rgba(17,17,17,0.06)",
      display: "flex", flexDirection: "column", gap: 16,
    }}>
      {/* Avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: "50%",
          background: `linear-gradient(135deg, ${C.gold}33, ${C.gold}88)`,
          border: `2px solid ${C.gold}55`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 22, fontWeight: 500, color: C.gold }}>
            {member.initial}
          </span>
        </div>
        <div>
          <p style={{ margin: 0, fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 20, fontWeight: 500, color: C.ink, lineHeight: 1.2 }}>
            {member.name}
          </p>
          <p style={{ margin: "3px 0 0", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.gold }}>
            {member.role}
          </p>
        </div>
      </div>

      {/* Bio */}
      <p style={{ fontSize: 13, color: C.slate, lineHeight: 1.7, margin: 0 }}>
        {member.bio}
      </p>

      {/* Call button */}
      <VoiceCallButton
        label={`Call ${member.name}`}
        metadata={{ contact_requested: member.name, contact_role: member.role, contact_email: member.email }}
      />
    </div>
  );
}
