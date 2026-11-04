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
  const jolts=original.match(
    /^Job Openings and Labor Turnover Survey for ([A-Za-z]+) (\d{4}) \([^)]+\): Job openings (\d+(?:\.\d+)?)([MBK])\b/i,
  );
  if(jolts){
    const [,month,year,value,scale]=jolts;
    return `JOLTS: ${value}${scale.toLowerCase()} job openings in ${month} ${year}`;
  }

  // Official release receipt: distinguish the already released RBA decision
  // from the originally scheduled calendar event and avoid inventing a vote.
  const rba=original.match(
    /^Released high-impact central bank event scheduled for [^.]+\. Actual: RBA cash rate target (\d+(?:\.\d+)?%) \(\+(\d+)bp, raised\)/i,
  );
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
  if(/^Crude oil inputs also fell in the Middle East as the closure of the strait significantly limited the export of refined products\./i.test(original)){
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

  // Safe structural fallback for multi-sentence notices: preserve an intact
  // source sentence rather than slicing a clause or introducing a new claim.
  // Never discard a qualification in a single-sentence headline.
  if(original.length>145){
    const first=original.match(/^(.{35,130}?[.!?])\s+[A-Z]/);
    if(first && !/^released |^scheduled |^according to /i.test(first[1]) &&
      !/\b(?:not verified|unavailable|not yet established)\b/i.test(first[1]))
      return first[1];
  }
  return original;
}
