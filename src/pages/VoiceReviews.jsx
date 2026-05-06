import React from "react";
import { supabase } from "../supabase";

const C = {
  ink: "#111111",
  slate: "#4a4a4a",
  dust: "#888888",
  smoke: "#e8e4dc",
  ivory: "#faf8f4",
  white: "#ffffff",
  gold: "#c9a84c",
  ok: "#1a6636",
  okBg: "#edf7ee",
  warn: "#92560a",
  warnBg: "#fef8ec",
  err: "#9b1c1c",
  errBg: "#fef2f2",
};

const statusOptions = ["new", "reviewed", "approved", "archived"];
const sourceOptions = ["all", "twilio", "vapi", "facebook", "web"];

const card = {
  background: C.white,
  border: `1px solid ${C.smoke}`,
  borderRadius: 12,
  padding: "16px 18px",
  boxShadow: "0 1px 4px rgba(17,17,17,0.04)",
};

function formatDate(value) {
  if (!value) return "Unknown";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleString();
}

function buildShareCaption(review) {
  if ((review.share_caption || "").trim()) return review.share_caption.trim();
  const name = (review.reviewer_name || "Client").trim();
  const text = (review.review_text || "").trim().slice(0, 280);
  return `${name} shared: "${text}"\n\n#MeetSerenity #SmithInc #ModelDevelopment`;
}

async function getAccessToken() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session?.access_token) throw new Error("Your session expired. Please log in again.");
  return session.access_token;
}

