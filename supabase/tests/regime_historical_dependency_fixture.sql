-- The production database already has this helper from the full intelligence history.
-- The representative DB-contract fixture does not apply that entire history, so
-- recreate only this historical dependency before the Regime migration.

create or replace function public.intelligence_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
