import type { ReactNode } from "react";

import { styles } from "./LiveDeskShell";

type Metric = {
  value: string | number;
  label: string;
};

export function formatDeskDate(value: string | null | undefined) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(date);
}

export function MetricGrid({ items }: { items: Metric[] }) {
  return (
    <div className={styles.metricGrid}>
      {items.map((item) => (
        <div className={styles.metric} key={item.label}>
          <b>{item.value}</b>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "ready" | "warn" | "risk" }) {
  const toneClass = tone === "ready"
    ? styles.badgeReady
    : tone === "warn"
      ? styles.badgeWarn
      : tone === "risk"
        ? styles.badgeRisk
        : "";
  return <span className={`${styles.badge} ${toneClass}`}>{children}</span>;
}

export function DataState({
  title,
  detail,
  state = "warn",
}: {
  title: string;
  detail: string;
  state?: "ready" | "warn" | "risk";
}) {
  const stateClass = state === "ready" ? styles.stateReady : state === "risk" ? styles.stateRisk : styles.stateWarn;
  return (
    <article className={`${styles.stateCard} ${stateClass}`}>
      <h3>{title}</h3>
      <p>{detail}</p>
    </article>
  );
}

export function Panel({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
