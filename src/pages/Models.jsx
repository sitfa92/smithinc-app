import React from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import { useAgencyBrand } from "../agencyBrand";
import { buildPublicAppUrl, isMissingColumnError, sendZapierEvent, sendBackendWebhook } from "../utils";
import { sendModelDirectEmail } from "../emailService";
import { MEDIA_UPLOAD_STANDARD, listDigitalsForModel, listVideosForModel } from "../imageUpload";
import LuxuryPhotoCarousel from "../components/LuxuryPhotoCarousel";

const formatAuditDimensions = (width = 0, height = 0) => `${width} x ${height}`;

const readImageDimensionsFromUrl = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || image.width || 0, height: image.naturalHeight || image.height || 0 });
    image.onerror = () => reject(new Error("Failed to load image metadata"));
    image.src = url;
  });

const readVideoDimensionsFromUrl = (url) =>
  new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => resolve({ width: video.videoWidth || 0, height: video.videoHeight || 0 });
    video.onerror = () => reject(new Error("Failed to load video metadata"));
    video.src = url;
  });

const isBelowStandard = ({ width = 0, height = 0 }, standard) => {
  const longEdge = Math.max(width, height);
  const shortEdge = Math.min(width, height);
  return longEdge < standard.minLongEdge || shortEdge < standard.minShortEdge;
};

