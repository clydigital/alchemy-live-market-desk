type RegimeFlagEnvironment = Record<string, string | undefined>;

function enabled(value: string | undefined) {
  return value !== "false";
}

export function regimeUiEnabled(env: RegimeFlagEnvironment = process.env) {
  return enabled(env.REGIME_UI_ENABLED);
}

export function regimeAutomaticRoutingEnabled(env: RegimeFlagEnvironment = process.env) {
  return enabled(env.REGIME_AUTO_ROUTING_ENABLED);
}

export function regimeShadowPersistenceEnabled(env: RegimeFlagEnvironment = process.env) {
  return enabled(env.REGIME_SHADOW_PERSISTENCE_ENABLED);
}

export function hybridRegimeDeepLinksEnabled(env: RegimeFlagEnvironment = process.env) {
  return enabled(env.HYBRID_REGIME_DEEP_LINKS_ENABLED);
}

export function regimeFeatureFlags(env: RegimeFlagEnvironment = process.env) {
  return {
    ui: regimeUiEnabled(env),
    automaticRouting: regimeAutomaticRoutingEnabled(env),
    shadowPersistence: regimeShadowPersistenceEnabled(env),
    hybridDeepLinks: hybridRegimeDeepLinksEnabled(env),
  };
}
