import React from "react";
import { supabase } from "../supabase";
import { uploadImage } from "../imageUpload";
import { sendModelSubmissionEmail } from "../emailService";
import {
  isMissingColumnError,
  createInAppAlerts,
  sendInternalTeamEmailAlert,
  sendBackendWebhook,
} from "../utils";

export default function ModelSignup() {
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    instagram: "",
  });
  const [image, setImage] = React.useState(null);
  const [imagePreview, setImagePreview] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!form.name.trim() || !form.email.trim()) {
        throw new Error("Name and email are required");
      }

      if (!image) {
        throw new Error("Please upload a profile image");
      }

      let imageUrl = "";
      try {
        imageUrl = await uploadImage(image);
      } catch (uploadErr) {
        throw new Error(`Image upload failed: ${uploadErr.message}`);
      }

      const baseSubmission = {
        name: form.name.trim(),
        email: form.email.trim(),
        instagram: form.instagram.trim(),
        image_url: imageUrl,
        status: "pending",
        submitted_at: new Date().toISOString(),
      };

      const pipelineSubmission = {
        ...baseSubmission,
        pipeline_stage: "submitted",
        priority_level: "medium",
        scouting_notes: "",
        internal_notes: "",
        agency_name: "",
        last_updated: new Date().toISOString(),
      };

      let { error: supabaseError } = await supabase
        .from("models")
        .insert([pipelineSubmission]);

      if (supabaseError && isMissingColumnError(supabaseError)) {
        const retry = await supabase.from("models").insert([baseSubmission]);
        supabaseError = retry.error;
      }

      if (supabaseError) throw supabaseError;

      sendModelSubmissionEmail({
        name: form.name.trim(),
        email: form.email.trim(),
        instagram: form.instagram.trim(),
      });

      createInAppAlerts([
        {
          title: "New model submission",
          message: `${form.name.trim()} submitted a new application.`,
          audience_role: "admin",
          source_type: "model",
          source_id: form.email.trim().toLowerCase(),
        },
        {
          title: "Model review needed",
          message: `${form.name.trim()} is ready for review in submissions.`,
          audience_role: "agent",
          source_type: "model",
          source_id: form.email.trim().toLowerCase(),
        },
      ]);

      sendInternalTeamEmailAlert({
        subject: `New model submission: ${form.name.trim()}`,
        message: `${form.name.trim()} submitted a model application.\nEmail: ${form.email.trim()}\nInstagram: ${form.instagram.trim() || "N/A"}`,
        roles: ["admin", "agent"],
        submissionEmail: form.email.trim(),
      });

      sendBackendWebhook("model_signup", {
        name: form.name.trim(),
        instagram: form.instagram.trim(),
        height: "",
        status: "pending",
      });

      setSuccess(true);
      setForm({ name: "", email: "", instagram: "" });
      setImage(null);
      setImagePreview("");
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || "Failed to submit. Please try again.");
      console.error("Submission error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", boxSizing: "border-box" }}>
      <h1 style={{ fontSize: "clamp(24px, 5vw, 32px)" }}>Model Signup</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>Full Name *</label>
          <input
            value={form.name}
            placeholder="Your full name"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            disabled={loading}
            style={{ width: "100%", padding: "12px", boxSizing: "border-box", fontSize: "16px", border: "1px solid #ccc", borderRadius: "4px" }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>Email *</label>
          <input
            value={form.email}
            placeholder="your@email.com"
            type="email"
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            disabled={loading}
            style={{ width: "100%", padding: "12px", boxSizing: "border-box", fontSize: "16px", border: "1px solid #ccc", borderRadius: "4px" }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>Instagram</label>
          <input
            value={form.instagram}
            placeholder="@yourprofile"
            onChange={(e) => setForm({ ...form, instagram: e.target.value })}
            disabled={loading}
            style={{ width: "100%", padding: "12px", boxSizing: "border-box", fontSize: "16px", border: "1px solid #ccc", borderRadius: "4px" }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
            Profile Image * (JPG, PNG, GIF, WebP - Max 5MB)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            disabled={loading}
            style={{ width: "100%", padding: "12px", boxSizing: "border-box", fontSize: "16px", border: "1px solid #ccc", borderRadius: "4px" }}
          />
          {imagePreview && (
            <div style={{ marginTop: 15, textAlign: "center" }}>
              <img
                src={imagePreview}
                alt="Preview"
                style={{ maxWidth: "100%", maxHeight: "300px", borderRadius: 8 }}
              />
            </div>
          )}
        </div>

        <button
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: loading ? "#ccc" : "#333",
            color: "white",
            border: "none",
            borderRadius: 4,
            fontSize: 16,
            fontWeight: "bold",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Uploading..." : "Submit Application"}
        </button>
      </form>

      {error && (
        <div style={{ color: "#d32f2f", marginTop: 20, padding: 15, backgroundColor: "#ffebee", borderRadius: 4 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ color: "#388e3c", marginTop: 20, padding: 15, backgroundColor: "#e8f5e9", borderRadius: 4 }}>
          ✓ Application submitted successfully! We'll review it soon.
        </div>
      )}
    </div>
  );
}
