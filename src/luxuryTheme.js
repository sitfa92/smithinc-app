// =========================================================
//  LUXURY DESIGN TOKENS — inline-style helpers
//  Used by all page components for consistent styling.
// =========================================================

export const lxColors = {
  ink:        "#111111",
  charcoal:   "#1c1c1c",
  slate:      "#4a4a4a",
  dust:       "#888888",
  smoke:      "#e8e4dc",
  ivory:      "#faf8f4",
  canvas:     "#f5f2ec",
  white:      "#ffffff",
  gold:       "#c9a84c",
  goldLight:  "rgba(201,168,76,0.10)",

  success:      "#1a6636",
  successBg:    "#edf7ee",
  successBr:    "rgba(26,102,54,0.18)",
  warning:      "#92560a",
  warningBg:    "#fef8ec",
  warningBr:    "rgba(146,86,10,0.20)",
  error:        "#9b1c1c",
  errorBg:      "#fef2f2",
  errorBr:      "rgba(155,28,28,0.20)",
  info:         "#1e3a5f",
  infoBg:       "#eff6ff",
  infoBr:       "rgba(30,58,95,0.15)",
  purple:       "#5b21b6",
  purpleBg:     "rgba(123,47,247,0.09)",
  purpleBr:     "rgba(123,47,247,0.20)",
};

export const lxFonts = {
  display: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
  sans:    "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
};

export const lxShadows = {
  xs: "0 1px 3px rgba(17,17,17,0.05)",
  sm: "0 2px 10px rgba(17,17,17,0.07)",
  md: "0 6px 24px rgba(17,17,17,0.10)",
  lg: "0 16px 60px rgba(17,17,17,0.14)",
};

