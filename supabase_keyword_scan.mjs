import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envFiles = ['.env', '.env.local', '.env.production'];
const parseEnv = (s) => Object.fromEntries(
  s.split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const i = l.indexOf('=');
      let v = l.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      return [l.slice(0, i).trim(), v];
    })
);

let env = {};
for (const f of envFiles) {
  const p = path.join(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  try { env = { ...env, ...parseEnv(fs.readFileSync(p, 'utf8')) }; } catch {}
}

const url = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.log('ERROR: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const tables = ['models', 'clients', 'bookings', 'users'];
const keywords = ['kouassi', 'benedicta', 'kouassibenedicta46@gmail.com'].map(s => s.toLowerCase());

const compact = (row) => ({
  id: row?.id ?? null,
  name: row?.name ?? null,
  email: row?.email ?? null,
  submitted_at: row?.submitted_at ?? null,
  created_at: row?.created_at ?? null,
  source: row?.source ?? null,
  image_url: row?.image_url ?? null,
});

const hasKeyword = (row) => Object.values(row || {}).some(v => typeof v === 'string' && keywords.some(k => v.toLowerCase().includes(k)));

async function fetchAll(table) {
  const out = [];
  for (let from = 0; from < 100000; from += 1000) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + 999);
    if (error) return { error, rows: out };
    if (!data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return { rows: out };
}

let totalMatches = 0;
const perTable = {};
let modelsRows = [];
let modelsMatches = [];

for (const table of tables) {
  const { rows, error } = await fetchAll(table);
  if (error) {
    console.log(`TABLE ${table}: ERROR ${error.message}${error.code ? ` (code ${error.code})` : ''}`);
    perTable[table] = { rows: 0, matches: 0, error: error.message };
    continue;
  }

  const matches = rows.filter(hasKeyword);
  if (table === 'models') {
    modelsRows = rows;
    modelsMatches = matches;
  }

  totalMatches += matches.length;
  perTable[table] = { rows: rows.length, matches: matches.length };
  console.log(`TABLE ${table}: rows=${rows.length} matches=${matches.length}`);
  for (const row of matches) {
    const c = compact(row);
    console.log(`MATCH ${table} | id=${c.id} | name=${c.name ?? ''} | email=${c.email ?? ''} | submitted_at=${c.submitted_at ?? ''} | created_at=${c.created_at ?? ''} | source=${c.source ?? ''} | image_url=${c.image_url ?? ''}`);
  }
}

if (modelsMatches.length === 0) {
  console.log('MODELS_FALLBACK_RECENT_20');
  const recents = [...modelsRows]
    .sort((a, b) => {
      const ta = new Date(a?.submitted_at || a?.created_at || 0).getTime() || 0;
      const tb = new Date(b?.submitted_at || b?.created_at || 0).getTime() || 0;
      return tb - ta;
    })
    .slice(0, 20);
  for (const row of recents) {
    const c = compact(row);
    console.log(`RECENT models | id=${c.id} | name=${c.name ?? ''} | email=${c.email ?? ''} | submitted_at=${c.submitted_at ?? ''} | created_at=${c.created_at ?? ''} | source=${c.source ?? ''} | image_url=${c.image_url ?? ''}`);
  }
}

console.log(`SUMMARY total_matches=${totalMatches}`);
console.log(`SUMMARY per_table=${JSON.stringify(perTable)}`);
