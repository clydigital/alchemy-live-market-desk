import Link from "next/link";
import type { ReactNode } from "react";

import { dashboardAuthRequired } from "@/lib/supabase/config";
import { dataRoutes, deskRoutes, type LiveDeskRoute } from "@/lib/live-desk/routes";

import styles from "./live-desk-shell.module.css";

type Props = {
  activePath: string;
  eyebrow?: string;
  title: string;
  description: string;
  meta?: ReactNode;
  children: ReactNode;
};

function NavRow({ label, routes, activePath }: { label: string; routes: LiveDeskRoute[]; activePath: string }) {
  return (
    <div className={styles.navRow}>
      <span className={styles.navLabel}>{label}</span>
      <div className={styles.navLinks}>
        {routes.map((route) => {
          const active = route.href === activePath;
          return (
            <Link
              key={route.href}
              href={route.href}
              className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
              title={route.description}
            >
              {route.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function LiveDeskShell({ activePath, eyebrow = "Alchemy Research Core", title, description, meta, children }: Props) {
  const authRequired = dashboardAuthRequired();

  return (
    <main className={styles.stage}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brandBlock}>
            <span className={styles.eyebrow}>Research workspace</span>
            <h1>Market Intelligence<br />Workspace</h1>
            <p>Persistent research, source health and Story memory. Dense by design, inspectable by default.</p>
          </div>
          <div className={styles.actions}>
            <span className={styles.status}>Research core online</span>
            <Link className={styles.button} href="/legacy">Legacy workspace</Link>
            <Link className={styles.primaryButton} href="/hybrid-output">Hybrid output</Link>
            {authRequired && (
              <form action="/auth/signout" method="post">
                <button className={styles.signoutButton} type="submit">Sign out</button>
              </form>
            )}
          </div>
        </header>

        <nav className={styles.navigation} aria-label="Live Desk sections">
          <NavRow label="Desk" routes={deskRoutes} activePath={activePath} />
          <NavRow label="Data & tools" routes={dataRoutes} activePath={activePath} />
        </nav>

        <div className={styles.content}>
          <header className={styles.pageHeader}>
            <div>
              <span className={styles.kicker}>{eyebrow}</span>
              <h2>{title}</h2>
              <p>{description}</p>
            </div>
            {meta ? <div className={styles.pageMeta}>{meta}</div> : null}
          </header>
          {children}
        </div>

        <footer className={styles.footer}>
          <div>PR 1 route shell. Existing operational modules remain available in the Legacy workspace.</div>
          <span>Alchemy Research Core</span>
        </footer>
      </section>
    </main>
  );
}

export { styles };
