-- BUILD-006 Phase 4 — verification that can BLOCK, as rows rather than as a return value.
--
-- ADDITIVE AND ISOLATED, exactly as 001, 002 and 003 are. This migration adds five tables, one
-- view and one function to the EXISTING `vlogops` namespace and writes nothing outside it. It
-- creates no schema of its own, issues NO GRANTS, and touches row-level security nowhere. Every
-- object is schema-qualified; there is no search_path dependency in this file.
--
-- IT ALTERS NO TABLE OF PHASES 1-3. Not a column, not a constraint, not a trigger. Everything it
-- needs from them it reaches by foreign key.
--
-- FORWARD-ONLY and IDEMPOTENT. Applying it twice against a fresh cluster succeeds and leaves
-- identical structure. `teardown.sql` already reverses it — it drops the `vlogops` namespace with
-- CASCADE, and every object below is created inside that namespace and nowhere else. Nothing in
-- teardown.sql needed to change.
--
-- Numbering continues 003 in this directory and is derived from nothing else.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- WHY THIS SCHEMA LOOKS LIKE THIS — read before the DDL, because the shape IS the feature
--
-- The map says verification "must be able to BLOCK". A verifier that returns a boolean cannot
-- block anything: it can only inform a caller who is free to not ask, or to ask and ignore the
-- answer. That is advisory dressed as enforcement, and this build has a standing rule against it
-- — 002 made provenance-completeness a property of the schema, 003 made traceability one, and
-- this makes BLOCKING one.
--
-- So the verdict is not the mechanism. THESE ROWS ARE THE MECHANISM:
--
--     verification_run       one immutable verdict over one package, content-addressed
--     verification_finding   one immutable row per objection, with the rule that raised it
--     finding_disposition    the recorded human answer to one finding — attributed, reasoned
--     package_advance        THE GATE. Writing here is what "advancing" a package MEANS, and a
--                            before-insert trigger refuses while any finding is undisposed.
--
-- Four properties follow from that shape, and each one is the answer to a way gates usually die:
--
--   1. A BLOCK SURVIVES A RESTART because it is a row, not a variable. Nothing is held in a
--      process, so there is nothing for a restart to lose.
--
--   2. A BLOCK CANNOT BE CLEARED BY RE-RUNNING THE VERIFIER. The gate looks at every run of the
--      package, not the most recent one, so a second run under a weaker ruleset adds a row and
--      clears nothing. "Retry until something validates is how a system quietly selects for
--      output that satisfies the checker rather than the evidence" — src/scribe/store.mjs said
--      that about model drafts; it is equally true of verdicts. The correct way to clear a
--      blocking finding is to FIX THE DRAFT, which produces a different package_id because a
--      package is content-addressed and immutable.
--
--   3. AN OVERRIDE IS POSSIBLE AND CANNOT BE SILENT. Warwick owns the product and may overrule
--      any objection. He may not do it invisibly: a disposition names the finding, the person and
--      the reason, it is append-only, and there is no wildcard, no package-level override and no
--      configuration flag that switches verification off.
--
--   4. AN UNANSWERED QUESTION STOPS THE PACKAGE TOO. Some objections are not rule violations but
--      judgements that belong to Warwick — §11 of the map makes publishing private or
--      rights-encumbered material his gate. Those are recorded as severity `surface` and they
--      block advancement exactly as a failure does, because a question nobody is forced to answer
--      is not a gate. Two labels, one mechanism: overriding a FAILURE and answering a QUESTION
--      are different human acts and read differently in the record.
--
-- ⛔ THE LIMIT OF ALL OF THIS, STATED HERE RATHER THAN DISCOVERED LATER ⛔
--
-- This gate is structural for the operation PHASE 4 DEFINES. Phases 5-7 do not exist yet, and
-- nothing here can force a future stage to advance a package by writing to package_advance rather
-- than by reading story_package directly and pressing on. THIS MUST NEVER BE DESCRIBED AS
-- UNBYPASSABLE. What it guarantees is narrower and still worth having: the advance operation this
-- phase defines cannot be performed on a package carrying an undisposed finding, by any client,
-- including a future one that has forgotten why the rule exists.
-- ═════════════════════════════════════════════════════════════════════════════════════════


