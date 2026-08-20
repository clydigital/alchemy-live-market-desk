export const ONS_BASE_URL = "https://api.beta.ons.gov.uk/v1";
export const ONS_SOURCE_NAME = "Office for National Statistics" as const;

export type OnsDatasetMetadata = {
  id: string;
  title: string | null;
  description: string | null;
  lastUpdated: string | null;
  releaseFrequency: string | null;
  nextRelease: string | null;
  state: string | null;
  unitOfMeasure: string | null;
  nationalStatistic: boolean | null;
  latestEdition: string | null;
  latestVersion: string | null;
  latestVersionUrl: string | null;
  publications: Array<{ title: string | null; href: string }>;
};

export type OnsObservation = {
  value: number | string | null;
  dimensions: Record<string, string>;
  metadata: Record<string, unknown>;
};

export type OnsObservationSet = {
  unitOfMeasure: string | null;
  totalObservations: number | null;
  observations: OnsObservation[];
  sourceUrl: string;
};

export type OnsSnapshot = {
  state: "ready" | "partial" | "unavailable";
  retrievedAt: string;
  sourceName: typeof ONS_SOURCE_NAME;
  dataset: OnsDatasetMetadata | null;
  observations: OnsObservationSet | null;
  note: string | null;
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function normalizeOnsDatasetId(value: string) {
  const id = value.trim();
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("ONS dataset id is invalid.");
  return id;
}

export function parseOnsLatestVersionHref(href: string | null) {
  if (!href) return { edition: null, version: null };
  const match = href.match(/\/datasets\/[^/]+\/editions\/([^/]+)\/versions\/(\d+)(?:$|[?#])/);
  return match
    ? { edition: decodeURIComponent(match[1]), version: match[2] }
    : { edition: null, version: null };
}

export function parseOnsDatasetMetadata(payload: unknown): OnsDatasetMetadata {
  const root = asObject(payload);
  if (!root) throw new Error("ONS dataset payload is not an object.");
  const id = text(root.id);
  if (!id) throw new Error("ONS dataset payload has no id.");

  const links = asObject(root.links);
  const latest = links ? asObject(links.latest_version) : null;
  const latestVersionUrl = latest ? text(latest.href) : null;
  const parsed = parseOnsLatestVersionHref(latestVersionUrl);
  const publications = Array.isArray(root.publications)
    ? root.publications.flatMap((item) => {
        const obj = asObject(item);
        const href = obj ? text(obj.href) : null;
        return href ? [{ title: text(obj?.title), href }] : [];
      })
    : [];

  return {
    id,
    title: text(root.title),
    description: text(root.description),
    lastUpdated: text(root.last_updated),
    releaseFrequency: text(root.release_frequency),
    nextRelease: text(root.next_release),
    state: text(root.state),
    unitOfMeasure: text(root.unit_of_measure),
    nationalStatistic: typeof root.national_statistic === "boolean" ? root.national_statistic : null,
    latestEdition: parsed.edition,
    latestVersion: text(latest?.id) ?? parsed.version,
    latestVersionUrl,
    publications,
  };
}

export function buildOnsObservationUrl(
  datasetId: string,
  edition: string,
  version: string | number,
  query: Record<string, string>,
) {
  const id = normalizeOnsDatasetId(datasetId);
  const ed = edition.trim();
  if (!ed) throw new Error("ONS edition is required.");
  const ver = String(version).trim();
  if (!/^\d+$/.test(ver)) throw new Error("ONS version must be numeric.");
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (!key.trim() || !value.trim()) throw new Error("ONS observation query contains an empty key/value.");
    params.set(key, value);
  }
  if ([...params.keys()].length === 0) throw new Error("ONS observation query is required.");
  return `${ONS_BASE_URL}/datasets/${encodeURIComponent(id)}/editions/${encodeURIComponent(ed)}/versions/${ver}/observations?${params.toString()}`;
}

export function parseOnsObservations(payload: unknown, sourceUrl: string): OnsObservationSet {
  const root = asObject(payload);
  if (!root) throw new Error("ONS observations payload is not an object.");
  if (!Array.isArray(root.observations)) throw new Error("ONS observations payload has no observations array.");

  const observations = root.observations.map((item) => {
    const obj = asObject(item) ?? {};
    const raw = obj.observation;
    let value: number | string | null = null;
    if (typeof raw === "number" && Number.isFinite(raw)) value = raw;
    else if (typeof raw === "string") {
      const n = Number(raw);
      value = raw.trim() === "" ? null : Number.isFinite(n) ? n : raw;
    }

    const dimensions: Record<string, string> = {};
    const rawDims = asObject(obj.dimensions);
    if (rawDims) {
      for (const [name, dimValue] of Object.entries(rawDims)) {
        const dimObj = asObject(dimValue);
        const option = dimObj ? asObject(dimObj.option) : null;
        const optionId = option ? text(option.id) : null;
        if (optionId) dimensions[name] = optionId;
      }
    } else if (Array.isArray(obj.dimensions)) {
      for (const dim of obj.dimensions) {
        const d = asObject(dim);
        const name = d ? text(d.dimension) ?? text(d.dimension_id) : null;
        const option = d ? text(d.option_id) ?? text(d.option) : null;
        if (name && option) dimensions[name] = option;
      }
    }

    const metadata = asObject(obj.metadata) ?? {};
    return { value, dimensions, metadata };
  });

  return {
    unitOfMeasure: text(root.unit_of_measure),
    totalObservations: numberOrNull(root.total_observations),
    observations,
    sourceUrl,
  };
}

function unavailable(retrievedAt: string, note: string): OnsSnapshot {
  return {
    state: "unavailable",
    retrievedAt,
    sourceName: ONS_SOURCE_NAME,
    dataset: null,
    observations: null,
    note,
  };
}

export async function fetchOnsDatasetSensor(options: {
  datasetId: string;
  observationQuery?: Record<string, string>;
  edition?: string;
  version?: string | number;
  fetchImpl?: typeof fetch;
}): Promise<OnsSnapshot> {
  const retrievedAt = new Date().toISOString();
  const id = normalizeOnsDatasetId(options.datasetId);
  const fetchImpl = options.fetchImpl ?? fetch;
  const datasetUrl = `${ONS_BASE_URL}/datasets/${encodeURIComponent(id)}`;

  let dataset: OnsDatasetMetadata;
  try {
    const response = await fetchImpl(datasetUrl, {
      headers: { accept: "application/json", "user-agent": "Alchemy Live Desk ONS adapter" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return unavailable(retrievedAt, `ONS dataset returned HTTP ${response.status}.`);
    dataset = parseOnsDatasetMetadata(await response.json());
  } catch (error) {
    return unavailable(retrievedAt, error instanceof Error ? `ONS dataset unavailable: ${error.message}` : "ONS dataset unavailable.");
  }

  if (!options.observationQuery) {
    return {
      state: "ready",
      retrievedAt,
      sourceName: ONS_SOURCE_NAME,
      dataset,
      observations: null,
      note: null,
    };
  }

  const edition = options.edition ?? dataset.latestEdition;
  const version = options.version ?? dataset.latestVersion;
  if (!edition || version === null || version === undefined) {
    return {
      state: "partial",
      retrievedAt,
      sourceName: ONS_SOURCE_NAME,
      dataset,
      observations: null,
      note: "ONS dataset metadata was available but latest edition/version could not be resolved.",
    };
  }

  let observationUrl: string;
  try {
    observationUrl = buildOnsObservationUrl(id, edition, version, options.observationQuery);
  } catch (error) {
    return {
      state: "partial",
      retrievedAt,
      sourceName: ONS_SOURCE_NAME,
      dataset,
      observations: null,
      note: error instanceof Error ? error.message : "ONS observation query is invalid.",
    };
  }

  try {
    const response = await fetchImpl(observationUrl, {
      headers: { accept: "application/json", "user-agent": "Alchemy Live Desk ONS adapter" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return {
        state: "partial",
        retrievedAt,
        sourceName: ONS_SOURCE_NAME,
        dataset,
        observations: null,
        note: `ONS observations returned HTTP ${response.status}.`,
      };
    }
    return {
      state: "ready",
      retrievedAt,
      sourceName: ONS_SOURCE_NAME,
      dataset,
      observations: parseOnsObservations(await response.json(), observationUrl),
      note: null,
    };
  } catch (error) {
    return {
      state: "partial",
      retrievedAt,
      sourceName: ONS_SOURCE_NAME,
      dataset,
      observations: null,
      note: error instanceof Error ? `ONS observations unavailable: ${error.message}` : "ONS observations unavailable.",
    };
  }
}
