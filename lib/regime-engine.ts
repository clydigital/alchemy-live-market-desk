import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { NewsThread, PublicStatement, Story } from "./data.ts";
import {
  evaluateExistingStoryMarketDomain,
  STORY_DOMAIN_CONTRACT_VERSION,
} from "./intelligence/story-admissibility.ts";
import { getDossierV2PresentationSelection } from "./dossier-v2/presentation-reader.ts";
import type { StoryEvent, StoryThesisVersion } from "./persistence/contracts.ts";
import {
  detectSystem1TelemetryStateChanges,
  openSystem2ActivationStoryIds,
  selectSystem2ActivationTargets,
  type System2StoryActivationTarget,
} from "./regime-system2-activation.ts";
import {
  buildRegimeProjection,
  REGIME_DEFINITIONS,
  REGIME_ROUTING_CONTRACT_VERSION,
  type ProjectedRegime,
  type RegimeRoute,
} from "./regimes.ts";
import { createSupabaseAdminClient } from "./supabase/admin.ts";

export const REGIME_PROJECTOR_CONTRACT_VERSION = "regime-projector/3" as const;

export type RegimeProjectionTrigger =
  | "story_engine"
  | "dossier"
  | "manual"
  | "bootstrap";

export type RegimeShadowProjectionResult = {
  enabled: boolean;
  reused: boolean;
  runId: string | null;
  runKey: string | null;
  inputHash: string | null;
  projectedRegimes: number;
  versionIds: string[];
  warnings: string[];
};

export type RegimeShadowHealth = {
  available: boolean;
  latestRunId: string | null;
  latestRunStatus: string | null;
  latestCompletedAt: string | null;
  latestInputHash: string | null;
  currentProjectionCount: number;
  expectedProjectionCount: number;
  contractVersion: string | null;
  lagMinutes: number | null;
  unassignedStoryCount: number;
  highSeverityUnassignedStoryCount: number;
  oldestUnassignedOpenedAt: string | null;
  oldestUnassignedAgeMinutes: number | null;
  quarantinedStoryCount: number;
  highSeverityQuarantinedStoryCount: number;
  oldestQuarantinedOpenedAt: string | null;
  oldestQuarantinedAgeMinutes: number | null;
  warning: string | null;
};

type RegimeIdentityRow = {
  id: string;
  slug: string;
};

type RegimeSubgroupIdentityRow = {
  id: string;
  regime_id: string;
  subgroup_key: string;
};

type ProjectionRunRow = {
  id: string;
  run_key: string;
  status: "started" | "completed" | "failed";
  input_hash: string;
  completed_at: string | null;
};

type PersistProjectionRpcRow = {
  version_id: string;
  version_number: number;
  created: boolean;
};

type RoutingDebtSyncRow = {
  active_count: number;
  upserted_count: number;
  resolved_count: number;
  stale: boolean;
};

type StoryDomainDebtSyncRow = {
  active_count: number;
  upserted_count: number;
  resolved_count: number;
  stale: boolean;
};

type CurrentRegimeProjectionRow = {
  regime_id: string;
  projection_run_id: string;
  snapshot: unknown;
};

type PendingSystem2Activation = System2StoryActivationTarget & {
  regimeId: string;
};

type ProjectionInput = {
  stories: Story[];
  versions: StoryThesisVersion[];
  events: StoryEvent[];
  newsThreads: NewsThread[];
  statements: PublicStatement[];
  dossier: Awaited<ReturnType<typeof getDossierV2PresentationSelection>>;
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, stableValue(nested)]),
  );
}

function stableJson(value: unknown) {
  return JSON.stringify(stableValue(value));
}

