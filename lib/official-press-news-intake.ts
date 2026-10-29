/**
 * Small original-source feed pass for the existing scheduled research run.
 * Only a directly read, recent official press-release page can become intake.
 * Official publication verifies the cited announcement, NOT a market reaction.
 * No separate job, public API, Story path or database is introduced.
 */
import { createHash } from "node:crypto";
import type { ResearchRunInput, IntakeItemInput } from "./research-update.ts";
import { normaliseDirectFeedText } from "./direct-news-evidence-triage.ts";
import { extractOfficialPressFacts } from "./official-press-facts.ts";
import { recoverOfficialPublisherSource } from "./official-publisher-source-recovery.ts";

export const OFFICIAL_PRESS_FEEDS = [
  {
    name: "Federal Reserve monetary-policy press releases",
    feed: "https://www.federalreserve.gov/feeds/press_monetary.xml",
    host: "www.federalreserve.gov",
    path: /^\/newsevents\/pressreleases\/[a-z0-9/-]+\.htm$/i,
    publisher: "Federal Reserve Board",
  },
  {
    name: "SEC press releases",
    feed: "https://www.sec.gov/news/pressreleases.rss",
    host: "www.sec.gov",
    path: /^\/(?:newsroom\/press-releases|news\/press-release)\/[a-z0-9/-]+$/i,
    publisher: "U.S. Securities and Exchange Commission",
  },
  {
    // Official NVIDIA Investor Relations RSS points to the NVIDIA newsroom.
    // Company events are not market-reaction evidence by themselves.
    name: "NVIDIA company press releases",
    feed: "https://nvidianews.nvidia.com/cats/press_release.xml",
    host: "nvidianews.nvidia.com",
    path: /^\/news\/[a-z0-9-]+\/?$/i,
    publisher: "NVIDIA Newsroom",
  },
  {
    name:"Broadcom investor news releases",
    feed:"https://investors.broadcom.com/rss/news-releases.xml",
    host:"investors.broadcom.com",
    path:/^\/news-releases\/news-release-details\/[a-z0-9-]+\/?$/i,
    publisher:"Broadcom Investor Relations",
  },
  {
    name:"EIA official energy press releases",
    feed:"https://www.eia.gov/rss/press_rss.xml",
    host:"www.eia.gov",
    path:/^\/pressroom\/releases\/press[0-9]+\.php$/i,
    publisher:"U.S. Energy Information Administration",
  },
  {
    // First-party EIA energy analysis, not a press-release event. Preserve
    // the original source time and distinguish it from verified price action.
    name: "EIA Today in Energy original analysis",
    feed: "https://www.eia.gov/rss/todayinenergy.xml",
    host: "www.eia.gov",
    path: /^\/todayinenergy\/detail\.php$/i,
    publisher: "EIA Today in Energy (official analysis)",
  },
  {
    // Direct, original-policy newsroom source. Do not treat policy previews as
    // realised decisions; the announcement must pass the headline + HTML gate.
    name: "Bank of Canada press releases",
    feed: "https://www.bankofcanada.ca/content_type/press-releases/feed/",
    host: "www.bankofcanada.ca",
    path: /^\/20[0-9]{2}\/[0-9]{2}\/[a-z0-9-]+\/?$/i,
    publisher: "Bank of Canada",
  },
  {
    name: "RBNZ official news",
    feed: "https://www.rbnz.govt.nz/feeds/news",
    host: "www.rbnz.govt.nz",
    path: /^\/news-and-events\/news\/20[0-9]{2}\/[0-9]{2}\/[a-z0-9-]+\/?$/i,
    publisher: "Reserve Bank of New Zealand",
  },
  {
    name:"Meta investor press releases",
    feed:"https://investor.atmeta.com/rss/pressrelease.aspx",
    host:"investor.atmeta.com",
    path:/^\/investor-news\/press-release-details\/[0-9]{4}\/[a-z0-9-]+\/default\.aspx$/i,
    publisher:"Meta Investor Relations",
  },
  {
    name:"ECB monetary policy press decisions",
    feed:"https://www.ecb.europa.eu/rss/press.html",
    host:"www.ecb.europa.eu",
    path:/^\/press\/pr\/date\/20[0-9]{2}\/html\/ecb\.(?:mp|pr)[0-9]{6}~[a-f0-9]{6,16}\.en\.html$/i,
    publisher:"European Central Bank",
  },
] as const;

