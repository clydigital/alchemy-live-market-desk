/**
 * Presentation contract for the existing private editorial generator.
 * Research Brain is the authorised daily-research packet; this is NOT a second
 * evidence engine, research task, source verifier, or canonical Story writer.
 */
export type DeskNarrativeKind = "DAILY_REPORT" | "OB" | "COTD";
export const DAILY_BRIEFING_STEPS = Object.freeze([
  {name:"The setup", purpose:"One short big-picture interpretation, then the actual dated catalyst."},
  {name:"The reveal", purpose:"Show only one or two meaningful like-for-like numerical contrasts, with dates and units."},
  {name:"The teaching moment", purpose:"Explain the human stakes and each economic step to a named asset."},
  {name:"The catch", purpose:"Give the strongest competing explanation and say what evidence is still missing."},
  {name:"The next decision", purpose:"State the next dated test and the outcomes that would change the interpretation."},
] as const);

/**
 * Applied only inside the already owner-authenticated editorial-generate route.
 * Directions deliberately describe HOW to read supplied evidence, never facts
 * or numbers that the model may cite as today's market data.
 */
export function privateNarrativeInstructions(kind: DeskNarrativeKind): string {
  const shared = [
    "Two desks, one evidence packet: Research gathers attributed originals, dated observations, gaps and competing explanations; Storytelling can ONLY rearrange and explain what the packet actually supports.",
    "Use the chronological explanatory style of a Shark Tank deal breakdown, NOT dialogue, roleplay, invented speakers, contrived excitement or direct quotes.",
    "Open with one concise big-picture interpretation grounded in the packet, then show what actually happened before explaining mechanisms.",
    "Keep the five-beat narrative spine: setup -> reveal -> teaching moment -> catch -> next decision. Write natural flowing prose, not five repeated mechanical subheadings.",
    "For the main catalyst: say who is acting, what changed, who pays/earns/borrows, how expectations might change and which specific assets could be exposed.",
    "Choose ONE or TWO numerical comparisons that genuinely explain significance, not a wall of figures. Every number, unit, observation window and source must be present in the supplied packet; otherwise leave it out or mark UNKNOWN.",
    "When comparing two values, explain the older and newer levels, difference in original units, exact observation dates and WHY the change matters. Explain percentage change only when comparable, with a valid non-zero denominator.",
    "For credit, distinguish a yield from a credit spread, and explain in plain language how an increase in the lender's required premium can affect refinancing. Do not claim a particular company's rate rose without proof.",
    "For oil or shipping, distinguish a count of vessels from cargo volumes and a daily flow from a cumulative total. A recovery from one flow estimate to another is not proof of normalisation without matched windows and coverage.",
    "Make a short teaching interruption when a term needs explaining, using a concrete everyday example (borrower, household, shareholder, airline, factory), then get back to the market story.",
    "Name the most plausible alternative interpretation and missing discriminator; treat X/creator/Notion commentary as discovery, not corroboration.",
    "What happened -> what was expected -> observed reaction or UNKNOWN -> what may explain it -> how this affects Regime/Story (maintains, strengthens, challenges or unresolved) -> next event and falsifier.",
    "Do not claim a Regime, Story, Dossier or canonical thesis was revised by this draft. You may discuss conditional implications but no model-generated evidence acceptance.",
    "End with a short 'what would change my mind' conclusion and source-dated next checks, including an opposing scenario.",
    "Use British English; speakable Year-8-level prose; paragraphs up to three sentences; avoid generic AI transitions, rhetorical padding, theatrical language and repetition.",
    "Include original source URLs next to important verifiable claims when already supplied; do not fabricate working links, citations or observations.",
    "No public publication, database write, automatic approval or claim that a model draft is fact-checked.",
  ];
  const format = kind === "DAILY_REPORT" ? [
    "DAILY REPORT: one opening snapshot and ONE dominant chronological story, then at most three genuinely material supporting developments.",
    "Use the dominant story to connect the figures and mechanisms; bring in rates, oil, equity indices, currencies and named companies only when causally relevant and sourced.",
    "Make the read-aloud briefing educational rather than a collection of headlines or a long checklist. Finish with conditional paths and the next dated decision.",
    "If source coverage is partial, say so near the beginning. If the main event or its reaction is unverified, tell a source-qualified account, do not fill in an invented narrative.",
  ] : kind === "OB" ? [
    "OPENING BELL: prioritise one timely verified news or macro catalyst, its expected versus observed reaction, and the market transmission; a chart is a check, not an invented trigger.",
    "Lead with a human consequence, then the reported event, countercase and next release or session discriminator.",
  ] : [
    "CHART OF THE DAY: chart/price-led on one or two assets. Give the dated observation and the decision level only where the supplied chart has been checked.",
    "Make the fundamental catalyst a conditional explanation, NOT a substitute for verified EMA/band or breakout data.",
  ];
  return [...shared,...format].join("\n");
}
