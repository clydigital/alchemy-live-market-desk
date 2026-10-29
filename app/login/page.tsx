import styles from "./login.module.css";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeOwnerReturnPath } from "@/lib/supabase/owner-return-path";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const errorCopy: Record<string, string> = {
  configuration: "Dashboard authentication has not been fully configured yet.",
  not_allowed: "That Google account is not approved for this dashboard.",
  provider: "Google sign-in could not be started. Check the Supabase Google provider configuration.",
  callback: "Google sign-in returned without a valid session. Please try again.",
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = safeOwnerReturnPath(rawNext);
  const rawError = Array.isArray(params.error) ? params.error[0] : params.error;
  const error = rawError ? errorCopy[rawError] || "Sign-in failed. Please try again." : null;

  // An authorised session must not be made to click "Continue with Google"
  // simply because the visitor opened /login directly or followed an old link.
  let approvedSession = false;
  if (!rawError) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error: claimsError } = await supabase.auth.getClaims();
      const email = typeof data?.claims?.email === "string"
        ? data.claims.email.trim().toLowerCase() : "";
      if (!claimsError && email) {
        const { data: access, error: accessError } = await supabase
          .from("app_access_allowlist")
          .select("email")
          .eq("email", email)
          .eq("active", true)
          .maybeSingle();
        approvedSession = !accessError && !!access;
      }
    } catch {
      // Keep the explicit error/help page accessible when auth is unavailable.
    }
  }
  if (approvedSession) redirect(next);

  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <p className={styles.kicker}>Bluebelly</p>
        <h1 className={styles.title}>Bluebelly Desk Access</h1>
        <p className={styles.copy}>
          Sign in with an approved Google account. Access is currently assigned to
          approved accounts in the Supabase allowlist.
        </p>

        {error && <div className={styles.alert}>{error}</div>}

        <a className={styles.button} href={`/auth/google?next=${encodeURIComponent(next)}`}>
          Continue with Google
        </a>

        <p className={styles.note}>
          API keys and research tokens remain server-side. You do not need to copy them between computers.
        </p>
        <a className={styles.secondary} href="/auth/signout">Clear session and switch account</a>
      </section>
    </main>
  );
}
