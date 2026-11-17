import type {NewsroomEditorialItem} from "./bluebelly-newsroom-editorial.ts";

export const NVIDIA_CRISIS_ID="nvidia-crisis-november-2026";
export const NVIDIA_CRISIS_AS_OF="2026-11-17T03:00:00Z";
export const NVIDIA_CRISIS_SOURCE="https://public-inspection.federalregister.gov/2026-23529.pdf";
export const NVIDIA_CRISIS_HEADLINE="The Nvidia crisis: what is actually happening?";

export const crisisSources={
  sec:"https://www.sec.gov/Archives/edgar/data/1045810/000104581026000082/nvda-20261111.htm",
  issuer:"https://nvidianews.nvidia.com/news/nvidia-announces-ceo-transition",
  senate:"https://www.banking.senate.gov/newsroom/minority/senators-warren-and-coons-direct-lutnick-rubio-and-miller-to-preserve-nvidia-records-following-reports-of-foreign-intelligence-operation-targeting-ceo-jensen-huang",
  chronology:"https://www.washingtonpost.com/technology/2026/11/12/timeline-alleged-spy-drama-engulfing-jensen-huang/",
  board:"https://www.reuters.com/legal/transactional/silicon-valley-leaders-back-call-jensen-huangs-return-nvidia-2026-11-16/",
  politics:"https://www.washingtonpost.com/technology/2026/11/16/fight-between-bessent-lutnick-over-nvidia-chips-heats-up/",
  holdings:"https://www.washingtonpost.com/business/2026/11/16/trumps-stake-nvidia-grew-much-62-million-before-scandal-broke-out/",
  bessent:"https://www.reuters.com/world/bessent-says-nvidia-must-go-outside-company-find-new-ceo-2026-11-15/",
  bis:NVIDIA_CRISIS_SOURCE,
  forecast:"https://www.vlsi.kr/en/ai-capex-growth-peak-verdict-en/",
  forecast2:"https://finance.sina.com.cn/yw-lb/2026-11-16/doc-iniyxynz2641790.shtml",
  close:"https://apnews.com/article/2e6a9c41b6336e9240c1b01585d20cd4",
  nvdaClose:"https://thetradesignal.com/brief/2026-11-16/close",
  indices:"https://portfolio-terminal.com/markets/stock-market-close",
  guidance:"https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Announces-Financial-Results-for-Second-Quarter-Fiscal-2027/default.aspx",
  call:"https://investor.nvidia.com/files/content_files/TRANSCRIPT_-NVIDIA-Corp-NVDA-US-Q2-2027-Earnings-Call-26-August-2026-5_00-PM-ET.pdf",
  ipo:"https://ipo.anthropic.com/documents/us/prospectus.pdf",
  hearings:"https://news.bgov.com/banking-law/scott-asks-huang-lutnick-to-testify-before-senate-banking-panel",
} as const;

export const capexForecast=[
 {year:2027,previous:770,revised:627},
 {year:2028,previous:1054,revised:758},
 {year:2029,previous:1352,revised:796},
 {year:2030,previous:1531,revised:923},
] as const;
export const cumulativeForecastCut=capexForecast.reduce((sum,row)=>sum+row.previous-row.revised,0);

export function nvidiaCrisisNewsroomItem(now:Date,reader:string):NewsroomEditorialItem|null{
 const time=+now, start=Date.parse(NVIDIA_CRISIS_AS_OF);
 if(!Number.isFinite(time)||time<start||time>=start+7*86400000)return null;
 return {id:"dated:"+NVIDIA_CRISIS_ID,headline:NVIDIA_CRISIS_HEADLINE,
   summary:"Three battles collide: Nvidia's leadership, Washington's China chip policy and the long-term AI investment thesis.",
   occurredAt:"2026-11-16T21:49:00Z",initialPublishedOn:"2026-11-17",editorialUpdatedAt:NVIDIA_CRISIS_AS_OF,
   sourceName:"Nvidia SEC filing · BIS rule · 16 November market close",sourceUrl:NVIDIA_CRISIS_SOURCE,
   readerHref:reader+"?feature="+NVIDIA_CRISIS_ID,topics:["ai","earnings","policy"],
   verificationLabel:"DATED EDITORIAL · CONFIRMED FACTS / CONDITIONAL OUTLOOK",
   why:"The policy and financing channels could affect Nvidia differently from other Nasdaq companies, even if existing orders hold.",
   nextTest:"17 November earnings: forward revenue, gross margin, customer financing and successor clarity; then Anthropic's IPO and congressional scrutiny.",kind:"reported"};
}
