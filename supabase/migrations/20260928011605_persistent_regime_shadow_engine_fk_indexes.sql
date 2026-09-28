-- Cover fresh foreign-key paths used by the persistent Regime shadow engine.

create index market_regime_versions_supersedes_idx
  on public.market_regime_versions(supersedes_version_id)
  where supersedes_version_id is not null;

create index market_regime_current_version_idx
  on public.market_regime_current(version_id);

create index market_regime_story_links_projection_run_idx
  on public.market_regime_story_links(last_projection_run_id)
  where last_projection_run_id is not null;
