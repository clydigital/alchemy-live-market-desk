export type MarketBriefParagraphRole =
  | "opening"
  | "mechanism"
  | "reaction"
  | "contradiction"
  | "outlook"
  | "context";

export type MarketBriefParagraphV1 = {
  role: MarketBriefParagraphRole;
  text: string;
  sourceRefs: string[];
  canonicalEvidenceIds: string[];
};

export type MarketBriefSourceLinkV1 = {
  title: string;
  url: string;
  accessedAt?: string | null;
};

export type MarketBriefArticleV1 = {
  contractVersion: "market-brief-article/1";
  articleId: string;                  // stable and unique within edition
  editionId: string;                  // exact published edition identity
  dossierId: string | null;           // exact selected canonical Dossier, no guessed fallback
  dossierAsOf: string | null;
  generatedAt: string;                // valid ISO timestamp
  title: string;                      // concise <=63 characters where feasible
  deck: string;                       // concise one-sentence introduction
  category: string;                   // descriptive, not a quota/bucket gate
  paragraphs: MarketBriefParagraphV1[];
  sourceLinks: MarketBriefSourceLinkV1[];
  interpretationStatus: "SUPPORTED" | "MIXED" | "UNRESOLVED";
  conditionalOutlook: string;         // explicit confirmation + invalidation
};

export type MarketBriefArticlesProjectionResult = {
  contractVersion: "market-brief-article/1";
  editionId: string;
  dossierId: string | null;
  generatedAt: string;
  articles: MarketBriefArticleV1[];
  status: "COMPLETE" | "PARTIAL" | "INSUFFICIENT_DATA";
  blockedReason?: string | null;
};

type JsonRecord = Record<string, unknown>;

function isObject(val: unknown): val is JsonRecord {
  return Boolean(val && typeof val === "object" && !Array.isArray(val));
}

function cleanText(val: unknown): string | null {
  if (typeof val === "string" && val.trim().length > 0) {
    return val.trim();
  }
  return null;
}

function cleanStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  const result: string[] = [];
  for (const item of val) {
    const s = cleanText(item);
    if (s && !result.includes(s)) {
      result.push(s);
    }
  }
  return result;
}

function isValidDossierId(id: unknown): string | null {
  if (typeof id !== "string") return null;
  const clean = id.trim();
  if (
    !clean ||
    clean.includes("contractVersion") ||
    clean.includes("briefing/v") ||
    clean.includes("dossier-briefing")
  ) {
    return null;
  }
  // Validate UUID or explicit dossier ID string
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean) ||
    (/^dossier-[a-z0-9-]+$/i.test(clean) && !clean.includes("v1"))
  ) {
    return clean;
  }
  return null;
}

function truncateTitle(text: string, maxLen = 63): string {
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen - 1).trim();
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > 20) {
    return truncated.slice(0, lastSpace) + "…";
  }
  return truncated + "…";
}

function deriveCategory(icon: string | null, assets: string[], title: string): string {
  const normIcon = (icon || "").toLowerCase();
  const normTitle = title.toLowerCase();
  const assetStr = assets.join(" ").toUpperCase();

  if (normIcon === "energy" || /oil|crude|brent|wti|gas|commodity/.test(normTitle)) {
    return "Energy & Commodities";
  }
  if (normIcon === "policy" || normIcon === "bonds" || /fed|fomc|yield|treasury|rate|bond|central bank/.test(normTitle)) {
    return "Rates & Policy";
  }
  if (normIcon === "fx" || normIcon === "japan" || /dollar|dxy|yen|jpy|eur|gbp|currency|fx/.test(normTitle)) {
    return "Global FX & Capital Flows";
  }
  if (normIcon === "credit" || /credit|spread|funding|leverage/.test(normTitle)) {
    return "Credit & Transmission";
  }
  if (normIcon === "equities" || /equity|stock|tech|spx|nasdaq|earnings|nvda/.test(normTitle)) {
    return "Equities & Earnings";
  }
  if (assetStr.includes("US10Y") || assetStr.includes("US2Y")) {
    return "Rates & Policy";
  }
  if (assetStr.includes("DXY") || assetStr.includes("USDJPY") || assetStr.includes("EURUSD")) {
    return "Global FX & Capital Flows";
  }
  return "Macro Focus";
}

