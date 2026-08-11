import { getAlchemyArticles } from "@/lib/alchemy";
import { getEconomicCalendar } from "@/lib/calendar";
import { getCotSnapshots } from "@/lib/cot";
import { getMarketData } from "@/lib/market";
import { retrieveTranscriptApiVideo } from "@/lib/transcriptapi";
import {
  EXISTING_PROVIDER_KEYS,
  FunctionProviderAdapter,
  ProviderRegistry,
  ProviderUnavailableError,
  type AcquisitionFailureSink,
  type ProviderRequest,
} from "./providers.ts";

function requiredString(request: ProviderRequest, key: string) {
  const value = request.params[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new ProviderUnavailableError("request", request.capability, "missing_parameter", `${key} is required.`);
  }
  return value.trim();
}

async function marketSeriesFor(sourcePattern: RegExp, providerKey: string) {
  const market = await getMarketData();
  const records = market.series.filter((series) => sourcePattern.test(series.sourceName) && series.points.length > 0);
  if (!records.length) {
    throw new ProviderUnavailableError(providerKey, "market_history", "provider_data_unavailable", `${providerKey} returned no usable market history.`, true);
  }
  return records;
}

export function createExistingProviderRegistry(failureSink?: AcquisitionFailureSink) {
  return new ProviderRegistry(failureSink)
    .register(new FunctionProviderAdapter(EXISTING_PROVIDER_KEYS.nasdaq, ["market_history"], async () => (
      marketSeriesFor(/nasdaq/i, EXISTING_PROVIDER_KEYS.nasdaq)
    )))
    .register(new FunctionProviderAdapter(EXISTING_PROVIDER_KEYS.eia, ["energy_spot", "market_history"], async () => {
      const market = await getMarketData();
      const series = market.series.filter((item) => /energy information administration/i.test(item.sourceName) && item.points.length > 0);
      if (!series.length) throw new ProviderUnavailableError(EXISTING_PROVIDER_KEYS.eia, "energy_spot", "provider_data_unavailable", "EIA returned no usable spot history.", true);
      return [...series, ...market.cracks];
    }))
    .register(new FunctionProviderAdapter(EXISTING_PROVIDER_KEYS.ecb, ["rates", "market_history"], async () => (
      marketSeriesFor(/european central bank/i, EXISTING_PROVIDER_KEYS.ecb)
    )))
    .register(new FunctionProviderAdapter(EXISTING_PROVIDER_KEYS.treasury, ["rates", "market_history"], async () => (
      marketSeriesFor(/treasury/i, EXISTING_PROVIDER_KEYS.treasury)
    )))
    .register(new FunctionProviderAdapter(EXISTING_PROVIDER_KEYS.bls, ["macro_release"], async () => {
      const records = await getEconomicCalendar();
      const bls = records.filter((item) => /bureau of labor statistics|\bbls\b/i.test(`${item.sourceName || ""} ${item.sourceUrl || ""}`));
      if (!bls.length) throw new ProviderUnavailableError(EXISTING_PROVIDER_KEYS.bls, "macro_release", "provider_data_unavailable", "BLS calendar returned no usable records.", true);
      return bls;
    }))
    .register(new FunctionProviderAdapter(EXISTING_PROVIDER_KEYS.cftc, ["positioning"], async () => {
      const records = await getCotSnapshots();
      if (!records.length) throw new ProviderUnavailableError(EXISTING_PROVIDER_KEYS.cftc, "positioning", "provider_data_unavailable", "CFTC positioning returned no usable records.", true);
      return records;
    }))
    .register(new FunctionProviderAdapter(EXISTING_PROVIDER_KEYS.alchemy, ["news"], async (request) => {
      const limit = Math.max(1, Math.min(50, Number(request.params.limit) || 18));
      const records = await getAlchemyArticles(limit);
      if (!records.length) throw new ProviderUnavailableError(EXISTING_PROVIDER_KEYS.alchemy, "news", "provider_data_unavailable", "Alchemy article memory returned no usable records.", true);
      return records;
    }))
    .register(new FunctionProviderAdapter(EXISTING_PROVIDER_KEYS.transcriptApi, ["transcript"], async (request) => {
      const apiKey = process.env.TRANSCRIPT_API_KEY;
      if (!apiKey) throw new ProviderUnavailableError(EXISTING_PROVIDER_KEYS.transcriptApi, "transcript", "missing_secret", "TRANSCRIPT_API_KEY is not configured.");
      const videoReference = requiredString(request, "videoReference");
      return [await retrieveTranscriptApiVideo(videoReference, apiKey)];
    }))
    .register(new FunctionProviderAdapter(EXISTING_PROVIDER_KEYS.youtube, ["video"], async () => {
      if (!process.env.YOUTUBE_DATA_API_KEY) throw new ProviderUnavailableError(EXISTING_PROVIDER_KEYS.youtube, "video", "missing_secret", "YOUTUBE_DATA_API_KEY is not configured.");
      throw new ProviderUnavailableError(EXISTING_PROVIDER_KEYS.youtube, "video", "requires_channel_intake", "YouTube acquisition must run through the configured channel intake registry.");
    }));
}
