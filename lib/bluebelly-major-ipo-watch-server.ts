import { buildSecSubmissionsUrl, parseSecSubmissionsPayload } from "./providers/sec-edgar.ts";
import { projectMajorIpoWatch, type IpoFilingObservation } from "./bluebelly-major-ipo-watch.ts";

/** Read-only refresh on calendar reads; Next's fetch cache limits SEC calls.
 * Reuses the SEC parser and existing SEC_USER_AGENT. No cron or ingestion write.
 */
export async function loadMajorIpoWatch({
  now=new Date(),fetchImpl=fetch,userAgent=process.env.SEC_USER_AGENT?.trim()||"",
}: {now?:Date;fetchImpl?:typeof fetch;userAgent?:string}={}) {
  const baseline=projectMajorIpoWatch({now});
  const coverage=(state:"checked"|"unavailable"|"not_configured",detail:string)=>({
    cards:baseline,
    coverage:{name:"SEC · major IPO watch",state,detail}
  });
  if(!/^[^\r\n]{12,200}$/.test(userAgent) || !/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(userAgent))
    return coverage("not_configured","Live SEC filing refresh not configured; dated source statements remain visible.");

  const ua={"user-agent":userAgent,accept:"application/json"};
  try {
    const response=await fetchImpl(buildSecSubmissionsUrl("0002130357"),{
      headers:ua,next:{revalidate:3600},signal:AbortSignal.timeout(6500)
    });
    if(!response.ok)throw new Error("SEC submissions unavailable");
    const payload=await response.json();
    if(Number(payload?.cik)!==2130357)throw new Error("SEC issuer mismatch");
    const parsed=parseSecSubmissionsPayload(payload,"0002130357");
    if(!/^anthropic,? pbc$/i.test(parsed.entityName?.trim()||""))
      throw new Error("SEC issuer name mismatch");

    const latest=parsed.filings.find(f=>["S-1","S-1/A"].includes(f.form)
      && /^20\d{2}-\d{2}-\d{2}$/.test(f.filingDate)
      && f.filingDate>="2026-10-26" && f.filingDate<=now.toISOString().slice(0,10)
      && /^\d{10}-\d{2}-\d{6}$/.test(f.accessionNumber));
    if(!latest)return coverage("checked","SEC submissions checked; no newer verified public S-1 record found.");
    const index="https://www.sec.gov/Archives/edgar/data/2130357/"
      +latest.accessionNumber.replace(/-/g,"")+"/"+latest.accessionNumber+"-index.html";
    // Original filing index independently corroborates accession and form.
    const detail=await fetchImpl(index,{
      headers:{"user-agent":userAgent,accept:"text/html"},
      next:{revalidate:3600},signal:AbortSignal.timeout(6500)
    });
    if(!detail.ok || (detail.url && detail.url!==index))throw new Error("SEC index unavailable");
    const html=(await detail.text()).slice(0,250_000).replace(/<[^>]*>/g," ").replace(/\s+/g," ");
    if(!html.includes(latest.accessionNumber) || !html.includes(latest.form))
      throw new Error("SEC index identity mismatch");
    const observation:IpoFilingObservation={
      form:latest.form as IpoFilingObservation["form"],
      filedOn:latest.filingDate,sourceUrl:index,
    };
    return {
      cards:projectMajorIpoWatch({now,anthropicFiling:observation}),
      coverage:{name:"SEC · major IPO watch",state:"checked" as const,
        detail:"SEC issuer, form and accession cross-checked against original filing index. No IPO date or price inferred."}
    };
  }catch{
    return coverage("unavailable","Live SEC refresh could not be completed; showing dated original-source IPO status only.");
  }
}
