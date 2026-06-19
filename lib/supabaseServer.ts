import "server-only";

// Minimal PostgREST client over fetch — used ONLY server-side with the secret key.
// Avoids the supabase-js realtime/WebSocket dependency (which breaks on Node < 22).
const URL = () => {
  const u = process.env.SUPABASE_URL;
  if (!u) throw new Error("SUPABASE_URL not set");
  return `${u}/rest/v1`;
};
const KEY = () => {
  const k = process.env.SUPABASE_SECRET_KEY;
  if (!k) throw new Error("SUPABASE_SECRET_KEY not set");
  return k;
};

function headers(extra: Record<string, string> = {}) {
  const k = KEY();
  return { apikey: k, Authorization: `Bearer ${k}`, "Content-Type": "application/json", ...extra };
}

export async function pgSelect<T = any>(
  table: string,
  filters: Record<string, string>,
  select = "*"
): Promise<T[]> {
  const q = new URLSearchParams({ select });
  for (const [k, v] of Object.entries(filters)) q.append(k, v);
  const res = await fetch(`${URL()}/${table}?${q}`, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`pgSelect ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function pgInsert(table: string, row: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${URL()}/${table}`, {
    method: "POST",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`pgInsert ${table}: ${res.status} ${await res.text()}`);
}

export async function pgUpdate(
  table: string,
  filters: Record<string, string>,
  patch: Record<string, unknown>
): Promise<void> {
  const q = new URLSearchParams(filters);
  const res = await fetch(`${URL()}/${table}?${q}`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`pgUpdate ${table}: ${res.status} ${await res.text()}`);
}
