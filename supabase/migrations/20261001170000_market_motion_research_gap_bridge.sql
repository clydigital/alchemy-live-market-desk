begin;

alter table public.research_gap_cases
  drop constraint if exists research_gap_cases_source_kind_check;

alter table public.research_gap_cases
  add constraint research_gap_cases_source_kind_check
  check (source_kind in ('research_gap', 'research_now', 'investigation', 'market_motion'));

alter table public.research_gap_case_occurrences
  drop constraint if exists research_gap_case_occurrences_source_kind_check;

alter table public.research_gap_case_occurrences
  add constraint research_gap_case_occurrences_source_kind_check
  check (source_kind in ('research_gap', 'research_now', 'investigation', 'market_motion'));

comment on constraint research_gap_cases_source_kind_check on public.research_gap_cases is
  'Operational Research Gap sources may originate from Dossier work or a traceable promoted Market Motion item.';

comment on constraint research_gap_case_occurrences_source_kind_check on public.research_gap_case_occurrences is
  'Each immutable Research Gap occurrence preserves whether the funded branch originated from Dossier work or Market Motion.';

commit;
