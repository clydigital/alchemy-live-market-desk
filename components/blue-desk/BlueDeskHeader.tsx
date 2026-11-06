import CurrentMarketUpdates from "@/components/blue-desk/CurrentMarketUpdates";
import Link from "next/link";
import ThemePreferences from "./ThemePreferences";
import { MarketIcon, type MarketIconName } from "./MarketIcon";
import { headers } from "next/headers";
import { blueDeskPublicHref, isBlueDeskPublicReaderHost } from "@/lib/blue-desk-host";

import styles from "@/app/blue-desk/blue-desk.module.css";
import chrome from "./bluebelly-chrome.module.css";

// Three market utilities + owner CTA (outside public navigation).
// The brand opens the compact market overview. Historical URLs remain valid.
const PRIVATE_NAV = [
  ["Markets", "/markets"],
  ["Calendar", "/blue-desk/calendar"],
  ["Watch", "/blue-desk/key-stories"],
  ["My Desk", "/my-reports"],
] as const;

const PUBLIC_NAV = [
  ["Markets", "/markets"],
  ["Calendar", "/calendar"],
  ["Watch", "/key-stories"],
] as const;

// Retained as source and historical reference tools, not parallel news products.
const PUBLIC_MORE = [
  ["Source Feed", "/newsroom"],
  ["Research Archive", "/research"],
  ["Regime Lenses", "/regime-watch"],
  ["Hormuz Data", "/hormuz"],
  ["Learn", "/learn"],
] as const;

const NAV_ICONS: Record<string, MarketIconName> = {
  "Live Market": "market",
  "Today": "market",
  "Newsroom": "layers",
  "Source Feed": "research",
  "Watch": "layers",
  "Research Archive": "library",
  "Regime Lenses": "divergence",
  "Hormuz Data": "oil",
  "Hormuz Watch": "oil",
  "Regime Watch": "divergence",
  "Markets": "chart",
  "Deep Dive": "deep-dive",
  "Deep Dives": "deep-dive",
  "Research": "research",
  "Research Library": "research",
  "Market Tools": "chart",
  "Data Library": "library",
  "X Wire": "research",
  "Calendar": "calendar",
  "Learn": "learn",
  "Key Stories": "layers",
  "Rates": "rates",
  "What Changed": "divergence",
  "Reports": "library",
  "COTD / OB": "library",
  "Daily Report": "deep-dive",
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
  const ownerWorkspace = activePath === "/power-stack" || activePath === "/my-reports" || activePath === "/owner/editorial" || activePath === "/owner/presenter" || activePath === "/owner/research" || activePath === "/owner/publications" || activePath === "/owner/daily-report" || activePath === "/owner/daily-articles" || activePath === "/owner/x-wire" || activePath === "/market-tools";
  const nav = publicHost && !ownerWorkspace ? PUBLIC_NAV : PRIVATE_NAV;
  const more = publicHost && !ownerWorkspace ? PUBLIC_MORE : [];
  const current=blueDeskPublicHref(activePath,host);
  return (
    <header data-bluebelly-chrome="mockup-editorial">
      <div className={chrome.utility}><div className={chrome.utilityInner}>
        <span><strong>BLUEBELLY / MARKET INTELLIGENCE</strong> · Source-qualified reporting and research</span>
        <span>Observed facts · working interpretations labelled separately</span>
      </div></div>
      <div className={chrome.masthead}><div className={chrome.mastInner}>
        <Link href={blueDeskPublicHref("/blue-desk",host)} className={chrome.brand} aria-label="Bluebelly market overview">
          <span className={chrome.logoSymbol} aria-hidden="true">B</span><span className={chrome.logoText}>BLUE<span>BELLY</span></span>
          <span className={chrome.brandText}>MARKET INTELLIGENCE</span>
        </Link>
        <div className={chrome.mastRight}><ThemePreferences/><span>Markets, without the noise.</span>
          <Link className={chrome.micro} href={blueDeskPublicHref("/blue-desk/newsroom",host)}>Source feed</Link>
          <Link className={chrome.micro} href="/my-reports">My Desk ↗</Link>
        </div>
      </div></div>
      <div className={chrome.navbar}><div className={chrome.navInner}>
        <details className={chrome.mobileNav}><summary>Sections</summary><nav aria-label="Bluebelly mobile">{nav.map(([label,path])=><Link key={path} href={blueDeskPublicHref(path,host)}>{label}</Link>)}{more.map(([label,path])=><Link key={path} href={blueDeskPublicHref(path,host)}>{label}</Link>)}</nav></details>
        <nav className={chrome.links} aria-label="Bluebelly primary">
          {nav.map(([label,path])=>{
            const href=blueDeskPublicHref(path,host);
            const active=href===current || (href==="/markets"&&activePath==="/blue-desk/markets");
            return <Link key={path} href={href} aria-current={active?"page":undefined}
              className={(active?chrome.navActive:chrome.navLink)+" "+(label==="My Desk"?chrome.owner:"")}>
              <MarketIcon name={NAV_ICONS[label]||"market"} size={15}/><span>{label}</span>
            </Link>;
          })}
          {more.length?<details className={chrome.moreNav}>
            <summary aria-label="More Bluebelly sections">More <span aria-hidden="true">⌄</span></summary>
            <div className={chrome.morePanel}>
              {more.map(([label,path])=><Link key={path} href={blueDeskPublicHref(path,host)}>{label}</Link>)}
            </div>
          </details>:null}
        </nav>
        <form action={publicHost?"/newsroom":"/blue-desk/newsroom"} method="get" className={chrome.search} role="search">
          <input name="q" type="search" maxLength={100} aria-label="Search source feed" placeholder="Search releases, issuers, themes"/>
          <button type="submit" aria-label="Search Newsroom">⌕</button>
        </form>
      </div></div>
      {publicHost&&!ownerWorkspace?<CurrentMarketUpdates host={host} mode="mast"/>:null}
    </header>
  );
}
