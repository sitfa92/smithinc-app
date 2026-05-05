export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const country = String(
    req.headers["x-vercel-ip-country"] ||
      req.headers["x-country-code"] ||
      req.headers["cf-ipcountry"] ||
      ""
  )
    .trim()
    .toUpperCase();

  return res.status(200).json({ ok: true, country: country || null });
}
