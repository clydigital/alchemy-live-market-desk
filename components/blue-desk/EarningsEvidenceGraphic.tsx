import type {VerifiedEarningsScorecard} from "@/lib/blue-desk-earnings-results";
import s from "./EarningsEvidenceGraphic.module.css";

/** Exact prior-quarter values are taken from the same original SK hynix Q3 release.
 * No inferred stock performance or analyst-consensus beat appears in this SVG. */
const PROVEN_QUARTERS={
 "sk-hynix-2026q3":{
   prior:"Q2 2026",current:"Q3 2026",unit:"₩ trillion",
   series:[{label:"Revenue",prior:79.3187,current:104.6155},
           {label:"Operating profit",prior:60.5426,current:83.3338}],
 },
} as const;

export default function EarningsEvidenceGraphic({scorecard}:{scorecard:VerifiedEarningsScorecard}){
 const record=PROVEN_QUARTERS[scorecard.id as keyof typeof PROVEN_QUARTERS];
 if(!record)return null;
 const max=112;
 const rows=record.series;
 return <figure className={s.figure} data-source-figure="issuer-quarter-comparison">
  <svg viewBox="0 0 680 226" role="img" aria-label={
    "SK hynix consolidated K-IFRS quarter comparison. Revenue rose from 79.3187 to 104.6155 trillion won; operating profit rose from 60.5426 to 83.3338 trillion won, Q2 to Q3 2026."}>
    <rect x="0" y="0" width="680" height="226" rx="8" fill="#082c40"/>
    <text x="20" y="27" fill="#fff" fontWeight="700" fontSize="17">The financial change, not just the headline</text>
    <g fontSize="12" fill="#b5d3df"><text x="20" y="51">Company-reported preliminary figures · {record.unit}</text>
      <rect x="457" y="40" width="10" height="10" rx="1" fill="#528da8"/>
      <text x="472" y="50">{record.prior}</text>
      <rect x="557" y="40" width="10" height="10" rx="1" fill="#e9c17e"/>
      <text x="572" y="50">{record.current}</text></g>
    {rows.map((r,i)=>{
      const y=79+i*72;
      const wPrior=330*r.prior/max,wCurrent=330*r.current/max;
      return <g key={r.label}>
       <text x="20" y={y} fill="#ecf8fe" fontSize="14" fontWeight="600">{r.label}</text>
       <rect x="177" y={y-14} width={wPrior} height="15" rx="2" fill="#528da8"/>
       <rect x="177" y={y+7} width={wCurrent} height="15" rx="2" fill="#e9c17e"/>
       <text x={Math.min(640,185+wPrior)} y={y-2} fill="#d5e7ef" fontSize="12">{r.prior.toFixed(2)}</text>
       <text x={Math.min(640,185+wCurrent)} y={y+19} fill="#f9e5bd" fontSize="12">{r.current.toFixed(2)}</text>
      </g>;
    })}
    <text x="20" y="214" fill="#aac8d6" fontSize="10">Original issuer figures, not a verified forecast or share-price reaction</text>
  </svg>
  <figcaption>Q2 versus Q3 2026, consolidated K-IFRS. <a href={scorecard.sourceUrl} target="_blank" rel="noreferrer">{scorecard.sourceName}</a>. No comparable pre-release analyst consensus is supplied.</figcaption>
 </figure>;
}
