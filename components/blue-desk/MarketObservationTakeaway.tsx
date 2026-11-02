import type {PublicMarketObservation} from "@/lib/blue-desk-public-markets";
import {marketObservationTakeaway} from "@/lib/bluebelly-market-observation-takeaway";
import styles from "./MarketTakeaway.module.css";

export default function MarketObservationTakeaway({row,window}:{
 row:PublicMarketObservation;window:"1D"|"3D"|"5D";
}){
 const brief=marketObservationTakeaway(row,window);
 return <details className={styles.observation} data-market-observation-takeaway={brief.state}>
   <summary>Market takeaway</summary>
   <p><b>What the data shows:</b> {brief.observation}</p>
   <p><b>What would clarify it:</b> {brief.nextTest}</p>
   <small>No earnings, macro or event-window cause inferred from a price change.</small>
  </details>;
}