function matchRelevantSourceRefs(
  allRefs: string[],
  storyId: string,
  evidenceRefs: string[],
  textToMatch: string
): string[] {
  const matched: string[] = [];
  const textLower = textToMatch.toLowerCase();
  const ignoreTokens = new Set(["source", "ref", "refs", "http", "https", "www", "release", "doc", "item"]);

  for (const ref of allRefs) {
    if (evidenceRefs.includes(ref)) {
      matched.push(ref);
      continue;
    }
    const refLower = ref.toLowerCase();

    // If exact ref string appears in text
    if (textLower.includes(refLower)) {
      matched.push(ref);
      continue;
    }

    // Check specific non-generic tokens
    const parts = refLower.split(/[:_.\/ -]+/).filter((p) => p.length >= 2 && !ignoreTokens.has(p));
    const storyParts = storyId.toLowerCase().split(/[:_.\/ -]+/).filter((p) => p.length >= 2 && !ignoreTokens.has(p));

    const hasOverlap = parts.some((p) => storyParts.includes(p));
    const appearsInText = parts.some((p) => p.length >= 3 && textLower.includes(p));

    if (hasOverlap || appearsInText) {
      matched.push(ref);
    }
  }

  for (const ev of evidenceRefs) {
    if (ev.startsWith("source:") || ev.startsWith("bls:") || ev.startsWith("ref:")) {
      if (!matched.includes(ev)) matched.push(ev);
    }
  }

  return matched;
}

/**
 * Projects canonical market brief articles from a daily brief edition snapshot
 * or full publication payload.
 */
