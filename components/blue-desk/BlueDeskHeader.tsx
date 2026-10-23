import Link from "next/link";
import Image from "next/image";
import { MarketIcon, type MarketIconName } from "./MarketIcon";
import { headers } from "next/headers";
import { blueDeskPublicHref, isBlueDeskPublicReaderHost } from "@/lib/blue-desk-host";

import styles from "@/app/blue-desk/blue-desk.module.css";

const PRIVATE_NAV = [
  ["Live Market", "/blue-desk"],
  ["Change Ledger", "/blue-desk/changes"],
  ["Dossier", "/blue-desk/dossier"],
  ["Markets", "/blue-desk/markets"],
  ["Deep Dive", "/articles"],
  ["Research", "/whats-new"],
  ["Data Library", "/data/macro"],
  ["Presenter Prep", "/blue-desk/presenter"],
  ["Calendar", "/blue-desk/calendar"],
  ["Learn", "/blue-desk/learn"],
] as const;

// Public Bluebelly is deliberately limited to the route allowlist; never
// advertise owner-only legacy links that its middleware correctly returns 404.
const PUBLIC_NAV = [
  ["Live Market", "/"],
  ["Key Stories", "/key-stories"],
  ["Rates", "/rates"],
  ["What Changed", "/what-changed"],
  ["Markets", "/markets"],
  ["Calendar", "/calendar"],
  ["Presenter Prep", "/presenter"],
  ["Learn", "/learn"],
] as const;

const NAV_ICONS: Record<string, MarketIconName> = {
  "Live Market": "market",
  "Key Stories": "layers",
  "What Changed": "divergence",
  "Change Ledger": "research",
  "Dossier": "library",
  "Markets": "chart",
  "Deep Dive": "deep-dive",
  "Research": "research",
  "Data Library": "library",
  "Presenter Prep": "studio",
  "Calendar": "calendar",
  "Learn": "learn",
  "Rates": "rates",
};

/** Shared presentation chrome. These links reuse canonical Live Desk pages. */
export default async function BlueDeskHeader({ activePath }: { activePath: string }) {
  const host = (await headers()).get("host");
  const publicHost = isBlueDeskPublicReaderHost(host);
  const nav = publicHost ? PUBLIC_NAV : PRIVATE_NAV;
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
            aria-current={(href === activePath || (publicHost && ((href === "/" && activePath === "/blue-desk") || (href === "/markets" && activePath === "/blue-desk/markets")))) ? "page" : undefined}
            className={(href === activePath || (publicHost && ((href === "/" && activePath === "/blue-desk") || (href === "/markets" && activePath === "/blue-desk/markets")))) ? styles.navActive : styles.navItem}
          >
            <MarketIcon name={NAV_ICONS[title] || "market"} size={17} />
            <span>{title}</span>
          </Link>
        ))}
      </nav>
    </header>
  );
}
