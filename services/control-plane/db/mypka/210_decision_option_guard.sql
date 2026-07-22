-- =============================================================================
-- MyPKA cockpit migration 210 — structural decision-option validation (BUILD-002 QA2-B finding D)
--
-- The renderCard worker validates option keys/labels, but the DB only required a non-empty array — so a
-- malformed card could be FILED and only fail later. This adds the structural guard at the source: every
-- decision_card option must have a key matching ^[A-Za-z0-9]{1,3}$, a non-empty label, unique keys, and
-- unique case-normalised labels. Enforced by a BEFORE INSERT/UPDATE trigger so an ill-formed card is
-- rejected at insert (23514), fail-closed. Idempotent; reversed by teardown (cockpit cascade).
-- =============================================================================
create or replace function cockpit.validate_decision_options(opts jsonb) returns void
language plpgsql as $$
declare o jsonb; k text; l text; keys text[] := '{}'; labels text[] := '{}';
begin
  if opts is null or jsonb_typeof(opts) <> 'array' or jsonb_array_length(opts) < 1 then
    raise exception 'decision options must be a non-empty JSON array' using errcode='23514';
  end if;
  for o in select value from jsonb_array_elements(opts) loop
    k := o->>'key'; l := o->>'label';
    if k is null or k !~ '^[A-Za-z0-9]{1,3}$' then raise exception 'decision option key "%" must be 1-3 alphanumerics', coalesce(k,'<null>') using errcode='23514'; end if;
    if l is null or btrim(l) = '' then raise exception 'decision option "%" needs a non-empty label', k using errcode='23514'; end if;
    if k = any(keys) then raise exception 'decision option key "%" is not unique', k using errcode='23514'; end if;
    if lower(btrim(l)) = any(labels) then raise exception 'decision option label "%" is not unique', l using errcode='23514'; end if;
    keys := keys || k; labels := labels || lower(btrim(l));
  end loop;
end $$;

create or replace function cockpit.decision_card_options_guard() returns trigger
language plpgsql as $$ begin perform cockpit.validate_decision_options(new.options); return new; end $$;
drop trigger if exists decision_card_options_guard_t on cockpit.decision_card;
create trigger decision_card_options_guard_t before insert or update on cockpit.decision_card
  for each row execute function cockpit.decision_card_options_guard();
