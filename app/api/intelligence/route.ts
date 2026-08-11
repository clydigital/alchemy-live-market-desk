import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getDeskData } from "@/lib/data";
import { getHybridPublicationRecords, selectHybridPublicationStoryStates } from "@/lib/hybrid-publication";
import { OpenAIReasoningProvider, ReasoningConfigurationError } from "@/lib/intelligence/openai-reasoning";
import { createExistingProviderRegistry } from "@/lib/intelligence/existing-provider-adapters";
import { runIntelligencePipeline, type IntelligencePipelineInput } from "@/lib/intelligence/pipeline";
import { IntelligenceRepository } from "@/lib/intelligence/repository";
import { runOneTargetedReevaluation } from "@/lib/intelligence/targeted-reevaluation";

export const dynamic = "force-dynamic";

const CAPABILITIES = [
  { name: "searchEvidence", description: "Search canonical Evidence Objects without exposing raw provider payloads." },
  { name: "getEvidenceRoom", description: "Read a persisted Evidence Room and its provenance-linked evidence." },
  { name: "getEntityGraph", description: "Read a canonical entity and its incoming/outgoing relationships." },
  { name: "searchEntities", description: "Search canonical entities without coupling clients to Supabase tables." },
  { name: "getMarketBeliefs", description: "Read persistent market beliefs and priced assumptions." },
  { name: "getDivergences", description: "Read material belief-versus-evidence divergences." },
  { name: "getHypotheses", description: "Read testable hypotheses and independent Challenger assessments." },
  { name: "getStory", description: "Read one Story with persistent intelligence state, evidence links and semantic relations." },
  { name: "getLiveStories", description: "Read the qualified persistent published Story set; never more than 15." },
  { name: "getFeaturedStories", description: "Read up to six published Stories, ordered by newest material evidence then qualification." },
  { name: "getStoryHistory", description: "Read immutable lifecycle and novelty history for a Story." },
  { name: "getStoryCandidates", description: "Read synthesized candidates before or after promotion to a public Story." },
  { name: "promoteStoryCandidate", description: "Create an original canonical Story or update its deduplicated existing Story, then persist the Evidence Room and history." },
  { name: "getProviderFailures", description: "Read unresolved acquisition failures and unavailable-provider state." },
  { name: "acquireProviderData", description: "Acquire records through a named interchangeable provider adapter; failures are persisted visibly." },
  { name: "runIntelligencePipeline", description: "Run the independent evidence-to-Story reasoning stages and persist their outputs." },
  { name: "runTargetedReevaluation", description: "Claim one evidence-triggered Story queue item and re-evaluate only that Story's lifecycle." },
] as const;

function configuredToken() {
  return process.env.ALCHEMY_INTELLIGENCE_TOKEN || process.env.RESEARCH_UPDATE_TOKEN || "";
}

function authorized(request: NextRequest) {
  const expected = configuredToken();
  if (!expected) return false;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return bearer === expected || request.headers.get("x-alchemy-token") === expected;
}

async function compatibilityStories(featured: boolean) {
  const [desk, records] = await Promise.all([getDeskData(), getHybridPublicationRecords()]);
  const selection = selectHybridPublicationStoryStates({ stories: desk.stories, records });
  const stories = featured ? selection.featuredStoryStates : selection.storyStates;
  return stories.map((story) => ({
    ...story,
    intelligenceState: null,
    compatibilityMode: true,
  }));
}

export async function GET() {
  return NextResponse.json({
    name: "alchemy-market-intelligence",
    facadeVersion: 1,
    transport: "Alchemy tool-call JSON over HTTP; MCP-style capability names remain stable.",
    endpoint: "/api/intelligence",
    authentication: "Bearer or x-alchemy-token",
    capabilities: CAPABILITIES,
  });
}

