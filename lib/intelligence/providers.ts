export type ProviderCapability =
  | "macro_release"
  | "market_history"
  | "energy_spot"
  | "rates"
  | "positioning"
  | "news"
  | "video"
  | "transcript"
  | "company_primary";

export type ProviderRequest = {
  capability: ProviderCapability;
  requestKey: string;
  params: Record<string, unknown>;
};

export type ProviderResponse<T = unknown> = {
  providerKey: string;
  capability: ProviderCapability;
  requestKey: string;
  observedAt: string;
  records: T[];
  metadata: Record<string, unknown>;
};

export type AcquisitionFailure = {
  providerKey: string;
  capability: ProviderCapability;
  requestKey: string;
  code: string;
  detail: string;
  retryable: boolean;
  metadata: Record<string, unknown>;
};

export type AcquisitionFailureSink = {
  record(failure: AcquisitionFailure): Promise<void>;
};

export interface ProviderAdapter<T = unknown> {
  readonly key: string;
  readonly capabilities: readonly ProviderCapability[];
  acquire(request: ProviderRequest): Promise<ProviderResponse<T>>;
}

export class ProviderUnavailableError extends Error {
  readonly providerKey: string;
  readonly capability: ProviderCapability;
  readonly code: string;
  readonly retryable: boolean;

  constructor(
    providerKey: string,
    capability: ProviderCapability,
    code: string,
    message: string,
    retryable = false,
  ) {
    super(message);
    this.name = "ProviderUnavailableError";
    this.providerKey = providerKey;
    this.capability = capability;
    this.code = code;
    this.retryable = retryable;
  }
}

export class FunctionProviderAdapter<T = unknown> implements ProviderAdapter<T> {
  readonly key: string;
  readonly capabilities: readonly ProviderCapability[];
  private readonly handler: (request: ProviderRequest) => Promise<T[]>;

  constructor(
    key: string,
    capabilities: readonly ProviderCapability[],
    handler: (request: ProviderRequest) => Promise<T[]>,
  ) {
    this.key = key;
    this.capabilities = capabilities;
    this.handler = handler;
  }

  async acquire(request: ProviderRequest): Promise<ProviderResponse<T>> {
    if (!this.capabilities.includes(request.capability)) {
      throw new ProviderUnavailableError(this.key, request.capability, "unsupported_capability", `${this.key} does not provide ${request.capability}.`);
    }
    const records = await this.handler(request);
    if (!Array.isArray(records)) {
      throw new ProviderUnavailableError(this.key, request.capability, "invalid_provider_response", `${this.key} returned a non-array record set.`);
    }
    return {
      providerKey: this.key,
      capability: request.capability,
      requestKey: request.requestKey,
      observedAt: new Date().toISOString(),
      records,
      metadata: {},
    };
  }
}

export class ProviderRegistry {
  private readonly adapters = new Map<string, ProviderAdapter>();
  private readonly failureSink?: AcquisitionFailureSink;

  constructor(failureSink?: AcquisitionFailureSink) {
    this.failureSink = failureSink;
  }

  register(adapter: ProviderAdapter) {
    this.adapters.set(adapter.key, adapter);
    return this;
  }

  providersFor(capability: ProviderCapability) {
    return [...this.adapters.values()].filter((adapter) => adapter.capabilities.includes(capability));
  }

  async acquire<T = unknown>(providerKey: string, request: ProviderRequest): Promise<ProviderResponse<T>> {
    const adapter = this.adapters.get(providerKey);
    if (!adapter) {
      const failure: AcquisitionFailure = {
        providerKey,
        capability: request.capability,
        requestKey: request.requestKey,
        code: "provider_not_registered",
        detail: `No adapter is registered for ${providerKey}.`,
        retryable: false,
        metadata: { params: request.params },
      };
      await this.failureSink?.record(failure);
      throw new ProviderUnavailableError(providerKey, request.capability, failure.code, failure.detail);
    }

    try {
      return await adapter.acquire(request) as ProviderResponse<T>;
    } catch (error) {
      const known = error instanceof ProviderUnavailableError ? error : null;
      const failure: AcquisitionFailure = {
        providerKey,
        capability: request.capability,
        requestKey: request.requestKey,
        code: known?.code || "provider_request_failed",
        detail: error instanceof Error ? error.message : String(error),
        retryable: known?.retryable ?? true,
        metadata: { params: request.params },
      };
      await this.failureSink?.record(failure);
      throw known || new ProviderUnavailableError(providerKey, request.capability, failure.code, failure.detail, failure.retryable);
    }
  }
}

export const EXISTING_PROVIDER_KEYS = {
  nasdaq: "nasdaq_public_market_data",
  eia: "eia_energy_spot",
  ecb: "ecb_data_api",
  treasury: "us_treasury_xml",
  bls: "bls_calendar",
  cftc: "cftc_positioning",
  alchemy: "alchemy_article_memory",
  youtube: "youtube_data_api",
  transcriptApi: "transcriptapi",
} as const;