export function projectMarketBriefArticles(
  input: unknown
): MarketBriefArticlesProjectionResult {
  if (!isObject(input)) {
    return {
      contractVersion: "market-brief-article/1",
      editionId: "unknown",
      dossierId: null,
      generatedAt: new Date().toISOString(),
      articles: [],
      status: "INSUFFICIENT_DATA",
      blockedReason: "No valid publication or snapshot object provided.",
    };
  }

  const editionObj = isObject(input.edition) ? input.edition : null;
  const editionId = cleanText(editionObj?.id)
    || cleanText(editionObj?.snapshotId)
    || cleanText(input.id)
    || "edition-unknown";

  const generatedAt = cleanText(editionObj?.generatedAt)
    || cleanText(input.published_at)
    || cleanText(input.generatedAt)
    || new Date().toISOString();

  const payload = isObject(editionObj?.payload)
    ? (editionObj!.payload as JsonRecord)
    : isObject(input.payload)
      ? (input.payload as JsonRecord)
      : (input as JsonRecord);

  // Extract Dossier identity (must be a valid Dossier UUID, not a contract version)
  const dossier = isObject(payload.dossier) ? (payload.dossier as JsonRecord) : null;
  const dossierComposition = isObject(payload.dossierComposition) ? (payload.dossierComposition as JsonRecord) : null;
  const rawDossierId = dossier?.id || dossierComposition?.parentEditionId || null;
  const dossierId = isValidDossierId(rawDossierId);

  const dossierAsOf = cleanText(dossier?.generatedAt)
    || cleanText(dossier?.asOf)
    || generatedAt;

  // Gather source record refs and links (ONLY explicit URLs, no fabricated defaults)
  const topSourceRefs = cleanStringArray(input.source_record_refs || payload.source_record_refs);
  const marketTape = isObject(payload.marketTape) ? (payload.marketTape as JsonRecord) : null;
  const tapeSources = Array.isArray(marketTape?.sources) ? marketTape!.sources : [];

  const sourceLinks: MarketBriefSourceLinkV1[] = [];
  if (Array.isArray(tapeSources)) {
    for (const src of tapeSources) {
      if (isObject(src)) {
        const title = cleanText(src.title) || cleanText(src.name) || "Source";
        const url = cleanText(src.url) || cleanText(src.sourceUrl);
        if (url && url !== "https://live.alchemymarkets.com") {
          sourceLinks.push({
            title,
            url,
            accessedAt: cleanText(src.accessedAt) || null,
          });
        }
      }
    }
  }

  // Candidates extraction
  const manifest = Array.isArray(payload.canonicalStoryManifest) ? payload.canonicalStoryManifest : [];
  const lessons = Array.isArray(dossier?.lessons) ? dossier!.lessons : [];
  const storiesList = Array.isArray(payload.stories) ? payload.stories : [];

  const candidateMap = new Map<string, {
    storyId: string;
    title: string;
    centralQuestion: string | null;
    thesis: string;
    explanation: string | null;
    whatChanged: string | null;
    marketReaction: string | null;
    strongestSupport: string | null;
    strongestContradiction: string | null;
    confirmation: string | null;
    invalidation: string | null;
    assets: string[];
    confidence: number;
    lifecycle: string;
    evidenceIds: string[];
    icon: string | null;
    bodyParagraphs: string[];
    system2Adjudicated: boolean;
  }>();

  // 1. Populate from canonicalStoryManifest
  for (const entry of manifest) {
    if (!isObject(entry)) continue;
    const storyId = cleanText(entry.storyId);
    if (!storyId) continue;

    const state = isObject(entry.state) ? (entry.state as JsonRecord) : {};
    const reasoning = isObject(entry.reasoning) ? (entry.reasoning as JsonRecord) : {};
    const intelligence = isObject(state.intelligence) ? (state.intelligence as JsonRecord) : {};

    const title = cleanText(reasoning.title) || cleanText(state.title) || "Market Movement";
    const centralQuestion = cleanText(reasoning.centralQuestion) || cleanText(state.marketQuestion);
    const thesis = cleanText(reasoning.thesis) || cleanText(state.thesis) || title;
    const explanation = cleanText(reasoning.acceptedExplanation)
      || cleanText(state.bestExplanation)
      || cleanText(intelligence.researchSynthesis);
    const whatChanged = cleanText(reasoning.whatChanged);
    const marketReaction = cleanText(reasoning.marketReaction);
    const strongestSupport = cleanText(state.strongestSupport) || cleanText(intelligence.strongestSupport);
    const countercaseObj = isObject(reasoning.countercase) ? (reasoning.countercase as JsonRecord) : null;
    const strongestContradiction = cleanText(countercaseObj?.strongest)
      || cleanText(state.strongestContradiction)
      || cleanText(intelligence.strongestContradiction);

    const confirmation = cleanText(state.confirmationCondition)
      || cleanText(intelligence.confirmationCondition)
      || (Array.isArray(reasoning.confirmation) ? cleanStringArray(reasoning.confirmation)[0] : null);

    const invalidation = cleanText(state.invalidationCondition)
      || cleanText(intelligence.invalidationCondition)
      || (Array.isArray(reasoning.invalidation) ? cleanStringArray(reasoning.invalidation)[0] : null);

    const assets = [...new Set([
      ...cleanStringArray(state.assets),
      ...cleanStringArray(intelligence.affectedAssets),
    ])];

    const confidence = typeof state.confidence === "number" ? state.confidence : 70;
    const lifecycle = cleanText(intelligence.lifecycleStatus) || cleanText(state.status) || "confirmed";

    // Gather exact canonical evidence UUIDs
    const evidenceIds: string[] = [];
    if (Array.isArray(reasoning.claims)) {
      for (const claim of reasoning.claims) {
        if (isObject(claim)) {
          evidenceIds.push(...cleanStringArray(claim.evidenceIds));
        }
      }
    }
    if (Array.isArray(reasoning.causalChain)) {
      for (const edge of reasoning.causalChain) {
        if (isObject(edge)) {
          evidenceIds.push(...cleanStringArray(edge.evidenceIds));
        }
      }
    }
    if (countercaseObj) {
      evidenceIds.push(...cleanStringArray(countercaseObj.evidenceIds));
    }
    evidenceIds.push(...cleanStringArray(intelligence.decisiveEvidenceIds));

    candidateMap.set(storyId, {
      storyId,
      title,
      centralQuestion,
      thesis,
      explanation,
      whatChanged,
      marketReaction,
      strongestSupport,
      strongestContradiction,
      confirmation,
      invalidation,
      assets,
      confidence,
      lifecycle,
      evidenceIds: [...new Set(evidenceIds)],
      icon: null,
      bodyParagraphs: [],
      system2Adjudicated: Boolean(dossierId && (reasoning.acceptedExplanation || intelligence.researchSynthesis)),
    });
  }

  // 2. Enrich/overlay from dossier lessons
  for (const lesson of lessons) {
    if (!isObject(lesson)) continue;
    const storyId = cleanText(lesson.storyId);
    if (!storyId) continue;

    const existing = candidateMap.get(storyId);
    const title = cleanText(lesson.title) || existing?.title || "Market Catalyst";
    const centralQuestion = cleanText(lesson.question) || existing?.centralQuestion || null;
    const bodyParagraphs = cleanStringArray(lesson.body);
    const lessonEv = cleanStringArray(lesson.evidenceRefs);
    const icon = cleanText(lesson.icon);

    let confirmation = existing?.confirmation || null;
    let invalidation = existing?.invalidation || null;
    let strongestContradiction = existing?.strongestContradiction || null;

    if (Array.isArray(lesson.callouts)) {
      for (const callout of lesson.callouts) {
        if (isObject(callout)) {
          const type = cleanText(callout.type);
          const text = cleanText(callout.text);
          if (type === "confirmation" && text) confirmation = text;
          if (type === "invalidation" && text) invalidation = text;
          if (type === "warning" && text) strongestContradiction = text;
        }
      }
    }

    if (existing) {
      existing.title = title;
      if (centralQuestion) existing.centralQuestion = centralQuestion;
      existing.icon = icon;
      existing.bodyParagraphs = bodyParagraphs;
      existing.evidenceIds = [...new Set([...existing.evidenceIds, ...lessonEv])];
      if (confirmation) existing.confirmation = confirmation;
      if (invalidation) existing.invalidation = invalidation;
      if (strongestContradiction) existing.strongestContradiction = strongestContradiction;
    } else {
      candidateMap.set(storyId, {
        storyId,
        title,
        centralQuestion,
        thesis: bodyParagraphs[0] || title,
        explanation: bodyParagraphs[1] || null,
        whatChanged: null,
        marketReaction: null,
        strongestSupport: null,
        strongestContradiction,
        confirmation,
        invalidation,
        assets: [],
        confidence: typeof lesson.confidence === "number" ? lesson.confidence : 70,
        lifecycle: "confirmed",
        evidenceIds: lessonEv,
        icon,
        bodyParagraphs,
        system2Adjudicated: Boolean(dossierId),
      });
    }
  }

  // 3. Populate from storiesList if empty
  if (candidateMap.size === 0) {
    for (const story of storiesList) {
      if (!isObject(story)) continue;
      const storyId = cleanText(story.id);
      if (!storyId) continue;

      const title = cleanText(story.title) || "Market Story";
      const thesis = cleanText(story.thesis) || title;
      const explanation = cleanText(story.bestExplanation) || cleanText(story.best_explanation);
      const confirmation = cleanText(story.confirmationCondition) || cleanText(story.confirmation_trigger);
      const invalidation = cleanText(story.invalidationCondition) || cleanText(story.invalidation_trigger);
      const assets = cleanStringArray(story.assets);
      const confidence = typeof story.confidence === "number" ? story.confidence : 60;

      candidateMap.set(storyId, {
        storyId,
        title,
        centralQuestion: cleanText(story.marketQuestion) || cleanText(story.market_question),
        thesis,
        explanation,
        whatChanged: null,
        marketReaction: null,
        strongestSupport: cleanText(story.strongestSupport) || cleanText(story.strongest_support),
        strongestContradiction: cleanText(story.strongestContradiction) || cleanText(story.strongest_contradiction),
        confirmation,
        invalidation,
        assets,
        confidence,
        lifecycle: cleanText(story.status) || "detected",
        evidenceIds: [],
        icon: null,
        bodyParagraphs: [thesis, explanation || ""].filter(Boolean),
        system2Adjudicated: false,
      });
    }
  }

  // Build MarketBriefArticleV1 records
  const articles: MarketBriefArticleV1[] = [];

  for (const candidate of candidateMap.values()) {
    const fullMatchedText = [
      candidate.title,
      candidate.thesis,
      candidate.explanation || "",
      ...candidate.bodyParagraphs,
    ].join(" ");

    const matchedSourceRefs = matchRelevantSourceRefs(
      topSourceRefs,
      candidate.storyId,
      candidate.evidenceIds,
      fullMatchedText
    );

    const hasCanonicalEvidence = candidate.evidenceIds.length > 0;
    const hasSourcedRefs = matchedSourceRefs.length > 0;

    // CANDIDATE ADMISSION GATE:
    if (!hasCanonicalEvidence && !hasSourcedRefs) {
      continue;
    }

    const articleId = `article:${editionId}:${candidate.storyId}`;
    const displayTitle = truncateTitle(candidate.title, 63);
    const deck = candidate.centralQuestion
      || (candidate.thesis.endsWith(".") ? candidate.thesis : `${candidate.thesis}.`);

    const category = deriveCategory(candidate.icon, candidate.assets, candidate.title);

    // Interpretation status:
    // Confidence or generic lifecycle CANNOT create a System 2 verdict without Dossier ID and System 2 adjudication
    const interpretationStatus: "SUPPORTED" | "MIXED" | "UNRESOLVED" =
      candidate.system2Adjudicated && dossierId
        ? candidate.confidence >= 75
          ? "SUPPORTED"
          : "MIXED"
        : "UNRESOLVED";

    const paragraphs: MarketBriefParagraphV1[] = [];
    const evIds = candidate.evidenceIds;
    const refs = matchedSourceRefs;

    // 1. Opening / Driver paragraph (from whatChanged or body[0] or thesis)
    const openingText = candidate.whatChanged
      || candidate.bodyParagraphs[0]
      || candidate.thesis;
    if (openingText) {
      paragraphs.push({
        role: "opening",
        text: openingText,
        sourceRefs: refs,
        canonicalEvidenceIds: evIds,
      });
    }

    // 2. Primary Mechanism paragraph (ONLY if explicitly present in input)
    const mechanismText1 = candidate.explanation
      || (candidate.bodyParagraphs.length > 1 ? candidate.bodyParagraphs[1] : null);
    if (mechanismText1 && mechanismText1 !== openingText) {
      paragraphs.push({
        role: "mechanism",
        text: mechanismText1,
        sourceRefs: refs,
        canonicalEvidenceIds: evIds,
      });
    }

    // 3. Secondary Transmission / Body paragraph (ONLY if explicitly present in input)
    if (candidate.bodyParagraphs.length > 2) {
      const mechanismText2 = candidate.bodyParagraphs[2];
      if (mechanismText2 && mechanismText2 !== openingText && mechanismText2 !== mechanismText1) {
        paragraphs.push({
          role: "mechanism",
          text: mechanismText2,
          sourceRefs: refs,
          canonicalEvidenceIds: evIds,
        });
      }
    }

    // 4. Market Tape / Reaction (ONLY if explicitly provided in input)
    if (candidate.marketReaction) {
      paragraphs.push({
        role: "reaction",
        text: candidate.marketReaction,
        sourceRefs: refs,
        canonicalEvidenceIds: evIds,
      });
    }

    // 5. Contradiction / Countercase (ONLY if explicitly provided in input)
    if (candidate.strongestContradiction) {
      paragraphs.push({
        role: "contradiction",
        text: candidate.strongestContradiction,
        sourceRefs: refs,
        canonicalEvidenceIds: evIds,
      });
    }

    // 6. Context & Background (ONLY if explicitly provided in input)
    if (candidate.bodyParagraphs.length > 3) {
      paragraphs.push({
        role: "context",
        text: candidate.bodyParagraphs[3],
        sourceRefs: refs,
        canonicalEvidenceIds: evIds,
      });
    } else if (candidate.strongestSupport && candidate.strongestSupport !== openingText && candidate.strongestSupport !== mechanismText1) {
      paragraphs.push({
        role: "context",
        text: candidate.strongestSupport,
        sourceRefs: refs,
        canonicalEvidenceIds: evIds,
      });
    }

    // 7. Outlook & Conditions (ONLY if confirmation or invalidation triggers exist in input)
    if (candidate.confirmation || candidate.invalidation) {
      const confirmationText = candidate.confirmation ? `Confirmation: ${candidate.confirmation}.` : "";
      const invalidationText = candidate.invalidation ? `Invalidation: ${candidate.invalidation}.` : "";
      const outlookText = `${confirmationText} ${invalidationText}`.trim();
      if (outlookText) {
        paragraphs.push({
          role: "outlook",
          text: outlookText,
          sourceRefs: refs,
          canonicalEvidenceIds: evIds,
        });
      }
    }

    const conditionalOutlook = (candidate.confirmation || candidate.invalidation)
      ? `Confirmation: ${candidate.confirmation || "Continued alignment"}. Invalidation: ${candidate.invalidation || "Reversal in underlying catalyst"}.`
      : "Unresolved; additional canonical evidence required to set formal confirmation/invalidation triggers.";

    articles.push({
      contractVersion: "market-brief-article/1",
      articleId,
      editionId,
      dossierId,
      dossierAsOf,
      generatedAt,
      title: displayTitle,
      deck,
      category,
      paragraphs,
      sourceLinks,
      interpretationStatus,
      conditionalOutlook,
    });
  }

  if (articles.length === 0) {
    return {
      contractVersion: "market-brief-article/1",
      editionId,
      dossierId,
      generatedAt,
      articles: [],
      status: "INSUFFICIENT_DATA",
      blockedReason: "No durable, source-grounded story or lesson records exist in the current edition to construct Market Brief articles.",
    };
  }

  return {
    contractVersion: "market-brief-article/1",
    editionId,
    dossierId,
    generatedAt,
    articles,
    status: "COMPLETE",
    blockedReason: null,
  };
}