-- ---------------------------------------------------------------------------
-- source_rights — the rights basis for one captured source.
--
-- Phases 1-3 record no rights at all, so before this table the honest answer for every source was
-- "unknown". A dimension that answers "unknown" about everything is not a control, it is a wall:
-- it would score identically if it refused every package ever built.
--
-- Two things stop that here. First, a basis can be DERIVED where the provenance genuinely settles
-- it — a source_system of `git`, `repository` or `fusion247` is Warwick's own estate. Second, and
-- more important, `basis_source` records WHICH of those two happened. A derived basis and a
-- declared one are different facts and a reader can always tell them apart; a default that
-- presented itself as a declaration would be a lie in the one field a rights question depends on.
--
-- `warwick-supplied` is deliberately NOT derivable. Pasted text is the class that can actually
-- carry somebody else's words — a transcript, an article, a quotation — and presuming it is his
-- is the single most expensive inference available in this table. It stays unanswered until a
-- human says otherwise, and the verifier surfaces it.
create table if not exists vlogops.source_rights (
  seed_id      char(64) not null,
  source_ref   text     not null,

  basis        text     not null
               check (basis in (
                 'estate-owned',            -- Warwick's own material
                 'licensed',                -- a licence is held and named
                 'permission-granted',      -- the holder said yes, and who/when is recorded
                 'public-domain',
                 'quotation-fair-dealing',  -- a bounded quotation relied on as such
                 'third-party-unlicensed'   -- known to belong to someone else, no permission
               )),

  -- DECLARED by a human, or DERIVED by rule from the frozen provenance. Never blurred.
  basis_source text     not null
               check (basis_source in ('declared', 'derived-from-provenance')),

  holder       text,
  licence_ref  text,
  note         text,

  -- Who says so. Attribution, not authentication: there is no identity system in this service and
  -- `credential_scope: none` means there is not going to be one here. What this buys is that the
  -- claim is undeniable after the fact, not that it was authorised at the time.
  declared_by  text     not null
               check (length(btrim(declared_by)) > 0),
  declared_at  timestamptz not null default now(),

  primary key (seed_id, source_ref),

  -- The rights row must attach to a snapshot Phase 1 actually froze. A basis recorded against a
  -- source that does not exist is a rights claim about nothing.
  constraint source_rights_snapshot_fk
    foreign key (seed_id, source_ref) references vlogops.source_snapshot (seed_id, source_ref),

  -- A licensed or permitted basis without a holder is not a basis, it is a hope. Derived bases
  -- are exempt because nothing derived can name a holder honestly.
  constraint source_rights_licensed_names_holder
    check (basis not in ('licensed', 'permission-granted')
           or (holder is not null and length(btrim(holder)) > 0)),

  -- Only the three estate-origin systems can produce a derived basis, and only ever this one.
  constraint source_rights_derived_is_estate_owned
    check (basis_source <> 'derived-from-provenance' or basis = 'estate-owned')
);

create index if not exists source_rights_basis_idx
  on vlogops.source_rights (basis);


-- ---------------------------------------------------------------------------
-- verification_run — one verdict over one package.
--
-- verification_id is the sha256 of a canonical manifest, on exactly the pattern 001 established
-- for seed_id, 002 for pack_id and 003 for package_id: a pure function of content, with the
-- hashed bytes stored beside the hash so any reader can recompute it from the row rather than
-- trusting the verifier. The package, the ruleset version and every finding participate. No
-- clock, no row id, no pid and no insertion order contributes to it.
--
-- Which means: verifying the same package twice under the same ruleset lands on the same row and
-- writes nothing. A verdict is not an event, it is a fact about a package under a ruleset.
create table if not exists vlogops.verification_run (
  verification_id  char(64) primary key
                   check (verification_id ~ '^[0-9a-f]{64}$'),
  package_id       char(64) not null,

  -- Bump these when a rule changes. A package checked under a different ruleset has honestly been
  -- asked a different question, and the version participates in identity so both answers survive.
  verifier_version text not null,
  ruleset_version  text not null,
  manifest_algo    text not null default 'sha256-canonical-json-v1',

  manifest         jsonb not null,

  -- Per-dimension verdict AND per-dimension COVERAGE. Coverage is not decoration: a dimension
  -- that reports `pass` while having examined nothing is the exact defect this build keeps
  -- meeting, and a reader must be able to see what ground was actually looked at.
  dimensions       jsonb not null,

  verdict          text not null check (verdict in ('pass', 'blocked')),

  finding_count    integer not null check (finding_count >= 0),
  blocking_count   integer not null check (blocking_count >= 0),
  surfaced_count   integer not null check (surfaced_count >= 0),
  created_at       timestamptz not null default now(),

  constraint verification_run_package_fk
    foreign key (package_id) references vlogops.story_package (package_id),

  -- The headline verdict cannot disagree with the rows beneath it. `pass` means no findings; any
  -- finding at all, of either severity, means blocked. Same discipline as 002's `bounded` flag,
  -- which cannot be set without the disclosure that justifies it.
  constraint verification_run_verdict_matches_findings
    check ((verdict = 'pass') = (finding_count = 0)),

  constraint verification_run_counts_add_up
    check (blocking_count + surfaced_count = finding_count),

  -- Referenced by package_advance, which is what stops an advance naming a verification of some
  -- other package entirely.
  constraint verification_run_package_run_unique unique (package_id, verification_id)
);

