export type EconomicMetricTransformation = "level" | "mom" | "yoy" | "qoq" | "annualised" | "change";

export type EconomicMetricRelease = {
  id: string;
  series_key: string;
  release_name: string;
  agency: string;
  category: string;
  release_date: string;
  reference_period: string | null;
  frequency: string;
  actual: string | null;
  consensus: string | null;
  previous: string | null;
  revised_previous: string | null;
  unit: string | null;
  source_url: string;
  published_at: string | null;
  actual_retrieved_at: string | null;
  consensus_source: string | null;
  consensus_captured_at: string | null;
};

export type StructuredEconomicMetric = {
  id: string;
  release_id: string;
  metric_key: string;
  label: string;
  geography: string;
  period: string | null;
  frequency: string;
  transformation: EconomicMetricTransformation;
  unit: string | null;
  previous: number | null;
  revised_previous: number | null;
  consensus: number | null;
  consensus_source: string | null;
  consensus_captured_at: string | null;
  forecast_low: number | null;
  forecast_high: number | null;
  alchemy_expectation: number | null;
  alchemy_expectation_low: number | null;
  alchemy_expectation_high: number | null;
  alchemy_expectation_confidence: number | null;
  actual: number | null;
  surprise_vs_consensus: number | null;
  surprise_vs_alchemy: number | null;
  source_name: string;
  source_url: string;
  observed_at: string;
  retrieved_at: string;
};

type PersistedEconomicMetric = Partial<StructuredEconomicMetric> & Pick<StructuredEconomicMetric, "id" | "release_id" | "metric_key" | "label" | "transformation">;

type ParsedNumber = { value: number; unit: string | null };

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function cleanUnit(unit: string | null | undefined) {
  const value = unit?.trim().toLowerCase();
  if (!value) return null;
  if (/^(%|percent|percentage)$/.test(value)) return "%";
  if (/^(percentage point|percentage points|pp|ppts?)$/.test(value)) return "percentage points";
  if (/^(index point|index points|index|points?)$/.test(value)) return "index points";
  if (/^(k|thousand|thousands)$/.test(value)) return "thousand";
  return unit!.trim();
}

function unitFromValue(value: string) {
  if (/\b(?:percentage points?|pp|ppts?)\b/i.test(value)) return "percentage points";
  if (/%|\bpercent(?:age)?\b/i.test(value)) return "%";
  if (/\b(?:index points?|index)\b/i.test(value)) return "index points";
  if (/\d\s*k\b|\bthousands?\b/i.test(value)) return "thousand";
  return null;
}

export function parseEconomicNumber(raw: string | null | undefined): ParsedNumber | null {
  if (!raw || /^(?:n\/?a|na|null|none|pending|tbc|--?|—|–)$/i.test(raw.trim())) return null;
  const normalised = raw.trim().replace(/[−–—]/g, "-").replace(/,/g, "");
  if (/\d+\.\d+\./.test(normalised)) return null;
  const matches = [...normalised.matchAll(/[+-]?(?:\d+(?:\.\d+)?|\.\d+)/g)];
  if (matches.length !== 1) return null;
  let value = Number(matches[0][0]);
  if (!Number.isFinite(value)) return null;
  if (/^\s*\([^)]*\)\s*$/.test(normalised)) value = -Math.abs(value);
  return { value, unit: unitFromValue(normalised) };
}

