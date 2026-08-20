export const JODI_OIL_ANNUAL_BASE = "https://www.jodidata.org/_resources/files/downloads/oil-data/annual-csv";
export const JODI_SOURCE_NAME = "Joint Organisations Data Initiative" as const;

export type JodiOilKind = "primary" | "secondary";
export type JodiAssessmentStatus = "comparable" | "caution" | "unassessed" | "under_verification" | "unknown";

export type JodiOilObservation = {
  countryCode: string;
  energyProduct: string;
  flow: string;
  unit: string;
  period: string;
  value: number;
  assessmentCode: string;
  assessmentStatus: JodiAssessmentStatus;
};

export type JodiOilSourceFile = {
  kind: JodiOilKind;
  year: number;
  state: "ready" | "unavailable";
  sourceUrl: string | null;
  attemptedUrls: string[];
  rowCount: number;
  note: string | null;
};

export type JodiOilSnapshot = {
  state: "ready" | "partial" | "unavailable";
  retrievedAt: string;
  latestPeriod: string | null;
  observations: JodiOilObservation[];
  sourceFiles: JodiOilSourceFile[];
  sourceName: typeof JODI_SOURCE_NAME;
  note: string | null;
};

const REQUIRED_COLUMNS = [
  "REF_AREA",
  "ENERGY_PRODUCT",
  "FLOW_BREAKDOWN",
  "UNIT_MEASURE",
  "TIME_PERIOD",
  "OBS_VALUE",
  "ASSESSMENT_CODE",
] as const;

function splitCsvLine(line: string) {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(field.trim());
      field = "";
    } else {
      field += char;
    }
  }

  fields.push(field.trim());
  return fields;
}

function parseNumeric(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed.toLowerCase() === "na" || trimmed.toLowerCase() === "x") return null;
  const parsed = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function assessmentStatus(code: string): JodiAssessmentStatus {
  switch (code.trim()) {
    case "1": return "comparable";
    case "2": return "caution";
    case "3": return "unassessed";
    case "4": return "under_verification";
    default: return "unknown";
  }
}

export function buildJodiOilAnnualCandidates(kind: JodiOilKind, year: number) {
  if (!Number.isInteger(year) || year < 2002 || year > 9999) throw new Error("JODI year is invalid.");
  return [
    `${JODI_OIL_ANNUAL_BASE}/${kind}/${year}.csv`,
    `${JODI_OIL_ANNUAL_BASE}/${kind}/${kind}year${year}.csv`,
  ];
}

export function parseJodiOilCsv(
  text: string,
  options?: { countries?: string[]; units?: string[] },
): JodiOilObservation[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];

  const header = splitCsvLine(lines[0]);
  const indexes = new Map(header.map((name, index) => [name.trim(), index]));
  for (const column of REQUIRED_COLUMNS) {
    if (!indexes.has(column)) throw new Error(`JODI CSV missing required column ${column}.`);
  }

  const countries = new Set((options?.countries || []).map((value) => value.trim().toUpperCase()).filter(Boolean));
  const units = new Set((options?.units || []).map((value) => value.trim().toUpperCase()).filter(Boolean));
  const valueAt = (parts: string[], column: typeof REQUIRED_COLUMNS[number]) => parts[indexes.get(column)!] ?? "";
  const observations: JodiOilObservation[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const parts = splitCsvLine(lines[i]);
    const countryCode = valueAt(parts, "REF_AREA").trim().toUpperCase();
    const energyProduct = valueAt(parts, "ENERGY_PRODUCT").trim();
    const flow = valueAt(parts, "FLOW_BREAKDOWN").trim();
    const unit = valueAt(parts, "UNIT_MEASURE").trim().toUpperCase();
    const period = valueAt(parts, "TIME_PERIOD").trim();
    const assessmentCode = valueAt(parts, "ASSESSMENT_CODE").trim();
    const value = parseNumeric(valueAt(parts, "OBS_VALUE"));

    if (!countryCode || !energyProduct || !flow || !unit || !/^\d{4}-\d{2}$/.test(period) || value === null) continue;
    if (countries.size && !countries.has(countryCode)) continue;
    if (units.size && !units.has(unit)) continue;

    observations.push({
      countryCode,
      energyProduct,
      flow,
      unit,
      period,
      value,
      assessmentCode,
      assessmentStatus: assessmentStatus(assessmentCode),
    });
  }

  observations.sort((a, b) => {
    const period = b.period.localeCompare(a.period);
    if (period) return period;
    return [a.countryCode, a.energyProduct, a.flow, a.unit].join("|").localeCompare(
      [b.countryCode, b.energyProduct, b.flow, b.unit].join("|"),
    );
  });
  return observations;
}

