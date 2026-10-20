import styles from "./login.module.css";
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

  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <p className={styles.kicker}>Alchemy Markets</p>
        <h1 className={styles.title}>Live Desk Access</h1>
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