create index if not exists verification_run_package_idx
  on vlogops.verification_run (package_id, created_at desc);


-- ---------------------------------------------------------------------------
-- verification_finding — one objection.
--
-- `rule` is the NAMED rule that raised it, matching the rule contract in
-- src/verify/contract/verification-v1.md. A finding that says only "privacy" tells Warwick which
-- department objected; a finding that says PRIV-3 tells him what was actually checked, and lets
-- him disagree with the rule rather than with the machine.
--
-- The locator columns are nullable because objections attach to different things: a claim, a
-- sibling segment, a cited source, or the package as a whole.
create table if not exists vlogops.verification_finding (
  verification_id char(64) not null,
  ordinal         integer  not null check (ordinal >= 0),

  dimension       text     not null
                  check (dimension in ('fact', 'quotation', 'privacy', 'rights', 'cross-format')),

  -- `block` — a rule was broken. `surface` — a question was raised that only Warwick can answer.
  -- Both stop the package. The label says which human act is needed to clear it.
  severity        text     not null check (severity in ('block', 'surface')),

  rule            text     not null check (length(btrim(rule)) > 0),
  detail          text     not null check (length(btrim(detail)) > 0),

  claim_id        text,
  sibling         text,
  segment_ordinal integer,
  source_ref      text,

  evidence        jsonb    not null,

  primary key (verification_id, ordinal),

  constraint verification_finding_run_fk
    foreign key (verification_id) references vlogops.verification_run (verification_id),

  -- Referenced by finding_disposition. Carrying severity in the key is what makes it impossible
  -- to file an OVERRIDE against a question, or an ANSWER against a rule violation — see below.
  constraint verification_finding_severity_unique unique (verification_id, ordinal, severity)
);

create index if not exists verification_finding_dimension_idx
  on vlogops.verification_finding (verification_id, dimension);


-- ---------------------------------------------------------------------------
-- finding_disposition — the recorded human answer to ONE finding.
--
-- THE WHOLE OF THE OVERRIDE RULE IS HERE, AND IT IS SHAPED SO THAT SILENCE IS IMPOSSIBLE:
--
--   * a disposition names EXACTLY ONE finding. There is no package-level override, no
--     dimension-level override, no wildcard and no configuration flag. Clearing six findings
--     takes six recorded decisions.
--   * `decided_by` and `reason` are NOT NULL and non-empty. An override with no reason is not
--     storable, so "it was overridden and nobody knows why" is not a state this store can reach.
--   * the table is append-only. A decision cannot be edited or deleted afterwards; a change of
--     mind is a new package, not a rewritten record.
--
-- The two dispositions are matched to the two severities BY FOREIGN KEY rather than by a trigger:
-- `overridden` can only reference a finding whose severity is `block`, and `answered` only one
-- whose severity is `surface`. Overruling a failure and answering a question are different acts
-- and the record must not let them be confused.
create table if not exists vlogops.finding_disposition (
  verification_id char(64) not null,
  ordinal         integer  not null,

  severity        text     not null check (severity in ('block', 'surface')),
  disposition     text     not null check (disposition in ('overridden', 'answered')),

  decided_by      text     not null check (length(btrim(decided_by)) > 0),
  reason          text     not null check (length(btrim(reason)) > 0),
  decided_at      timestamptz not null default now(),

  primary key (verification_id, ordinal),

  -- The finding exists, and its severity is the one being claimed here.
  constraint finding_disposition_finding_fk
    foreign key (verification_id, ordinal, severity)
      references vlogops.verification_finding (verification_id, ordinal, severity),

  constraint finding_disposition_matches_severity
    check ((disposition = 'overridden') = (severity = 'block'))
);