async function fetchOneAnnualFile(
  kind: JodiOilKind,
  year: number,
  fetchImpl: typeof fetch,
  parseOptions?: { countries?: string[]; units?: string[] },
): Promise<{ source: JodiOilSourceFile; observations: JodiOilObservation[] }> {
  const attemptedUrls = buildJodiOilAnnualCandidates(kind, year);
  let lastNote = "JODI annual CSV was unavailable.";

  for (const sourceUrl of attemptedUrls) {
    try {
      const response = await fetchImpl(sourceUrl, {
        headers: {
          accept: "text/csv,text/plain,*/*",
          "user-agent": "Alchemy Live Desk JODI Oil adapter",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        lastNote = `JODI annual CSV returned HTTP ${response.status}.`;
        continue;
      }

      const observations = parseJodiOilCsv(await response.text(), parseOptions);
      return {
        source: {
          kind,
          year,
          state: "ready",
          sourceUrl,
          attemptedUrls,
          rowCount: observations.length,
          note: observations.length ? null : "JODI file was available but contained no observations matching the requested filters.",
        },
        observations,
      };
    } catch (error) {
      lastNote = error instanceof Error ? `JODI annual CSV unavailable: ${error.message}` : "JODI annual CSV unavailable.";
    }
  }

  return {
    source: {
      kind,
      year,
      state: "unavailable",
      sourceUrl: null,
      attemptedUrls,
      rowCount: 0,
      note: lastNote,
    },
    observations: [],
  };
}

export async function fetchJodiOilSnapshot(options?: {
  now?: Date;
  years?: number[];
  kinds?: JodiOilKind[];
  countries?: string[];
  units?: string[];
  fetchImpl?: typeof fetch;
}): Promise<JodiOilSnapshot> {
  const now = options?.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("JODI snapshot clock is invalid.");
  const years = [...new Set(options?.years?.length ? options.years : [now.getUTCFullYear(), now.getUTCFullYear() - 1])];
  const kinds = [...new Set(options?.kinds?.length ? options.kinds : ["primary", "secondary"] as JodiOilKind[])];
  const fetchImpl = options?.fetchImpl ?? fetch;
  const retrievedAt = new Date().toISOString();

  const results = await Promise.all(
    years.flatMap((year) => kinds.map((kind) => fetchOneAnnualFile(kind, year, fetchImpl, {
      countries: options?.countries,
      units: options?.units ?? ["KBD"],
    }))),
  );

  const sourceFiles = results.map((result) => result.source);
  const deduped = new Map<string, JodiOilObservation>();
  for (const result of results) {
    for (const observation of result.observations) {
      const key = [
        observation.countryCode,
        observation.energyProduct,
        observation.flow,
        observation.unit,
        observation.period,
      ].join("|");
      if (!deduped.has(key)) deduped.set(key, observation);
    }
  }

  const observations = [...deduped.values()].sort((a, b) => {
    const period = b.period.localeCompare(a.period);
    if (period) return period;
    return [a.countryCode, a.energyProduct, a.flow, a.unit].join("|").localeCompare(
      [b.countryCode, b.energyProduct, b.flow, b.unit].join("|"),
    );
  });
  const readyFiles = sourceFiles.filter((source) => source.state === "ready").length;
  const state: JodiOilSnapshot["state"] = observations.length === 0
    ? "unavailable"
    : readyFiles === sourceFiles.length
      ? "ready"
      : "partial";

  return {
    state,
    retrievedAt,
    latestPeriod: observations[0]?.period ?? null,
    observations,
    sourceFiles,
    sourceName: JODI_SOURCE_NAME,
    note: state === "partial"
      ? "One or more requested JODI annual files were unavailable; usable source rows were preserved without treating missing files as deletions."
      : state === "unavailable"
        ? "No usable JODI observations were retrieved from the requested annual files."
        : null,
  };
}