// ─── Reusable style objects ─────────────────────────────
export const S = {
  // Page container
  page: {
    padding: "40px 36px",
    maxWidth: 1100,
    margin: "0 auto",
    animation: "lx-fadein 0.32s cubic-bezier(0.4,0,0.2,1) both",
  },

  // Card
  card: {
    background: "#ffffff",
    border: "1px solid #e8e4dc",
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
    boxShadow: "0 1px 3px rgba(17,17,17,0.05)",
    transition: "box-shadow 0.22s ease",
  },

  // Typography
  pageTitle: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: "clamp(26px, 4vw, 40px)",
    fontWeight: 400,
    color: "#111111",
    letterSpacing: "-0.03em",
    marginBottom: 4,
  },
  pageSub: {
    color: "#888888",
    fontSize: 14,
    marginBottom: 32,
  },
  sectionTitle: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: 20,
    fontWeight: 500,
    color: "#111111",
    letterSpacing: "-0.01em",
    marginBottom: 0,
  },
  label: {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.11em",
    textTransform: "uppercase",
    color: "#888888",
    marginBottom: 6,
  },

  // Inputs
  input: (extra = {}) => ({
    width: "100%",
    padding: "12px 14px",
    fontSize: 14,
    color: "#111111",
    background: "#ffffff",
    border: "1px solid #e8e4dc",
    borderRadius: 8,
    outline: "none",
    fontFamily: "'Inter', sans-serif",
    boxSizing: "border-box",
    transition: "border-color 0.2s, box-shadow 0.2s",
    ...extra,
  }),
  select: (extra = {}) => ({
    width: "100%",
    padding: "12px 14px",
    fontSize: 14,
    color: "#111111",
    background: "#ffffff",
    border: "1px solid #e8e4dc",
    borderRadius: 8,
    outline: "none",
    fontFamily: "'Inter', sans-serif",
    boxSizing: "border-box",
    appearance: "none",
    cursor: "pointer",
    ...extra,
  }),
  textarea: (extra = {}) => ({
    width: "100%",
    padding: "12px 14px",
    fontSize: 14,
    color: "#111111",
    background: "#ffffff",
    border: "1px solid #e8e4dc",
    borderRadius: 8,
    outline: "none",
    fontFamily: "'Inter', sans-serif",
    resize: "vertical",
    ...extra,
  }),

  // Buttons
  btn: (variant = "primary", extra = {}) => {
    const base = {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      padding: "11px 22px",
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      border: "none",
      borderRadius: 8,
      cursor: "pointer",
      fontFamily: "'Inter', sans-serif",
      whiteSpace: "nowrap",
      transition: "all 0.22s cubic-bezier(0.4,0,0.2,1)",
    };
    const variants = {
      primary: { background: "#111111", color: "#ffffff" },
      outline:  { background: "transparent", color: "#111111", border: "1px solid #e8e4dc" },
      ghost:    { background: "transparent", color: "#4a4a4a", border: "none" },
      danger:   { background: "#fef2f2", color: "#9b1c1c", border: "1px solid rgba(155,28,28,0.2)" },
      gold:     { background: "#c9a84c", color: "#ffffff" },
      success:  { background: "#edf7ee", color: "#1a6636", border: "1px solid rgba(26,102,54,0.18)" },
      info:     { background: "#eff6ff", color: "#1e3a5f", border: "1px solid rgba(30,58,95,0.15)" },
    };
    return { ...base, ...(variants[variant] || variants.primary), ...extra };
  },

  btnDisabled: { opacity: 0.38, cursor: "not-allowed" },

  // Badge
  badge: (status, extra = {}) => {
    const map = {
      pending:     { bg: "rgba(201,168,76,0.10)",    color: "#92560a",  br: "rgba(146,86,10,0.2)" },
      approved:    { bg: "#edf7ee",                  color: "#1a6636",  br: "rgba(26,102,54,0.18)" },
      active:      { bg: "#edf7ee",                  color: "#1a6636",  br: "rgba(26,102,54,0.18)" },
      completed:   { bg: "#edf7ee",                  color: "#1a6636",  br: "rgba(26,102,54,0.18)" },
      done:        { bg: "#edf7ee",                  color: "#1a6636",  br: "rgba(26,102,54,0.18)" },
      paid:        { bg: "#edf7ee",                  color: "#1a6636",  br: "rgba(26,102,54,0.18)" },
      rejected:    { bg: "#fef2f2",                  color: "#9b1c1c",  br: "rgba(155,28,28,0.2)" },
      cancelled:   { bg: "#fef2f2",                  color: "#9b1c1c",  br: "rgba(155,28,28,0.2)" },
      error:       { bg: "#fef2f2",                  color: "#9b1c1c",  br: "rgba(155,28,28,0.2)" },
      high:        { bg: "#fef2f2",                  color: "#9b1c1c",  br: "rgba(155,28,28,0.2)" },
      confirmed:   { bg: "#eff6ff",                  color: "#1e3a5f",  br: "rgba(30,58,95,0.15)" },
      in_progress: { bg: "#eff6ff",                  color: "#1e3a5f",  br: "rgba(30,58,95,0.15)" },
      sent:        { bg: "#eff6ff",                  color: "#1e3a5f",  br: "rgba(30,58,95,0.15)" },
      info:        { bg: "#eff6ff",                  color: "#1e3a5f",  br: "rgba(30,58,95,0.15)" },
      success:     { bg: "#edf7ee",                  color: "#1a6636",  br: "rgba(26,102,54,0.18)" },
      warning:     { bg: "#fef8ec",                  color: "#92560a",  br: "rgba(146,86,10,0.2)" },
      inactive:    { bg: "#faf8f4",                  color: "#888888",  br: "#e8e4dc" },
      lead:        { bg: "rgba(201,168,76,0.10)",    color: "#92560a",  br: "rgba(146,86,10,0.2)" },
      medium:      { bg: "rgba(201,168,76,0.10)",    color: "#92560a",  br: "rgba(146,86,10,0.2)" },
      low:         { bg: "#faf8f4",                  color: "#888888",  br: "#e8e4dc" },
      churned:     { bg: "#fef2f2",                  color: "#9b1c1c",  br: "rgba(155,28,28,0.2)" },
      manychat:    { bg: "rgba(123,47,247,0.09)",    color: "#5b21b6",  br: "rgba(123,47,247,0.2)" },
    };
    const s = map[status] || { bg: "#faf8f4", color: "#888888", br: "#e8e4dc" };
    return {
      display: "inline-flex",
      alignItems: "center",
      padding: "3px 10px",
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.05em",
      textTransform: "uppercase",
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.br}`,
      whiteSpace: "nowrap",
      ...extra,
    };
  },

  // Setup/info banner
  banner: (type = "warn") => {
    const map = {
      warn:    { bg: "#fef8ec", br: "rgba(146,86,10,0.20)",  color: "#92560a" },
      error:   { bg: "#fef2f2", br: "rgba(155,28,28,0.20)",  color: "#9b1c1c" },
      info:    { bg: "#eff6ff", br: "rgba(30,58,95,0.15)",   color: "#1e3a5f" },
      success: { bg: "#edf7ee", br: "rgba(26,102,54,0.18)",  color: "#1a6636" },
      purple:  { bg: "rgba(123,47,247,0.09)", br: "rgba(123,47,247,0.2)", color: "#5b21b6" },
    };
    const s = map[type] || map.warn;
    return {
      background: s.bg,
      border: `1px solid ${s.br}`,
      borderRadius: 12,
      padding: "20px 24px",
      marginBottom: 24,
      color: s.color,
    };
  },

  // Error inline
  errorBox: {
    background: "#fef2f2",
    border: "1px solid rgba(155,28,28,0.2)",
    borderRadius: 8,
    padding: "11px 14px",
    color: "#9b1c1c",
    fontSize: 13,
    marginBottom: 16,
  },

  // Divider
  divider: {
    border: "none",
    borderTop: "1px solid #e8e4dc",
    margin: "28px 0",
  },

  // Muted text
  muted: { color: "#888888", fontSize: 13 },

  // Stat grid
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 16,
    marginBottom: 32,
  },
  statCard: {
    background: "#ffffff",
    border: "1px solid #e8e4dc",
    borderRadius: 12,
    padding: "22px 18px",
    boxShadow: "0 1px 3px rgba(17,17,17,0.05)",
    textAlign: "center",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#888888",
    marginBottom: 10,
  },
  statValue: (color = "#111111") => ({
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: 36,
    fontWeight: 500,
    color,
    lineHeight: 1,
  }),
};

// ─── Responsive mobile padding ──────────────────────────
export const mobilePage = {
  padding: "24px 16px",
  maxWidth: 1100,
  margin: "0 auto",
};
