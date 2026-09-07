from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"missing anchor for {label}")
    return text.replace(old, new, 1)


runtime_path = Path("lib/intelligence/runtime.ts")
runtime = runtime_path.read_text()

runtime = replace_once(
    runtime,
    'import { buildAncestryUpsertSpecs } from "@/lib/intelligence/intake-normalization";\n',
    'import { buildAncestryUpsertSpecs } from "@/lib/intelligence/intake-normalization";\nimport { deriveMarketThemeKeys, momentumForTransition } from "@/lib/market-theme-taxonomy";\nimport { sourceVerificationRole, sourceVerificationWeight } from "@/lib/intelligence/source-verification";\n',
    "runtime imports",
)

runtime = replace_once(
    runtime,
    '  ancestry_group_id: string | null;\n};\n\ntype CanonicalEvidenceRow = {',
    '  ancestry_group_id: string | null;\n  provider_key: string;\n  metadata?: { verificationRole?: "canonical" | "discovery_only" } | null;\n};\n\ntype CanonicalEvidenceRow = {',
    "canonical source metadata",
)

runtime = replace_once(
    runtime,
    '      provenanceUrls: row.provenance_urls ?? [],\n      structuredPayload: row.structured_payload ?? {},',
    '      provenanceUrls: row.provenance_urls ?? [],\n      providerKey: source?.provider_key ?? null,\n      sourceVerificationRole: source?.metadata?.verificationRole\n        ?? sourceVerificationRole({ sourceName: source?.source_name, providerKey: source?.provider_key, provenanceUrls: row.provenance_urls }),\n      structuredPayload: row.structured_payload ?? {},',
    "evidence verification metadata",
)

runtime = replace_once(
    runtime,
    '      metadata: { domain },\n      last_seen_at: item.published_at,',
    '      metadata: {\n        domain,\n        verificationRole: sourceVerificationRole({ sourceName: item.publisher, provenanceUrls: [item.url], providerKey: "research_intake" }),\n      },\n      last_seen_at: item.published_at,',
    "intake verification role",
)

runtime = replace_once(
    runtime,
    'source:intelligence_evidence_sources(id,external_source_id,source_name,source_tier,reliability_score,ancestry_group_id)&freshness_status',
    'source:intelligence_evidence_sources(id,external_source_id,source_name,source_tier,reliability_score,ancestry_group_id,provider_key,metadata)&freshness_status',
    "evidence source select",
)

helper = '''async function persistDerivedStoryThemes(storyId: string, input: { title: string; thesis: string; causalMechanism: string; assets: string[] }) {
  const themeKeys = deriveMarketThemeKeys(input);
  if (!themeKeys.length) return;
  const encoded = themeKeys.map(encodeURIComponent).join(",");
  const themes = await intelligenceRest<Array<{ id: string; theme_key: string }>>(
    `intelligence_themes?select=id,theme_key&theme_key=in.(${encoded})`,
  );
  if (!themes.length) return;
  await intelligenceRest("intelligence_story_theme_links?on_conflict=story_id,theme_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(themes.map((theme) => ({
      story_id: storyId,
      theme_id: theme.id,
      assignment_origin: "deterministic_runtime",
      confidence: 70,
    }))),
  });
}

'''
if "async function persistDerivedStoryThemes(" not in runtime:
    runtime = replace_once(runtime, "async function promoteCandidate({\n", helper + "async function promoteCandidate({\n", "theme persistence helper")

verification_block = '''  const decisiveEvidence = decisive.map((id) => evidenceById.get(id)).filter((item): item is EvidencePackItem => Boolean(item));
  const corroboratingGroups = new Set(decisiveEvidence
    .filter((item) => sourceVerificationWeight(item) > 0)
    .map((item) => item.ancestryGroupId || item.sourceName));
  const verificationScore = clamp(Math.max(0, ...decisiveEvidence.map((item) => sourceVerificationWeight(item) * 100)));
  const verificationState = decisiveEvidence.some((item) => item.sourceTier <= 2 && sourceVerificationWeight(item) > 0)
    ? "corroborated"
    : corroboratingGroups.size ? "partially_corroborated" : "unverified";
'''
if "const decisiveEvidence = decisive.map" not in runtime:
    runtime = replace_once(
        runtime,
        '  const ancestry = unique(decisive.map((id) => evidenceById.get(id)?.ancestryGroupId).filter((id): id is string => Boolean(id)));',
        verification_block + '  const ancestry = unique(decisive.map((id) => evidenceById.get(id)?.ancestryGroupId).filter((id): id is string => Boolean(id)));',
        "story verification state",
    )