// The public archive covers seven days; intake must not discard a source
// simply because a scheduled research pass was delayed or blocked.
const WINDOW_MS = 7 * 24 * 60 * 60_000;
const FETCH_TIMEOUT_MS = 6500;
const MAX_PER_FEED = 3;
/**
 * Dated original-release clock attestations for the 28 Oct 2026 policy
 * incident. The BoC RSS exposes 09:47 +00 (its local newsroom clock, not the
 * actual 13:45Z decision), while RBNZ RSS publishes a DATE ONLY as local
 * midnight. Never mistake either feed clock for the announcement instant.
 *
 * Corroboration: the named bank's independently published official decision
 * schedule and the linked first-party decision HTML, which is read separately.
 * Future bank policy releases fail closed until their exact release clocks
 * have equally independent provenance. This is not a general timezone offset.
 */
const POLICY_RELEASE_CLOCKS: Readonly<Record<string,{releaseAt:string;scheduleSource:string}>> = {
  "https://www.bankofcanada.ca/2026/10/fad-press-release-2026-10-28/": {
    releaseAt:"2026-10-28T13:45:00.000Z",
    scheduleSource:"https://www.bankofcanada.ca/core-functions/monetary-policy/key-interest-rate/",
  },
  "https://www.rbnz.govt.nz/news-and-events/news/2026/10/ocr-held-at-2-75-percent": {
    releaseAt:"2026-10-28T01:00:00.000Z",
    scheduleSource:"https://www.rbnz.govt.nz/news-and-events/how-we-release-information/ocr-decision-dates-and-financial-stability-report-dates-to-feb-2028",
  },
};
type Feed = typeof OFFICIAL_PRESS_FEEDS[number];
/** Pure RSS/Atom parser: no Next aliases or runtime network imports. */
export function parseOfficialPressFeed(xml: string) {
  if (!/<(?:rss|feed|rdf:RDF)\b/i.test(xml)) throw new Error("Official press source did not provide an RSS, RDF or Atom feed.");
  const blocks = [
    ...[...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(match => ({ xml: match[1], atom: false })),
    ...[...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map(match => ({ xml: match[1], atom: true })),
  ];
  const tag = (body: string, names: string[]) => {
    for (const name of names) {
      const pattern = new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" + name + ">", "i");
      const text = pattern.exec(body)?.[1];
      if (text) return normaliseDirectFeedText(text);
    }
    return "";
  };
  return blocks.flatMap(({ xml: body, atom }) => {
    const title = tag(body, ["title"]);
    const rawUrl = atom
      ? [...body.matchAll(/<link\b([^>]*)\/?>/gi)].map(link =>
          link[1].match(/\bhref=["']([^"']+)["']/i)?.[1] || "").find(Boolean) || ""
      : tag(body, ["link", "guid"]);
    const time = tag(body, ["pubDate", "published", "updated", "dc:date", "date"]);
    const parsed = Date.parse(time);
    if (!title || !rawUrl || !Number.isFinite(parsed)) return [];
    return [{
      title: title.slice(0, 500),
      url: normaliseDirectFeedText(rawUrl),
      publishedAt: new Date(parsed).toISOString(),
    }];
  });
}


function fixedUrl(value: string, feed: Feed) {
  try {
    // EIA's official RSS emits root-relative article URLs; only that
    // publisher gets a relative-link base (never protocol-relative URLs).
    const eiaRelative = feed.host === "www.eia.gov" && value.startsWith("/") && !value.startsWith("//");
    if (value.startsWith("/") && !eiaRelative) return null;
    const url = new URL(value, eiaRelative ? "https://www.eia.gov" : undefined);
    // ECB's official RSS inserts a second slash after the host. Normalise
    // only this known first-party prefix, then apply the exact path allowlist.
    if (feed.host === "www.ecb.europa.eu" && url.pathname.startsWith("//press/"))
      url.pathname = url.pathname.slice(1);
    if (url.protocol !== "https:" || url.username || url.password ||
      url.hostname.toLowerCase() !== feed.host || !feed.path.test(url.pathname)) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^(?:utm_.+|fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    const eiaAnalysis = feed.feed === "https://www.eia.gov/rss/todayinenergy.xml";
    if (url.search && !(eiaAnalysis && /^\?id=\d{4,8}$/.test(url.search))) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function recent(iso: string, now: Date) {
  const at = Date.parse(iso);
  return Number.isFinite(at) && at <= now.getTime() + 5 * 60_000
    && now.getTime() - at <= WINDOW_MS;
}

/** Claim-shaped titles are necessary; meetings and general website updates are not. */
export function materiallyActionableOfficialHeadline(feed: Feed, headline: string) {
  if (feed.host === "www.ecb.europa.eu")
    return /^monetary policy decisions$/i.test(headline.trim()) ||
      (/\b(?:ECB|governing council|monetary policy|key interest rates?|deposit facility)\b/i.test(headline)
        && /\b(?:decides?|decision|raises?|cuts?|maintains?|holds?|changes?|increases?|lowers?|updates?)\b/i.test(headline));
  // Analytical source observations are useful when material, but are not
  // classified as independently observed market catalysts.
  if (feed.feed === "https://www.eia.gov/rss/todayinenergy.xml")
    return /\b(?:oil|crude|petroleum|gas|gasoline|diesel|electricity|energy|production|lng|refiner(?:y|ies)|fuel|hydro|power)\b/i.test(headline)
      && /\b(?:imports?|importing|exports?|exporting|increases?|increasing|decreases?|decreasing|rises?|rose|falls?|fell|declines?|declining|grows?|grew|record|shortage|higher|lower|share|outlook|surge|supply)\b/i.test(headline);
  if (feed.host === "www.eia.gov") return /\b(?:oil|crude|petroleum|gas|gasoline|diesel|electricity|energy|production|outlook|inventor(?:y|ies)|hormuz|refin(?:ery|eries)|lng)\b/i.test(headline)
    && /\b(?:forecasts?|expects?|raises?|lowers?|increases?|decreases?|revises?|reports?|releases?|updates?|projects?)\b/i.test(headline);
  if (feed.host === "www.bankofcanada.ca")
    return /\b(?:bank of canada|policy rate|overnight rate)\b/i.test(headline)
      && /\b(?:raises?|raised|hikes?|hiked|increases?|increased|holds?|held|maintains?|maintained|cuts?|cut|lowers?|lowered)\b/i.test(headline)
      && /\b(?:rate|rates|overnight)\b/i.test(headline);
  if (feed.host === "www.rbnz.govt.nz")
    return /\b(?:rbnz|reserve bank of new zealand|ocr|official cash rate|monetary policy committee)\b/i.test(headline)
      && /\b(?:holds?|held|unchanged|maintains?|maintained|raises?|raised|hikes?|hiked|increases?|increased|cuts?|cut|lowers?|lowered)\b/i.test(headline)
      && /\b(?:rate|ocr|cash)\b/i.test(headline);
  if (feed.host === "www.federalreserve.gov") return /\b(?:federal reserve|fomc|federal open market|monetary policy|federal funds|discount rate|balance sheet|policy rate)\b/i.test(headline)
    && /\b(?:announces?|issues?|releases?|statement|decision|raises?|cuts?|maintains?|approves?|updates?|votes?)\b/i.test(headline);
  if (feed.host === "investors.broadcom.com"||feed.host === "investor.atmeta.com")
    return /\b(?:announces?|reports?|prices?|files?|launches?|raises?|upsizes?|revises?|acquires?|agrees?|secures?|appoints?|enters?|completes?)\b/i.test(headline)
      && /\b(?:earnings|revenue|guidance|dividend|offering|convertible|financing|capital|equity|stock|shares?|acquisition|merger|investment|chips?|ai|infrastructure|capex|cash|debt|credit|funding|buyback|sec)\b/i.test(headline);
  if (feed.host === "nvidianews.nvidia.com") return /\b(?:announces?|reports?|expands?|signs?|secures?|raises?|lowers?|revises?|commits?|introduces?|acquires?|partners?|launches?)\b/i.test(headline)
    && /\b(?:earnings|revenue|profits?|margin|guidance|capital expenditure|capex|investment|contract|partnership|data.center|ai factor(?:y|ies)|infrastructure|capacity|supply|semiconductor|gpu|hbm)\b/i.test(headline);
  return /\b(?:approves?|adopts?|proposes?|finaliz(?:e|es)|rescind(?:s)?|amends?|authoriz(?:e|es)|issues?)\b/i.test(headline)
    && /\b(?:trading|market structure|treasury|securities|exchange|settlement|clearing|exchange.traded|etfs?|derivatives?|disclosure|registered funds?|broker.dealers?)\b/i.test(headline);
}

function materialTitleFound(html: string, title: string) {
  // An exact H1 match also proves very short official policy titles such as
  // "OCR held at 2.75%"; the old >=3 long-word rule silently dropped these.
  // Only evaluated after the RSS permalink has passed the exact HTTPS host gate.
  const normalise=(value:string)=>value.replace(/<[^>]+>/g," ")
    .replace(/&amp;/gi,"&").replace(/&nbsp;/gi," ")
    .toLowerCase().replace(/\s+/g," ").trim();
  const h1=html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||"";
  if(title.trim().length>=12 && normalise(h1)===normalise(title)) return true;
  const header = [
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "",
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "",
  ].join(" ").replace(/<[^>]+>/g, " ").toLowerCase();
  const words = [...new Set(title.toLowerCase().match(/[a-z]{5,}/g) || [])];
  return words.length >= 3 && words.filter(word => header.includes(word)).length >= Math.min(3, words.length);
}

type FeedDiagnostics={
 feedEntries:number;rejectedUrl:number;unattestedPolicyClock:number;
 rejectedClock:number;rejectedHeadline:number;unreadablePage:number;titleMismatch:number;
 feedFallback:number;articleFallback:number;fallbackRejected:number;
};
type Result = { state: "checked" | "blocked" | "no_new_items"; checked: number; items: IntakeItemInput[];
 diagnostics:FeedDiagnostics; note?:string };

type ScrapePublic = typeof recoverOfficialPublisherSource;
function matchingRecoveryUrl(recovered:{resolvedUrl:string|null}, requested:string, feed:Feed){
 // A provider redirect to a different article or publisher cannot establish
 // the identity of the original RSS entry.
 if(!recovered.resolvedUrl)return true;
 // RSS endpoints are not article paths; compare exact publisher endpoint
 // strings rather than comparing two null article allowlist results.
 if(requested===feed.feed){
   try{return new URL(recovered.resolvedUrl).toString()===new URL(feed.feed).toString();}
   catch{return false;}
 }
 const expected=fixedUrl(requested,feed);
 return Boolean(expected)&&fixedUrl(recovered.resolvedUrl,feed)===expected;
}
async function loadOfficialFeed(feed: Feed, now: Date, fetchImpl: typeof fetch, scrapeImpl: ScrapePublic): Promise<Result> {
  const diagnostics:FeedDiagnostics={feedEntries:0,rejectedUrl:0,unattestedPolicyClock:0,
    rejectedClock:0,rejectedHeadline:0,unreadablePage:0,titleMismatch:0,
    feedFallback:0,articleFallback:0,fallbackRejected:0};
  try {
    let xml="";
    let directError="rss_fetch_failed";
    try{
      const resp = await fetchImpl(feed.feed, {
        cache: "no-store",
        headers: { Accept: "application/rss+xml,application/atom+xml,text/xml,application/xml", "User-Agent": "Alchemy Live Desk official-source reader" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if(resp.ok)xml=(await resp.text()).slice(0,250_000);
      else directError="rss_http_"+resp.status;
    }catch{directError="rss_fetch_failed";}
    // Only after a failed direct publisher read, reuse the configured
    // Firecrawl transport on this EXACT feed. A recovered feed alone is not
    // evidence: every candidate still requires its own original article.
    if(!xml){
      const recovered=await scrapeImpl(feed.feed,{timeoutMs:14_000});
      if(!recovered.ok||!matchingRecoveryUrl(recovered,feed.feed,feed)){
        diagnostics.fallbackRejected++;
        return {state:"blocked",checked:0,items:[],diagnostics,note:directError+";fallback_"+(recovered.ok?"source_mismatch":recovered.code)};
      }
      xml=recovered.rawHtml.slice(0,250_000);
      diagnostics.feedFallback++;
    }
    const entries=parseOfficialPressFeed(xml);
    diagnostics.feedEntries=entries.length;
    const candidates = entries.flatMap(item => {
      const url = fixedUrl(item.url, feed);
      if (!url){diagnostics.rejectedUrl++;return [];}
      const specialPolicyClock = feed.host === "www.bankofcanada.ca" || feed.host === "www.rbnz.govt.nz";
      const scheduled = specialPolicyClock ? POLICY_RELEASE_CLOCKS[url] : null;
      // Bank calendar day or local-time RSS fields do not establish the
      // release minute. Only the separately attested official event clock may
      // be used for those domains. Reject un-attested future policy releases.
      if (specialPolicyClock && !scheduled){diagnostics.unattestedPolicyClock++;return [];}
      const feedAt = Date.parse(item.publishedAt);
      const attestedAt = scheduled ? Date.parse(scheduled.releaseAt) : null;
      // The feed date must still be plausible for this dated original event.
      // A future-dated or unrelated item cannot borrow the attested clock.
      if (scheduled && (!Number.isFinite(feedAt) || feedAt > now.getTime() + 5*60_000 ||
          Math.abs(feedAt - attestedAt!) > 24*3_600_000)){diagnostics.rejectedClock++;return [];}
      const publishedAt = scheduled?.releaseAt ?? item.publishedAt;
      if(!recent(publishedAt,now)){diagnostics.rejectedClock++;return [];}
      if(!materiallyActionableOfficialHeadline(feed,item.title)){
        diagnostics.rejectedHeadline++;return [];
      }
      return [{ ...item, url, publishedAt, scheduleSource: scheduled?.scheduleSource ?? null }];
    }).slice(0, MAX_PER_FEED);
    const results = await Promise.all(candidates.map(async entry => {
      try {
        let html="";
        let blocked=false;
        try{
          const response=await fetchImpl(entry.url,{
            cache:"no-store",redirect:"follow",
            headers:{Accept:"text/html,application/xhtml+xml","User-Agent":"Alchemy Live Desk official-source reader"},
            signal:AbortSignal.timeout(FETCH_TIMEOUT_MS),
          });
          // A successful redirect to the wrong article MUST fail closed.
          if(response.ok&&response.url&&fixedUrl(response.url,feed)!==entry.url){
            diagnostics.unreadablePage++;return null;
          }
          if(response.ok&&(response.headers.get("content-type")||"").toLowerCase().includes("text/html"))
            html=(await response.text()).slice(0,150_000);
          else blocked=!response.ok;
        }catch{blocked=true;}
        if(!html&&blocked){
          const recovered=await scrapeImpl(entry.url,{timeoutMs:14_000});
          if(recovered.ok&&matchingRecoveryUrl(recovered,entry.url,feed)&&recovered.rawHtml.trim()){
            html=recovered.rawHtml.slice(0,150_000);
            diagnostics.articleFallback++;
          }else diagnostics.fallbackRejected++;
        }
        if(!html){diagnostics.unreadablePage++;return null;}
        if (!materialTitleFound(html, entry.title)){diagnostics.titleMismatch++;return null;}
        const title = entry.title.slice(0, 500);
        const sourceFacts=extractOfficialPressFacts(html,title);
        return {
          itemKey: "official-press:" + createHash("sha256").update(entry.url).digest("hex").slice(0, 24),
          itemType: "news" as const,
          publisher: feed.publisher,
          title,
          url: entry.url,
          publishedAt: entry.publishedAt,
          summary: sourceFacts.length?sourceFacts.join(" "):title,
          sourceQuality: 95,
          relevance: 84,
          materiality: 80,
          novelty: 76,
          recommendedAction: "collect_evidence" as const,
          newsSignal: feed.feed === "https://www.eia.gov/rss/todayinenergy.xml"
            ? "First-party EIA analysis; source-verified observation, not a new policy action or proof of a contemporaneous price move."
            : entry.scheduleSource
            ? "Original policy release verified. Exact decision clock independently drawn from the official bank event schedule: " + entry.scheduleSource + ". Publisher RSS time is NOT the event release time. No asset reaction is established."
            : "Original issuer/regulator announcement. A related price move or market impact has not been established.",
          evidence: [{
            title, url: entry.url, publisher: feed.publisher,
            publishedAt: entry.publishedAt, claim: title,
          }, ...sourceFacts.map(fact=>({
            title, url:entry.url, publisher:feed.publisher,
            publishedAt:entry.publishedAt, claim:"OFFICIAL_FACT: "+fact,
          }))],
          reviewReason: feed.feed === "https://www.eia.gov/rss/todayinenergy.xml"
            ? "Original official RSS publication clock and directly linked same-host analysis HTML checked. This is source analysis, not a newly announced event or its market effect."
            : "Original official RSS publication clock and directly linked same-host press-release HTML checked. Headline describes the announcement only, not its financial effect.",
        };
      } catch {
        diagnostics.unreadablePage++;
        return null;
      }
    }));
    const items = results.filter((item): item is NonNullable<typeof item> => item !== null);
    return { state: items.length ? "checked" : "no_new_items", checked: candidates.length, items,diagnostics };
  } catch {
    return { state: "blocked", checked: 0, items: [],diagnostics,note:"rss_fetch_or_parse_failed" };
  }
}

export async function applyOfficialPressNewsIntake(
  input: ResearchRunInput,
  opts: { now?: Date; fetchImpl?: typeof fetch; scrapeImpl?: ScrapePublic } = {},
): Promise<ResearchRunInput> {
  const now = opts.now ?? new Date();
  const fetchImpl = opts.fetchImpl ?? fetch;
  const scrapeImpl = opts.scrapeImpl ?? recoverOfficialPublisherSource;
  const results = await Promise.all(OFFICIAL_PRESS_FEEDS.map(feed => loadOfficialFeed(feed, now, fetchImpl, scrapeImpl)));
  const existing = new Set(input.items.map(item => item.url));
  const appended: IntakeItemInput[] = [];
  for (const result of results) for (const item of result.items) {
    if (!existing.has(item.url) && input.items.length + appended.length < 250) {
      existing.add(item.url);
      appended.push(item);
    }
  }
  const status = results.map((result, i) =>
    OFFICIAL_PRESS_FEEDS[i].name + ":" + result.state + ",linked=" + result.checked
    + ",read=" + result.items.length
    + ",feed_entries=" + result.diagnostics.feedEntries
    + ",wrong_url=" + result.diagnostics.rejectedUrl
    + ",untimed_policy=" + result.diagnostics.unattestedPolicyClock
    + ",stale_or_bad_clock=" + result.diagnostics.rejectedClock
    + ",nonmaterial=" + result.diagnostics.rejectedHeadline
    + ",html_failed=" + result.diagnostics.unreadablePage
    + ",title_mismatch=" + result.diagnostics.titleMismatch
    + ",feed_fallback=" + result.diagnostics.feedFallback
    + ",article_fallback=" + result.diagnostics.articleFallback
    + ",fallback_rejected=" + result.diagnostics.fallbackRejected
    + (result.note?",error="+result.note:"")).join(" | ");
  return {
    ...input,
    items: [...input.items, ...appended],
    summary: ((input.summary || "") + " Original-source press coverage: " + status
      + ". First-party announcements are factual discovery only; market causality is not established.").slice(0, 6000),
  };
}
