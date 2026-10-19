import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";

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
export default async function BlueDeskHeader({ activePath }: { activePath: string }) {
  const host = (await headers()).get("host");
  return (
    <header className={styles.topbar}>
      <Link href={blueDeskPublicHref("/blue-desk", host)} className={styles.brand} aria-label="Blue Desk — Live Market">
        <Image src="/blue-desk-wordmark.svg" alt="Blue Desk" width={272} height={60} priority unoptimized />
      </Link>
      <nav className={styles.nav} aria-label="Blue Desk primary">
        {NAV.map(([title, href]) => (
          <Link
            key={href}
            href={blueDeskPublicHref(href, host)}
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
