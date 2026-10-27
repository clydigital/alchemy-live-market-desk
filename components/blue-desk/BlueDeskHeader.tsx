import Link from "next/link";
import Image from "next/image";
import { MarketIcon, type MarketIconName } from "./MarketIcon";
import { headers } from "next/headers";
import { blueDeskPublicHref, isBlueDeskPublicReaderHost } from "@/lib/blue-desk-host";

import styles from "@/app/blue-desk/blue-desk.module.css";

// Keep the owner header task-focused. Specialist legacy routes remain reachable
// from their workspaces, not as fifteen competing top-level destinations.
const PRIVATE_NAV = [
  ["Live Market", "/blue-desk"],
  ["Key Stories", "/blue-desk/key-stories"],
  ["Markets", "/markets"],
  ["My Desk", "/my-reports"],
  ["Writing Desk", "/owner/editorial"],
  ["Research Library", "/owner/research"],
  ["Calendar", "/blue-desk/calendar"],
] as const;

// Public Bluebelly is deliberately limited to the route allowlist; never
// advertise owner-only legacy links that its middleware correctly returns 404.
const PUBLIC_NAV = [
  ["Live Market", "/"],
  ["Key Stories", "/key-stories"],
  ["Markets", "/markets"],
  ["Calendar", "/calendar"],
] as const;

const NAV_ICONS: Record<string, MarketIconName> = {
  "Live Market": "market",
  "Markets": "chart",
  "Deep Dive": "deep-dive",
  "Research": "research",
  "Research Library": "research",
  "Data Library": "library",
  "Presenter Prep": "studio",
  "Presenter Studio": "studio",
  "Editorial Studio": "deep-dive",
  "X Wire": "research",
  "Calendar": "calendar",
  "Learn": "learn",
  "Key Stories": "layers",
  "Rates": "rates",
  "What Changed": "divergence",
  "Reports": "library",
  "COTD / OB": "library",
  "Daily Report": "deep-dive",
  "Daily Report Studio": "deep-dive",
  "My Daily Report": "library",
  "My Reports": "library",
  "My Desk": "library",
  "Writing Desk": "deep-dive",
  "Calendar + Earnings": "calendar",
  "Publish Reports": "library",
  "Private Daily Articles": "deep-dive",
};

/** Shared presentation chrome. These links reuse canonical Live Desk pages. */
export default async function BlueDeskHeader({ activePath }: { activePath: string }) {
  const host = (await headers()).get("host");
  const publicHost = isBlueDeskPublicReaderHost(host);
  // Authenticated owner routes must retain their private workspace navigation,
  // even when opened on the canonical hostname that also serves public readers.
  const ownerWorkspace = activePath === "/my-reports" || activePath === "/owner/editorial" || activePath === "/owner/presenter" || activePath === "/owner/research" || activePath === "/owner/publications" || activePath === "/owner/daily-report" || activePath === "/owner/daily-articles" || activePath === "/owner/x-wire";
  const nav = publicHost && !ownerWorkspace ? PUBLIC_NAV : PRIVATE_NAV;
  return (
    <header className={styles.topbar}>
      <Link href={blueDeskPublicHref("/blue-desk", host)} className={styles.brand} aria-label="Blue Desk — Live Market">
        <Image src="/blue-desk-wordmark.svg" alt="Blue Desk" width={272} height={60} priority unoptimized />
      </Link>
      <nav className={styles.nav} aria-label="Blue Desk primary">
        {nav.map(([title, href]) => (
          <Link
            key={href}
            href={blueDeskPublicHref(href, host)}
            aria-current={(href === activePath || (publicHost && ((href === "/" && activePath === "/blue-desk") || (href === "/markets" && activePath === "/blue-desk/markets") || (href === "/key-stories" && activePath === "/blue-desk/key-stories")))) ? "page" : undefined}
            className={(href === activePath || (publicHost && ((href === "/" && activePath === "/blue-desk") || (href === "/markets" && activePath === "/blue-desk/markets") || (href === "/key-stories" && activePath === "/blue-desk/key-stories")))) ? styles.navActive : styles.navItem}
          >
            <MarketIcon name={NAV_ICONS[title] || "market"} size={17} />
            <span>{title}</span>
          </Link>
        ))}
        {publicHost && !ownerWorkspace ? <Link href="/my-reports" className={styles.navItem}
          aria-label="Open private Bluebelly workspace; sign-in required">
          <MarketIcon name="studio" size={17} /><span>My Desk</span>
        </Link> : null}
      </nav>
    </header>
  );
}
