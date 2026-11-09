-- Distinguish an exchange observation from an upstream provider batch timestamp.
-- iSaham explicitly says last_updated_timestamp is a refresh batch start, NOT last trade.
alter table public.power_stack_quote_observations
  add column if not exists timestamp_basis text not null default 'source_observation';
alter table public.power_stack_quote_observations
  add column if not exists source_recorded_at timestamptz;
alter table public.power_stack_quote_observations
  add constraint power_stack_quote_timestamp_basis_valid
  check (timestamp_basis in ('source_observation','upstream_batch'));
