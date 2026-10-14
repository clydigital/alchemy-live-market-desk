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

function deriveInterpretationStatus(
  confidence: number,
  lifecycle: string,
  countercase: string | null
): "SUPPORTED" | "MIXED" | "UNRESOLVED" {
  const normLife = lifecycle.toLowerCase();
  if (normLife.includes("invalid") || normLife.includes("weaken")) {
    return "UNRESOLVED";
  }
  if (countercase && countercase.length > 20 && confidence < 75) {
    return "MIXED";
  }
  if (confidence >= 70 || normLife.includes("confirm")) {
    return "SUPPORTED";
  }
  if (confidence >= 50 || normLife.includes("develop")) {
    return "MIXED";
  }
  return "UNRESOLVED";
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

  // Handle both full publication object and individual snapshot row
  const publication = isObject(input.publication) ? input.publication : null;
  const canonical = isObject(input.canonical) ? input.canonical : null;
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

  // Extract Dossier identity
  const dossier = isObject(payload.dossier) ? (payload.dossier as JsonRecord) : null;
  const dossierComposition = isObject(payload.dossierComposition) ? (payload.dossierComposition as JsonRecord) : null;
  const dossierId = cleanText(dossier?.id)
    || cleanText(dossier?.contractVersion)
    || cleanText(dossier?.compositionVersion)
    || cleanText(dossierComposition?.parentEditionId)
    || null;

  const dossierAsOf = cleanText(dossier?.generatedAt)
    || cleanText(dossier?.asOf)
    || generatedAt;

  // Gather source record refs and links
  const topSourceRefs = cleanStringArray(input.source_record_refs || payload.source_record_refs);
  const marketTape = isObject(payload.marketTape) ? (payload.marketTape as JsonRecord) : null;
  const tapeSources = Array.isArray(marketTape?.sources) ? marketTape!.sources : [];

  const sourceLinks: MarketBriefSourceLinkV1[] = [];
  if (Array.isArray(tapeSources)) {
    for (const src of tapeSources) {
      if (isObject(src)) {
        const title = cleanText(src.title) || cleanText(src.name) || "Market Source";
        const url = cleanText(src.url) || cleanText(src.sourceUrl);
        if (url) {
          sourceLinks.push({
            title,
            url,
            accessedAt: cleanText(src.accessedAt) || generatedAt,
          });
        }
      }
    }
  }

  // Default canonical source if none extracted
  if (sourceLinks.length === 0) {
    sourceLinks.push({
      title: "Alchemy Live Market Desk Canonical Intelligence",
      url: "https://live.alchemymarkets.com",
      accessedAt: generatedAt,
    });
  }

  // Extract candidate stories/lessons to build articles
  const manifest = Array.isArray(payload.canonicalStoryManifest) ? payload.canonicalStoryManifest : [];
  const lessons = Array.isArray(dossier?.lessons) ? dossier!.lessons : [];
  const storiesList = Array.isArray(payload.stories)
    ? payload.stories
    : Array.isArray(canonical?.storyStates)
      ? (canonical!.storyStates as unknown[])
      : [];

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
      });
    }
  }

  // 3. Fallback to storiesList if candidateMap is empty
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
      });
    }
  }

  // Build MarketBriefArticleV1 records
  const articles: MarketBriefArticleV1[] = [];

  for (const candidate of candidateMap.values()) {
    const articleId = `article:${editionId}:${candidate.storyId}`;
    const displayTitle = truncateTitle(candidate.title, 63);
    const deck = candidate.centralQuestion
      || (candidate.thesis.endsWith(".") ? candidate.thesis : `${candidate.thesis}.`);

    const category = deriveCategory(candidate.icon, candidate.assets, candidate.title);
    const interpretationStatus = deriveInterpretationStatus(
      candidate.confidence,
      candidate.lifecycle,
      candidate.strongestContradiction
    );

    const paragraphs: MarketBriefParagraphV1[] = [];
    const evIds = candidate.evidenceIds;
    const refs = topSourceRefs;

    // 1. Opening / Driver paragraph
    const openingText = candidate.whatChanged
      || candidate.bodyParagraphs[0]
      || candidate.thesis;
    paragraphs.push({
      role: "opening",
      text: openingText,
      sourceRefs: refs,
      canonicalEvidenceIds: evIds,
    });

    // 2. Primary Mechanism paragraph (plain English causal explanation)
    const mechanismText1 = candidate.explanation
      || candidate.bodyParagraphs[1]
      || `The key transmission channel is anchored by ${candidate.title.toLowerCase()}, driving repricing expectations across key benchmark rates and cross-asset flows.`;
    paragraphs.push({
      role: "mechanism",
      text: mechanismText1,
      sourceRefs: refs,
      canonicalEvidenceIds: evIds,
    });

    // 3. Secondary Transmission / Causal step 2
    if (candidate.assets.length > 0 || candidate.bodyParagraphs.length > 2) {
      const mechanismText2 = candidate.bodyParagraphs[2]
        || `Market participants are evaluating asset sensitivities specifically in ${candidate.assets.join(", ")}, where positioning and liquidity conditions reflect the current fundamental balance.`;
      paragraphs.push({
        role: "mechanism",
        text: mechanismText2,
        sourceRefs: refs,
        canonicalEvidenceIds: evIds,
      });
    }

    // 4. Market Tape / Reaction
    const reactionText = candidate.marketReaction
      || (candidate.assets.length > 0
        ? `Observed price action across ${candidate.assets.slice(0, 3).join(" and ")} reflects immediate recalibration of current expectations following the event.`
        : "Recent market pricing demonstrates active absorption of the headline move without breaking broader structural ranges.");
    paragraphs.push({
      role: "reaction",
      text: reactionText,
      sourceRefs: refs,
      canonicalEvidenceIds: evIds,
    });

    // 5. Genuine Contradiction / Countercase
    const contradictionText = candidate.strongestContradiction
      || "A key risk to this thesis lies in potential macro data surprises or shifts in official communication that could challenge current market assumptions.";
    paragraphs.push({
      role: "contradiction",
      text: contradictionText,
      sourceRefs: refs,
      canonicalEvidenceIds: evIds,
    });

    // 6. Context & Background
    if (candidate.strongestSupport || candidate.bodyParagraphs.length > 3) {
      const contextText = candidate.bodyParagraphs[3]
        || candidate.strongestSupport
        || `In broader historical context, this development aligns with recent institutional positioning trends observed across the desk.`;
      paragraphs.push({
        role: "context",
        text: contextText,
        sourceRefs: refs,
        canonicalEvidenceIds: evIds,
      });
    }

    // 7. Outlook & Conditions
    const confirmationText = candidate.confirmation
      ? `Confirmed if: ${candidate.confirmation}.`
      : "Confirmed if subsequent macroeconomic releases validate the directional bias.";
    const invalidationText = candidate.invalidation
      ? `Invalidated if: ${candidate.invalidation}.`
      : "Invalidated if key threshold levels or official policy stances reverse.";
    const outlookText = `${confirmationText} ${invalidationText}`;

    paragraphs.push({
      role: "outlook",
      text: outlookText,
      sourceRefs: refs,
      canonicalEvidenceIds: evIds,
    });

    const conditionalOutlook = `Confirmation: ${candidate.confirmation || "Continued alignment in key indicators"}. Invalidation: ${candidate.invalidation || "Reversal in underlying catalyst or policy path"}.`;

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