export default function Models() {
  const { role, isOwner, isAgencyAdmin, isAgencyMember, agencyId } = useAuth();
  const { agencyName, agencyAccentColor } = useAgencyBrand(agencyId, isAgencyAdmin || isAgencyMember);
  const [models, setModels] = React.useState([]);
  const [imageLoadFailed, setImageLoadFailed] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [saveLoading, setSaveLoading] = React.useState(false);
  const [saveError, setSaveError] = React.useState("");
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    instagram: "",
    height: "",
    status: "pending",
  });
  // Removed duplicate useAuth destructuring
  const canAddModels = ["admin", "agent", "user"].includes(role);
  const canViewTemplates = role === "admin" || role === "va";

  const MODEL_FOLLOWUP_TEMPLATES = [
    { label: "Request Digitals",     template: (n) => `Hi ${n}, thank you for applying to SmithInc. The Fashion Agency. To move your application forward, please send your digital photos — full length, close-up, and profile — along with your current measurements (height, bust, waist, hips, shoe size, and location).` },
    { label: "Request Measurements", template: (n) => `Hi ${n}, we are reviewing your profile at SmithInc. Please send your current measurements: height, bust, waist, hips, shoe size, and location so we can continue.` },
    { label: "Book Eval Call",       template: (n) => `Hi ${n}, we would like to schedule a brief evaluation call to discuss your application. Please reply with your availability and we will confirm a time.` },
    { label: "Decline — Not a Fit",  template: (n) => `Hi ${n}, thank you for your interest in SmithInc. The Fashion Agency. After careful review, we have decided not to move forward at this time. We appreciate you applying and wish you well.` },
    { label: "Welcome — Signed",     template: (n) => `Hi ${n}, welcome to SmithInc. The Fashion Agency. We are pleased to confirm your signing. Our team will be in touch shortly with your onboarding details.` },
  ];

  const [expandedDigitals, setExpandedDigitals] = React.useState({});   // { [modelId]: { open, loading, files } }
  const [copiedTpl, setCopiedTpl] = React.useState({});
  const [mediaScanLoading, setMediaScanLoading] = React.useState(false);
  const [mediaScanProgress, setMediaScanProgress] = React.useState({ scanned: 0, total: 0 });
  const [mediaScanReport, setMediaScanReport] = React.useState(null);
  const [mediaScanError, setMediaScanError] = React.useState("");
  const [mediaQualityLoading, setMediaQualityLoading] = React.useState(false);
  const [mediaQualityProgress, setMediaQualityProgress] = React.useState({ scanned: 0, total: 0 });
  const [mediaQualityReport, setMediaQualityReport] = React.useState(null);
  const [mediaQualityError, setMediaQualityError] = React.useState("");
  const [sendingEmailId, setSendingEmailId] = React.useState("");
  const [emailResultById, setEmailResultById] = React.useState({});
  const [snapshotSendById, setSnapshotSendById] = React.useState({});
  const [snapshotSendResultById, setSnapshotSendResultById] = React.useState({});
  const [composeById, setComposeById] = React.useState({}); // { [id]: { subject, message } }
  const [attachmentsById, setAttachmentsById] = React.useState({}); // { [id]: [{ filename, content, type, sizeLabel }] }
  const [toggleAgencyById, setToggleAgencyById] = React.useState({}); // { [id]: loading }
  const [paypalStatus, setPaypalStatus] = React.useState({ loading: false, configured: false, mode: "sandbox", modelSubscriptionsEnabled: false, agencyPayoutsEnabled: false, canSendAgencyPayouts: false });
  const [subscriptionDraftById, setSubscriptionDraftById] = React.useState({});
  const [savingSubscriptionById, setSavingSubscriptionById] = React.useState({});
  const [manualPaymentDraftById, setManualPaymentDraftById] = React.useState({});
  const [savingManualPaymentById, setSavingManualPaymentById] = React.useState({});
  const [showManualPaymentById, setShowManualPaymentById] = React.useState({});
  const [payingSubscriptionById, setPayingSubscriptionById] = React.useState({});
  const [agencyList, setAgencyList] = React.useState([]);
  const [agencyPayoutDraft, setAgencyPayoutDraft] = React.useState({ agencyId: "", recipientEmail: "", amount: "", note: "Agency payout" });
  const [sendingAgencyPayout, setSendingAgencyPayout] = React.useState(false);
  const [agencyPayoutResult, setAgencyPayoutResult] = React.useState({ type: "", message: "" });
  const ATTACH_MAX_MB = 2.5;
  const ATTACH_TOTAL_MAX_MB = 3.5;
  const ATTACH_TOTAL_MAX_BASE64_CHARS = Math.floor((ATTACH_TOTAL_MAX_MB * 1024 * 1024 * 4) / 3);
  const ATTACH_ALLOWED = "image/jpeg,image/png,image/gif,image/webp,application/pdf";

  const readFileAsBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result.split(",")[1]);
      reader.onerror = () => reject(new Error("File read failed"));
      reader.readAsDataURL(file);
    });

  const handleAttachFiles = async (modelId, files) => {
    const existing = attachmentsById[modelId] || [];
    const existingBase64Chars = existing.reduce((sum, item) => sum + String(item?.content || "").length, 0);
    let pendingBase64Chars = 0;
    const newItems = [];
    for (const file of files) {
      if (file.size > ATTACH_MAX_MB * 1024 * 1024) {
        alert(`"${file.name}" exceeds the ${ATTACH_MAX_MB} MB limit and was skipped.`);
        continue;
      }
      try {
        const content = await readFileAsBase64(file);
        const nextTotalChars = existingBase64Chars + pendingBase64Chars + String(content).length;
        if (nextTotalChars > ATTACH_TOTAL_MAX_BASE64_CHARS) {
          alert(`Adding "${file.name}" would exceed the ${ATTACH_TOTAL_MAX_MB} MB total attachment limit. It was skipped.`);
          continue;
        }
        newItems.push({
          filename: file.name,
          content,
          type: file.type,
          sizeLabel: file.size < 1024 * 1024
            ? `${Math.round(file.size / 1024)} KB`
            : `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        });
        pendingBase64Chars += String(content).length;
      } catch { /* skip unreadable file */ }
    }
    setAttachmentsById(prev => ({ ...prev, [modelId]: [...existing, ...newItems] }));
  };

  const removeAttachment = (modelId, idx) => {
    setAttachmentsById(prev => ({
      ...prev,
      [modelId]: (prev[modelId] || []).filter((_, i) => i !== idx),
    }));
  };

  const toggleDigitals = async (model) => {
    const modelId = model?.id;
    if (!modelId) return;
    const current = expandedDigitals[modelId];
    if (current?.open) {
      setExpandedDigitals(prev => ({ ...prev, [modelId]: { ...prev[modelId], open: false } }));
      return;
    }

    setExpandedDigitals(prev => {
      const cur = prev[modelId];
      return { ...prev, [modelId]: { open: true, loading: true, files: cur?.files || [] } };
    });
    try {
      const files = await listDigitalsForModel({
        id: modelId,
        email: model.email,
        instagram: model.instagram,
        folder: `digitals/${modelId}`,
      });
      setExpandedDigitals(prev => ({ ...prev, [modelId]: { open: true, loading: false, files } }));
    } catch {
      setExpandedDigitals(prev => ({ ...prev, [modelId]: { open: true, loading: false, files: [] } }));
    }
  };

  const toggleAgencyVisibility = async (model) => {
    const modelId = model.id;
    const newValue = !model.visible_to_agencies;
    
    setToggleAgencyById(prev => ({ ...prev, [modelId]: true }));
    
    try {
      const { error } = await supabase
        .from("models")
        .update({ visible_to_agencies: newValue })
        .eq("id", modelId);
      
      if (error) throw error;
      
      // Update local state to reflect the change immediately
      setModels(prev => 
        prev.map(m => m.id === modelId ? { ...m, visible_to_agencies: newValue } : m)
      );
    } catch (err) {
      console.error("Error updating agency visibility:", err);
      alert("Failed to update model visibility: " + (err?.message || "Unknown error"));
    } finally {
      setToggleAgencyById(prev => ({ ...prev, [modelId]: false }));
    }
  };

  const getAuthHeaders = React.useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("Authentication required");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }, []);

  const saveModelSubscriptionPayment = async (model) => {
    if (!isOwner || !model?.id) return;

    const draft = subscriptionDraftById[model.id] || {};
    const enabled = draft.enabled !== undefined ? draft.enabled === true : model.agency_subscription_payment_enabled === true;
    const amount = Number(draft.amount ?? model.agency_subscription_monthly_amount ?? 0);

    if (enabled && (!Number.isFinite(amount) || amount <= 0)) {
      setError("Monthly amount must be greater than 0 when payment is enabled.");
      return;
    }

    setSavingSubscriptionById((prev) => ({ ...prev, [model.id]: true }));
    setError("");
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch("/api/models/set-subscription-payment", {
        method: "POST",
        headers,
        body: JSON.stringify({
          modelId: model.id,
          enabled,
          monthlyAmount: enabled ? amount : 0,
        }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) {
        throw new Error(json.error || "Failed to save model payment settings");
      }

      setModels((prev) => prev.map((row) => (
        row.id === model.id
          ? {
            ...row,
            agency_subscription_payment_enabled: enabled,
            agency_subscription_monthly_amount: enabled ? amount : 0,
          }
          : row
      )));
      setSubscriptionDraftById((prev) => {
        const next = { ...prev };
        delete next[model.id];
        return next;
      });
    } catch (err) {
      setError(err.message || "Failed to save model payment settings");
    } finally {
      setSavingSubscriptionById((prev) => ({ ...prev, [model.id]: false }));
    }
  };

  const payModelSubscription = async (model) => {
    if (!model?.id) return;

    setPayingSubscriptionById((prev) => ({ ...prev, [model.id]: true }));
    setError("");
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch("/api/agencies/create-model-subscription-payment", {
        method: "POST",
        headers,
        body: JSON.stringify({ modelId: model.id }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok || !json?.request?.checkoutUrl) {
        throw new Error(json.error || "Failed to start model subscription payment");
      }

      window.location.href = json.request.checkoutUrl;
    } catch (err) {
      setError(err.message || "Failed to start model subscription payment");
      setPayingSubscriptionById((prev) => ({ ...prev, [model.id]: false }));
    }
  };

  const recordManualSubscriptionPayment = async (model) => {
    if (!isOwner || !model?.id) return;

    const draft = manualPaymentDraftById[model.id] || {};
    const amount = Number(draft.amount || 0);
    const paidAt = String(draft.paidAt || "").trim();
    const reference = String(draft.reference || "").trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Manual payment amount must be greater than 0.");
      return;
    }

    setSavingManualPaymentById((prev) => ({ ...prev, [model.id]: true }));
    setError("");
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch("/api/models/record-subscription-payment", {
        method: "POST",
        headers,
        body: JSON.stringify({
          modelId: model.id,
          amount,
          paidAt,
          reference,
          status: "MANUAL_COMPLETED",
        }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) {
        throw new Error(json.error || "Failed to record manual payment");
      }

      const updated = json?.model || {};
      setModels((prev) => prev.map((row) => (
        row.id === model.id
          ? {
            ...row,
            agency_subscription_payments_total: updated.agency_subscription_payments_total ?? row.agency_subscription_payments_total,
            agency_subscription_last_paid_at: updated.agency_subscription_last_paid_at ?? row.agency_subscription_last_paid_at,
            agency_subscription_last_paid_amount: updated.agency_subscription_last_paid_amount ?? row.agency_subscription_last_paid_amount,
            agency_subscription_last_paid_order_id: updated.agency_subscription_last_paid_order_id ?? row.agency_subscription_last_paid_order_id,
            agency_subscription_last_paid_status: updated.agency_subscription_last_paid_status ?? row.agency_subscription_last_paid_status,
          }
          : row
      )));

      setShowManualPaymentById((prev) => ({ ...prev, [model.id]: false }));
      setManualPaymentDraftById((prev) => {
        const next = { ...prev };
        delete next[model.id];
        return next;
      });
    } catch (err) {
      setError(err.message || "Failed to record manual payment");
    } finally {
      setSavingManualPaymentById((prev) => ({ ...prev, [model.id]: false }));
    }
  };

  const sendAgencyPayout = async () => {
    if (!isOwner) return;

    const agencyId = String(agencyPayoutDraft.agencyId || "").trim();
    const recipientEmail = String(agencyPayoutDraft.recipientEmail || "").trim();
    const note = String(agencyPayoutDraft.note || "Agency payout").trim();
    const amount = Number(agencyPayoutDraft.amount || 0);

    if (!agencyId) {
      setAgencyPayoutResult({ type: "error", message: "Select an agency first." });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setAgencyPayoutResult({ type: "error", message: "Enter a valid payout amount." });
      return;
    }

    setSendingAgencyPayout(true);
    setAgencyPayoutResult({ type: "", message: "" });
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch("/api/agencies/paypal-payout", {
        method: "POST",
        headers,
        body: JSON.stringify({ agencyId, recipientEmail, amount, note }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) {
        throw new Error(json.error || "Failed to send agency payout");
      }

      setAgencyPayoutResult({
        type: "ok",
        message: `Payout submitted: ${Number(json?.payout?.amount || 0).toLocaleString(undefined, { style: "currency", currency: "USD" })}`,
      });
      setAgencyPayoutDraft((prev) => ({ ...prev, amount: "" }));
      setAgencyList((prev) => prev.map((item) => (
        item.id === agencyId ? { ...item, ...(json.agency || {}) } : item
      )));
    } catch (err) {
      setAgencyPayoutResult({ type: "error", message: err.message || "Failed to send agency payout" });
    } finally {
      setSendingAgencyPayout(false);
    }
  };

  const openCompose = (model) => {
    const name = String(model?.name || "there").trim();
    setComposeById((prev) => ({
      ...prev,
      [model.id]: {
        subject: `Hi ${name} — SmithInc Follow-up`,
        message: `Hi ${name},\n\n`,
      },
    }));
    setAttachmentsById((prev) => ({ ...prev, [model.id]: [] }));
    setEmailResultById((prev) => ({ ...prev, [model.id]: "" }));
  };

  const closeCompose = (modelId) => {
    setComposeById((prev) => { const n = { ...prev }; delete n[modelId]; return n; });
    setAttachmentsById((prev) => { const n = { ...prev }; delete n[modelId]; return n; });
  };

  const sendComposedEmail = async (model) => {
    const to = String(model?.email || "").trim();
    if (!to) return;
    const compose = composeById[model.id];
    if (!compose) return;
    const name = String(model?.name || "there").trim();
    const attachments = (attachmentsById[model.id] || []).map(({ filename, content, type }) => ({ filename, content, type }));
    const totalBase64Chars = attachments.reduce((sum, item) => sum + String(item?.content || "").length, 0);
    if (totalBase64Chars > ATTACH_TOTAL_MAX_BASE64_CHARS) {
      alert(`Attachments are too large to send in one email. Keep total attachments under ${ATTACH_TOTAL_MAX_MB} MB.`);
      return;
    }
    setSendingEmailId(model.id);
    const ok = await sendModelDirectEmail({ name, email: to, subject: compose.subject, message: compose.message, attachments });
    setSendingEmailId("");
    if (ok) {
      closeCompose(model.id);
      setEmailResultById((prev) => ({ ...prev, [model.id]: "sent" }));
    } else {
      setEmailResultById((prev) => ({ ...prev, [model.id]: "failed" }));
    }
  };

  const sendSnapshotLinkEmail = async (model) => {
    const to = String(model?.email || "").trim();
    if (!to) return;
    const name = String(model?.name || "there").trim();
    const snapshotUrl = buildPublicAppUrl(`/champ-snapshot/${encodeURIComponent(model.id)}`);
    setSnapshotSendById((prev) => ({ ...prev, [model.id]: true }));
    setSnapshotSendResultById((prev) => ({ ...prev, [model.id]: "" }));

    const ok = await sendModelDirectEmail({
      name,
      email: to,
      subject: "Your Live CHAMP Snapshot Link",
      message: `Hi ${name},\n\nHere is your live CHAMP model card snapshot link:\n${snapshotUrl}\n\nThis snapshot updates in real time, and there is also a Refresh Snapshot button on the page if you want to manually refresh instantly.\n\nBest,\nSmithInc Team`,
    });

    setSnapshotSendById((prev) => ({ ...prev, [model.id]: false }));
    setSnapshotSendResultById((prev) => ({ ...prev, [model.id]: ok ? "sent" : "failed" }));
  };

  // ...removed agency toggling logic...

  const fetchModels = React.useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const selectFields = "id, name, email, instagram, status, source, image_url, submitted_at, created_at, pipeline_stage, visible_to_agencies, submitted_by_agency_id, agency_subscription_payment_enabled, agency_subscription_monthly_amount, agency_subscription_last_paid_at, agency_subscription_last_paid_amount, agency_subscription_last_paid_status, agency_subscription_last_paid_order_id";
      const legacySelectFields = "id, name, email, instagram, status, source, image_url, submitted_at, created_at, pipeline_stage, visible_to_agencies, submitted_by_agency_id";

      let query = supabase
        .from("models")
        .select(selectFields)
        .order("created_at", { ascending: false });

      if (isAgencyAdmin || isAgencyMember) {
        query = query.or(`submitted_by_agency_id.eq.${agencyId},visible_to_agencies.eq.true`);
      }

      let { data, error } = await query;
      if (error && isMissingColumnError(error)) {
        let fallbackQuery = supabase
          .from("models")
          .select(legacySelectFields)
          .order("created_at", { ascending: false });

        if (isAgencyAdmin || isAgencyMember) {
          fallbackQuery = fallbackQuery.or(`submitted_by_agency_id.eq.${agencyId},visible_to_agencies.eq.true`);
        }

        const retry = await fallbackQuery;
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;
      setModels(data || []);
      setImageLoadFailed({});
    } catch (err) {
      setError(err.message || "Failed to load models");
    } finally {
      setLoading(false);
    }
  }, [isAgencyAdmin, isAgencyMember, agencyId]);

  const isMissingReindexJobsTableError = React.useCallback((err) => {
    const msg = String(err?.message || "").toLowerCase();
    return msg.includes("media_reindex_jobs") && (msg.includes("could not find") || msg.includes("does not exist"));
  }, []);

  const runMediaReindex = async () => {
    if (role !== "admin" && !isOwner) return;

    setMediaScanLoading(true);
    setMediaScanError("");
    setMediaScanReport(null);
    setMediaScanProgress({ scanned: 0, total: 0 });

    try {
      // Get auth token for API call
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error("Not authenticated");
      }

      // Trigger background reindex job
      const response = await fetch("/api/admin/reindex-media-background", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to start media reindex");
      }

      const { jobId: _jobId, report } = await response.json();

      // Job completed immediately (or quickly) - show results
      setMediaScanReport(report);
    } catch (err) {
      setMediaScanError(err.message || "Media reindex failed");
    } finally {
      setMediaScanLoading(false);
    }
  };

  const runMediaQualityAudit = async () => {
    if (role !== "admin" && !isOwner) return;

    setMediaQualityLoading(true);
    setMediaQualityError("");
    setMediaQualityReport(null);
    setMediaQualityProgress({ scanned: 0, total: models.length });

    try {
      const rows = [];
      const sortedModels = [...models].sort((a, b) => {
        const aTime = Date.parse(a.created_at || a.submitted_at || "") || 0;
        const bTime = Date.parse(b.created_at || b.submitted_at || "") || 0;
        return bTime - aTime;
      });

      for (let index = 0; index < sortedModels.length; index += 1) {
        const model = sortedModels[index];
        const [digitals, videos] = await Promise.all([
          listDigitalsForModel({
            id: model.id,
            email: model.email,
            instagram: model.instagram,
            folder: `digitals/${model.id}`,
          }).catch(() => []),
          listVideosForModel({
            id: model.id,
            email: model.email,
            instagram: model.instagram,
            folder: `videos/${model.id}`,
          }).catch(() => []),
        ]);

        const latestDigital = digitals[0] || null;
        const latestVideo = videos[0] || null;
        let digitalMeta = null;
        let videoMeta = null;

        if (latestDigital?.url) {
          try {
            digitalMeta = await readImageDimensionsFromUrl(latestDigital.url);
          } catch {
            digitalMeta = null;
          }
        }

        if (latestVideo?.url) {
          try {
            videoMeta = await readVideoDimensionsFromUrl(latestVideo.url);
          } catch {
            videoMeta = null;
          }
        }

        const digitalFlag = digitalMeta
          ? isBelowStandard(digitalMeta, MEDIA_UPLOAD_STANDARD.digitals)
          : false;
        const videoFlag = videoMeta
          ? isBelowStandard(videoMeta, MEDIA_UPLOAD_STANDARD.video)
          : false;

        if (digitalFlag || videoFlag) {
          rows.push({
            id: model.id,
            name: model.name || "Unnamed",
            email: model.email || "",
            digitalsCount: digitals.length,
            videosCount: videos.length,
            digitalDimensions: digitalMeta ? formatAuditDimensions(digitalMeta.width, digitalMeta.height) : "Not found",
            videoDimensions: videoMeta ? formatAuditDimensions(videoMeta.width, videoMeta.height) : "Not found",
            flaggedDigital: digitalFlag,
            flaggedVideo: videoFlag,
          });
        }

        setMediaQualityProgress({ scanned: index + 1, total: sortedModels.length });
      }

      const flaggedDigitals = rows.filter((row) => row.flaggedDigital).length;
      const flaggedVideos = rows.filter((row) => row.flaggedVideo).length;
      setMediaQualityReport({
        scanned: sortedModels.length,
        total: sortedModels.length,
        flaggedRows: rows.length,
        flaggedDigitals,
        flaggedVideos,
        details: rows,
      });
    } catch (err) {
      setMediaQualityError(err.message || "Media quality audit failed");
    } finally {
      setMediaQualityLoading(false);
    }
  };

  // Poll for reindex job status (useful for long-running scans)
  React.useEffect(() => {
    if (!mediaScanLoading) return;

    const pollInterval = setInterval(async () => {
      try {
        // Fetch latest job
        const { data: jobs, error } = await supabase
          .from("media_reindex_jobs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1);

        if (error) {
          if (isMissingReindexJobsTableError(error)) {
            setMediaScanLoading(false);
            return;
          }
          throw error;
        }
        if (jobs?.length === 0) return;

        const job = jobs[0];

        if (job.status === "processing") {
          setMediaScanProgress({ scanned: job.scanned, total: job.total_models });
        } else if (job.status === "completed") {
          setMediaScanReport({
            scanned: job.scanned,
            total: job.total_models,
            withDigitals: job.with_digitals,
            withPortfolio: job.with_portfolio,
            missingDigitals: job.missing_digitals,
            missingPortfolio: job.missing_portfolio,
            missingBoth: job.missing_both,
            details: job.details || [],
            completedAt: job.completed_at,
          });
          setMediaScanLoading(false);
        } else if (job.status === "failed") {
          setMediaScanError(job.error_message || "Media reindex failed");
          setMediaScanLoading(false);
        }
      } catch (err) {
        console.error("Error polling reindex status:", err);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [mediaScanLoading, isMissingReindexJobsTableError]);

  const getModelImageSrc = React.useCallback((imageUrl) => {
    const raw = String(imageUrl || "").trim();
    if (!raw) return "";

    // Some older records stored signed URLs that expire. Convert to public URL shape.
    if (/^https?:\/\//i.test(raw)) {
      const signMarker = "/storage/v1/object/sign/";
      const signIndex = raw.indexOf(signMarker);
      if (signIndex >= 0) {
        const signedPath = raw.slice(signIndex + signMarker.length).split("?")[0];
        return `${raw.slice(0, signIndex)}/storage/v1/object/public/${signedPath}`;
      }
      return raw;
    }

    const cleanPath = raw.replace(/^\/+/, "");
    if (!cleanPath) return "";

    const bucketCandidates = ["model-images", "models", "images"];
    if (cleanPath.includes("/")) {
      const [firstSegment, ...rest] = cleanPath.split("/");
      if (bucketCandidates.includes(firstSegment) && rest.length) {
        const fromBucketPath = rest.join("/");
        const { data } = supabase.storage.from(firstSegment).getPublicUrl(fromBucketPath);
        return data?.publicUrl || "";
      }
    }

    const { data } = supabase.storage.from("model-images").getPublicUrl(cleanPath);
    return data?.publicUrl || "";
  }, []);

  React.useEffect(() => {
    const shouldLoad = isOwner || isAgencyAdmin || isAgencyMember;
    if (!shouldLoad) return;

    let active = true;
    const loadPayPalStatus = async () => {
      setPaypalStatus((prev) => ({ ...prev, loading: true }));
      try {
        const headers = await getAuthHeaders();
        const resp = await fetch("/api/agencies/paypal-status", { headers });
        const json = await resp.json().catch(() => ({}));
        if (!active) return;
        if (!resp.ok || !json?.ok) {
          setPaypalStatus({ loading: false, configured: false, mode: "sandbox", modelSubscriptionsEnabled: false, agencyPayoutsEnabled: false, canSendAgencyPayouts: false });
          return;
        }
        setPaypalStatus({
          loading: false,
          configured: !!json?.paypal?.configured,
          mode: json?.paypal?.mode === "live" ? "live" : "sandbox",
          modelSubscriptionsEnabled: !!json?.paypal?.modelSubscriptionsEnabled,
          agencyPayoutsEnabled: !!json?.paypal?.agencyPayoutsEnabled,
          canSendAgencyPayouts: !!json?.paypal?.canSendAgencyPayouts,
        });
      } catch (_err) {
        if (!active) return;
        setPaypalStatus({ loading: false, configured: false, mode: "sandbox", modelSubscriptionsEnabled: false, agencyPayoutsEnabled: false, canSendAgencyPayouts: false });
      }
    };

    loadPayPalStatus();
    return () => {
      active = false;
    };
  }, [getAuthHeaders, isOwner, isAgencyAdmin, isAgencyMember]);

  React.useEffect(() => {
    if (!isOwner) return;

    let active = true;
    const loadAgencies = async () => {
      try {
        const headers = await getAuthHeaders();
        const resp = await fetch("/api/agencies/list", { headers });
        const json = await resp.json().catch(() => ({}));
        if (!active || !resp.ok || !json?.ok) return;
        setAgencyList(Array.isArray(json.agencies) ? json.agencies : []);
      } catch (_err) {
        if (!active) return;
        setAgencyList([]);
      }
    };

    loadAgencies();
    return () => {
      active = false;
    };
  }, [getAuthHeaders, isOwner]);

  React.useEffect(() => {
    if (!isOwner) return;
    const selected = agencyList.find((item) => item.id === agencyPayoutDraft.agencyId);
    if (!selected) return;
    if (agencyPayoutDraft.recipientEmail) return;
    if (!selected.paypal_payout_email) return;
    setAgencyPayoutDraft((prev) => ({ ...prev, recipientEmail: selected.paypal_payout_email }));
  }, [agencyList, agencyPayoutDraft.agencyId, agencyPayoutDraft.recipientEmail, isOwner]);

  React.useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const handleAddModel = async (e) => {
    e.preventDefault();
    if (!canAddModels) return;

    setSaveLoading(true);
    setSaveError("");
    try {
      const basePayload = {
        name: form.name.trim(),
        email: form.email.trim(),
        instagram: form.instagram.trim(),
        height: form.height.trim(),
        status: form.status,
        submitted_at: new Date().toISOString(),
      };

      const payload = {
        ...basePayload,
        pipeline_stage: "submitted",
        priority_level: "medium",
        scouting_notes: "",
        internal_notes: "",
        agency_name: "",
        last_updated: new Date().toISOString(),
      };

      if (!payload.name || !payload.email) {
        throw new Error("Name and email are required");
      }

      let { error } = await supabase.from("models").insert([payload]);
      if (error && isMissingColumnError(error)) {
        const retry = await supabase.from("models").insert([basePayload]);
        error = retry.error;
      }
      if (error) throw error;

      sendZapierEvent("model.created", {
        name: payload.name,
        email: payload.email,
        instagram: payload.instagram,
        status: payload.status,
      });

      sendBackendWebhook("model_signup", {
        name: payload.name,
        instagram: payload.instagram,
        height: payload.height,
        status: payload.status,
      });

      setForm({ name: "", email: "", instagram: "", height: "", status: "pending" });
      fetchModels();
    } catch (err) {
      setSaveError(err.message || "Failed to add model");
    } finally {
      setSaveLoading(false);
    }
  };

  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeTab, setActiveTab] = React.useState("all");

  const filteredModels = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return models;
    return models.filter(
      (m) =>
        String(m.name || "").toLowerCase().includes(q) ||
        String(m.email || "").toLowerCase().includes(q)
    );
  }, [models, searchQuery]);

  const sharedCount = React.useMemo(
    () => models.filter((m) => m.visible_to_agencies === true).length,
    [models]
  );
  const notSharedCount = React.useMemo(
    () => models.filter((m) => m.visible_to_agencies !== true).length,
    [models]
  );
  const tabbedModels = React.useMemo(() => {
    if (activeTab === "shared") {
      return filteredModels.filter((m) => m.visible_to_agencies === true);
    }
    if (activeTab === "not-shared") {
      return filteredModels.filter((m) => m.visible_to_agencies !== true);
    }
    return filteredModels;
  }, [filteredModels, activeTab]);

  const approved = React.useMemo(() => models.filter((m) => m.status === "approved").length, [models]);
  const pending = React.useMemo(() => models.filter((m) => m.status === "pending").length, [models]);
  const modelMetricCards = React.useMemo(
    () => [
      { label: "Total Models", value: models.length },
      { label: "Approved Talent", value: approved },
      { label: "Pending Review", value: pending },
    ],
    [models.length, approved, pending]
  );

  const C = { ink:"#111111", slate:"#4a4a4a", dust:"#888888", smoke:"#e8e4dc", ivory:"#faf8f4", white:"#ffffff", warn:"#92560a", warnBg:"#fef8ec", ok:"#1a6636", okBg:"#edf7ee", err:"#9b1c1c", errBg:"#fef2f2" };
  const card = { background:C.white, border:`1px solid ${C.smoke}`, borderRadius:12, padding:"16px 18px", marginBottom:12, boxShadow:"0 1px 4px rgba(17,17,17,0.04)" };
  const inp = { padding:"11px 13px", fontSize:13, color:C.ink, background:C.white, border:`1px solid ${C.smoke}`, borderRadius:8, outline:"none", fontFamily:"'Inter',sans-serif", width:"100%", boxSizing:"border-box" };
  const statusStyle = { pending:[C.warnBg,C.warn], approved:[C.okBg,C.ok], rejected:[C.errBg,C.err] };

  return (
    <div style={{ padding:"32px 24px", maxWidth:1200, margin:"0 auto" }}>
      <h1 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:"clamp(26px,4vw,38px)", fontWeight:500, color:C.ink, letterSpacing:"-0.02em", margin:"0 0 4px" }}>
        {isAgencyAdmin || isAgencyMember ? `${agencyName} Talent Directory` : "Talent Tracking"}
      </h1>
      <p style={{ color:isAgencyAdmin || isAgencyMember ? agencyAccentColor || C.dust : C.dust, fontSize:13, marginBottom:20 }}>
        {isAgencyAdmin || isAgencyMember ? `Manage ${agencyName} submissions and model pipeline status.` : "Manage your model roster and track submission status."}
      </p>

      {(isAgencyAdmin || isAgencyMember) && (
        <div style={{ display:"flex", justifyContent:"flex-start", marginBottom:18 }}>
          <Link
            to="/agency-submit"
            style={{ padding:"10px 16px", background:C.ink, color:C.white, borderRadius:8, fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", textDecoration:"none", fontFamily:"'Inter',sans-serif" }}
          >
            Add Model to {agencyName}
          </Link>
        </div>
      )}

      {(isOwner || isAgencyAdmin || isAgencyMember) && (
        <div style={{ ...card, marginBottom:18 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            <div>
              <p style={{ margin:"0 0 4px", fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:20, color:C.ink }}>Agency Payments</p>
              <p style={{ margin:0, fontSize:12, color:C.dust }}>
                {isOwner ? "Control agency payouts and model subscription payment access." : "Pay enabled model monthly subscriptions securely through PayPal."}
              </p>
            </div>
            <span style={{ padding:"4px 10px", borderRadius:999, fontSize:11, fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase", background:paypalStatus.mode === "live" ? C.okBg : C.warnBg, color:paypalStatus.mode === "live" ? C.ok : C.warn, border:`1px solid ${paypalStatus.mode === "live" ? "rgba(26,102,54,0.3)" : "rgba(146,86,10,0.28)"}` }}>
              {paypalStatus.loading ? "Checking" : paypalStatus.mode === "live" ? "PayPal Live" : "PayPal Sandbox"}
            </span>
          </div>

          {!paypalStatus.configured && (
            <p style={{ margin:"10px 0 0", fontSize:12, color:C.err }}>
              PayPal is not configured on this app yet.
            </p>
          )}

          {isOwner && (
            <div style={{ marginTop:12, borderTop:`1px solid ${C.smoke}`, paddingTop:12 }}>
              <p style={{ margin:"0 0 8px", fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:C.dust }}>Owner Payout to Agency</p>
              {!paypalStatus.agencyPayoutsEnabled && (
                <p style={{ margin:"0 0 8px", fontSize:12, color:C.warn }}>
                  Agency payouts are disabled. Set PAYPAL_AGENCY_PAYOUTS_ENABLED=1 to enable owner payouts.
                </p>
              )}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:8, marginBottom:8 }}>
                <select
                  value={agencyPayoutDraft.agencyId}
                  onChange={(e) => setAgencyPayoutDraft((prev) => ({ ...prev, agencyId: e.target.value }))}
                  style={inp}
                >
                  <option value="">Select agency</option>
                  {agencyList.map((agency) => (
                    <option key={agency.id} value={agency.id}>{agency.name}</option>
                  ))}
                </select>
                <input
                  type="email"
                  value={agencyPayoutDraft.recipientEmail}
                  onChange={(e) => setAgencyPayoutDraft((prev) => ({ ...prev, recipientEmail: e.target.value }))}
                  placeholder="Agency PayPal email"
                  style={inp}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={agencyPayoutDraft.amount}
                  onChange={(e) => setAgencyPayoutDraft((prev) => ({ ...prev, amount: e.target.value }))}
                  placeholder="Payout amount"
                  style={inp}
                />
                <input
                  type="text"
                  value={agencyPayoutDraft.note}
                  onChange={(e) => setAgencyPayoutDraft((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder="Payout note"
                  style={inp}
                />
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                <button
                  onClick={sendAgencyPayout}
                  disabled={sendingAgencyPayout || !paypalStatus.agencyPayoutsEnabled}
                  style={{ padding:"8px 12px", background:C.ink, color:C.white, border:"none", borderRadius:8, fontSize:11, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", cursor:sendingAgencyPayout ? "not-allowed" : "pointer", opacity:(!paypalStatus.agencyPayoutsEnabled || sendingAgencyPayout) ? 0.6 : 1, fontFamily:"'Inter',sans-serif" }}
                >
                  {sendingAgencyPayout ? "Sending..." : "Send Agency Payout"}
                </button>
                {agencyPayoutResult.message && (
                  <span style={{ fontSize:12, color:agencyPayoutResult.type === "ok" ? C.ok : C.err }}>
                    {agencyPayoutResult.message}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ position:"relative", marginBottom:24 }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or email…"
          style={{ padding:"11px 13px 11px 38px", fontSize:13, color:C.ink, background:C.white, border:`1px solid ${C.smoke}`, borderRadius:8, outline:"none", fontFamily:"'Inter',sans-serif", width:"100%", boxSizing:"border-box" }}
        />
        <svg style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", width:15, height:15, color:C.dust, pointerEvents:"none" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <circle cx={11} cy={11} r={8}/><path d="m21 21-4.35-4.35"/>
        </svg>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:C.dust, fontSize:16, lineHeight:1, padding:"2px 4px" }}
            aria-label="Clear search"
          >×</button>
        )}
      </div>

      {canAddModels && (
        <div style={{ ...card, marginBottom:24, padding:"22px 22px" }}>
          <p style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:18, fontWeight:500, color:C.ink, margin:"0 0 14px" }}>Add Model Manually</p>
          <form onSubmit={handleAddModel} style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <input value={form.name} placeholder="Model name" onChange={(e)=>setForm({...form,name:e.target.value})} required style={inp} />
            <input value={form.email} placeholder="Model email" type="email" onChange={(e)=>setForm({...form,email:e.target.value})} required style={inp} />
            <input value={form.instagram} placeholder="Instagram" onChange={(e)=>setForm({...form,instagram:e.target.value})} style={inp} />
            <input value={form.height} placeholder="Height (optional)" onChange={(e)=>setForm({...form,height:e.target.value})} style={inp} />
            <select value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})} style={{ ...inp, appearance:"none", gridColumn:"1/-1" }}>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            {saveError && <p style={{ color:C.err, margin:0, gridColumn:"1/-1", fontSize:13 }}>{saveError}</p>}
            <button disabled={saveLoading} style={{ gridColumn:"1/-1", padding:"12px 20px", background:C.ink, color:C.white, border:"none", borderRadius:8, fontSize:12, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", cursor:saveLoading?"not-allowed":"pointer", opacity:saveLoading?0.55:1, fontFamily:"'Inter',sans-serif" }}>
              {saveLoading ? "Saving…" : "Add Model"}
            </button>
          </form>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:12, marginBottom:24 }}>
        {modelMetricCards.map(m=>(
          <div key={m.label} style={{ background:C.white, border:`1px solid ${C.smoke}`, borderRadius:12, padding:18, boxShadow:"0 1px 4px rgba(17,17,17,0.04)" }}>
            <p style={{ margin:"0 0 4px", fontSize:11, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:C.dust }}>{m.label}</p>
            <p style={{ margin:0, fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:32, fontWeight:500, color:C.ink, lineHeight:1 }}>{m.value}</p>
          </div>
        ))}
      </div>

      {isOwner && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div>
              <p style={{ margin: "0 0 4px", fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize: 20, color: C.ink }}>Media Reindex</p>
              <p style={{ margin: 0, fontSize: 12, color: C.dust }}>Scan all current models for digitals and portfolio coverage.</p>
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <button
                onClick={runMediaReindex}
                disabled={mediaScanLoading || loading}
                style={{ padding:"10px 14px", background:C.ink, color:C.white, border:"none", borderRadius:8, fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", cursor:(mediaScanLoading || loading)?"not-allowed":"pointer", opacity:(mediaScanLoading || loading)?0.6:1, fontFamily:"'Inter',sans-serif" }}
              >
                {mediaScanLoading ? `Scanning ${mediaScanProgress.scanned}/${mediaScanProgress.total || models.length}` : "Reindex Media"}
              </button>
              <button
                onClick={runMediaQualityAudit}
                disabled={mediaQualityLoading || loading}
                style={{ padding:"10px 14px", background:C.infoBg, color:C.info || "#1e3a5f", border:`1px solid rgba(30,58,95,0.16)`, borderRadius:8, fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", cursor:(mediaQualityLoading || loading)?"not-allowed":"pointer", opacity:(mediaQualityLoading || loading)?0.6:1, fontFamily:"'Inter',sans-serif" }}
              >
                {mediaQualityLoading ? `Auditing ${mediaQualityProgress.scanned}/${mediaQualityProgress.total || models.length}` : "Run Quality Audit"}
              </button>
            </div>
          </div>

          {mediaScanError && <p style={{ margin: "10px 0 0", color: C.err, fontSize: 13 }}>{mediaScanError}</p>}

          {mediaScanReport && (
            <div style={{ marginTop: 12, borderTop: `1px solid ${C.smoke}`, paddingTop: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8, marginBottom: 10 }}>
                <div style={{ background: C.ivory, border:`1px solid ${C.smoke}`, borderRadius:8, padding:"8px 10px" }}><span style={{ fontSize:11, color:C.dust }}>With Digitals</span><div style={{ fontSize:18, color:C.ink, fontWeight:700 }}>{mediaScanReport.withDigitals}</div></div>
                <div style={{ background: C.ivory, border:`1px solid ${C.smoke}`, borderRadius:8, padding:"8px 10px" }}><span style={{ fontSize:11, color:C.dust }}>With Portfolio</span><div style={{ fontSize:18, color:C.ink, fontWeight:700 }}>{mediaScanReport.withPortfolio}</div></div>
                <div style={{ background: C.warnBg, border:`1px solid rgba(146,86,10,0.2)`, borderRadius:8, padding:"8px 10px" }}><span style={{ fontSize:11, color:C.warn }}>Missing Digitals</span><div style={{ fontSize:18, color:C.warn, fontWeight:700 }}>{mediaScanReport.missingDigitals}</div></div>
                <div style={{ background: C.warnBg, border:`1px solid rgba(146,86,10,0.2)`, borderRadius:8, padding:"8px 10px" }}><span style={{ fontSize:11, color:C.warn }}>Missing Portfolio</span><div style={{ fontSize:18, color:C.warn, fontWeight:700 }}>{mediaScanReport.missingPortfolio}</div></div>
                <div style={{ background: C.errBg, border:`1px solid rgba(155,28,28,0.2)`, borderRadius:8, padding:"8px 10px" }}><span style={{ fontSize:11, color:C.err }}>Missing Both</span><div style={{ fontSize:18, color:C.err, fontWeight:700 }}>{mediaScanReport.missingBoth}</div></div>
              </div>

              {mediaScanReport.details.length > 0 && (
                <div style={{ maxHeight: 220, overflow: "auto", border:`1px solid ${C.smoke}`, borderRadius:8 }}>
                  {mediaScanReport.details.map((row) => (
                    <div key={row.id} style={{ display:"grid", gridTemplateColumns:"1fr auto auto", gap:10, alignItems:"center", padding:"8px 10px", borderBottom:`1px solid ${C.smoke}` }}>
                      <div>
                        <div style={{ fontSize:13, color:C.ink, fontWeight:600 }}>{row.name}</div>
                        <div style={{ fontSize:11, color:C.dust }}>{row.email || "No email"}</div>
                      </div>
                      <span style={{ fontSize:11, color: row.digitalsCount ? C.ok : C.warn, fontWeight:700, letterSpacing:"0.04em", textTransform:"uppercase" }}>Digitals: {row.digitalsCount}</span>
                      <span style={{ fontSize:11, color: row.portfolioCount ? C.ok : C.warn, fontWeight:700, letterSpacing:"0.04em", textTransform:"uppercase" }}>Portfolio: {row.portfolioCount}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {mediaQualityError && <p style={{ margin: "10px 0 0", color: C.err, fontSize: 13 }}>{mediaQualityError}</p>}

          {mediaQualityReport && (
            <div style={{ marginTop: 12, borderTop: `1px solid ${C.smoke}`, paddingTop: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8, marginBottom: 10 }}>
                <div style={{ background: C.ivory, border:`1px solid ${C.smoke}`, borderRadius:8, padding:"8px 10px" }}><span style={{ fontSize:11, color:C.dust }}>Models Audited</span><div style={{ fontSize:18, color:C.ink, fontWeight:700 }}>{mediaQualityReport.scanned}</div></div>
                <div style={{ background: C.warnBg, border:`1px solid rgba(146,86,10,0.2)`, borderRadius:8, padding:"8px 10px" }}><span style={{ fontSize:11, color:C.warn }}>Flagged Photos</span><div style={{ fontSize:18, color:C.warn, fontWeight:700 }}>{mediaQualityReport.flaggedDigitals}</div></div>
                <div style={{ background: C.warnBg, border:`1px solid rgba(146,86,10,0.2)`, borderRadius:8, padding:"8px 10px" }}><span style={{ fontSize:11, color:C.warn }}>Flagged Videos</span><div style={{ fontSize:18, color:C.warn, fontWeight:700 }}>{mediaQualityReport.flaggedVideos}</div></div>
                <div style={{ background: C.errBg, border:`1px solid rgba(155,28,28,0.2)`, borderRadius:8, padding:"8px 10px" }}><span style={{ fontSize:11, color:C.err }}>Needs Re-upload</span><div style={{ fontSize:18, color:C.err, fontWeight:700 }}>{mediaQualityReport.flaggedRows}</div></div>
              </div>

              {mediaQualityReport.details.length > 0 ? (
                <div style={{ maxHeight: 260, overflow: "auto", border:`1px solid ${C.smoke}`, borderRadius:8 }}>
                  {mediaQualityReport.details.map((row) => (
                    <div key={row.id} style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) auto auto", gap:10, alignItems:"center", padding:"8px 10px", borderBottom:`1px solid ${C.smoke}` }}>
                      <div>
                        <div style={{ fontSize:13, color:C.ink, fontWeight:600 }}>{row.name}</div>
                        <div style={{ fontSize:11, color:C.dust }}>{row.email || "No email"}</div>
                      </div>
                      <span style={{ fontSize:11, color: row.flaggedDigital ? C.err : C.ok, fontWeight:700, letterSpacing:"0.04em", textTransform:"uppercase" }}>
                        Photo: {row.digitalDimensions}
                      </span>
                      <span style={{ fontSize:11, color: row.flaggedVideo ? C.err : C.ok, fontWeight:700, letterSpacing:"0.04em", textTransform:"uppercase" }}>
                        Video: {row.videoDimensions}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin:0, fontSize:12, color:C.ok }}>No current digitals or videos were flagged below the active upload standard.</p>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ display:"flex", gap:8, marginBottom:16, borderBottom:`1px solid ${C.smoke}`, overflowX:"auto" }}>
        <button
          onClick={() => setActiveTab("all")}
          style={{
            padding:"9px 14px",
            background:activeTab === "all" ? C.ink : C.white,
            color:activeTab === "all" ? C.white : C.ink,
            border:"none",
            borderBottom:activeTab === "all" ? `3px solid ${C.ink}` : "3px solid transparent",
            borderRadius:"8px 8px 0 0",
            fontSize:12,
            fontWeight:700,
            letterSpacing:"0.05em",
            textTransform:"uppercase",
            cursor:"pointer",
            fontFamily:"'Inter',sans-serif",
            whiteSpace:"nowrap",
          }}
        >
          All Models ({models.length})
        </button>
        <button
          onClick={() => setActiveTab("shared")}
          style={{
            padding:"9px 14px",
            background:activeTab === "shared" ? C.ok : C.white,
            color:activeTab === "shared" ? C.white : C.ink,
            border:"none",
            borderBottom:activeTab === "shared" ? `3px solid ${C.ok}` : "3px solid transparent",
            borderRadius:"8px 8px 0 0",
            fontSize:12,
            fontWeight:700,
            letterSpacing:"0.05em",
            textTransform:"uppercase",
            cursor:"pointer",
            fontFamily:"'Inter',sans-serif",
            whiteSpace:"nowrap",
          }}
        >
          Shared with Agencies ({sharedCount})
        </button>
        <button
          onClick={() => setActiveTab("not-shared")}
          style={{
            padding:"9px 14px",
            background:activeTab === "not-shared" ? C.warn : C.white,
            color:activeTab === "not-shared" ? C.white : C.ink,
            border:"none",
            borderBottom:activeTab === "not-shared" ? `3px solid ${C.warn}` : "3px solid transparent",
            borderRadius:"8px 8px 0 0",
            fontSize:12,
            fontWeight:700,
            letterSpacing:"0.05em",
            textTransform:"uppercase",
            cursor:"pointer",
            fontFamily:"'Inter',sans-serif",
            whiteSpace:"nowrap",
          }}
        >
          Not Shared ({notSharedCount})
        </button>
      </div>

      {loading && <p style={{ color:C.dust }}>Loading models…</p>}
      {error && <p style={{ color:C.err }}>{error}</p>}
      {!loading && searchQuery && (
        <p style={{ fontSize:12, color:C.dust, marginBottom:12 }}>
          {tabbedModels.length === 0
            ? `No models match "${searchQuery}"`
            : `Showing ${tabbedModels.length} of ${models.length} model${models.length !== 1 ? "s" : ""}`}
        </p>
      )}
      {!loading && tabbedModels.map(model => {
        const [bg,clr] = statusStyle[model.status] || [C.ivory,C.slate];
        const dState = expandedDigitals[model.id];
        const imageSrc = getModelImageSrc(model.image_url);
        const showImage = Boolean(imageSrc) && !imageLoadFailed[model.id];
        const isDigitalsPending = model.pipeline_stage === "digitals_pending";
        return (
          <div key={model.id} style={card}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, flexWrap:"wrap" }}>
              {/* Avatar + info */}
              <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                {showImage ? (
                  <img
                    src={imageSrc}
                    alt={model.name}
                    loading="lazy"
                    decoding="async"
                    onError={() => setImageLoadFailed((prev) => ({ ...prev, [model.id]: true }))}
                    style={{ width:52, height:52, borderRadius:10, objectFit:"cover", flexShrink:0, border:`1px solid ${C.smoke}`, background:C.ivory }}
                  />
                ) : (
                  <div style={{ width:52, height:52, borderRadius:10, background:C.ivory, border:`1px solid ${C.smoke}`, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:20, color:C.dust }}>
                    {(model.name || "?")[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <p style={{ margin:"0 0 4px", fontSize:15, fontWeight:600, color:C.ink }}>{model.name}</p>
                  <p style={{ margin:"0 0 2px", fontSize:13, color:C.dust }}>{model.email}</p>
                  <p style={{ margin:0, fontSize:13, color:C.dust }}>{model.instagram || "No Instagram"}</p>
                </div>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                {model.source === "manychat" && (
                  <span style={{ padding:"3px 10px", background:"rgba(123,47,247,0.1)", color:"#7b2ff7", borderRadius:99, fontSize:11, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase" }}>ManyChat</span>
                )}
                <span style={{ padding:"3px 10px", background:bg, color:clr, borderRadius:99, fontSize:11, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase" }}>{model.status}</span>
                <button
                  onClick={() => composeById[model.id] ? closeCompose(model.id) : openCompose(model)}
                  disabled={!model.email}
                  title={model.email ? "Compose email to this model" : "Model has no email address"}
                  style={{ padding:"4px 10px", background:composeById[model.id] ? C.smoke : (model.email ? C.ivory : "#f3f3f3"), color:model.email ? C.slate : C.dust, border:`1px solid ${C.smoke}`, borderRadius:7, fontSize:11, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", cursor:model.email ? "pointer" : "not-allowed", fontFamily:"'Inter',sans-serif" }}
                >
                  {composeById[model.id] ? "Cancel" : "Email Model"}
                </button>
                {emailResultById[model.id] === "sent" && <span style={{ fontSize:11, color:C.ok, fontWeight:600 }}>Email sent</span>}
                {emailResultById[model.id] === "failed" && <span style={{ fontSize:11, color:"#c0392b", fontWeight:600 }}>Send failed</span>}
                <button
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/digitals/${model.id}`)}
                  title="Copy digitals upload link"
                  style={{ padding:"4px 10px", background:C.okBg, color:C.ok, border:`1px solid rgba(26,102,54,0.2)`, borderRadius:7, fontSize:11, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
                >
                  Copy Digitals Link
                </button>
                <button
                  onClick={() => window.open(`${window.location.origin}/digitals/${model.id}`, "_blank", "noopener,noreferrer")}
                  title="Open digitals portal"
                  style={{ padding:"4px 10px", background:C.ink, color:C.white, border:`1px solid ${C.ink}`, borderRadius:7, fontSize:11, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
                >
                  Open Digitals
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/talent/${model.id}`)}
                  title="Copy public portfolio link"
                  style={{ padding:"4px 10px", background:C.ivory, color:C.dust, border:`1px solid ${C.smoke}`, borderRadius:7, fontSize:11, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
                >
                  Copy Public Portfolio
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/portfolio/${model.id}`)}
                  title="Copy portfolio upload link"
                  style={{ padding:"4px 10px", background:C.okBg, color:C.ok, border:`1px solid rgba(26,102,54,0.2)`, borderRadius:7, fontSize:11, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
                >
                  Copy Portfolio Upload
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(buildPublicAppUrl(`/champ-snapshot/${encodeURIComponent(model.id)}`))}
                  title="Copy live CHAMP snapshot link"
                  style={{ padding:"4px 10px", background:isDigitalsPending ? C.warnBg : C.ivory, color:isDigitalsPending ? C.warn : C.slate, border:`1px solid ${isDigitalsPending ? "rgba(146,86,10,0.25)" : C.smoke}`, borderRadius:7, fontSize:11, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
                >
                  Copy CHAMP Snapshot
                </button>
                <button
                  onClick={() => window.open(buildPublicAppUrl(`/champ-snapshot/${encodeURIComponent(model.id)}`), "_blank", "noopener,noreferrer")}
                  title="Open live CHAMP snapshot"
                  style={{ padding:"4px 10px", background:C.ink, color:C.white, border:`1px solid ${C.ink}`, borderRadius:7, fontSize:11, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
                >
                  Open CHAMP Snapshot
                </button>
                {isDigitalsPending && (
                  <button
                    onClick={() => sendSnapshotLinkEmail(model)}
                    disabled={!model.email || !!snapshotSendById[model.id]}
                    title={model.email ? "Email live CHAMP snapshot link" : "Model has no email address"}
                    style={{ padding:"4px 10px", background:C.warnBg, color:C.warn, border:`1px solid rgba(146,86,10,0.22)`, borderRadius:7, fontSize:11, fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase", cursor:(!model.email || snapshotSendById[model.id]) ? "not-allowed" : "pointer", fontFamily:"'Inter',sans-serif", opacity:(!model.email || snapshotSendById[model.id]) ? 0.65 : 1 }}
                  >
                    {snapshotSendById[model.id] ? "Sending..." : "Send Snapshot Link"}
                  </button>
                )}
                {snapshotSendResultById[model.id] === "sent" && <span style={{ fontSize:11, color:C.ok, fontWeight:600 }}>Snapshot email sent</span>}
                {snapshotSendResultById[model.id] === "failed" && <span style={{ fontSize:11, color:"#c0392b", fontWeight:600 }}>Snapshot send failed</span>}
                <button
                  onClick={() => window.open(`${window.location.origin}/portfolio/${model.id}`, "_blank", "noopener,noreferrer")}
                  title="Open portfolio upload portal"
                  style={{ padding:"4px 10px", background:C.ink, color:C.white, border:`1px solid ${C.ink}`, borderRadius:7, fontSize:11, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
                >
                  Open Portfolio Upload
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/videos/${model.id}`)}
                  title="Copy video upload link"
                  style={{ padding:"4px 10px", background:C.okBg, color:C.ok, border:`1px solid rgba(26,102,54,0.2)`, borderRadius:7, fontSize:11, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
                >
                  Copy Video Upload
                </button>
                <button
                  onClick={() => window.open(`${window.location.origin}/videos/${model.id}`, "_blank", "noopener,noreferrer")}
                  title="Open video upload portal"
                  style={{ padding:"4px 10px", background:C.ink, color:C.white, border:`1px solid ${C.ink}`, borderRadius:7, fontSize:11, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
                >
                  Open Video Upload
                </button>
                {/* Removed agency visibility button for isAdmin */}
              </div>
            </div>

            {composeById[model.id] && (
              <div style={{ marginTop:10, padding:"14px 16px", background:C.ivory, border:`1px solid ${C.smoke}`, borderRadius:10 }}>
                <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:C.dust }}>Compose Email to {model.name}</p>
                <div style={{ marginBottom:8 }}>
                  <label style={{ display:"block", fontSize:11, fontWeight:600, color:C.dust, marginBottom:4, letterSpacing:"0.05em", textTransform:"uppercase" }}>Subject</label>
                  <input
                    value={composeById[model.id].subject}
                    onChange={e => setComposeById(prev => ({ ...prev, [model.id]: { ...prev[model.id], subject: e.target.value } }))}
                    style={{ width:"100%", padding:"7px 10px", border:`1px solid ${C.smoke}`, borderRadius:7, fontSize:13, fontFamily:"'Inter',sans-serif", boxSizing:"border-box", background:"#fff", color:C.ink }}
                  />
                </div>
                <div style={{ marginBottom:10 }}>
                  <label style={{ display:"block", fontSize:11, fontWeight:600, color:C.dust, marginBottom:4, letterSpacing:"0.05em", textTransform:"uppercase" }}>Message</label>
                  <textarea
                    rows={5}
                    value={composeById[model.id].message}
                    onChange={e => setComposeById(prev => ({ ...prev, [model.id]: { ...prev[model.id], message: e.target.value } }))}
                    style={{ width:"100%", padding:"7px 10px", border:`1px solid ${C.smoke}`, borderRadius:7, fontSize:13, fontFamily:"'Inter',sans-serif", boxSizing:"border-box", resize:"vertical", background:"#fff", color:C.ink }}
                  />
                </div>
                {/* Attachments */}
                <div style={{ marginBottom:10 }}>
                  <label style={{ display:"block", fontSize:11, fontWeight:600, color:C.dust, marginBottom:6, letterSpacing:"0.05em", textTransform:"uppercase" }}>Attachments — images &amp; PDFs (max {ATTACH_MAX_MB} MB each, {ATTACH_TOTAL_MAX_MB} MB total)</label>
                  {(attachmentsById[model.id] || []).length > 0 && (
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:8 }}>
                      {(attachmentsById[model.id] || []).map((att, idx) => (
                        <div key={idx} style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px", background:C.white, border:`1px solid ${C.smoke}`, borderRadius:7, fontSize:12 }}>
                          <span style={{ color:C.slate, maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{att.filename}</span>
                          <span style={{ color:C.dust, fontSize:11 }}>({att.sizeLabel})</span>
                          <button
                            onClick={() => removeAttachment(model.id, idx)}
                            style={{ background:"none", border:"none", cursor:"pointer", color:C.dust, fontSize:14, lineHeight:1, padding:"0 2px" }}
                            aria-label={`Remove ${att.filename}`}
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label style={{ display:"inline-block", padding:"6px 12px", background:C.ivory, border:`1px solid ${C.smoke}`, borderRadius:7, fontSize:11, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif", color:C.slate }}>
                    + Add Files
                    <input
                      type="file"
                      multiple
                      accept={ATTACH_ALLOWED}
                      style={{ display:"none" }}
                      onChange={e => {
                        if (e.target.files?.length) handleAttachFiles(model.id, Array.from(e.target.files));
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <button
                    onClick={() => sendComposedEmail(model)}
                    disabled={sendingEmailId === model.id || !composeById[model.id]?.subject.trim() || !composeById[model.id]?.message.trim()}
                    style={{ padding:"6px 16px", background:C.ink, color:C.white, border:"none", borderRadius:7, fontSize:12, fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase", cursor:sendingEmailId === model.id ? "not-allowed" : "pointer", fontFamily:"'Inter',sans-serif" }}
                  >
                    {sendingEmailId === model.id ? "Sending..." : "Send Email"}
                  </button>
                  <button
                    onClick={() => closeCompose(model.id)}
                    disabled={sendingEmailId === model.id}
                    style={{ padding:"6px 12px", background:"transparent", color:C.dust, border:`1px solid ${C.smoke}`, borderRadius:7, fontSize:12, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
                  >
                    Cancel
                  </button>
                  {emailResultById[model.id] === "failed" && <span style={{ fontSize:11, color:"#c0392b", fontWeight:600 }}>Send failed — try again</span>}
                </div>
              </div>
            )}

            {/* Follow-up templates for admin / support lead */}
            {canViewTemplates && (
              <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${C.smoke}` }}>
                <p style={{ margin:"0 0 6px", fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:C.dust }}>Follow-up Templates</p>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {MODEL_FOLLOWUP_TEMPLATES.map(({ label, template }) => {
                    const tplKey = `${model.id}-${label}`;
                    const copied = !!copiedTpl[tplKey];
                    return (
                      <button
                        key={label}
                        onClick={() => {
                          navigator.clipboard.writeText(template(model.name || "there"));
                          setCopiedTpl(prev => ({ ...prev, [tplKey]: true }));
                          setTimeout(() => setCopiedTpl(prev => ({ ...prev, [tplKey]: false })), 2000);
                        }}
                        title={`Copy "${label}" message`}
                        style={{ padding:"5px 10px", background: copied ? C.okBg : C.ivory, color: copied ? C.ok : C.slate, border:`1px solid ${copied ? "rgba(26,102,54,0.3)" : C.smoke}`, borderRadius:7, fontSize:11, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
                      >
                        {copied ? "✓ Copied" : `📋 ${label}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {(isOwner || isAgencyAdmin || isAgencyMember) && (
              <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${C.smoke}` }}>
                <p style={{ margin:"0 0 8px", fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:C.dust }}>
                  Model Subscription Payment
                </p>

                {isOwner && (
                  <div style={{ display:"grid", gap:8, marginBottom:8 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    <button
                      onClick={() => setSubscriptionDraftById((prev) => {
                        const currentEnabled = prev[model.id]?.enabled !== undefined
                          ? prev[model.id].enabled === true
                          : model.agency_subscription_payment_enabled === true;
                        return {
                          ...prev,
                          [model.id]: {
                            ...prev[model.id],
                            enabled: !currentEnabled,
                            amount: prev[model.id]?.amount ?? String(model.agency_subscription_monthly_amount || ""),
                          },
                        };
                      })}
                      style={{ padding:"4px 10px", background:(subscriptionDraftById[model.id]?.enabled ?? model.agency_subscription_payment_enabled) ? C.okBg : C.ivory, color:(subscriptionDraftById[model.id]?.enabled ?? model.agency_subscription_payment_enabled) ? C.ok : C.slate, border:`1px solid ${(subscriptionDraftById[model.id]?.enabled ?? model.agency_subscription_payment_enabled) ? "rgba(26,102,54,0.3)" : C.smoke}`, borderRadius:7, fontSize:11, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
                    >
                      {(subscriptionDraftById[model.id]?.enabled ?? model.agency_subscription_payment_enabled) ? "Enabled" : "Disabled"}
                    </button>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={subscriptionDraftById[model.id]?.amount ?? String(model.agency_subscription_monthly_amount || "")}
                      onChange={(e) => setSubscriptionDraftById((prev) => ({
                        ...prev,
                        [model.id]: {
                          ...prev[model.id],
                          enabled: prev[model.id]?.enabled !== undefined ? prev[model.id].enabled : model.agency_subscription_payment_enabled === true,
                          amount: e.target.value,
                        },
                      }))}
                      placeholder="Monthly amount"
                      style={{ ...inp, maxWidth:150, padding:"7px 9px", fontSize:12 }}
                    />
                    <button
                      onClick={() => saveModelSubscriptionPayment(model)}
                      disabled={!!savingSubscriptionById[model.id] || !paypalStatus.modelSubscriptionsEnabled}
                      style={{ padding:"6px 12px", background:C.ink, color:C.white, border:"none", borderRadius:7, fontSize:11, fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase", cursor:(!paypalStatus.modelSubscriptionsEnabled || savingSubscriptionById[model.id]) ? "not-allowed" : "pointer", fontFamily:"'Inter',sans-serif", opacity:(!paypalStatus.modelSubscriptionsEnabled || savingSubscriptionById[model.id]) ? 0.6 : 1 }}
                    >
                      {savingSubscriptionById[model.id] ? "Saving..." : "Save Payment Rule"}
                    </button>
                    <button
                      onClick={() => {
                        const currentlyOpen = showManualPaymentById[model.id] === true;
                        setShowManualPaymentById((prev) => ({ ...prev, [model.id]: !currentlyOpen }));
                        if (!currentlyOpen) {
                          setManualPaymentDraftById((prev) => ({
                            ...prev,
                            [model.id]: {
                              amount: prev[model.id]?.amount ?? String(model.agency_subscription_monthly_amount || ""),
                              paidAt: prev[model.id]?.paidAt ?? new Date().toISOString().slice(0, 10),
                              reference: prev[model.id]?.reference ?? "",
                            },
                          }));
                        }
                      }}
                      style={{ padding:"6px 12px", background:C.ivory, color:C.slate, border:`1px solid ${C.smoke}`, borderRadius:7, fontSize:11, fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
                    >
                      {showManualPaymentById[model.id] ? "Hide Manual Entry" : "Record Manual Payment"}
                    </button>
                    </div>

                    {showManualPaymentById[model.id] && (
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", background:C.ivory, border:`1px solid ${C.smoke}`, borderRadius:8, padding:"8px 10px" }}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={manualPaymentDraftById[model.id]?.amount ?? ""}
                          onChange={(e) => setManualPaymentDraftById((prev) => ({
                            ...prev,
                            [model.id]: {
                              ...prev[model.id],
                              amount: e.target.value,
                            },
                          }))}
                          placeholder="Amount"
                          style={{ ...inp, maxWidth:120, padding:"6px 8px", fontSize:12 }}
                        />
                        <input
                          type="date"
                          value={manualPaymentDraftById[model.id]?.paidAt ?? ""}
                          onChange={(e) => setManualPaymentDraftById((prev) => ({
                            ...prev,
                            [model.id]: {
                              ...prev[model.id],
                              paidAt: e.target.value,
                            },
                          }))}
                          style={{ ...inp, maxWidth:150, padding:"6px 8px", fontSize:12 }}
                        />
                        <input
                          type="text"
                          value={manualPaymentDraftById[model.id]?.reference ?? ""}
                          onChange={(e) => setManualPaymentDraftById((prev) => ({
                            ...prev,
                            [model.id]: {
                              ...prev[model.id],
                              reference: e.target.value,
                            },
                          }))}
                          placeholder="Reference (optional)"
                          style={{ ...inp, minWidth:180, padding:"6px 8px", fontSize:12 }}
                        />
                        <button
                          onClick={() => recordManualSubscriptionPayment(model)}
                          disabled={!!savingManualPaymentById[model.id]}
                          style={{ padding:"6px 12px", background:C.ink, color:C.white, border:"none", borderRadius:7, fontSize:11, fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase", cursor:savingManualPaymentById[model.id] ? "not-allowed" : "pointer", fontFamily:"'Inter',sans-serif", opacity:savingManualPaymentById[model.id] ? 0.7 : 1 }}
                        >
                          {savingManualPaymentById[model.id] ? "Saving..." : "Save Manual Payment"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {(isAgencyAdmin || isAgencyMember) && model.submitted_by_agency_id === agencyId && (
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:8 }}>
                    <button
                      onClick={() => payModelSubscription(model)}
                      disabled={!!payingSubscriptionById[model.id] || !paypalStatus.modelSubscriptionsEnabled || model.agency_subscription_payment_enabled !== true}
                      style={{ padding:"6px 12px", background:C.okBg, color:C.ok, border:`1px solid rgba(26,102,54,0.3)`, borderRadius:7, fontSize:11, fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase", cursor:(!paypalStatus.modelSubscriptionsEnabled || model.agency_subscription_payment_enabled !== true || payingSubscriptionById[model.id]) ? "not-allowed" : "pointer", fontFamily:"'Inter',sans-serif", opacity:(!paypalStatus.modelSubscriptionsEnabled || model.agency_subscription_payment_enabled !== true || payingSubscriptionById[model.id]) ? 0.6 : 1 }}
                    >
                      {payingSubscriptionById[model.id]
                        ? "Opening PayPal..."
                        : model.agency_subscription_payment_enabled === true
                          ? `Pay ${Number(model.agency_subscription_monthly_amount || 0).toLocaleString(undefined, { style: "currency", currency: "USD" })}`
                          : "Payment Disabled by Owner"}
                    </button>
                    {!paypalStatus.modelSubscriptionsEnabled && (
                      <span style={{ fontSize:11, color:C.warn }}>Subscriptions are temporarily disabled.</span>
                    )}
                  </div>
                )}

                {model.agency_subscription_last_paid_status && (
                  <p style={{ margin:0, fontSize:11, color:C.dust }}>
                    Last payment: {model.agency_subscription_last_paid_status}
                    {model.agency_subscription_last_paid_amount ? ` • ${Number(model.agency_subscription_last_paid_amount).toLocaleString(undefined, { style: "currency", currency: "USD" })}` : ""}
                    {model.agency_subscription_last_paid_at ? ` • ${new Date(model.agency_subscription_last_paid_at).toLocaleDateString()}` : ""}
                    {model.agency_subscription_last_paid_order_id ? ` • Ref ${model.agency_subscription_last_paid_order_id}` : ""}
                  </p>
                )}
              </div>
            )}

            {/* Inline digitals toggle and agency visibility toggle */}
            <div style={{ marginTop:10, borderTop:`1px solid ${C.smoke}`, paddingTop:10, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <button
                onClick={() => toggleDigitals(model)}
                style={{ padding:"4px 12px", background:"transparent", color:C.slate, border:`1px solid ${C.smoke}`, borderRadius:7, fontSize:11, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
              >
                {dState?.open ? "Hide Digitals" : "View Digitals"}
              </button>
              {dState?.open && !dState.loading && dState.files.length > 0 && (
                <span style={{ fontSize:11, color:C.dust }}>{dState.files.length} photo{dState.files.length !== 1 ? "s" : ""}</span>
              )}
              <button
                onClick={() => toggleAgencyVisibility(model)}
                disabled={toggleAgencyById[model.id]}
                style={{ padding:"4px 12px", background:model.visible_to_agencies ? C.okBg : C.ivory, color:model.visible_to_agencies ? C.ok : C.slate, border:`1px solid ${model.visible_to_agencies ? "rgba(26,102,54,0.3)" : C.smoke}`, borderRadius:7, fontSize:11, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", cursor:toggleAgencyById[model.id] ? "not-allowed" : "pointer", fontFamily:"'Inter',sans-serif", opacity:toggleAgencyById[model.id] ? 0.6 : 1 }}
              >
                {toggleAgencyById[model.id] ? "Updating..." : (model.visible_to_agencies ? "✓ Shared with Agencies" : "Share with Agencies")}
              </button>
            </div>

            {dState?.open && (
              <div style={{ marginTop:10 }}>
                {dState.loading && <p style={{ color:C.dust, fontSize:13, margin:0 }}>Loading…</p>}
                {!dState.loading && dState.files.length === 0 && (
                  <p style={{ color:C.dust, fontSize:13, margin:0 }}>No digitals uploaded yet.</p>
                )}
                {!dState.loading && dState.files.length > 0 && (
                  <LuxuryPhotoCarousel files={dState.files} title="Digitals archive" />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