export default function VoiceReviews() {
  const [loading, setLoading] = React.useState(true);
  const [savingId, setSavingId] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sourceFilter, setSourceFilter] = React.useState("all");
  const [reviews, setReviews] = React.useState([]);
  const [activeId, setActiveId] = React.useState("");
  const [editState, setEditState] = React.useState({
    reviewer_name: "",
    review_type: "program",
    rating: "",
    review_text: "",
    status: "new",
    share_approved: false,
    admin_notes: "",
    share_caption: "",
  });
  const [facebookDraft, setFacebookDraft] = React.useState({
    reviewer_name: "",
    review_type: "company",
    rating: "",
    review_text: "",
    review_url: "",
  });

  const fetchReviews = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getAccessToken();
      const qs = new URLSearchParams({
        status: statusFilter,
        source: sourceFilter,
        limit: "250",
      });
      const resp = await fetch(`/api/voice-reviews/list?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json.ok) throw new Error(json.error || "Failed to fetch voice reviews");
      setReviews(Array.isArray(json.reviews) ? json.reviews : []);
    } catch (err) {
      setError(err.message || "Failed to fetch voice reviews");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sourceFilter]);

  React.useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const startEdit = (item) => {
    setActiveId(item.id);
    setEditState({
      reviewer_name: item.reviewer_name || "",
      review_type: item.review_type || "program",
      rating: item.rating || "",
      review_text: item.review_text || "",
      status: item.status || "new",
      share_approved: !!item.share_approved,
      admin_notes: item.admin_notes || "",
      share_caption: item.share_caption || "",
    });
  };

  const cancelEdit = () => {
    setActiveId("");
  };

  const saveEdit = async (item) => {
    setSavingId(item.id);
    setError("");
    try {
      const token = await getAccessToken();
      const payload = {
        id: item.id,
        reviewer_name: editState.reviewer_name,
        review_type: editState.review_type,
        rating: editState.rating === "" ? null : Number(editState.rating),
        review_text: editState.review_text,
        status: editState.status,
        share_approved: !!editState.share_approved,
        admin_notes: editState.admin_notes,
        share_caption: editState.share_caption,
      };
      const resp = await fetch("/api/voice-reviews/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json.ok) throw new Error(json.error || "Failed to update review");
      setReviews((prev) => prev.map((r) => (r.id === item.id ? json.review : r)));
      setActiveId("");
    } catch (err) {
      setError(err.message || "Failed to update review");
    } finally {
      setSavingId("");
    }
  };

  const shareReview = async (item, platform) => {
    const caption = buildShareCaption(item);
    try {
      await navigator.clipboard.writeText(caption);
    } catch (_err) {
      // If clipboard permission fails, user can still copy manually from prompt below.
    }

    const encoded = encodeURIComponent(caption);
    const pageUrl = encodeURIComponent(`${window.location.origin}/model-development`);

    if (platform === "x") {
      window.open(`https://twitter.com/intent/tweet?text=${encoded}`, "_blank", "noopener,noreferrer");
      return;
    }
    if (platform === "linkedin") {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${pageUrl}`, "_blank", "noopener,noreferrer");
      return;
    }
    if (platform === "facebook") {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${pageUrl}&quote=${encoded}`, "_blank", "noopener,noreferrer");
      return;
    }

    alert("Caption copied. Paste it into Instagram with your selected media.");
  };

  const createFacebookReview = async () => {
    setCreating(true);
    setError("");
    try {
      const token = await getAccessToken();
      const resp = await fetch("/api/voice-reviews/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          source: "facebook",
          reviewer_name: facebookDraft.reviewer_name,
          review_type: facebookDraft.review_type,
          rating: facebookDraft.rating === "" ? null : Number(facebookDraft.rating),
          review_text: facebookDraft.review_text,
          review_url: facebookDraft.review_url,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json.ok) throw new Error(json.error || "Failed to add Facebook review");
      setReviews((prev) => [json.review, ...prev]);
      setFacebookDraft({ reviewer_name: "", review_type: "company", rating: "", review_text: "", review_url: "" });
    } catch (err) {
      setError(err.message || "Failed to add Facebook review");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ padding: "32px 24px", maxWidth: 1180, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(26px,4vw,38px)", fontWeight: 500, color: C.ink, margin: "0 0 6px" }}>
        Voice Bot Reviews
      </h1>
      <p style={{ color: C.dust, fontSize: 13, marginBottom: 20 }}>
        Manage client experience reviews captured from both voice bots. Edit, approve, and share safely.
      </p>

      <div style={{ ...card, marginBottom: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ fontSize: 12, color: C.dust }}>Status</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ border: `1px solid ${C.smoke}`, borderRadius: 8, padding: "8px 10px" }}>
          <option value="all">All</option>
          {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label style={{ fontSize: 12, color: C.dust }}>Source</label>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} style={{ border: `1px solid ${C.smoke}`, borderRadius: 8, padding: "8px 10px" }}>
          {sourceOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={fetchReviews} style={{ border: "none", borderRadius: 8, padding: "8px 12px", background: C.ink, color: C.white, fontSize: 12, cursor: "pointer" }}>
          Refresh
        </button>
      </div>

      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: C.dust, marginBottom: 8 }}>
          Add Facebook Review
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <input value={facebookDraft.reviewer_name} onChange={(e) => setFacebookDraft((p) => ({ ...p, reviewer_name: e.target.value }))} placeholder="Reviewer name" style={{ border: `1px solid ${C.smoke}`, borderRadius: 8, padding: "8px 10px" }} />
          <textarea value={facebookDraft.review_text} onChange={(e) => setFacebookDraft((p) => ({ ...p, review_text: e.target.value }))} rows={3} placeholder="Paste the Facebook review text" style={{ border: `1px solid ${C.smoke}`, borderRadius: 8, padding: "8px 10px", resize: "vertical" }} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input value={facebookDraft.review_url} onChange={(e) => setFacebookDraft((p) => ({ ...p, review_url: e.target.value }))} placeholder="Facebook review link (optional)" style={{ minWidth: 260, flex: 1, border: `1px solid ${C.smoke}`, borderRadius: 8, padding: "8px 10px" }} />
            <select value={facebookDraft.review_type} onChange={(e) => setFacebookDraft((p) => ({ ...p, review_type: e.target.value }))} style={{ border: `1px solid ${C.smoke}`, borderRadius: 8, padding: "8px 10px" }}>
              <option value="company">company</option>
              <option value="program">program</option>
            </select>
            <input type="number" min="1" max="5" value={facebookDraft.rating} onChange={(e) => setFacebookDraft((p) => ({ ...p, rating: e.target.value }))} placeholder="Rating" style={{ width: 90, border: `1px solid ${C.smoke}`, borderRadius: 8, padding: "8px 10px" }} />
            <button onClick={createFacebookReview} disabled={creating || !facebookDraft.review_text.trim()} style={{ border: "none", borderRadius: 8, padding: "8px 12px", background: C.ink, color: C.white, fontSize: 12, cursor: creating ? "not-allowed" : "pointer" }}>
              {creating ? "Adding..." : "Add Facebook Review"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: C.errBg, border: `1px solid rgba(155,28,28,0.2)`, borderRadius: 10, color: C.err, padding: "10px 12px", marginBottom: 14, fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ ...card, color: C.dust, fontSize: 13 }}>Loading voice reviews...</div>
      ) : reviews.length === 0 ? (
        <div style={{ ...card, color: C.dust, fontSize: 13 }}>No reviews found for current filters.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {reviews.map((item) => {
            const isEditing = activeId === item.id;
            const current = isEditing ? editState : item;
            return (
              <div key={item.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                  <div style={{ fontSize: 13, color: C.slate }}>
                    <strong style={{ color: C.ink }}>{item.reviewer_name || "Voice Caller"}</strong>
                    {" · "}{item.source || "unknown"}
                    {" · "}{item.review_type || "program"}
                    {" · "}{formatDate(item.created_at)}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: C.dust }}>{item.status || "new"}</span>
                    <span style={{ fontSize: 12, color: C.warn }}>{item.rating ? `${item.rating}/5` : "no rating"}</span>
                  </div>
                </div>
                {item.metadata?.review_url && (
                  <div style={{ marginBottom: 8 }}>
                    <a href={item.metadata.review_url} target="_blank" rel="noreferrer" style={{ color: C.warn, fontSize: 12, textDecoration: "none" }}>
                      View original source
                    </a>
                  </div>
                )}

                {isEditing ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <input value={current.reviewer_name} onChange={(e) => setEditState((p) => ({ ...p, reviewer_name: e.target.value }))} placeholder="Reviewer name" style={{ border: `1px solid ${C.smoke}`, borderRadius: 8, padding: "8px 10px" }} />
                    <textarea value={current.review_text} onChange={(e) => setEditState((p) => ({ ...p, review_text: e.target.value }))} rows={4} style={{ border: `1px solid ${C.smoke}`, borderRadius: 8, padding: "8px 10px", resize: "vertical" }} />
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <select value={current.review_type} onChange={(e) => setEditState((p) => ({ ...p, review_type: e.target.value }))} style={{ border: `1px solid ${C.smoke}`, borderRadius: 8, padding: "8px 10px" }}>
                        <option value="program">program</option>
                        <option value="company">company</option>
                      </select>
                      <input type="number" min="1" max="5" value={current.rating} onChange={(e) => setEditState((p) => ({ ...p, rating: e.target.value }))} placeholder="Rating 1-5" style={{ width: 110, border: `1px solid ${C.smoke}`, borderRadius: 8, padding: "8px 10px" }} />
                      <select value={current.status} onChange={(e) => setEditState((p) => ({ ...p, status: e.target.value }))} style={{ border: `1px solid ${C.smoke}`, borderRadius: 8, padding: "8px 10px" }}>
                        {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <textarea value={current.admin_notes} onChange={(e) => setEditState((p) => ({ ...p, admin_notes: e.target.value }))} rows={2} placeholder="Admin notes" style={{ border: `1px solid ${C.smoke}`, borderRadius: 8, padding: "8px 10px", resize: "vertical" }} />
                    <textarea value={current.share_caption} onChange={(e) => setEditState((p) => ({ ...p, share_caption: e.target.value }))} rows={2} placeholder="Share caption (optional)" style={{ border: `1px solid ${C.smoke}`, borderRadius: 8, padding: "8px 10px", resize: "vertical" }} />
                    <label style={{ fontSize: 12, color: C.slate, display: "flex", gap: 8, alignItems: "center" }}>
                      <input type="checkbox" checked={!!current.share_approved} onChange={(e) => setEditState((p) => ({ ...p, share_approved: e.target.checked }))} />
                      Approved for sharing
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => saveEdit(item)} disabled={savingId === item.id} style={{ border: "none", borderRadius: 8, padding: "8px 12px", background: C.ink, color: C.white, fontSize: 12, cursor: "pointer" }}>
                        {savingId === item.id ? "Saving..." : "Save"}
                      </button>
                      <button onClick={cancelEdit} style={{ border: `1px solid ${C.smoke}`, borderRadius: 8, padding: "8px 12px", background: C.white, color: C.slate, fontSize: 12, cursor: "pointer" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ whiteSpace: "pre-wrap", color: C.slate, fontSize: 14, lineHeight: 1.6, marginBottom: 10 }}>
                      {item.review_text}
                    </div>
                    {(item.admin_notes || "").trim() && (
                      <div style={{ background: C.ivory, border: `1px solid ${C.smoke}`, borderRadius: 8, padding: "8px 10px", fontSize: 12, color: C.slate, marginBottom: 10 }}>
                        <strong style={{ color: C.ink }}>Admin note:</strong> {item.admin_notes}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => startEdit(item)} style={{ border: "none", borderRadius: 8, padding: "8px 12px", background: C.ink, color: C.white, fontSize: 12, cursor: "pointer" }}>
                        Edit
                      </button>
                      <button onClick={() => shareReview(item, "x")} disabled={!item.share_approved} style={{ border: `1px solid ${C.smoke}`, borderRadius: 8, padding: "8px 12px", background: C.white, color: C.slate, fontSize: 12, cursor: item.share_approved ? "pointer" : "not-allowed", opacity: item.share_approved ? 1 : 0.5 }}>
                        Share X
                      </button>
                      <button onClick={() => shareReview(item, "linkedin")} disabled={!item.share_approved} style={{ border: `1px solid ${C.smoke}`, borderRadius: 8, padding: "8px 12px", background: C.white, color: C.slate, fontSize: 12, cursor: item.share_approved ? "pointer" : "not-allowed", opacity: item.share_approved ? 1 : 0.5 }}>
                        Share LinkedIn
                      </button>
                      <button onClick={() => shareReview(item, "facebook")} disabled={!item.share_approved} style={{ border: `1px solid ${C.smoke}`, borderRadius: 8, padding: "8px 12px", background: C.white, color: C.slate, fontSize: 12, cursor: item.share_approved ? "pointer" : "not-allowed", opacity: item.share_approved ? 1 : 0.5 }}>
                        Share Facebook
                      </button>
                      <button onClick={() => shareReview(item, "instagram")} disabled={!item.share_approved} style={{ border: `1px solid ${C.smoke}`, borderRadius: 8, padding: "8px 12px", background: C.white, color: C.slate, fontSize: 12, cursor: item.share_approved ? "pointer" : "not-allowed", opacity: item.share_approved ? 1 : 0.5 }}>
                        Instagram (copy)
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
