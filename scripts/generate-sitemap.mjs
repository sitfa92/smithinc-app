import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getInsightSitemapRoutes } from "../src/content/insights.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SITE_URL = "https://meet-serenity.online";
const staticRoutes = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/model-development", changefreq: "weekly", priority: "0.95" },
  { path: "/book", changefreq: "weekly", priority: "0.95" },
  { path: "/contact-team", changefreq: "weekly", priority: "0.85" },
  { path: "/model-signup", changefreq: "weekly", priority: "0.9" },
  { path: "/partner-submit", changefreq: "weekly", priority: "0.85" },
  { path: "/brand-ambassador-submit", changefreq: "weekly", priority: "0.85" },
  { path: "/onboarding", changefreq: "monthly", priority: "0.6" },
];

const routes = [...staticRoutes, ...getInsightSitemapRoutes()];
const lastmod = new Date().toISOString().slice(0, 10);

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...routes.map(({ path: routePath, changefreq, priority }) => [
    '  <url>',
    `    <loc>${SITE_URL}${routePath}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].join("\n")),
  '</urlset>',
  '',
].join("\n");

const sitemapPath = path.resolve(__dirname, "..", "public", "sitemap.xml");
await fs.writeFile(sitemapPath, xml, "utf8");
