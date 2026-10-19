import Link from "next/link";
import Image from "next/image";

import styles from "@/app/blue-desk/blue-desk.module.css";

const NAV = [
  ["Live Market", "/blue-desk"],
  ["Markets", "/markets"],
  ["Deep Dive", "/articles"],
  ["Research", "/whats-new"],
  ["Data Library", "/data/macro"],
  ["Presenter Prep", "/hybrid-output/prepare"],
  ["Calendar", "/blue-desk/calendar"],
  ["Learn", "/concepts"],
] as const;

/** Shared presentation chrome. These links reuse canonical Live Desk pages. */
export default function BlueDeskHeader({ activePath }: { activePath: string }) {
  return (
    <header className={styles.topbar}>
      <Link href="/blue-desk" className={styles.brand} aria-label="Blue Desk — Live Market">
        <Image src="/blue-desk-wordmark.svg" alt="Blue Desk" width={272} height={60} priority unoptimized />
        <span>Market Intelligence</span>
      </Link>
      <nav className={styles.nav} aria-label="Blue Desk primary">
        {NAV.map(([title, href]) => (
          <Link
            key={href}
            href={href}
            aria-current={href === activePath ? "page" : undefined}
            className={href === activePath ? styles.navActive : styles.navItem}
          >
            {title}
          </Link>
        ))}
      </nav>
    </header>
  );
}