runtime = replace_once(
    runtime,
    '      last_evidence_at: new Date().toISOString(),\n      last_evaluated_at: new Date().toISOString(),\n      story_candidate_id: candidateRowId,',
    '      last_evidence_at: new Date().toISOString(),\n      last_evaluated_at: new Date().toISOString(),\n      last_material_update_at: mutationAt,\n      momentum: momentumForTransition(matched?.status, lifecycleStatus),\n      source_verification_state: verificationState,\n      source_verification_score: verificationScore,\n      story_candidate_id: candidateRowId,',
    "story state fields",
)

theme_call = '''  await persistDerivedStoryThemes(story.id, {
    title: candidate.title,
    thesis: candidate.thesis,
    causalMechanism: hypothesis.causal_mechanism,
    assets: candidate.affectedAssets,
  });

'''
if "await persistDerivedStoryThemes(story.id" not in runtime:
    runtime = replace_once(
        runtime,
        '  await intelligenceRest(`intelligence_story_candidates?id=eq.${encodeURIComponent(candidateRowId)}`, {',
        theme_call + '  await intelligenceRest(`intelligence_story_candidates?id=eq.${encodeURIComponent(candidateRowId)}`, {',
        "theme persistence call",
    )

publish_guard = '''      const hasPrimaryCorroboration = candidate.decisiveEvidenceIds.some((id) => {
        const item = evidenceById.get(id);
        return item?.sourceVerificationRole !== "discovery_only" && (item?.sourceTier ?? 5) <= 2;
      });
      const structurallyPublishable = integrity.publishable && hasPrimaryCorroboration;
'''
if "const hasPrimaryCorroboration = candidate.decisiveEvidenceIds.some" not in runtime:
    runtime = replace_once(
        runtime,
        '      const structurallyPublishable = integrity.publishable;\n      if (!integrity.publishable) warnings.push(`${candidate.title}: not published for structural reason: ${integrity.structuralReasons.join(", ")}.`);',
        publish_guard + '      if (!integrity.publishable) warnings.push(`${candidate.title}: not published for structural reason: ${integrity.structuralReasons.join(", ")}.`);\n      if (!hasPrimaryCorroboration) warnings.push(`${candidate.title}: not published because decisive claims lack primary or direct-market corroboration.`);',
        "publication corroboration guard",
    )

runtime_path.write_text(runtime)

schemas_path = Path("lib/intelligence/schemas.ts")
schemas = schemas_path.read_text()
schemas = replace_once(
    schemas,
    '  provenanceUrls: string[];\n  structuredPayload: Record<string, unknown>;',
    '  provenanceUrls: string[];\n  providerKey?: string | null;\n  /** Discovery-only sources may surface leads but are excluded from canonical proof. */\n  sourceVerificationRole?: "canonical" | "discovery_only";\n  structuredPayload: Record<string, unknown>;',
    "schema verification metadata",
)
schemas_path.write_text(schemas)

source_verification = r'''import type { EvidencePackItem } from "./schemas";

export type SourceVerificationRole = "canonical" | "discovery_only";

const ZEROHEDGE_READS_PATTERNS = [
  /zero\s*hedge/i,
  /alt[- ]?market|alt-market\.us/i,
  /antiwar(?:\.com)?/i,
  /bitcoin\s*magazine|bitcoinmagazine\.com/i,
  /bombthrower|bombthrower\.com/i,
  /bullionstar|bullionstar\.(?:com|us)/i,
  /capitalist\s*exploits|capitalistexploits/i,
  /christophe\s*barraud|christophe-barraud/i,
  /dollar\s*collapse|dollarcollapse/i,
  /dr\.?\s*housing\s*bubble|doctorhousingbubble/i,
  /financial\s*revolutionist|financialrevolutionist/i,
  /forex\s*live|forexlive/i,
  /forum\s*geopolitica|forumgeopolitica/i,
  /gains\s*pains\s*(?:&|and)\s*capital|gainspainscapital/i,
  /gefira/i,
  /gmg\s*research|gmgresearch/i,
  /gold\s*core|goldcore/i,
  /implode[- ]?explode/i,
  /insider\s*paper|insiderpaper/i,
  /libertarian\s*institute|libertarianinstitute/i,
  /liberty\s*blitzkrieg|libertyblitzkrieg/i,
  /max\s*keiser|maxkeiser/i,
  /mises\s*institute|mises\.org/i,
  /mish\s*talk|mishtalk/i,
  /monetary\s*metals|monetary-metals|monetarymetals/i,
] as const;

export function sourceVerificationRole(input: { sourceName?: string | null; provenanceUrls?: string[] | null; providerKey?: string | null }): SourceVerificationRole {
  const value = [input.sourceName, input.providerKey, ...(input.provenanceUrls ?? [])].filter(Boolean).join(" ");
  return ZEROHEDGE_READS_PATTERNS.some((pattern) => pattern.test(value)) ? "discovery_only" : "canonical";
}

/** Discovery sources can create leads and review debt, never prove a canonical fact or mutation. */
export function isCanonicalEligibleEvidence(item: EvidencePackItem) {
  return item.sourceVerificationRole !== "discovery_only"
    && sourceVerificationRole({ sourceName: item.sourceName, providerKey: item.providerKey, provenanceUrls: item.provenanceUrls }) !== "discovery_only"
    && item.evidenceClass !== "transcript"
    && item.evidenceClass !== "research_analysis"
    && item.sourceTier <= 4;
}

export function sourceVerificationWeight(item: EvidencePackItem) {
  if (!isCanonicalEligibleEvidence(item)) return 0;
  const tierWeight = [0, 1, 0.85, 0.65, 0.45, 0][item.sourceTier] ?? 0;
  return tierWeight * Math.max(0, Math.min(1, item.reliabilityScore / 100));
}
'''
Path("lib/intelligence/source-verification.ts").write_text(source_verification)

