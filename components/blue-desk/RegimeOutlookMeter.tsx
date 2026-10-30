import {confidenceSegments,outlookPosition,type LensResearchOutlook} from "@/lib/bluebelly-regime-lens-outlook";
import styles from "./RegimeOutlookMeter.module.css";

type Props={assessment:LensResearchOutlook;size?:"compact"|"full"};
const outlookLabels=["Strong bearish","Bearish","Mixed","Bullish","Strong bullish"] as const;

export default function RegimeOutlookMeter({assessment,size="compact"}:Props){
 const location=outlookPosition(assessment.outlook);
 const confidence=confidenceSegments(assessment.confidence);
 return <div className={size==="full"?styles.full:styles.compact}
  data-outlook-meter={assessment.lens} data-outlook={assessment.outlook}
  data-confidence={assessment.confidence}>
  <div className={styles.scope} data-outlook-target={assessment.lens}><span>Outlook for</span><strong>{assessment.directionTarget}</strong></div>
  <div className={styles.topline}>
   <span className={styles.caption}>Fundamental outlook</span>
   <strong className={styles.verdict}>{assessment.outlook==="MIXED"?"Mixed":assessment.outlook==="BULLISH"?"Bullish":"Bearish"}</strong>
  </div>
  <div className={styles.outlookTrack} role="img" aria-label={"Editorial outlook: "+assessment.outlook.toLowerCase()+", five-position scale from strongly bearish to strongly bullish"}>
   {outlookLabels.map((label,i)=><span key={label} className={i+1===location?styles.selected:styles.inactive} aria-hidden="true" title={label}/>)}
  </div>
  <div className={styles.scale} aria-hidden="true"><span>Bearish</span><span>Mixed</span><span>Bullish</span></div>
  <div className={styles.horizon}>{assessment.horizon} · Reviewed {assessment.reviewedAt} MYT</div>
  <div className={styles.confidence}>
   <span className={styles.caption}>Confidence</span>
   <span className={styles.confidenceTrack} role="img" aria-label={"Editorial evidence confidence: "+assessment.confidence.toLowerCase()}>
    {[1,2,3].map(position=><span key={position} className={position<=confidence?styles.confident:styles.inactiveConfidence} aria-hidden="true"/>)}
   </span>
   <strong>{assessment.confidence==="MEDIUM"?"Medium":assessment.confidence==="HIGH"?"High":"Low"}</strong>
  </div>
 </div>;
}
