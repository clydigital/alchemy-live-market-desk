import Link from "next/link";
import {headers} from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import MarketsScannerWidgets from "@/components/blue-desk/MarketsScannerWidgets";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import styles from "../../blue-desk.module.css";

export const metadata={title:"Scanner | Bluebelly Markets",description:"Interactive stock heatmap, currency strength and stock screening."};
export default async function MarketsScannerPage(){
 const host=(await headers()).get("host");
 return <main className={styles.page} data-bluebelly-markets-scanner="tradingview">
  <BlueDeskHeader activePath="/blue-desk/markets/scanner"/>
  <div className={styles.content}>
   <header className={styles.calendarHero}>
    <div><p className={styles.kicker}><Link href={blueDeskPublicHref("/blue-desk/markets",host)}>Markets</Link> / SCANNER</p>
    <h1>Scanner</h1><p className={styles.heroDeck}>Find unusual moves, currency strength and equity candidates.</p></div>
   </header>
   <MarketsScannerWidgets/>
  </div>
 </main>;
}
