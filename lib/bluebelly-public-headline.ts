/**
 * A presentation-only headline pass over ALREADY source-qualified text.
 *
 * Never infer surprise, market reaction, price direction, consensus or causality.
 * Rules are deliberately narrow: each rewrite has to be grounded in exact
 * source wording and measurable fields already present in the input. Unknown
 * feeds retain their original headline rather than receiving a guessed title.
 *
 * The original source headline, summary, timestamp and URL remain unchanged
 * in ingestion, saved editions, search, attribution and full readers.
 */
export function publicReadingHeadline(
  sourceHeadline:string,
  sourceSummary="",
  sourceName="",
):string {
  const original=sourceHeadline.trim().replace(/\s+/g," ");
  if (!original) return sourceHeadline;
  const summary=sourceSummary.trim().replace(/\s+/g," ");

  // BLS JOLTS release: the US job-openings number is explicitly attached to
  // the period. Do not reinterpret this as a beat/miss or net job creation.
  const officialJolts=original.match(
    /^Job Openings and Labor Turnover Survey for ([A-Za-z]+) (\d{4}) [—–-] \1 \2 official result$/i,
  );
  const reportedJolts=summary.match(
    /^Job Openings and Labor Turnover Survey for ([A-Za-z]+) (\d{4}) \([^)]+\): Job openings (\d+(?:\.\d+)?)([MBK])\b/i,
  );
  const jolts=original.match(
    /^Job Openings and Labor Turnover Survey for ([A-Za-z]+) (\d{4}) \([^)]+\): Job openings (\d+(?:\.\d+)?)([MBK])\b/i,
  ) || (officialJolts && reportedJolts && officialJolts[1].toLowerCase()===reportedJolts[1].toLowerCase()
       && officialJolts[2]===reportedJolts[2]?reportedJolts:null);
  if(jolts){
    const [,month,year,value,scale]=jolts;
    return `JOLTS: ${value}${scale.toLowerCase()} job openings in ${month} ${year}`;
  }

  // Official release receipt: distinguish the already released RBA decision
  // from the originally scheduled calendar event and avoid inventing a vote.
  const rbaPattern=/^Released high-impact central bank event scheduled for [^.]+\. Actual: RBA cash rate target (\d+(?:\.\d+)?%) \(\+(\d+)bp, raised\)/i;
  const rba=original.match(rbaPattern) ||
    (/^RBA monetary-policy decision and Statement on Monetary Policy · Released$/i.test(original)
      ?summary.match(rbaPattern):null);
  if(rba) return `RBA raises cash rate ${rba[2]}bp to ${rba[1]}`;

  // BEA: the source explicitly distinguishes headline PCE y/y from real
  // consumption. These are separate metrics, not a Fed-rate prediction.
  const pce=original.match(
    /^BEA reported ([A-Za-z]+) headline PCE inflation of (\d+(?:\.\d+)?%) year-on-year/i,
  );
  if(pce){
    return `${pce[1]} PCE inflation at ${pce[2]} y/y`+
      (/real spending was essentially flat/i.test(original) ? "; real spending flat" : "");
  }

  // Physical supply report: the source itself states the region, strait
  // closure and refined-product export restriction. No oil-price response
  // is implied by the headline.
  const physicalOil=/^Crude oil inputs also fell in the Middle East as the closure of the strait significantly limited the export of refined products\./i;
  if(physicalOil.test(original) ||
    (/^Global refinery inputs fell sharply in the second quarter of \d{4} before modest recovery$/i.test(original) &&
      physicalOil.test(summary))){
    return "Middle East crude inputs fall as strait closure limits refined-product exports";
  }

  // An issuer's source-dated segment arithmetic, not a share-price move.
  const datacentre=original.match(
    /^Data Centre supplied \$[\d.]+bn of the group's \$[\d.]+bn year-on-year revenue growth \(~(\d+)%\), while free cash flow declined\./i,
  );
  if(datacentre) return `Data Centre drives ~${datacentre[1]}% of revenue growth as free cash flow falls`;

  // Generic official ECB document title is not a usable news headline. Only
  // supply its measured deposit rate when the unchanged-rate statement is
  // attached to this very record (not a separately inferred expectation).
  if(/^Monetary policy decisions[.\s]*$/i.test(original) &&
    /European Central Bank|\bECB\b/i.test(sourceName+" "+summary)){
    const deposit=summary.match(/interest rates on the deposit facility, [^.]*? will remain unchanged at (\d+(?:\.\d+)?%)/i);
    if(deposit)return `ECB holds deposit rate at ${deposit[1]}`;
  }

  // SEC release heading: exact transaction scope is retained, while the
  // formal regulatory phrase is shortened for public scanning.
  if(/^SEC Issues Exemptive Relief from Treasury Clearing Requirements for Certain Inter-Affiliate and Non-U\.S\. Repo Transactions$/i.test(original))
    return "SEC grants Treasury-clearing relief for some repo trades";

  // Unknown or contradictory source text stays verbatim. A generic
  // first-sentence or character-limit cutoff could drop a later qualification.
  return original;
}
