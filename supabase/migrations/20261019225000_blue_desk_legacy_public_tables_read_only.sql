-- Blue Desk security partition: preserve legacy public reads while removing
-- unnecessary database write privileges from visitor / signed-in roles.
-- These legacy tables feed Hybrid presentation and must NOT be hidden until a
-- verified replacement read contract exists. All three tables already enforce
-- RLS and have SELECT-only public policies. Service-role writes remain intact.
BEGIN;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.evidence,
           public.research_source_registry,
           public.research_schedule_slots
  FROM anon, authenticated;

-- Do not change SELECT grants, RLS policies, row contents or writer privileges.
-- The previous broad grants also allowed schema-level write privileges, despite
-- the absence of corresponding permissive write RLS policies.
COMMIT;
