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

/** Reuse the existing source-dated earnings graphic for the first
 * issuer-filed Chart Watch edition. No vendor price graph is reused. */
function AmdQ3EvidenceGraphic({scorecard,variant}:{scorecard:VerifiedEarningsScorecard;variant:"segments"|"fcf"}){
 const source=scorecard.sourceUrl;
 if(variant==="segments"){
  const rows=[
   {name:"DATA CENTRE",prior:4.341,current:8.546},
   {name:"CLIENT & GAMING",prior:4.048,current:3.722},
   {name:"EMBEDDED",prior:.857,current:1.109},
  ];
  return <figure className={s.figure} data-chart-watch-figure="amd-q3-segments" data-verified-source="amd-q3-2026">
    <svg viewBox="0 0 680 316" role="img" aria-label="AMD segment revenue, billions of US dollars, Q3 2025 compared with Q3 2026: Data Centre 4.341 to 8.546; Client and Gaming 4.048 to 3.722; Embedded 0.857 to 1.109.">
      <rect x="0" y="0" width="680" height="316" rx="8" fill="#082c40"/>
      <text x="18" y="27" fill="#fff" fontWeight="700" fontSize="16">Data Centre drove more than all the net growth</text>
      <text x="18" y="47" fill="#b5d3df" fontSize="12">AMD Q3 reported revenue by segment · US$bn · source-dated</text>
      <g fontSize="12" fill="#d7e6ef"><rect x="442" y="38" width="11" height="11" fill="#528da8"/><text x="458" y="48">Q3 2025</text>
      <rect x="542" y="38" width="11" height="11" fill="#e9c17e"/><text x="558" y="48">Q3 2026</text></g>
      {rows.map((r,i)=>{
       const y=94+i*70,priorW=r.prior/9*335,currentW=r.current/9*335;
       return <g key={r.name}>
        <text x="18" y={y-5} fill="#e6f3f9" fontSize="12" fontWeight="700">{r.name}</text>
        <rect x="182" y={y-20} width={priorW} height="15" rx="2" fill="#528da8"/>
        <rect x="182" y={y+2} width={currentW} height="15" rx="2" fill="#e9c17e"/>
        <text x={188+priorW} y={y-8} fill="#dcecf4" fontSize="12">{r.prior.toFixed(3)}</text>
        <text x={188+currentW} y={y+14} fill="#fce4b6" fontSize="12">{r.current.toFixed(3)}</text>
       </g>;
      })}
      <text x="18" y="304" fill="#adccd8" fontSize="11">Q3 FY2026 ended 26 Sep 2026 · no analyst-consensus or price reaction implied</text>
    </svg>
    <figcaption>Revenue for the quarters ended 27 September 2025 and 26 September 2026. <a href={source} target="_blank" rel="noopener noreferrer">Original AMD Q3 2026 issuer release</a>. Underlying numbers and accessible table follow in the article.</figcaption>
  </figure>;
 }
 return <figure className={s.figure} data-chart-watch-figure="amd-q3-fcf" data-verified-source="amd-q3-2026">
   <svg viewBox="0 0 680 236" role="img" aria-label="AMD reported continuing-operations free cash flow declined from 1.530 billion US dollars in Q3 2025 to 0.554 billion in Q3 2026, down around 64 percent.">
    <rect x="0" y="0" width="680" height="236" rx="8" fill="#082c40"/>
    <text x="18" y="26" fill="#fff" fontSize="16" fontWeight="700">Reported free cash flow fell about 64%</text>
    <text x="18" y="46" fill="#b5d3df" fontSize="12">Continuing operations · AMD definition · US$bn</text>
    <line x1="158" y1="179" x2="595" y2="179" stroke="#578096"/>
    <rect x="215" y="61" width="115" height="118" rx="5" fill="#528da8"/>
    <rect x="421" y="136" width="115" height="43" rx="5" fill="#e9c17e"/>
    <text x="272" y="84" fill="#ffffff" textAnchor="middle" fontSize="20" fontWeight="700">1.530</text>
    <text x="478" y="131" fill="#fff3d5" textAnchor="middle" fontSize="20" fontWeight="700">0.554</text>
    <text x="272" y="199" fill="#d0e4ed" textAnchor="middle" fontSize="13">Q3 2025</text>
    <text x="478" y="199" fill="#d0e4ed" textAnchor="middle" fontSize="13">Q3 2026</text>
    <text x="18" y="223" fill="#adc8d7" fontSize="11">2025 uses continuing-operations CFO; do not substitute total CFO</text>
   </svg>
   <figcaption>Issuer-reported free cash flow. The 2025 comparison removes discontinued operations before subtracting cash capital spending. <a href={source} target="_blank" rel="noopener noreferrer">AMD financial release and reconciliations</a>.</figcaption>
 </figure>;
}

export default function EarningsEvidenceGraphic({scorecard,variant="segments"}:{scorecard:VerifiedEarningsScorecard;variant?:"segments"|"fcf"}){
 if(scorecard.id==="amd-2026q3")return <AmdQ3EvidenceGraphic scorecard={scorecard} variant={variant}/>;
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