function hash(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function projectionPersistenceEnabled() {
  return process.env.REGIME_SHADOW_PERSISTENCE_ENABLED !== "false";
}

function latestVersions(versions: StoryThesisVersion[]) {
  const map = new Map<string, StoryThesisVersion>();
  for (const version of versions) {
    const current = map.get(version.story_id);
    if (
      !current
      || version.version_number > current.version_number
      || (
        version.version_number === current.version_number
        && version.effective_at > current.effective_at
      )
    ) {
      map.set(version.story_id, version);
    }
  }
  return [...map.values()].sort((left, right) => left.story_id.localeCompare(right.story_id));
}

async function loadProjectionInput(client: SupabaseClient): Promise<ProjectionInput> {
  const [storiesResult, versionsResult, eventsResult, newsResult, statementsResult, dossier] = await Promise.all([
    client
      .from("stories")
      .select("id,slug,title,thesis,status,confidence,rank,market_question,dominant_narrative,best_explanation,strongest_support,strongest_contradiction,priced_assessment,confirmation_trigger,invalidation_trigger,next_catalyst,article_angle,provisional_title,article_verdict,assets,source_quality,novelty,persistence,trader_relevance,article_potential")
      .neq("status", "archived")
      .order("rank", { ascending: true, nullsFirst: false })
      .limit(120),
    client
      .from("story_thesis_versions")
      .select("*")
      .order("effective_at", { ascending: false })
      .limit(600),
    client
      .from("story_events")
      .select("*")
      .order("event_at", { ascending: false })
      .limit(600),
    client
      .from("news_threads")
      .select("id,domain,category,headline,summary,current_view,source_url,source_type,published_at,importance,affected_assets")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(80),
    client
      .from("public_statements")
      .select("id,speaker,statement_group,channel,statement_date,quote_excerpt,topic,market_interpretation,affected_assets,source_url,verification_status,follow_up")
      .order("statement_date", { ascending: false })
      .limit(50),
    getDossierV2PresentationSelection(client),
  ]);

  const failure = [
    ["stories", storiesResult.error],
    ["story_thesis_versions", versionsResult.error],
    ["story_events", eventsResult.error],
    ["news_threads", newsResult.error],
    ["public_statements", statementsResult.error],
  ].find(([, error]) => Boolean(error));

  if (failure) {
    const [name, error] = failure as [string, { message: string }];
    throw new Error(`Regime projector could not load ${name}: ${error.message}`);
  }

  return {
    stories: (storiesResult.data || []) as Story[],
    versions: (versionsResult.data || []) as StoryThesisVersion[],
    events: (eventsResult.data || []) as StoryEvent[],
    newsThreads: (newsResult.data || []) as NewsThread[],
    statements: (statementsResult.data || []) as PublicStatement[],
    dossier,
  };
}

function buildInputManifest(input: ProjectionInput) {
  const latest = latestVersions(input.versions);
  const recentEvents = input.events.slice(0, 160);
  const recentNews = input.newsThreads.slice(0, 60);
  const recentStatements = input.statements.slice(0, 40);
  const dossier = input.dossier.presentation;

  return {
    contractVersion: REGIME_PROJECTOR_CONTRACT_VERSION,
    routingContractVersion: REGIME_ROUTING_CONTRACT_VERSION,
    storyDomainContractVersion: STORY_DOMAIN_CONTRACT_VERSION,
    storyVersions: latest.map((version) => ({
      storyId: version.story_id,
      versionId: version.id,
      versionNumber: version.version_number,
      effectiveAt: version.effective_at,
    })),
    storyEvents: recentEvents.map((event) => ({
      id: event.id,
      storyId: event.story_id,
      eventAt: event.event_at,
      impact: event.impact,
      type: event.event_type,
    })),
    news: recentNews.map((item) => ({
      id: item.id,
      publishedAt: item.published_at,
      sourceType: item.source_type,
    })),
    statements: recentStatements.map((item) => ({
      id: item.id,
      statementDate: item.statement_date,
      verificationStatus: item.verification_status,
    })),
    dossier: {
      selectedDossierId: input.dossier.selectedDossierId,
      selectedAsOf: input.dossier.selectedAsOf,
      status: input.dossier.status,
      rateRegimeContract: dossier?.rateRegime?.contractVersion ?? null,
      rateRegimeAsOf: dossier?.rateRegime?.asOf ?? null,
      dollarLiquidityContract: dossier?.dollarLiquidity?.contractVersion ?? null,
      dollarLiquidityAsOf: dossier?.dollarLiquidity?.asOf ?? null,
      motionRegimeContext: (dossier?.motionRegimeContext ?? [])
        .map((item) => ({
          motionId: item.motionId,
          decision: item.decision,
          regimeSlug: item.regimeSlug,
          storyId: item.storyId,
          canonicalEvidenceRefs: [...item.canonicalEvidenceRefs].sort(),
          observedAt: item.observedAt,
          versionNumber: item.versionNumber,
        }))
        .sort((left, right) =>
          left.regimeSlug.localeCompare(right.regimeSlug)
          || left.motionId.localeCompare(right.motionId)
        ),
    },
  };
}

function projectionSnapshot(regime: ProjectedRegime) {
  return {
    contractVersion: REGIME_PROJECTOR_CONTRACT_VERSION,
    regime,
  };
}

export function materialProjectionSignature(regime: ProjectedRegime) {
  return {
    contractVersion: REGIME_PROJECTOR_CONTRACT_VERSION,
    regimeSlug: regime.slug,
    state: regime.state,
    stateKind: regime.stateKind,
    confidence: regime.confidence,
    stories: regime.stories
      .map((story) => ({
        id: story.id,
        versionId: story.versionId,
        versionNumber: story.versionNumber,
        lifecycle: story.lifecycle,
        confidence: story.confidence,
        maturity: story.maturity,
        contributesToState: story.contributesToState,
        routes: story.routes
          .filter((route) => route.regime === regime.slug)
          .map((route) => ({
            subgroup: route.subgroup,
            role: route.role,
          }))
          .sort((left, right) => `${left.subgroup}:${left.role}`.localeCompare(`${right.subgroup}:${right.role}`)),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    subgroups: regime.subgroups
      .map((subgroup) => ({
        key: subgroup.key,
        state: subgroup.state,
        stateKind: subgroup.stateKind,
        durableStories: subgroup.durableStories
          .map((story) => ({ id: story.id, versionId: story.versionId }))
          .sort((left, right) => left.id.localeCompare(right.id)),
        contextStories: subgroup.contextStories
          .map((story) => ({ id: story.id, versionId: story.versionId, maturity: story.maturity }))
          .sort((left, right) => left.id.localeCompare(right.id)),
        telemetry: subgroup.telemetry
          .map((item) => ({
            key: item.key,
            state: item.state,
            source: item.source,
          }))
          .sort((left, right) => left.key.localeCompare(right.key)),
      }))
      .sort((left, right) => left.key.localeCompare(right.key)),
  };
}

function partitionStoriesByMarketDomain(stories: Story[]) {
  const admissible: Story[] = [];
  const quarantined: Array<{
    story: Story;
    reason: ReturnType<typeof evaluateExistingStoryMarketDomain>["reason"];
    marketSignals: string[];
    processSignals: string[];
  }> = [];

  for (const story of stories) {
    const result = evaluateExistingStoryMarketDomain({
      title: story.title,
      thesis: story.thesis,
      marketQuestion: story.market_question,
      dominantNarrative: story.dominant_narrative,
      bestExplanation: story.best_explanation,
      articleAngle: story.article_angle,
      assets: story.assets || [],
    });
    if (result.admissible) {
      admissible.push(story);
    } else {
      quarantined.push({
        story,
        reason: result.reason,
        marketSignals: result.marketSignals,
        processSignals: result.processSignals,
      });
    }
  }

  return { admissible, quarantined };
}

async function reconcileStoryDomainDebt(input: {
  client: SupabaseClient;
  projectionRunId: string;
  evaluatedStories: Story[];
  admissibleStories: Story[];
}) {
  const { data, error } = await input.client.rpc("sync_story_domain_debt_v1", {
    p_projection_run_id: input.projectionRunId,
    p_evaluated_story_ids: input.evaluatedStories.map((story) => story.id),
    p_admissible_story_ids: input.admissibleStories.map((story) => story.id),
  });
  if (error) throw new Error(`Story-domain debt sync failed: ${error.message}`);

  const domainDebt = ((data || []) as StoryDomainDebtSyncRow[])[0];
  if (!domainDebt) throw new Error("Story-domain debt sync returned no ownership result.");
  return domainDebt;
}

function storyRoutes(regimes: ProjectedRegime[]) {
  const seen = new Set<string>();
  const links: Array<{
    story_id: string;
    regime_slug: string;
    subgroup_key: string;
    role: RegimeRoute["role"];
    confidence: number;
  }> = [];

  for (const regime of regimes) {
    for (const story of regime.stories) {
      for (const route of story.routes.filter((item) => item.regime === regime.slug)) {
        const key = `${story.id}:${route.regime}:${route.subgroup}:${route.role}`;
        if (seen.has(key)) continue;
        seen.add(key);
        links.push({
          story_id: story.id,
          regime_slug: route.regime,
          subgroup_key: route.subgroup,
          role: route.role,
          confidence: Math.max(0, Math.min(100, route.score)),
        });
      }
    }
  }

  return links;
}

async function loadPersistedRoutedStoryIds(client: SupabaseClient, storyIds: string[]) {
  if (!storyIds.length) return [] as string[];
  const { data, error } = await client
    .from("market_regime_story_links")
    .select("story_id")
    .in("story_id", storyIds)
    .is("effective_to", null);
  if (error) throw new Error(`Regime persisted Story-link load failed: ${error.message}`);
  return [...new Set((data || []).map((item) => item.story_id as string))];
}

async function reconcileRegimeRoutingDebt(input: {
  client: SupabaseClient;
  projectionRunId: string;
  stories: Story[];
  routedStoryIds: string[];
}) {
  const { data, error } = await input.client.rpc("sync_regime_routing_debt_v1", {
    p_projection_run_id: input.projectionRunId,
    p_considered_story_ids: input.stories.map((story) => story.id),
    p_routed_story_ids: input.routedStoryIds,
  });
  if (error) throw new Error(`Regime routing-debt sync failed: ${error.message}`);

  const routingDebt = ((data || []) as RoutingDebtSyncRow[])[0];
  if (!routingDebt) throw new Error("Regime routing-debt sync returned no ownership result.");
  return routingDebt;
}

async function loadIdentities(client: SupabaseClient) {
  const [regimesResult, subgroupsResult] = await Promise.all([
    client.from("market_regimes").select("id,slug").eq("status", "active"),
    client.from("market_regime_subgroups").select("id,regime_id,subgroup_key").eq("status", "active"),
  ]);

  if (regimesResult.error) throw new Error(`Regime identity load failed: ${regimesResult.error.message}`);
  if (subgroupsResult.error) throw new Error(`Regime subgroup identity load failed: ${subgroupsResult.error.message}`);

  const regimes = (regimesResult.data || []) as RegimeIdentityRow[];
  const subgroups = (subgroupsResult.data || []) as RegimeSubgroupIdentityRow[];
  return {
    regimesBySlug: new Map(regimes.map((item) => [item.slug, item])),
    subgroupByKey: new Map(subgroups.map((item) => [`${item.regime_id}:${item.subgroup_key}`, item])),
  };
}

async function loadCurrentRegimeSnapshots(client: SupabaseClient) {
  const { data, error } = await client
    .from("market_regime_current")
    .select("regime_id,projection_run_id,snapshot")
    .eq("projection_mode", "shadow");

  if (error) {
    throw new Error(`Could not load current Regime snapshots for System 1 activation comparison: ${error.message}`);
  }
  return (data || []) as CurrentRegimeProjectionRow[];
}

function mergeSystem2ActivationTargets(targets: PendingSystem2Activation[]) {
  const merged = new Map<string, PendingSystem2Activation>();
  for (const target of targets) {
    const existing = merged.get(target.storyId);
    if (!existing) {
      merged.set(target.storyId, { ...target, changes: [...target.changes] });
      continue;
    }
    existing.priority = Math.max(existing.priority, target.priority);
    existing.changes = [...new Map([...existing.changes, ...target.changes].map((item) => [
      `${item.regimeSlug}:${item.subgroupKey}:${item.telemetryKey}:${item.source}`,
      item,
    ])).values()];
    existing.reason = [
      "system1_threshold_crossing",
      ...existing.changes.map((item) =>
        `${item.subgroupLabel} / ${item.telemetryLabel}: ${item.fromState} -> ${item.toState} [${item.source}]`),
    ].join(" | ");
  }
  return [...merged.values()]
    .sort((left, right) => right.priority - left.priority || left.storyId.localeCompare(right.storyId))
    .slice(0, 4);
}

async function enqueueSystem2ActivationTargets(
  client: SupabaseClient,
  targets: PendingSystem2Activation[],
) {
  const merged = mergeSystem2ActivationTargets(targets);
  if (!merged.length) return { enqueued: 0, skipped: 0, warning: null as string | null };

  const storyIds = merged.map((item) => item.storyId);
  const { data: existing, error: existingError } = await client
    .from("intelligence_reevaluation_queue")
    .select("target_id,reason")
    .eq("target_kind", "story")
    .in("target_id", storyIds)
    .in("status", ["pending", "processing", "retryable"]);

  if (existingError) {
    return {
      enqueued: 0,
      skipped: 0,
      warning: `System 2 activation queue lookup failed: ${existingError.message}`,
    };
  }

  // Evidence-triggered queue rows must not mask a genuine deterministic
  // System 1 threshold crossing. Only an already-open System 1 activation for
  // the same Story suppresses a duplicate activation row.
  const alreadyQueued = openSystem2ActivationStoryIds(existing || []);
  const rows = merged
    .filter((item) => !alreadyQueued.has(item.storyId))
    .map((item) => ({
      target_kind: "story",
      target_id: item.storyId,
      requested_by_evidence_id: null,
      reason: item.reason,
      priority: item.priority,
      status: "pending",
      available_at: new Date().toISOString(),
    }));

  if (!rows.length) {
    return { enqueued: 0, skipped: merged.length, warning: null as string | null };
  }

  const { error: insertError } = await client
    .from("intelligence_reevaluation_queue")
    .insert(rows);

  if (insertError) {
    return {
      enqueued: 0,
      skipped: alreadyQueued.size,
      warning: `System 2 activation queue insert failed: ${insertError.message}`,
    };
  }

  return {
    enqueued: rows.length,
    skipped: merged.length - rows.length,
    warning: null as string | null,
  };
}

async function beginProjectionRun(input: {
  client: SupabaseClient;
  runKey: string;
  trigger: RegimeProjectionTrigger;
  triggerRef: string | null;
  inputManifest: Record<string, unknown>;
  inputHash: string;
}) {
  const now = new Date().toISOString();
  const { data: inserted, error: insertError } = await input.client
    .from("market_regime_projection_runs")
    .upsert({
      run_key: input.runKey,
      projection_mode: "shadow",
      trigger_kind: input.trigger,
      trigger_ref: input.triggerRef,
      contract_version: REGIME_PROJECTOR_CONTRACT_VERSION,
      status: "started",
      input_manifest: input.inputManifest,
      input_hash: input.inputHash,
      warnings: [],
      error_detail: null,
      started_at: now,
      completed_at: null,
    }, { onConflict: "run_key", ignoreDuplicates: true })
    .select("id,run_key,status,input_hash,completed_at")
    .maybeSingle();

  if (insertError) throw new Error(`Could not start Regime projection: ${insertError.message}`);
  if (inserted) return { row: inserted as ProjectionRunRow, reused: false };

  const { data: prior, error: priorError } = await input.client
    .from("market_regime_projection_runs")
    .select("id,run_key,status,input_hash,completed_at")
    .eq("run_key", input.runKey)
    .maybeSingle();

  if (priorError || !prior) {
    throw new Error(`Could not recover idempotent Regime projection run: ${priorError?.message || "missing row"}`);
  }
  return { row: prior as ProjectionRunRow, reused: prior.status === "completed" };
}

async function completeProjectionRun(
  client: SupabaseClient,
  runId: string,
  versionIds: string[],
  warnings: string[],
) {
  const { error } = await client
    .from("market_regime_projection_runs")
    .update({
      status: "completed",
      version_ids: versionIds,
      warnings,
      error_detail: null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);
  if (error) throw new Error(`Could not complete Regime projection run: ${error.message}`);
}

async function failProjectionRun(client: SupabaseClient, runId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  await client
    .from("market_regime_projection_runs")
    .update({
      status: "failed",
      error_detail: message.slice(0, 2_000),
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

export async function persistRegimeShadowProjection(input: {
  trigger: RegimeProjectionTrigger;
  triggerRef?: string | null;
  client?: SupabaseClient;
}): Promise<RegimeShadowProjectionResult> {
  if (!projectionPersistenceEnabled()) {
    return {
      enabled: false,
      reused: false,
      runId: null,
      runKey: null,
      inputHash: null,
      projectedRegimes: 0,
      versionIds: [],
      warnings: ["Regime shadow persistence is disabled by REGIME_SHADOW_PERSISTENCE_ENABLED=false."],
    };
  }

  const client = input.client ?? createSupabaseAdminClient();
  const source = await loadProjectionInput(client);
  const storyDomain = partitionStoriesByMarketDomain(source.stories);
  const inputManifest = buildInputManifest(source);
  const inputHash = hash(inputManifest);
  const runKey = `regime-shadow:${inputHash.slice(0, 40)}`;
  const begun = await beginProjectionRun({
    client,
    runKey,
    trigger: input.trigger,
    triggerRef: input.triggerRef ?? null,
    inputManifest,
    inputHash,
  });

  if (begun.reused) {
    const domainDebt = await reconcileStoryDomainDebt({
      client,
      projectionRunId: begun.row.id,
      evaluatedStories: source.stories,
      admissibleStories: storyDomain.admissible,
    });
    const routedStoryIds = await loadPersistedRoutedStoryIds(
      client,
      storyDomain.admissible.map((story) => story.id),
    );
    const routingDebt = await reconcileRegimeRoutingDebt({
      client,
      projectionRunId: begun.row.id,
      stories: storyDomain.admissible,
      routedStoryIds,
    });
    const warnings: string[] = [];
    if (domainDebt.stale) {
      warnings.push("Reused Regime projection did not reconcile Story-domain debt because a newer shadow run owns governance state.");
    } else if (domainDebt.active_count > 0) {
      warnings.push(`${domainDebt.active_count} active Story domain quarantine item(s) remain outside the market routing universe; canonical Story history was preserved.`);
    }
    if (routingDebt.stale) {
      warnings.push("Reused Regime projection did not reconcile routing debt because a newer shadow run owns routing state.");
    } else if (routingDebt.active_count > 0) {
      warnings.push(`${routingDebt.active_count} active Story routing debt item(s) remain unassigned; no weak Regime mapping was forced.`);
    }

    const { data: priorVersions } = await client
      .from("market_regime_versions")
      .select("id")
      .eq("projection_run_id", begun.row.id);
    return {
      enabled: true,
      reused: true,
      runId: begun.row.id,
      runKey,
      inputHash,
      projectedRegimes: priorVersions?.length || 0,
      versionIds: (priorVersions || []).map((item) => item.id),
      warnings,
    };
  }

  try {
    const regimes = buildRegimeProjection({
      stories: storyDomain.admissible,
      versions: source.versions,
      events: source.events,
      newsThreads: source.newsThreads,
      statements: source.statements,
      dossier: source.dossier.presentation,
    });

    const identities = await loadIdentities(client);
    const priorCurrent = input.trigger === "dossier"
      ? await loadCurrentRegimeSnapshots(client)
      : [];
    const priorSnapshotByRegimeId = new Map(priorCurrent.map((item) => [item.regime_id, item.snapshot]));
    const pendingSystem2Activations: PendingSystem2Activation[] = [];

    const expectedSlugs = new Set(REGIME_DEFINITIONS.map((item) => item.slug));
    const missingRegimes = [...expectedSlugs].filter((slug) => !identities.regimesBySlug.has(slug));
    if (missingRegimes.length) {
      throw new Error(`Regime identity migration is incomplete: missing ${missingRegimes.join(", ")}.`);
    }

    const warnings: string[] = [];
    const domainDebt = await reconcileStoryDomainDebt({
      client,
      projectionRunId: begun.row.id,
      evaluatedStories: source.stories,
      admissibleStories: storyDomain.admissible,
    });
    if (domainDebt.stale) {
      warnings.push("Stale Regime shadow worker stopped before Story-domain quarantine persistence because a newer shadow run owns governance state.");
      await completeProjectionRun(client, begun.row.id, [], warnings);
      return {
        enabled: true,
        reused: false,
        runId: begun.row.id,
        runKey,
        inputHash,
        projectedRegimes: 0,
        versionIds: [],
        warnings,
      };
    }
    if (domainDebt.active_count > 0) {
      warnings.push(`${domainDebt.active_count} active Story domain quarantine item(s) remain outside the market routing universe; canonical Story history was preserved.`);
    }

    const links = storyRoutes(regimes);
    const { error: linkError } = await client.rpc("sync_market_regime_story_links_v1", {
      p_projection_run_id: begun.row.id,
      p_links: links,
    });
    if (linkError) throw new Error(`Regime Story-link sync failed: ${linkError.message}`);

    const routedStoryIds = [...new Set(links.map((link) => link.story_id))];
    const routingDebt = await reconcileRegimeRoutingDebt({
      client,
      projectionRunId: begun.row.id,
      stories: storyDomain.admissible,
      routedStoryIds,
    });

    if (routingDebt.stale) {
      warnings.push("Stale Regime shadow worker stopped before projection persistence because a newer shadow run owns routing state.");
      await completeProjectionRun(client, begun.row.id, [], warnings);
      return {
        enabled: true,
        reused: false,
        runId: begun.row.id,
        runKey,
        inputHash,
        projectedRegimes: 0,
        versionIds: [],
        warnings,
      };
    }

    if (routingDebt.active_count > 0) {
      warnings.push(`${routingDebt.active_count} active Story routing debt item(s) remain unassigned; no weak Regime mapping was forced.`);
    }

    const versionIds: string[] = [];

    for (const regime of regimes) {
      const identity = identities.regimesBySlug.get(regime.slug);
      if (!identity) continue;

      for (const subgroup of regime.subgroups) {
        if (!identities.subgroupByKey.has(`${identity.id}:${subgroup.key}`)) {
          warnings.push(`${regime.slug}: missing subgroup identity ${subgroup.key}; snapshot retained but taxonomy link is incomplete.`);
        }
      }

      const priorSnapshot = priorSnapshotByRegimeId.get(identity.id);
      if (input.trigger === "dossier" && priorSnapshot) {
        const telemetryChanges = detectSystem1TelemetryStateChanges(priorSnapshot, regime);
        const targets = selectSystem2ActivationTargets(regime, telemetryChanges);
        pendingSystem2Activations.push(...targets.map((target) => ({
          ...target,
          regimeId: identity.id,
        })));
      }

      const snapshot = projectionSnapshot(regime);
      const snapshotHash = hash(materialProjectionSignature(regime));
      const perRegimeManifest = {
        ...inputManifest,
        regimeSlug: regime.slug,
        storyVersionIds: regime.stories.map((story) => story.versionId).filter(Boolean).sort(),
        system1Contracts: regime.subgroups.flatMap((subgroup) =>
          subgroup.telemetry.map((item) => ({ key: item.key, source: item.source, asOf: item.asOf })),
        ),
        dossierMotionContextIds: (regime.dossierContext ?? [])
          .map((item) => item.id)
          .sort(),
      };

      const { data, error } = await client.rpc("persist_market_regime_projection_v1", {
        p_projection_run_id: begun.row.id,
        p_regime_slug: regime.slug,
        p_snapshot: snapshot,
        p_snapshot_hash: snapshotHash,
        p_input_manifest: perRegimeManifest,
        p_as_of: regime.asOf,
        p_state: regime.state,
        p_state_kind: regime.stateKind,
        p_confidence_label: regime.confidence,
        p_materiality_reason: "shadow_change",
      });

      if (error) throw new Error(`${regime.slug} projection persistence failed: ${error.message}`);
      const persisted = ((data || []) as PersistProjectionRpcRow[])[0];
      if (!persisted?.version_id) throw new Error(`${regime.slug} projection persistence returned no version pointer.`);
      versionIds.push(persisted.version_id);
    }

    if (input.trigger === "dossier" && pendingSystem2Activations.length) {
      const changedRegimeIds = [...new Set(pendingSystem2Activations.map((item) => item.regimeId))];
      const { data: currentRows, error: currentError } = await client
        .from("market_regime_current")
        .select("regime_id")
        .eq("projection_mode", "shadow")
        .eq("projection_run_id", begun.row.id)
        .in("regime_id", changedRegimeIds);

      if (currentError) {
        warnings.push(`System 2 activation was not queued because current Regime ownership could not be verified: ${currentError.message}`);
      } else {
        const currentRegimeIds = new Set((currentRows || []).map((item) => item.regime_id));
        const eligibleActivations = pendingSystem2Activations.filter((item) => currentRegimeIds.has(item.regimeId));
        const activation = await enqueueSystem2ActivationTargets(client, eligibleActivations);
        if (activation.warning) warnings.push(activation.warning);
        if (activation.enqueued) {
          warnings.push(`${activation.enqueued} durable Story reevaluation target(s) queued after a same-contract System 1 telemetry state transition; queue context is not canonical evidence.`);
        }
        if (activation.skipped) {
          warnings.push(`${activation.skipped} System 2 activation target(s) were already pending and were not duplicated.`);
        }
      }
    }

    await completeProjectionRun(client, begun.row.id, versionIds, warnings);
    return {
      enabled: true,
      reused: false,
      runId: begun.row.id,
      runKey,
      inputHash,
      projectedRegimes: versionIds.length,
      versionIds,
      warnings,
    };
  } catch (error) {
    await failProjectionRun(client, begun.row.id, error).catch(() => undefined);
    throw error;
  }
}

export async function persistRegimeShadowProjectionSafely(input: {
  trigger: RegimeProjectionTrigger;
  triggerRef?: string | null;
  client?: SupabaseClient;
}): Promise<RegimeShadowProjectionResult> {
  try {
    return await persistRegimeShadowProjection(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Regime shadow projection failure.";
    console.warn(JSON.stringify({
      event: "regime_shadow_projection_failed",
      trigger: input.trigger,
      triggerRef: input.triggerRef ?? null,
      error: message,
    }));
    return {
      enabled: projectionPersistenceEnabled(),
      reused: false,
      runId: null,
      runKey: null,
      inputHash: null,
      projectedRegimes: 0,
      versionIds: [],
      warnings: [message],
    };
  }
}

export async function getRegimeShadowHealth(
  client?: SupabaseClient,
): Promise<RegimeShadowHealth> {
  try {
    const db = client ?? createSupabaseAdminClient();
    const [runResult, currentResult, routingDebtResult, domainDebtResult] = await Promise.all([
      db
        .from("market_regime_projection_runs")
        .select("id,status,input_hash,contract_version,completed_at")
        .eq("projection_mode", "shadow")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("market_regime_current")
        .select("regime_id")
        .eq("projection_mode", "shadow"),
      db
        .from("research_debt")
        .select("story_id,severity,opened_at")
        .eq("status", "open")
        .like("debt_key", "regime-routing:%")
        .eq("metadata->>kind", "regime_routing_debt")
        .order("opened_at", { ascending: true }),
      db
        .from("research_debt")
        .select("story_id,severity,opened_at")
        .eq("status", "open")
        .like("debt_key", "story-domain:%")
        .eq("metadata->>kind", "story_domain_debt")
        .order("opened_at", { ascending: true }),
    ]);

    if (runResult.error || currentResult.error || routingDebtResult.error || domainDebtResult.error) {
      const message = runResult.error?.message
        || currentResult.error?.message
        || routingDebtResult.error?.message
        || domainDebtResult.error?.message
        || "Regime persistence unavailable.";
      return {
        available: false,
        latestRunId: null,
        latestRunStatus: null,
        latestCompletedAt: null,
        latestInputHash: null,
        currentProjectionCount: 0,
        expectedProjectionCount: REGIME_DEFINITIONS.length,
        contractVersion: null,
        lagMinutes: null,
        unassignedStoryCount: 0,
        highSeverityUnassignedStoryCount: 0,
        oldestUnassignedOpenedAt: null,
        oldestUnassignedAgeMinutes: null,
        quarantinedStoryCount: 0,
        highSeverityQuarantinedStoryCount: 0,
        oldestQuarantinedOpenedAt: null,
        oldestQuarantinedAgeMinutes: null,
        warning: message,
      };
    }

    const row = runResult.data;
    const completedAt = row?.completed_at || null;
    const lagMinutes = completedAt && Number.isFinite(Date.parse(completedAt))
      ? Math.max(0, Math.round((Date.now() - Date.parse(completedAt)) / 60_000))
      : null;
    const routingDebt = routingDebtResult.data || [];
    const oldestUnassignedOpenedAt = routingDebt[0]?.opened_at || null;
    const oldestUnassignedAgeMinutes = oldestUnassignedOpenedAt && Number.isFinite(Date.parse(oldestUnassignedOpenedAt))
      ? Math.max(0, Math.round((Date.now() - Date.parse(oldestUnassignedOpenedAt)) / 60_000))
      : null;
    const domainDebt = domainDebtResult.data || [];
    const oldestQuarantinedOpenedAt = domainDebt[0]?.opened_at || null;
    const oldestQuarantinedAgeMinutes = oldestQuarantinedOpenedAt && Number.isFinite(Date.parse(oldestQuarantinedOpenedAt))
      ? Math.max(0, Math.round((Date.now() - Date.parse(oldestQuarantinedOpenedAt)) / 60_000))
      : null;

    return {
      available: Boolean(row),
      latestRunId: row?.id || null,
      latestRunStatus: row?.status || null,
      latestCompletedAt: completedAt,
      latestInputHash: row?.input_hash || null,
      currentProjectionCount: currentResult.data?.length || 0,
      expectedProjectionCount: REGIME_DEFINITIONS.length,
      contractVersion: row?.contract_version || null,
      lagMinutes,
      unassignedStoryCount: routingDebt.length,
      highSeverityUnassignedStoryCount: routingDebt.filter((item) => item.severity === "high" || item.severity === "critical").length,
      oldestUnassignedOpenedAt,
      oldestUnassignedAgeMinutes,
      quarantinedStoryCount: domainDebt.length,
      highSeverityQuarantinedStoryCount: domainDebt.filter((item) => item.severity === "high" || item.severity === "critical").length,
      oldestQuarantinedOpenedAt,
      oldestQuarantinedAgeMinutes,
      warning: null,
    };
  } catch (error) {
    return {
      available: false,
      latestRunId: null,
      latestRunStatus: null,
      latestCompletedAt: null,
      latestInputHash: null,
      currentProjectionCount: 0,
      expectedProjectionCount: REGIME_DEFINITIONS.length,
      contractVersion: null,
      lagMinutes: null,
      unassignedStoryCount: 0,
      highSeverityUnassignedStoryCount: 0,
      oldestUnassignedOpenedAt: null,
      oldestUnassignedAgeMinutes: null,
      quarantinedStoryCount: 0,
      highSeverityQuarantinedStoryCount: 0,
      oldestQuarantinedOpenedAt: null,
      oldestQuarantinedAgeMinutes: null,
      warning: error instanceof Error ? error.message : "Regime shadow health unavailable.",
    };
  }
}
