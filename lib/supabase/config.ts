export function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase Auth requires NEXT_PUBLIC_SUPABASE_URL and either NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return { url, key };
}

export function dashboardAuthRequired() {
  return process.env.DASHBOARD_AUTH_REQUIRED === "true";
}

export const MACHINE_AUTH_PATHS = [
  "/api/research-update",
  "/api/video-intake",
] as const;

export const PUBLIC_AUTH_PATHS = [
  "/login",
  "/auth/google",
  "/auth/callback",
  "/auth/signout",
  "/auth/auth-code-error",
] as const;
