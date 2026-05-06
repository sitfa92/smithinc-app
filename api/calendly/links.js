const isCalendlyUrl = (value) => /^https?:\/\/(www\.)?calendly\.com\//i.test(String(value || "").trim());

const splitLinks = (value) =>
  String(value || "")
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const toLabel = (key) =>
  String(key || "")
    .replace(/^CALENDLY_?/i, "")
    .replace(/_LINKS?$/i, "")
    .replace(/_/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase()) || "Scheduling";

const collectCalendlyLinks = () => {
  const links = [];
  const env = process.env || {};

  Object.entries(env).forEach(([key, rawValue]) => {
    if (!/^CALENDLY_/i.test(key)) return;

    const values = splitLinks(rawValue);
    values.forEach((url) => {
      if (!isCalendlyUrl(url)) return;
      links.push({
        key,
        label: toLabel(key),
        url,
      });
    });
  });

  const fallback = "https://calendly.com/meetserenity";
  if (!links.length) {
    links.push({ key: "fallback", label: "General", url: fallback });
  }

  const seen = new Set();
  return links.filter((item) => {
    const normalized = item.url.toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const links = collectCalendlyLinks();
  return res.status(200).json({
    configured: links.length > 0,
    links,
  });
}