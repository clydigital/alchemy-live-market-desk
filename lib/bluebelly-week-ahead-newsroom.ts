import type {NewsroomEditorialItem} from "./bluebelly-newsroom-editorial";

/** Frozen 2 Nov pre-event analytical briefs. These are editorial PREVIEWS,
 * not claims that the November releases/election have happened. The viewer
 * never derives current numbers from these snapshots. */
const PREVIEW_DAY="2026-11-02";
export const NEWSROOM_NOVEMBER_SOURCES={
 manufacturing:"https://www.ismworld.org/supply-management-news-and-reports/reports/ism-pmi-reports/pmi/september/",
 services:"https://www.ismworld.org/supply-management-news-and-reports/reports/ism-pmi-reports/services/september/",
 ismCalendar:"https://www.ismworld.org/supply-management-news-and-reports/reports/rob-report-calendar/",
 bls:"https://www.bls.gov/news.release/empsit.htm",
 blsCalendar:"https://www.bls.gov/schedule/2026/11_sched_list.htm",
 fedCalendar:"https://www.newyorkfed.org/research/calendars/i-nov26.html",
 election:"https://www.fec.gov/introduction-campaign-finance/election-results-and-voting-information/",
 congress:"https://www.usa.gov/midterm-elections",
 earnings:"https://www.earningswhispers.com/calweek/20261102",
} as const;
export function weekAheadNewsroomEditorial(now:Date,href:string):NewsroomEditorialItem[]{
 const t=now.getTime();
 // Dated previews remain directly accessible through their immutable URL
 // after the week, but stop taking space in the current breaking-news wire.
 if(!Number.isFinite(t)||t<Date.parse("2026-11-02T00:00:00Z")
   ||t>=Date.parse("2026-11-10T00:00:00Z"))return [];
 const base=href.split("#")[0];
 const item=(id:string,headline:string,summary:string,sourceName:string,
  sourceUrl:string,topics:NewsroomEditorialItem["topics"],why:string,nextTest:string,
  kind:NewsroomEditorialItem["kind"]):NewsroomEditorialItem=>({
   id:"nov2-week-ahead:"+id,headline,summary,occurredAt:PREVIEW_DAY,
   sourceName,sourceUrl,readerHref:base+"#"+id,topics,
   verificationLabel:"FROZEN PRE-EVENT ANALYSIS · 2 NOV · NOT RESULTS",
   why,nextTest,kind,
  });
 return [
  item("midterms","US midterms: Can a different Congress change the market's fiscal bargain?",
   "3 November is the federal election. All House seats and one-third of Senate seats are at stake, but a possible shift in chamber control is not the same as a signed tax, tariff or spending bill.",
   "Federal Election Commission",NEWSROOM_NOVEMBER_SOURCES.election,["policy","bonds","energy"],
   "The important price question is whether the likely path for deficits, spending, debt issuance and regulation changes. A blocked bill and a new enacted policy have very different cash-flow consequences.",
   "Confirm chamber control with official results, then compare specific proposed legislation, Treasury yields, DXY, banks, healthcare, utilities and energy on matched time windows.","reported"),
  item("ism","ISM's inflation contradiction: factory orders rose, but input prices surged",
   "September Manufacturing PMI was 54.5 while prices rose to 77.9; services PMI was 54.9 with prices at 74.0. October manufacturing and services reports are scheduled for 2 and 4 November at 10:00 ET.",
   "Institute for Supply Management",NEWSROOM_NOVEMBER_SOURCES.manufacturing,["policy","bonds"],
   "The market needs to distinguish genuinely stronger new orders from a headline lifted by slow supplier deliveries. Strong demand and persistent input costs can threaten margins and complicate rate expectations.",
   "After each release, match actual, dated pre-release consensus, previous and revised numbers; then check orders, employment, deliveries, prices and time-matched US02Y/DXY/SPX reactions.","reported"),
  item("labour","US jobs: Can a soft payrolls trend coexist with sticky inflation?",
   "September payrolls rose 29,000 and unemployment stood at 4.2%. This week brings JOLTS, ADP, productivity and Friday's October employment report.",
   "US Bureau of Labor Statistics",NEWSROOM_NOVEMBER_SOURCES.bls,["policy","bonds"],
   "Weak hiring can lower the expected rate path, but sticky services prices or wage costs could pull in the opposite direction. Hours, revisions and productivity can change the interpretation of a headline jobs surprise.",
   "Track 3 Nov JOLTS, 4 Nov ADP, 5 Nov productivity and 6 Nov payrolls (08:30 ET); distinguish survey definitions and reconcile actual versus pre-release consensus and revisions.","reported"),
  item("earnings","AI earnings week: Are rising orders becoming profits and cash?",
   "Apple, Palantir, AMD, Super Micro, Eaton, Navitas, Uber, Qualcomm and the wider AI/power supply chain are being tested against guidance, margins, financing and cash conversion.",
   "Earnings Whispers calendar · cross-check issuer IR",NEWSROOM_NOVEMBER_SOURCES.earnings,
   ["earnings","ai","energy"],
   "Supplier revenue and cloud capex are not the same as free cash flow. Strong orders matter only when converted into shipment, profit and collectable cash; Uber separately tests robotaxi economics.",
   "Compare company releases with like-for-like pre-release expectations and dated share-price reactions; leave whisper estimates and actuals unknown until established.","earnings"),
 ];
}
