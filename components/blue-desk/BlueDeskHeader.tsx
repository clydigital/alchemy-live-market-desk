import Link from "next/link";
import Image from "next/image";
import { MarketIcon, type MarketIconName } from "./MarketIcon";
import { headers } from "next/headers";
import { blueDeskPublicHref, isBlueDeskPublicReaderHost } from "@/lib/blue-desk-host";

import styles from "@/app/blue-desk/blue-desk.module.css";
import chrome from "./bluebelly-chrome.module.css";

// Keep the owner header task-focused. Specialist legacy routes remain reachable
// from their workspaces, not as fifteen competing top-level destinations.
const PRIVATE_NAV = [
  ["Live Market", "/blue-desk"],
  ["Key Stories", "/blue-desk/key-stories"],
  ["Markets", "/markets"],
  ["My Desk", "/my-reports"],
  ["Research Library", "/owner/research"],
  ["Market Tools", "/market-tools"],
  ["X Wire", "/owner/x-wire"],
  ["Calendar", "/blue-desk/calendar"],
  ["Learn", "/blue-desk/learn"],
] as const;

// All seven navigation destinations are visible on Bluebelly. The three owner
// destinations remain protected by middleware and the active account allowlist.
const PUBLIC_NAV = [
  ["Today", "/"],
  ["Newsroom", "/newsroom"],
  ["Hormuz Watch", "/hormuz"],
  ["Regime Watch", "/regime-watch"],
  ["Markets", "/markets"],
  ["Calendar", "/calendar"],
  ["Daily Report", "/daily-report"],
  ["Learn", "/learn"],
  ["Presenter Prep", "/owner/presenter"],
] as const;

const NAV_ICONS: Record<string, MarketIconName> = {
  "Live Market": "market",
  "Today": "market",
  "Newsroom": "layers",
  "Hormuz Watch": "oil",
  "Regime Watch": "divergence",
  "Markets": "chart",
  "Deep Dive": "deep-dive",
  "Research": "research",
  "Research Library": "research",
  "Market Tools": "chart",
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
  const ownerWorkspace = activePath === "/my-reports" || activePath === "/owner/editorial" || activePath === "/owner/presenter" || activePath === "/owner/research" || activePath === "/owner/publications" || activePath === "/owner/daily-report" || activePath === "/owner/daily-articles" || activePath === "/owner/x-wire" || activePath === "/market-tools";
  const nav = publicHost && !ownerWorkspace ? PUBLIC_NAV : PRIVATE_NAV;
  const current=blueDeskPublicHref(activePath,host);
  return (
    <header data-bluebelly-chrome="mockup-editorial">
      <div className={chrome.utility}><div className={chrome.utilityInner}>
        <span><strong>BLUEBELLY / MARKET INTELLIGENCE</strong> · Source-qualified reporting and research</span>
        <span>Observed facts · working interpretations labelled separately</span>
      </div></div>
      <div className={chrome.masthead}><div className={chrome.mastInner}>
        <Link href={blueDeskPublicHref("/blue-desk",host)} className={chrome.brand} aria-label="Bluebelly Today">
          <Image src="/blue-desk-wordmark.svg" alt="Bluebelly" width={272} height={60} priority unoptimized/>
          <span className={chrome.brandText}>MARKET INTELLIGENCE</span>
        </Link>
        <div className={chrome.mastRight}><span>Markets, without the noise.</span>
          <Link className={chrome.micro} href={blueDeskPublicHref("/blue-desk/regime-watch",host)}>Research lenses</Link>
          <Link className={chrome.micro} href="/owner/presenter">Presenter Prep ↗</Link>
        </div>
      </div></div>
      <div className={chrome.navbar}><div className={chrome.navInner}>
        <nav className={chrome.links} aria-label="Bluebelly primary">
          {nav.map(([label,path])=>{
            const href=blueDeskPublicHref(path,host);
            const active=href===current || (href==="/markets"&&activePath==="/blue-desk/markets");
            return <Link key={path} href={href} aria-current={active?"page":undefined}
              className={(active?chrome.navActive:chrome.navLink)+" "+(label==="Presenter Prep"?chrome.owner:"")}>
              <MarketIcon name={NAV_ICONS[label]||"market"} size={15}/><span>{label}</span>
            </Link>;
          })}
        </nav>
        <form action={publicHost?"/newsroom":"/blue-desk/newsroom"} method="get" className={chrome.search} role="search">
          <input name="q" type="search" maxLength={100} aria-label="Search public Newsroom" placeholder="Search stories, issuers, themes"/>
          <button type="submit" aria-label="Search Newsroom">⌕</button>
        </form>
      </div></div>
    </header>
  );
}
