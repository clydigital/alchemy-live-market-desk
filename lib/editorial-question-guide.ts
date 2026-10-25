/** Reader and owner-writer prompts, not a substitute for evidence verification. */
export type EditorialGuideKind = "COTD" | "OB";
export type EditorialGuidingQuestion = {
  id: string;
  question: string;
  evidenceCheck: string;
};

const COMMON: EditorialGuidingQuestion[] = [
  {
    id: "expectation",
    question: "Before this happened, what would the market normally have expected?",
    evidenceCheck: "Use consensus, market-implied expectations or historical relationships. Do not reverse-engineer the expectation after price moves.",
  },
  {
    id: "reaction",
    question: "What actually moved, when, and by how much?",
    evidenceCheck: "Check dated asset/contract data, the completed session and where possible event-window prices. Name what is unavailable.",
  },
  {
    id: "mechanics",
    question: "How does the physical action or policy change reach this market?",
    evidenceCheck: "Identify who does what, the immediate effect, each missing middle step and the eventual asset exposure in plain English.",
  },
  {
    id: "cross-assets",
    question: "Which other assets should confirm or contradict the explanation?",
    evidenceCheck: "Check only relevant yields, DXY/JXY, gold, crude/refined products, equities, sectors, credit or funding. Do not manufacture correlation.",
  },
  {
    id: "alternatives",
    question: "What other explanation could fit the same move?",
    evidenceCheck: "Separate positioning, expected-versus-actual surprise, real yields, physical constraints and options flows as hypotheses until supported.",
  },
  {
    id: "future",
    question: "Which upcoming economic release or company earnings report could change this view?",
    evidenceCheck: "Use the Calendar & Earnings Hub and original issuer/agency notices. Preserve unknown times, consensus and reporting periods.",
  },
  {
    id: "watch",
    question: "What precise chart behaviour or next observation confirms or invalidates the thesis?",
    evidenceCheck: "State both sides conditionally, with instrument/timeframe and the exact data that should be checked.",
  },
];

export function editorialGuidingQuestions(kind: EditorialGuideKind): EditorialGuidingQuestion[] {
  const opening: EditorialGuidingQuestion = kind === "COTD"
    ? {
      id: "chart",
      question: "Which specific chart behaviour started this idea?",
      evidenceCheck: "Name instrument, timeframe, band/level, relevant previous sessions and whether the break or retest has actually been observed.",
    }
    : {
      id: "catalyst",
      question: "What happened overnight, and what was known before the opening?",
      evidenceCheck: "Establish original source, event time, order of catalysts and the affected sessions before attributing market reaction.",
    };
  return [opening, ...COMMON];
}