export async function POST(request: NextRequest) {
  if (!configuredToken()) {
    return NextResponse.json({ error: "intelligence_facade_not_configured", detail: "ALCHEMY_INTELLIGENCE_TOKEN or RESEARCH_UPDATE_TOKEN is required." }, { status: 503 });
  }
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { tool?: string; arguments?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const tool = body.tool || "";
  const args = body.arguments || {};

  try {
    const repository = new IntelligenceRepository();
    let result: unknown;
    switch (tool) {
      case "searchEvidence":
        result = await repository.searchEvidence(args);
        break;
      case "getEvidenceRoom":
        result = await repository.getEvidenceRoom(args);
        break;
      case "getEntityGraph":
        result = await repository.getEntityGraph(args);
        break;
      case "searchEntities":
        result = await repository.searchEntities(args);
        break;
      case "getMarketBeliefs":
        result = await repository.getMarketBeliefs(args);
        break;
      case "getDivergences":
        result = await repository.getDivergences(args);
        break;
      case "getHypotheses":
        result = await repository.getHypotheses(args);
        break;
      case "getStory":
        result = await repository.getStory(args);
        break;
      case "getLiveStories": {
        const canonical = await repository.getLiveStories();
        result = canonical.length ? canonical : await compatibilityStories(false);
        break;
      }
      case "getFeaturedStories": {
        const canonical = await repository.getFeaturedStories();
        result = canonical.length ? canonical : await compatibilityStories(true);
        break;
      }
      case "getStoryHistory":
        result = await repository.getStoryHistory(args);
        break;
      case "getStoryCandidates":
        result = await repository.getStoryCandidates(args);
        break;
      case "promoteStoryCandidate":
        result = await repository.promoteStoryCandidate(args);
        break;
      case "getProviderFailures":
        result = await repository.getProviderFailures(args);
        break;
      case "acquireProviderData": {
        const providerKey = typeof args.providerKey === "string" ? args.providerKey : "";
        const capability = typeof args.capability === "string" ? args.capability : "";
        const requestKey = typeof args.requestKey === "string" ? args.requestKey : `${providerKey}:${Date.now()}`;
        if (!providerKey || !capability) return NextResponse.json({ error: "invalid_arguments", detail: "providerKey and capability are required." }, { status: 400 });
        result = await createExistingProviderRegistry(repository).acquire(providerKey, {
          capability: capability as never,
          requestKey,
          params: args.params && typeof args.params === "object" ? args.params as Record<string, unknown> : {},
        });
        break;
      }
      case "runIntelligencePipeline": {
        const input = args.input as IntelligencePipelineInput | undefined;
        if (!input?.providerKey || !input.source || !input.record) {
          return NextResponse.json({ error: "invalid_arguments", detail: "input.providerKey, input.source and input.record are required." }, { status: 400 });
        }
        const runId = await repository.beginEngineRun("api", { providerKey: input.providerKey });
        try {
          const existingStories = await repository.existingStoryCandidates();
          const pipeline = await runIntelligencePipeline({ ...input, existingStories }, new OpenAIReasoningProvider());
          const persisted = await repository.persistPipelineResult(runId, pipeline);
          const promotions = [];
          for (const candidateId of persisted.promotableCandidateIds) {
            promotions.push(await repository.promoteStoryCandidate({ candidateId }));
          }
          await repository.finishEngineRun(runId, {
            status: "completed",
            storiesConsidered: pipeline.storyCandidates.length,
            storiesPublished: promotions.length,
            warnings: pipeline.storyCandidates.length && !promotions.length
              ? ["Candidate decisions were persisted, but none cleared novelty and publication qualification."]
              : [],
          });
          if (promotions.length) {
            revalidatePath("/");
            revalidatePath("/stories");
            revalidatePath("/api/hybrid-feed");
            revalidatePath("/api/hybrid-feed-v2");
          }
          result = {
            runId,
            persisted,
            materialDivergence: pipeline.divergence.material,
            hypotheses: pipeline.hypotheses.length,
            scenarios: pipeline.scenarios.length,
            storyCandidates: pipeline.storyCandidates,
            promotions,
          };
        } catch (error) {
          await repository.finishEngineRun(runId, {
            status: error instanceof ReasoningConfigurationError ? "blocked" : "failed",
            failureDetail: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
        break;
      }
      case "runTargetedReevaluation": {
        result = await runOneTargetedReevaluation(typeof args.queueId === "string" ? args.queueId : undefined, repository);
        break;
      }
      default:
        return NextResponse.json({ error: "unknown_tool", available: CAPABILITIES.map((item) => item.name) }, { status: 404 });
    }
    return NextResponse.json({ tool, result });
  } catch (error) {
    const blocked = error instanceof ReasoningConfigurationError;
    return NextResponse.json({
      error: blocked ? "reasoning_provider_not_configured" : "intelligence_tool_failed",
      detail: error instanceof Error ? error.message : String(error),
    }, { status: blocked ? 503 : 500 });
  }
}