export function economicGeography(release: Pick<EconomicMetricRelease, "agency" | "series_key" | "source_url">) {
  const agency = release.agency.trim().toLowerCase();
  const seriesKey = release.series_key.trim().toLowerCase();
  let hostname = "";
  try {
    hostname = new URL(release.source_url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    // An invalid source URL supplies no geographic evidence.
  }

  const knownGeographies = [
    { geography: "Australia", seriesPrefix: "au-", agencies: [/^reserve bank of australia$/, /^rba$/], domains: ["rba.gov.au", "abs.gov.au"] },
    { geography: "New Zealand", seriesPrefix: "nz-", agencies: [/^reserve bank of new zealand$/, /^rbnz$/], domains: ["rbnz.govt.nz", "stats.govt.nz"] },
    { geography: "United Kingdom", seriesPrefix: "uk-", agencies: [/^bank of england$/, /^uk office for national statistics$/, /^office for national statistics$/], domains: ["bankofengland.co.uk", "ons.gov.uk"] },
    { geography: "Japan", seriesPrefix: "jp-", agencies: [/^bank of japan$/, /^boj$/], domains: ["boj.or.jp", "stat.go.jp"] },
    { geography: "Canada", seriesPrefix: "ca-", agencies: [/^bank of canada$/, /^statistics canada$/, /^statcan$/], domains: ["bankofcanada.ca", "statcan.gc.ca"] },
    { geography: "Euro Area", seriesPrefix: "ea-", agencies: [/^european central bank$/, /^ecb$/, /^eurostat$/], domains: ["ecb.europa.eu", "ec.europa.eu"] },
    {
      geography: "United States",
      seriesPrefix: "us-",
      agencies: [
        /^u\.s\. bureau of labor statistics$/,
        /^bureau of labor statistics$/,
        /^u\.s\. bureau of economic analysis$/,
        /^bureau of economic analysis$/,
        /^federal reserve(?: board)?$/,
        /^u\.s\. census bureau$/,
      ],
      domains: ["bls.gov", "bea.gov", "federalreserve.gov", "census.gov"],
    },
  ] as const;

  for (const mapping of knownGeographies) {
    if (
      seriesKey.startsWith(mapping.seriesPrefix)
      || mapping.agencies.some((pattern) => pattern.test(agency))
      || mapping.domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
    ) return mapping.geography;
  }
  return "Unknown";
}

export function economicTransformation(release: Pick<EconomicMetricRelease, "series_key" | "release_name" | "category" | "unit">): EconomicMetricTransformation {
  const text = `${release.series_key} ${release.release_name} ${release.category}`.toLowerCase();
  if (/\b(?:yoy|y\/y)\b|year[- ]on[- ]year|year over year|12[- ]month/.test(text)) return "yoy";
  if (/\b(?:mom|m\/m)\b|month[- ]on[- ]month|month over month/.test(text)) return "mom";
  if (/\b(?:qoq|q\/q)\b|quarter[- ]on[- ]quarter|quarter over quarter/.test(text)) return "qoq";
  if (/annualis(?:ed|z)|\bsaar\b/.test(text)) return "annualised";
  if (/payroll|employment change|job change|claims change|net change/.test(text)) return "change";
  // A rate decision, an unemployment rate and an index are observed levels.
  // A bare percent sign never supplies a rate-of-change transformation.
  return "level";
}

function canonicalMetricName(release: EconomicMetricRelease) {
  const explicit = release.release_name
    .replace(/\s*[([]\s*(?:yoy|y\/y|mom|m\/m|qoq|q\/q|year[- ]on[- ]year|month[- ]on[- ]month|quarter[- ]on[- ]quarter|annualis(?:ed|z)|saar)\s*[)\]]/ig, "")
    .replace(/\s+/g, " ")
    .trim();
  return explicit || release.series_key;
}

function identityUnit(release: EconomicMetricRelease, transformation: EconomicMetricTransformation) {
  const explicit = cleanUnit(release.unit);
  if (explicit) return explicit;
  const text = `${release.release_name} ${release.series_key}`;
  if (/index/i.test(text) && transformation === "level") return "index points";
  if (/rate decision|cash rate|policy rate|ocr decision|interest rate|unemployment rate/i.test(text)) return "%";
  if (/payroll|employment change/i.test(text)) return "thousand";
  return null;
}

function compatibleValue(raw: string | null, expectedUnit: string | null) {
  const parsed = parseEconomicNumber(raw);
  if (!parsed) return null;
  const parsedUnit = cleanUnit(parsed.unit);
  if (expectedUnit && parsedUnit && expectedUnit !== parsedUnit) return null;
  return parsed.value;
}

function completeness(release: EconomicMetricRelease) {
  return [release.actual, release.consensus, release.previous, release.revised_previous, release.reference_period, release.unit]
    .filter((value) => value !== null && value !== "").length;
}

function releaseIdentity(release: EconomicMetricRelease) {
  const transformation = economicTransformation(release);
  return [
    release.release_date.slice(0, 10),
    economicGeography(release),
    slug(canonicalMetricName(release)),
    release.reference_period || "",
    release.frequency || "",
    transformation,
  ].join("|").toLowerCase();
}

function deriveMetric(release: EconomicMetricRelease): StructuredEconomicMetric {
  const transformation = economicTransformation(release);
  const label = canonicalMetricName(release);
  const geography = economicGeography(release);
  const unit = identityUnit(release, transformation);
  const actual = compatibleValue(release.actual, unit);
  const consensus = compatibleValue(release.consensus, unit);
  const previous = compatibleValue(release.previous, unit);
  const revisedPrevious = compatibleValue(release.revised_previous, unit);
  const metricKey = slug(`${geography}-${label}-${release.frequency || "unspecified"}-${transformation}`);
  const observedAt = release.actual_retrieved_at || release.published_at || release.release_date;
  return {
    id: `derived:${release.id}:${metricKey}`,
    release_id: release.id,
    metric_key: metricKey,
    label,
    geography,
    period: release.reference_period,
    frequency: release.frequency || "Unspecified",
    transformation,
    unit,
    previous,
    revised_previous: revisedPrevious,
    consensus,
    consensus_source: release.consensus_source,
    consensus_captured_at: release.consensus_captured_at,
    forecast_low: null,
    forecast_high: null,
    alchemy_expectation: null,
    alchemy_expectation_low: null,
    alchemy_expectation_high: null,
    alchemy_expectation_confidence: null,
    actual,
    surprise_vs_consensus: actual !== null && consensus !== null ? actual - consensus : null,
    surprise_vs_alchemy: null,
    source_name: release.agency,
    source_url: release.source_url,
    observed_at: observedAt,
    retrieved_at: observedAt,
  };
}

function enrichPersistedMetric(metric: PersistedEconomicMetric, release: EconomicMetricRelease): StructuredEconomicMetric {
  const actual = metric.actual ?? null;
  const consensus = metric.consensus ?? null;
  const alchemy = metric.alchemy_expectation ?? null;
  const observedAt = metric.observed_at || metric.retrieved_at || release.actual_retrieved_at || release.published_at || release.release_date;
  return {
    id: metric.id,
    release_id: metric.release_id,
    metric_key: metric.metric_key,
    label: metric.label,
    geography: metric.geography || economicGeography(release),
    period: metric.period ?? release.reference_period,
    frequency: metric.frequency || release.frequency || "Unspecified",
    transformation: metric.transformation,
    unit: cleanUnit(metric.unit) || identityUnit(release, metric.transformation),
    previous: metric.previous ?? null,
    revised_previous: metric.revised_previous ?? null,
    consensus,
    consensus_source: metric.consensus_source ?? release.consensus_source,
    consensus_captured_at: metric.consensus_captured_at ?? release.consensus_captured_at,
    forecast_low: metric.forecast_low ?? null,
    forecast_high: metric.forecast_high ?? null,
    alchemy_expectation: alchemy,
    alchemy_expectation_low: metric.alchemy_expectation_low ?? null,
    alchemy_expectation_high: metric.alchemy_expectation_high ?? null,
    alchemy_expectation_confidence: metric.alchemy_expectation_confidence ?? null,
    actual,
    surprise_vs_consensus: metric.surprise_vs_consensus ?? (actual !== null && consensus !== null ? actual - consensus : null),
    surprise_vs_alchemy: metric.surprise_vs_alchemy ?? (actual !== null && alchemy !== null ? actual - alchemy : null),
    source_name: metric.source_name || release.agency,
    source_url: metric.source_url || release.source_url,
    observed_at: observedAt,
    retrieved_at: metric.retrieved_at || observedAt,
  };
}

export function buildStructuredEconomicMetrics(
  releases: EconomicMetricRelease[],
  persistedMetrics: PersistedEconomicMetric[] = [],
) {
  const releaseById = new Map(releases.map((release) => [release.id, release]));
  const output = persistedMetrics.flatMap((metric) => {
    const release = releaseById.get(metric.release_id);
    return release ? [enrichPersistedMetric(metric, release)] : [];
  });
  const persistedKeys = new Set(output.map((metric) => `${metric.release_id}:${metric.metric_key}`));

  const canonicalReleases = new Map<string, EconomicMetricRelease>();
  for (const release of releases) {
    const identity = releaseIdentity(release);
    const current = canonicalReleases.get(identity);
    if (!current || completeness(release) > completeness(current)) canonicalReleases.set(identity, release);
  }

  for (const release of canonicalReleases.values()) {
    const metric = deriveMetric(release);
    if (persistedKeys.has(`${metric.release_id}:${metric.metric_key}`)) continue;
    output.push(metric);
  }
  return output;
}
