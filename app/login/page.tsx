import styles from "./login.module.css";
import desk from "@/app/blue-desk/blue-desk.module.css";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import Link from "next/link";
import { headers } from "next/headers";
import { isBluebellyReaderHost } from "@/lib/blue-desk-host";
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
  const bluebelly = isBluebellyReaderHost((await headers()).get("host"));

  const ownerCard = (
      <section className={styles.card}>
        {bluebelly ? <p className={styles.kicker}>BLUE DESK · PRIVATE SECTION</p> : null}
        {!bluebelly ? <p className={styles.kicker}>Alchemy Markets</p> : null}
        <h1 className={styles.title}>{bluebelly ? "Presenter Prep" : "Live Desk Access"}</h1>
        <p className={styles.copy}>
          {bluebelly
            ? "Sign in to open Presenter Prep within Blue Desk. Your private technical readings, article planning and edition history stay protected."
            : "Sign in with an approved Google account. Access is currently assigned to approved accounts in the Supabase allowlist."}
        </p>

        {error && <div className={styles.alert}>{error}</div>}

        <a className={styles.button} href={`/auth/google?next=${encodeURIComponent(next)}`}>
          Continue with Google
        </a>

        <p className={styles.note}>
          API keys and research tokens remain server-side. You do not need to copy them between computers.
        </p>
        <a className={styles.secondary} href="/auth/signout">Clear session and switch account</a>
        {bluebelly ? <p><Link className={styles.secondary} href="/">← Back to Blue Desk</Link></p> : null}
      </section>
  );
  return bluebelly
    ? <main className={desk.page} data-bluebelly-presenter-login="within-blue-desk">
        <BlueDeskHeader activePath="/blue-desk/presenter" />
        <div className={styles.shell} style={{fontFamily:"Figtree, Inter, sans-serif"}}>{ownerCard}</div>
      </main>
    : <main className={styles.shell}>{ownerCard}</main>;
}