review_path = Path("lib/intelligence/story-review.ts")
review = review_path.read_text()
if 'import { isCanonicalEligibleEvidence } from "./source-verification.ts";' not in review:
    review = review.replace(
        'import type { EvidencePackItem, ExistingStoryPackItem, StoryReviewTargetPackItem } from "./schemas.ts";\n',
        'import type { EvidencePackItem, ExistingStoryPackItem, StoryReviewTargetPackItem } from "./schemas.ts";\nimport { isCanonicalEligibleEvidence } from "./source-verification.ts";\n',
        1,
    )
review = review.replace(
    '''function creatorOnly(item: EvidencePackItem) {
  return item.evidenceClass === "transcript" || item.evidenceClass === "research_analysis";
}

''',
    "",
)
review = review.replace(
    '    && !creatorOnly(item)\n    && item.sourceTier <= 4);',
    '    && isCanonicalEligibleEvidence(item));',
)
review_path.write_text(review)

migration_path = Path("supabase/migrations/20260907110000_persistent_market_theme_taxonomy.sql")
migration = migration_path.read_text()
registry_sql = r'''

-- ZeroHedge Reads is a discovery ecosystem, not only the zerohedge.com domain.
-- Keep every requested member available for lead generation while preventing it
-- from independently proving a canonical fact or Story mutation.
update public.intelligence_evidence_sources
set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('verificationRole','discovery_only'),
    updated_at=now()
where lower(coalesce(source_name,'')) ~ '(alt[- ]?market|antiwar|bitcoin[ ]*magazine|bombthrower|bullionstar|capitalist[ ]*exploits|christophe[ ]*barraud|dollar[ ]*collapse|dr\.?[ ]*housing[ ]*bubble|financial[ ]*revolutionist|forex[ ]*live|forum[ ]*geopolitica|gains[ ]*pains|gefira|gmg[ ]*research|gold[ ]*core|implode[- ]?explode|insider[ ]*paper|libertarian[ ]*institute|liberty[ ]*blitzkrieg|max[ ]*keiser|mises[ ]*institute|mish[ ]*talk|monetary[ ]*metals)'
   or lower(coalesce(source_url,'')) ~ '(alt-market\.us|antiwar\.com|bitcoinmagazine\.com|bombthrower\.com|bullionstar|capitalistexploits|christophe-barraud|dollarcollapse|doctorhousingbubble|financialrevolutionist|forexlive|forumgeopolitica|gainspains|gefira|gmgresearch|goldcore|implode-explode|insiderpaper|libertarianinstitute|libertyblitzkrieg|maxkeiser|mises\.org|mishtalk|monetary-metals)';
'''
if "ZeroHedge Reads is a discovery ecosystem" not in migration:
    marker = "-- Seed the requested priority questions as explicitly unverified, non-public"
    migration = migration.replace(marker, registry_sql + "\n" + marker, 1)
migration_path.write_text(migration)

test_path = Path("tests/market-theme-taxonomy.test.ts")
test = test_path.read_text()
extra_test = r'''

test("ZeroHedge Reads members on independent domains remain discovery-only", () => {
  for (const source of [
    { sourceName: "BullionStar", provenanceUrls: ["https://www.bullionstar.us/"] },
    { sourceName: "ForexLive", provenanceUrls: ["https://www.forexlive.com/"] },
    { sourceName: "Mises Institute", provenanceUrls: ["https://mises.org/"] },
    { sourceName: "Capitalist Exploits", provenanceUrls: ["https://www.capitalistexploits.at/"] },
  ]) {
    assert.equal(sourceVerificationRole(source), "discovery_only");
    assert.equal(sourceVerificationWeight(evidence({ sourceName: source.sourceName, provenanceUrls: source.provenanceUrls, sourceVerificationRole: sourceVerificationRole(source) })), 0);
  }
  assert.match(migration, /ZeroHedge Reads is a discovery ecosystem/);
});
'''
if "ZeroHedge Reads members on independent domains remain discovery-only" not in test:
    test += extra_test
test_path.write_text(test)
