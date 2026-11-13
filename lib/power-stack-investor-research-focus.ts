/** Owner-only, noncanonical diligence hypotheses; not company valuations. */
export type ResearchFocus=Readonly<{
 ticker:string;priority:"UNDERWRITE"|"WATCH";reviewedOn:string;
 contrast:string;whyNow:string;firstRejection:string;nextTest:string;
 sources:ReadonlyArray<Readonly<{name:string;url:string}>>;
}>;
export const RESEARCH_FOCUS:readonly ResearchFocus[]=[
 {ticker:"MU",priority:"UNDERWRITE",reviewedOn:"2026-11-13",
  contrast:"Low screen multiples rest on exceptional memory-cycle earnings. Cheap at peak earnings is not necessarily cheap through a cycle.",
  whyNow:"Micron reported FY26 revenue $133.19bn, net income $84.97bn and operating cash flow $89.68bn, with materially higher FY27 guidance.",
  firstRejection:"HBM/DRAM pricing or gross margins fall before the forecast earnings become sustainable; high investment reduces free cash flow.",
  nextTest:"Model 2027–29 HBM supply contracts, pricing, maintenance capex, dilution and a down-cycle earnings/FCF case.",
  sources:[{name:"SEC FY26 earnings",url:"https://www.sec.gov/Archives/edgar/data/723125/000072312526000018/a2026q4ex991-pressrelease.htm"},
   {name:"FY26 10-K",url:"https://www.sec.gov/Archives/edgar/data/723125/000072312526000023/mu-20260903.htm"}]},
 {ticker:"FCX",priority:"UNDERWRITE",reviewedOn:"2026-11-13",
  contrast:"Low forward PEG contrasts with higher trailing earnings multiples and thin older cash-flow yield. Grasberg recovery is the missing bridge.",
  whyNow:"Freeport says mine and smelter recovery is proceeding, with larger Grasberg output expected in 2027–28.",
  firstRejection:"Recovery delays, weak copper prices or sustaining capex consume expected earnings improvement.",
  nextTest:"Model 2027–28 copper volumes, realised copper prices, Indonesian ramp-up dates and mine-level sustaining capex into owner cash flow.",
  sources:[{name:"SEC Q3 results",url:"https://www.sec.gov/Archives/edgar/data/831259/000083125926000045/a3q2026exhibit991.htm"},
   {name:"Grasberg update",url:"https://investors.fcx.com/investors/news-releases/news-release-details/2026/Freeport-Provides-Third-Quarter-2026-Operational-Update/default.aspx"}]},
 {ticker:"GRAB",priority:"WATCH",reviewedOn:"2026-11-13",
  contrast:"Revenue and adjusted cash generation improved while shares remain pressured. This is a growth-price research divergence, not demonstrated mispricing.",
  whyNow:"Grab reported Q3 revenue $1.112bn (+27%), adjusted EBITDA $237m (+73%) and trailing adjusted FCF $533m.",
  firstRejection:"Adjusted FCF overstates distributable cash; finance receivables, credit risk, acquisition spend and convertibles absorb value.",
  nextTest:"Reconcile statutory cash flow and adjusted FCF, credit losses, converts, shareholder dilution and 2028 net cash available to owners.",
  sources:[{name:"SEC Q3 results",url:"https://www.sec.gov/Archives/edgar/data/1855612/000185561226000148/a2026q3-earningspressrelea.htm"}]},
 {ticker:"BWXT",priority:"WATCH",reviewedOn:"2026-11-13",
  contrast:"Nuclear and defence contract exposure looks strong, but the historical FCF yield and earnings multiple do not establish a bargain.",
  whyNow:"Q3 official results showed revenue approximately $953m and net income around $102m.",
  firstRejection:"Contract timing, funding, debt service or capital investment delay cash conversion despite rising reported backlog.",
  nextTest:"Separate funded signed contracts from pipeline; model backlog conversion and capital expenditure, then test conservative FCF valuation.",
  sources:[{name:"BWXT official Q3",url:"https://investors.bwxt.com/news-releases/news-release-details/bwx-technologies-reports-third-quarter-2026-results"}]},
 {ticker:"XOM",priority:"WATCH",reviewedOn:"2026-11-13",
  contrast:"Cash generation is strong, but elevated oil prices and diesel cracks can inflate cyclical earnings. Use mid-cycle cash, not shock profits.",
  whyNow:"ExxonMobil reported Q3 GAAP earnings $15.4bn and $25.65bn operating cash flow.",
  firstRejection:"Oil and refined-product margins normalise or required spending rises; buybacks are not sustained by mid-cycle FCF.",
  nextTest:"Build Brent/refined crack margin sensitivity, financing and net debt checks and mid-cycle buyback coverage.",
  sources:[{name:"XOM official Q3",url:"https://investor.exxonmobil.com/company-information/press-releases/detail/1213/exxonmobil-announces-third-quarter-2026-results"}]}
];
export function privateResearchFocus(tickers:readonly string[],now=new Date()){
 const allowed=new Set(tickers.map(t=>t.toUpperCase()));
 const today=Date.parse(now.toISOString().slice(0,10)+"T00:00:00Z");
 return RESEARCH_FOCUS.filter(item=>allowed.has(item.ticker)).map(item=>({
  ...item,expired:today-Date.parse(item.reviewedOn+"T00:00:00Z")>7*86400000
 }));
}
