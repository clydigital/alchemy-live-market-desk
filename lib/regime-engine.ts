import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { NewsThread, PublicStatement, Story } from "./data.ts";
import { getDossierV2PresentationSelection } from "./dossier-v2/presentation-reader.ts";
import type { StoryEvent, StoryThesisVersion } from "./persistence/contracts.ts";
import {
  buildRegimeProjection,
  REGIME_DEFINITIONS,
  type ProjectedRegime,
  type RegimeRoute,
} from "./regimes.ts";
import { createSupabaseAdminClient } from "./supabase/admin.ts";

export const REGIME_PROJECTOR_CONTRACT_VERSION = "regime-projector/1" as const;

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
        stories: subgroup.stories
          .map((story) => ({ id: story.id, versionId: story.versionId }))
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
      warnings: [],
    };
  }

  try {
    const regimes = buildRegimeProjection({
      stories: source.stories,
      versions: source.versions,
      events: source.events,
      newsThreads: source.newsThreads,
      statements: source.statements,
      dossier: source.dossier.presentation,
    });

    const identities = await loadIdentities(client);
    const expectedSlugs = new Set(REGIME_DEFINITIONS.map((item) => item.slug));
    const missingRegimes = [...expectedSlugs].filter((slug) => !identities.regimesBySlug.has(slug));
    if (missingRegimes.length) {
      throw new Error(`Regime identity migration is incomplete: missing ${missingRegimes.join(", ")}.`);
    }

    const links = storyRoutes(regimes);
    const { error: linkError } = await client.rpc("sync_market_regime_story_links_v1", {
      p_projection_run_id: begun.row.id,
      p_links: links,
    });
    if (linkError) throw new Error(`Regime Story-link sync failed: ${linkError.message}`);

    const versionIds: string[] = [];
    const warnings: string[] = [];

    for (const regime of regimes) {
      const identity = identities.regimesBySlug.get(regime.slug);
      if (!identity) continue;

      for (const subgroup of regime.subgroups) {
        if (!identities.subgroupByKey.has(`${identity.id}:${subgroup.key}`)) {
          warnings.push(`${regime.slug}: missing subgroup identity ${subgroup.key}; snapshot retained but taxonomy link is incomplete.`);
        }
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
    const [runResult, currentResult] = await Promise.all([
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
    ]);

    if (runResult.error || currentResult.error) {
      const message = runResult.error?.message || currentResult.error?.message || "Regime persistence unavailable.";
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
        warning: message,
      };
    }

    const row = runResult.data;
    const completedAt = row?.completed_at || null;
    const lagMinutes = completedAt && Number.isFinite(Date.parse(completedAt))
      ? Math.max(0, Math.round((Date.now() - Date.parse(completedAt)) / 60_000))
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
      warning: error instanceof Error ? error.message : "Regime shadow health unavailable.",
    };
  }
}
