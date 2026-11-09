-- Required for the scheduled Power Stack quote refresh.
-- The runtime token is configured separately in Supabase Vault and Vercel env;
-- keep it out of version control and migrations.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;
