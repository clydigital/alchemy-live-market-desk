-- Bluebelly R2: INERT client-bound OAuth token audience hook.
-- 2026-11-06; apply with project administrator privileges.
--
-- This creates a private allowlist and SQL function but DOES NOT enable
-- Authentication > Hooks > Custom Access Token in the Supabase dashboard.
-- The table begins empty; all existing tokens remain unchanged.
-- No secrets or personally identifying OAuth client metadata are stored.
--
-- After registering a dedicated ChatGPT public OAuth client, inspect its
-- exact UUID and approved callback in Authentication > OAuth Apps. ONLY then
-- insert the UUID into bluebelly_oauth.approved_mcp_clients (enabled true),
-- test the entire real OAuth PKCE flow, and explicitly select this function
-- as the Custom Access Token Hook. Keep BLUEBELLY_MCP_ENABLED unset until
-- issuer / audience / scope / client_id and owner readback pass.
--
-- DANGER: Custom Access Token Hooks run for all token issuance. This function
-- returns the original event verbatim for all non-allowlisted clients and
-- routine dashboard login/refresh. Never use client-supplied "aud" as input.
--
-- The email scope is added only for the *dedicated* approved OAuth client;
-- the actual authorization UI at /oauth/consent separately requires the
-- 'email' scope. This is a scoped permission assertion, not proof that the
-- OAuth server honored the RFC8707 resource parameter. Verify production
-- resource binding independently before enabling the MCP endpoint.

create schema if not exists bluebelly_oauth;
revoke all on schema bluebelly_oauth from public, anon, authenticated;
grant usage on schema bluebelly_oauth to supabase_auth_admin;

create table if not exists bluebelly_oauth.approved_mcp_clients (
  client_id uuid primary key,
  resource_uri text not null default 'https://bluebelly-desk.vercel.app/api/mcp',
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  constraint approved_mcp_exact_resource
    check (resource_uri = 'https://bluebelly-desk.vercel.app/api/mcp')
);

revoke all on bluebelly_oauth.approved_mcp_clients
  from public, anon, authenticated;
alter table bluebelly_oauth.approved_mcp_clients enable row level security;
grant select on bluebelly_oauth.approved_mcp_clients to supabase_auth_admin;

do $policy$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname='bluebelly_oauth'
      and tablename='approved_mcp_clients'
      and policyname='auth admin can read enabled approved MCP clients'
  ) then
    create policy "auth admin can read enabled approved MCP clients"
      on bluebelly_oauth.approved_mcp_clients
      for select to supabase_auth_admin
      using (enabled = true);
  end if;
end
$policy$;

create or replace function bluebelly_oauth.mcp_client_token_hook(event jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $hook$
declare
  client_value text;
  client_uuid uuid;
  claims jsonb;
begin
  if event is null or pg_catalog.jsonb_typeof(event) <> 'object' then
    return event;
  end if;
  claims := event -> 'claims';
  if pg_catalog.jsonb_typeof(claims) <> 'object'
    or claims ->> 'role' is distinct from 'authenticated'
  then
    return event;
  end if;

  client_value := coalesce(
    nullif(event ->> 'client_id',''),
    nullif(claims ->> 'client_id','')
  );
  if client_value is null or client_value !~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    return event;
  end if;

  client_uuid := client_value::uuid;
  if not exists (
    select 1 from bluebelly_oauth.approved_mcp_clients
    where client_id = client_uuid and enabled = true
      and resource_uri = 'https://bluebelly-desk.vercel.app/api/mcp'
  ) then
    return event;
  end if;

  -- Preserve issuer, sub, exp, role, session and all other Supabase claims.
  -- Only the named client receives this fixed API audience and scope.
  return pg_catalog.jsonb_set(
    event, '{claims}',
    claims || pg_catalog.jsonb_build_object(
      'aud', 'https://bluebelly-desk.vercel.app/api/mcp',
      'scope', 'email',
      'client_id', client_uuid::text
    ),
    true
  );
end
$hook$;

revoke all on function bluebelly_oauth.mcp_client_token_hook(jsonb)
  from public, anon, authenticated;
grant execute on function bluebelly_oauth.mcp_client_token_hook(jsonb)
  to supabase_auth_admin;
