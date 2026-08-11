import "server-only";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function intelligenceDatabaseConfigured() {
  return Boolean(supabaseUrl && serviceKey);
}

export async function intelligenceRest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!supabaseUrl || !serviceKey) throw new Error("Intelligence database credentials are not configured.");
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Intelligence database request failed (${response.status}): ${detail.slice(0, 800)}`);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function restSelect(value: string) {
  return encodeURIComponent(value).replace(/%2C/g, ",").replace(/%28/g, "(").replace(/%29/g, ")");
}