-- ---------------------------------------------------------------------------
-- The run header cannot misreport its own body.
--
-- Same rule 003 applies to story_package's claim_count, and checked the same way: at COMMIT,
-- because the run row and its findings are written in one transaction and the rows necessarily
-- arrive in an order where an immediate check would fire on a perfectly correct write.
--
-- This is what stops the cheapest possible defeat of the whole mechanism — writing a `pass`
-- header over a body full of findings.
create or replace function vlogops.require_verification_counts() returns trigger
language plpgsql as $require_vcounts$
declare
  actual_total    integer;
  actual_blocking integer;
  actual_surfaced integer;
begin
  select count(*),
         count(*) filter (where severity = 'block'),
         count(*) filter (where severity = 'surface')
    into actual_total, actual_blocking, actual_surfaced
    from vlogops.verification_finding
   where verification_id = new.verification_id;

  if actual_total <> new.finding_count
     or actual_blocking <> new.blocking_count
     or actual_surfaced <> new.surfaced_count then
    raise exception
      'vlogops: verification_run % declares %/%/% (total/blocking/surfaced) and holds %/%/%',
      new.verification_id, new.finding_count, new.blocking_count, new.surfaced_count,
      actual_total, actual_blocking, actual_surfaced
      using errcode = 'integrity_constraint_violation';
  end if;

  return null;
end;
$require_vcounts$;

drop trigger if exists verification_run_counts_are_true on vlogops.verification_run;
create constraint trigger verification_run_counts_are_true
  after insert on vlogops.verification_run
  deferrable initially deferred
  for each row execute function vlogops.require_verification_counts();


-- ---------------------------------------------------------------------------
-- package_advance — THE GATE.
--
-- Writing a row here is what "advancing a package" MEANS in this build. It is the operation
-- Phase 4 defines and the one a later stage must go through, and the trigger below refuses it
-- while any finding of any run of that package is undisposed.
--
-- One row per package: a package is advanced once. The composite foreign key ties the advance to
-- a verification OF THAT PACKAGE, so an advance cannot cite somebody else's clean verdict.
create table if not exists vlogops.package_advance (
  package_id      char(64) primary key,
  verification_id char(64) not null,

  -- Attribution, on the same terms as source_rights.declared_by: undeniable afterwards, never a
  -- claim that anybody was authorised at the time.
  advanced_by     text not null check (length(btrim(advanced_by)) > 0),
  advanced_at     timestamptz not null default now(),

  constraint package_advance_run_fk
    foreign key (package_id, verification_id)
      references vlogops.verification_run (package_id, verification_id)
);


-- ---------------------------------------------------------------------------
-- The gate itself.
--
-- A foreign key can say "this must exist". It cannot say "nothing like this may exist", which is
-- what a block is. So this is a function, called from a BEFORE INSERT trigger — immediate rather
-- than deferred, because unlike 003's at-least-one rules this one is answerable the moment the
-- row is offered.
--
-- IT LOOKS AT EVERY RUN OF THE PACKAGE, NOT THE ONE BEING CITED. That single word — every — is
-- what makes a block durable rather than a snapshot of the most recent opinion. Re-running the
-- verifier adds a row; it clears nothing.
create or replace function vlogops.assert_package_advanceable(p_package_id char(64))
returns void
language plpgsql as $advanceable$
declare
  blocked_n  integer;
  surfaced_n integer;
  first_rule text;
