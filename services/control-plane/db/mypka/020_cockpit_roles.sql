-- =============================================================================
-- MyPKA cockpit migration 020 — least-privilege login roles
--
--   cp_directus — the Directus RUNTIME connection (the cockpit). Requests only.
--   cp_worker   — the trusted executor that drains the command-request queue.
--
-- Structure only: roles are created LOGIN NOINHERIT NOSUPERUSER with NO password here
-- (a password in a committed migration would be a leaked secret). The password is set
-- OUT OF BAND by the runtime provisioner from the gitignored .runtime-live store, e.g.:
--   alter role cp_directus login password '<from .runtime-live/directus-live.env.json>';
--   alter role cp_worker   login password '<from .runtime-live/directus-live.env.json>';
-- Until a password is set the role cannot authenticate (fail-closed).
--
-- Idempotent. Reversible via teardown.sql.
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'cp_directus') then
    create role cp_directus login noinherit nosuperuser;
  else
    alter role cp_directus login noinherit nosuperuser;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'cp_worker') then
    create role cp_worker login noinherit nosuperuser;
  else
    alter role cp_worker login noinherit nosuperuser;
  end if;
end $$;

comment on role cp_directus is 'myPKA cockpit: Directus runtime connection. Request-only on the command queue; SELECT on cockpit read views. Password set out-of-band.';
comment on role cp_worker   is 'myPKA cockpit: trusted command-queue executor. Claims+receipts the queue and performs the effect; cannot fabricate a request. Password set out-of-band.';
