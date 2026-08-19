export type StoryRelation =
  | "UPDATE_EXISTING_STORY"
  | "CONFIRMATION"
  | "CONTRADICTION"
  | "ESCALATION"
  | "NEW_STORY"
  | "DUPLICATE"
  | "NOISE";

export type UpstreamRelationSignal =
  | "update"
  | "confirmation"
  | "contradiction"
  | "escalation"
  | "none";

export type StoryFingerprint = {
  slug: string;
  title: string;
  thesis: string;
  assets: string[];
  themes: string[];
  mechanismTerms: string[];
};

export type CandidateChange = {
  id: string;
  headline: string;
  detail: string;
  assets: string[];
  themes: string[];
  mechanismTerms: string[];
  relationSignal: UpstreamRelationSignal;
  materiality: number;
  material: boolean;
  evidenceFingerprint: string;
};

export type StoryFinderDecision = {
  relation: StoryRelation;
  matchedStorySlug: string | null;
  relatedStorySlugs: string[];
  score: number;
  runnerUpScore: number;
  margin: number;
  reason: string;
};

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "has", "have",
  "in", "into", "is", "it", "its", "of", "on", "or", "that", "the", "their", "this", "to",
  "was", "were", "while", "with", "yet", "now", "more", "than", "not", "still", "can", "could",
]);

function cleanToken(token: string) {
  return token.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

function tokenSet(values: string[]) {
  const tokens = new Set<string>();
  for (const value of values) {
    for (const raw of value.toLowerCase().split(/\s+/)) {
      const token = cleanToken(raw);
      if (token.length >= 3 && !STOPWORDS.has(token)) tokens.add(token);
    }
  }
  return tokens;
}

function overlapCoefficient(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  return intersection / Math.min(a.size, b.size);
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

function normalizedAssets(values: string[]) {
  return new Set(values.map((value) => value.trim().toUpperCase()).filter(Boolean));
}

function scoreStory(candidate: CandidateChange, story: StoryFingerprint) {
  const candidateThemes = tokenSet(candidate.themes);
  const storyThemes = tokenSet(story.themes);
  const candidateMechanism = tokenSet(candidate.mechanismTerms);
  const storyMechanism = tokenSet(story.mechanismTerms);
  const candidateAssets = normalizedAssets(candidate.assets);
  const storyAssets = normalizedAssets(story.assets);
  const candidateText = tokenSet([candidate.headline, candidate.detail, ...candidate.themes, ...candidate.mechanismTerms]);
  const storyText = tokenSet([story.title, story.thesis, ...story.themes, ...story.mechanismTerms]);

  return (
    overlapCoefficient(candidateThemes, storyThemes) * 4 +
    overlapCoefficient(candidateMechanism, storyMechanism) * 5 +
    overlapCoefficient(candidateAssets, storyAssets) * 3 +
    jaccard(candidateText, storyText) * 2
  );
}

const MATCH_THRESHOLD = 5.4;

function mapRelation(signal: UpstreamRelationSignal): StoryRelation {
  if (signal === "confirmation") return "CONFIRMATION";
  if (signal === "contradiction") return "CONTRADICTION";
  if (signal === "escalation") return "ESCALATION";
  return "UPDATE_EXISTING_STORY";
}

export function findStoryForChange(input: {
  candidate: CandidateChange;
  stories: StoryFingerprint[];
  seenEvidenceFingerprints?: Set<string>;
}): StoryFinderDecision {
  const { candidate, stories } = input;
  const seenEvidenceFingerprints = input.seenEvidenceFingerprints ?? new Set<string>();

  if (seenEvidenceFingerprints.has(candidate.evidenceFingerprint)) {
    return {
      relation: "DUPLICATE",
      matchedStorySlug: null,
      relatedStorySlugs: [],
      score: 0,
      runnerUpScore: 0,
      margin: 0,
      reason: "Evidence fingerprint was already processed.",
    };
  }

  if (!candidate.material || candidate.materiality < 40) {
    return {
      relation: "NOISE",
      matchedStorySlug: null,
      relatedStorySlugs: [],
      score: 0,
      runnerUpScore: 0,
      margin: 0,
      reason: "Upstream change detector did not mark the change as materially actionable.",
    };
  }

  const ranked = stories
    .map((story) => ({ story, score: scoreStory(candidate, story) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0] ?? null;
  const runnerUp = ranked[1] ?? null;
  const bestScore = best?.score ?? 0;
  const runnerUpScore = runnerUp?.score ?? 0;
  const rawMargin = bestScore - runnerUpScore;
  const matched = ranked.filter((item) => item.score >= MATCH_THRESHOLD).slice(0, 3);

  if (!best || bestScore < MATCH_THRESHOLD) {
    return {
      relation: "NEW_STORY",
      matchedStorySlug: null,
      relatedStorySlugs: [],
      score: bestScore,
      runnerUpScore,
      margin: rawMargin,
      reason: best ? "No existing Story crossed the deterministic match threshold." : "No existing Story fingerprint was available.",
    };
  }

  if (matched.length > 1) {
    return {
      relation: "NEW_STORY",
      matchedStorySlug: null,
      relatedStorySlugs: matched.map((item) => item.story.slug),
      score: bestScore,
      runnerUpScore,
      margin: 0,
      reason: "Cross-Story candidate matched multiple existing mechanisms; do not auto-attach before synthesis resolves the relationship.",
    };
  }

  return {
    relation: mapRelation(candidate.relationSignal),
    matchedStorySlug: best.story.slug,
    relatedStorySlugs: [],
    score: bestScore,
    runnerUpScore,
    margin: rawMargin,
    reason: "Existing Story matched on structured themes, mechanism and assets.",
  };
}

export function evaluateStoryFinderBenchmark(input: {
  cases: Array<{
    candidate: CandidateChange;
    expectedRelation: StoryRelation;
    expectedStorySlug: string | null;
  }>;
  stories: StoryFingerprint[];
  seenEvidenceFingerprints?: Set<string>;
}) {
  const decisions = input.cases.map((testCase) => {
    const actual = findStoryForChange({
      candidate: testCase.candidate,
      stories: input.stories,
      seenEvidenceFingerprints: input.seenEvidenceFingerprints,
    });
    const relationCorrect = actual.relation === testCase.expectedRelation;
    const storyCorrect = actual.matchedStorySlug === testCase.expectedStorySlug;
    return {
      id: testCase.candidate.id,
      expectedRelation: testCase.expectedRelation,
      actualRelation: actual.relation,
      expectedStorySlug: testCase.expectedStorySlug,
      actualStorySlug: actual.matchedStorySlug,
      relatedStorySlugs: actual.relatedStorySlugs,
      relationCorrect,
      storyCorrect,
      correct: relationCorrect && storyCorrect,
      score: actual.score,
      runnerUpScore: actual.runnerUpScore,
      margin: actual.margin,
      reason: actual.reason,
    };
  });

  const correct = decisions.filter((item) => item.correct).length;
  return {
    total: decisions.length,
    correct,
    accuracy: decisions.length ? correct / decisions.length : 0,
    decisions,
  };
}