begin
  select count(*) filter (where f.severity = 'block'),
         count(*) filter (where f.severity = 'surface'),
         min(f.dimension || '/' || f.rule)
    into blocked_n, surfaced_n, first_rule
    from vlogops.verification_run r
    join vlogops.verification_finding f on f.verification_id = r.verification_id
    left join vlogops.finding_disposition d
      on d.verification_id = f.verification_id and d.ordinal = f.ordinal
   where r.package_id = p_package_id
     and d.verification_id is null;

  if coalesce(blocked_n, 0) > 0 or coalesce(surfaced_n, 0) > 0 then
    raise exception
      'vlogops: package % is BLOCKED and cannot advance — % undisposed blocking finding(s) and % undisposed surfaced question(s), first: %. A blocking finding is cleared by a recorded override, a surfaced question by a recorded answer, or by fixing the draft (which produces a different package). Re-running verification clears nothing.',
      p_package_id, coalesce(blocked_n, 0), coalesce(surfaced_n, 0), coalesce(first_rule, '(none)')
      using errcode = 'integrity_constraint_violation';
  end if;
end;
$advanceable$;


create or replace function vlogops.package_advance_gate() returns trigger
language plpgsql as $gate$
begin
  perform vlogops.assert_package_advanceable(new.package_id);
  return new;
end;
$gate$;

drop trigger if exists package_advance_requires_clean_verification on vlogops.package_advance;
create trigger package_advance_requires_clean_verification
  before insert on vlogops.package_advance
  for each row execute function vlogops.package_advance_gate();


-- ---------------------------------------------------------------------------
-- A readable answer to "where does this package stand", for an operator with psql and no code.
--
-- The RUNBOOK points at this. It exists because the alternative is an operator reconstructing the
-- gate's logic by hand at the moment they are least able to check their working.
create or replace view vlogops.package_verification_state as
select p.package_id,
       p.pack_id,
       p.seed_id,
       (select count(*) from vlogops.verification_run r where r.package_id = p.package_id)
         as verification_runs,
       coalesce(u.undisposed_blocks, 0)   as undisposed_blocks,
       coalesce(u.undisposed_surfaced, 0) as undisposed_surfaced,
       (a.package_id is not null)         as advanced,
       a.advanced_by,
       a.advanced_at,
       (coalesce(u.undisposed_blocks, 0) = 0 and coalesce(u.undisposed_surfaced, 0) = 0)
         as advanceable
  from vlogops.story_package p
  left join vlogops.package_advance a on a.package_id = p.package_id
  left join lateral (
    select count(*) filter (where f.severity = 'block')   as undisposed_blocks,
           count(*) filter (where f.severity = 'surface') as undisposed_surfaced
      from vlogops.verification_run r
      join vlogops.verification_finding f on f.verification_id = r.verification_id
      left join vlogops.finding_disposition d
        on d.verification_id = f.verification_id and d.ordinal = f.ordinal
     where r.package_id = p.package_id
       and d.verification_id is null
  ) u on true;


-- ---------------------------------------------------------------------------
-- Immutability, enforced by the database rather than by convention.
--
-- Reusing 001's vlogops.deny_mutation() rather than writing a fourth one. Called with no
-- arguments it refuses every UPDATE and every DELETE.
--
-- Every table here is append-only, and for this phase that is not a stylistic choice inherited
-- from its neighbours — it is the property that makes the whole gate mean anything. A verdict
-- that could be edited is not a verdict; an override record that could be deleted is exactly the
-- silent override AC6 forbids; and an advance that could be rolled back by hand would let a
-- blocked package become an advanced one without any decision being recorded anywhere.
drop trigger if exists source_rights_immutable on vlogops.source_rights;
create trigger source_rights_immutable
  before update or delete on vlogops.source_rights
  for each row execute function vlogops.deny_mutation();

drop trigger if exists verification_run_immutable on vlogops.verification_run;
create trigger verification_run_immutable
  before update or delete on vlogops.verification_run
  for each row execute function vlogops.deny_mutation();

drop trigger if exists verification_finding_immutable on vlogops.verification_finding;
create trigger verification_finding_immutable
  before update or delete on vlogops.verification_finding
  for each row execute function vlogops.deny_mutation();

drop trigger if exists finding_disposition_immutable on vlogops.finding_disposition;
create trigger finding_disposition_immutable
  before update or delete on vlogops.finding_disposition
  for each row execute function vlogops.deny_mutation();

drop trigger if exists package_advance_immutable on vlogops.package_advance;
create trigger package_advance_immutable
  before update or delete on vlogops.package_advance
  for each row execute function vlogops.deny_mutation();
