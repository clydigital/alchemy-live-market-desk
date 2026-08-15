const INDEPENDENCE_NOTES = "Independence is conservatively grouped by canonical source domain.";

export type IntakeAncestryRow = {
  publisher: string;
  url: string;
};

export type AncestryUpsertSpec = {
  ancestry_key: string;
  canonical_name: string;
  owner_name: string | null;
  independence_notes: string;
  metadata: {
    domain: string;
    publishers: string[];
  };
  updated_at: string;
};

function canonicalDomain(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, "en", { sensitivity: "base" }) || a.localeCompare(b);
}

export function buildAncestryUpsertSpecs(items: IntakeAncestryRow[], updatedAt = new Date().toISOString()): AncestryUpsertSpec[] {
  const groups = new Map<string, { domain: string; publishers: Set<string> }>();

  for (const item of items) {
    const domain = canonicalDomain(item.url);
    const ancestryKey = `domain:${domain}`;
    const publisher = item.publisher.trim();
    const existing = groups.get(ancestryKey);
    if (existing) {
      if (publisher) existing.publishers.add(publisher);
      continue;
    }
    groups.set(ancestryKey, {
      domain,
      publishers: publisher ? new Set([publisher]) : new Set<string>(),
    });
  }

  return [...groups.entries()]
    .sort(([leftKey], [rightKey]) => compareText(leftKey, rightKey))
    .map(([ancestryKey, group]) => {
      const publishers = [...group.publishers].sort(compareText);
      const ownerName = publishers[0] ?? null;
      return {
        ancestry_key: ancestryKey,
        canonical_name: group.domain === "unknown" ? ownerName ?? "unknown" : group.domain,
        owner_name: ownerName,
        independence_notes: INDEPENDENCE_NOTES,
        metadata: {
          domain: group.domain,
          publishers,
        },
        updated_at: updatedAt,
      };
    });
}
