-- =============================================================================
-- MyPKA cockpit migration 261 — let the Cockpit surface FILE governed intents (IDEA-016)
--
-- cp_directus is the "read + insert-intent" role, but it only ever had SELECT on the command queues,
-- so the Cockpit's Accept button could never actually file its action. Complete the intended grant:
-- the surface may INSERT an intent; only cp_worker claims/completes it (status/receipt columns), so the
-- governed intent → worker → receipt seam is preserved.
-- =============================================================================
grant insert on cockpit.learning_command to cp_directus;
grant insert on cockpit.brain_command   to cp_directus;
