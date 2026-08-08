# GL-009 - Public/private knowledge boundary

> **This Guideline is the single source of truth for what may and may not enter the public repository.** No other file states this boundary; everywhere else `[[wikilink]]`s here. Its sibling [[GL-012-secrets-store-access-boundary]] governs a different axis — *access* to the off-repo secrets store — and neither file restates the other.

## Purpose

This repository may be public during the myPKA/Fusion247Brain merge and testing phase. Team Knowledge can describe architecture, process, and acceptance criteria publicly; Warwick's personal context should remain in the local/private PKM layer unless he explicitly approves a specific publication.

## The rule that governs how this rule is read

**The prohibited list is closed. The word "personal" is not a licence to extend it.**

An agent that meets content this file does not name must ask *"is this credential, account-access, payment, address or medical material?"* — not *"could this be described as personal?"* Almost anything in a personal knowledge base can be described as personal, so that second question always returns yes and it has been used to refuse correct work.

Warwick, 2026-08-04 (`BUILD-015-SHOPPING-DATA-CLASSIFICATION`): **"Do not silently widen 'private' to mean 'anything concerning a household.'"**

When the classification is genuinely unclear, the escalation is a one-line question to Larry naming the exact content — never a unilateral refusal, and never a new prohibition inferred from a category word.

## Public by default

- Team contracts and adapter shims.
- SOPs, Workstreams, Guidelines, templates, and architecture tasks.
- Abstract session-log records that describe decisions without embedding personal evidence. **Narrow exception: a capability or workstream Warwick has classified as having no permitted public-repository trace — see "No-public-trace classifications" below. For those, and only those, sanitising the body of a record does not make the record publishable.**
- Public-facing examples that do not reveal Warwick's journal content, current state, or private evidence.
- **Ordinary household operations content** — see the explicit list below.

## Household operations content: EXPLICITLY PERMITTED in the public repository

Ruling `BUILD-015-SHOPPING-DATA-CLASSIFICATION`, Warwick, 2026-08-04. Warwick's own words: **"I explicitly accept that ordinary household shopping content may be public."**

The following MAY be committed, and no agent may withhold them on privacy grounds:

- Product names, brands, pack sizes and quantities.
- Shopping-list wording exactly as written, and aliases for it.
- Household shopping preferences of every kind.
- Regulars and Favourites classification.
- Rotation rules, offer and multibuy rules, exclusions, mappings, and the directive values that encode them.
- Worked examples naming real items — including milk, sanitary products, toiletries, medicines available as ordinary retail products, and coffee preferences.
- **Deterministic seed and corrective migrations containing those rules.** Warwick: *"Commit the exact reproducible SQL rather than leaving the live database ahead of Git."*
- Tests and fixtures built from that content.

This list is permissive on purpose and is as binding as the prohibited list below.

## MUST NOT be committed, in any repository state

- Credentials, passwords, tokens, API keys.
- Payment information.
- Account-session material — cookies, session tokens, saved logins.
- Delivery addresses, unless Warwick explicitly authorises that exact publication.
- Any secret that enables account access, fraud or impersonation.
- Medical records and diagnostic information **unrelated to ordinary shopping instructions**. "Buy the usual paracetamol" is a shopping instruction and is permitted; a diagnosis, prescription record or clinical note is not.

## No-public-trace classifications

**Two kinds of sentence appear below and the difference is load-bearing.** The blockquote marked **VERIFIED RULING** is Warwick's own decision, corroborated on 2026-08-08 against a conversation record of **2026-07-28** that is independent of any Git artefact. Everything after it is the team's engineering expression of that ruling and carries no more authority than any other operating text in this file. **Do not cite the engineering half as a Warwick ruling.**

> **VERIFIED RULING (Warwick, 2026-07-28).** Where Warwick has classified a capability or workstream as having **no permitted public-repository trace**, sanitising body text does not make a public artefact acceptable if the artefact itself — including its filename, frontmatter, metadata, branch/issue/build identity or equivalent surface — still exposes or represents that private capability.

On the occasion that produced it, the classification covered **sanitised machinery, build records, specialist references, and public branch, issue and metadata traces** — not merely secret values — and the capability itself belonged in approved private Supabase/runtime state.

**Scope, stated so it cannot drift.** This section binds **only where Warwick has actually classified a capability or workstream that way.** It is **not** a general rule about `private_surface` work, and it does not disturb the public-by-default list above: abstract records that describe decisions without embedding personal evidence remain **permitted**. It is also not a licence to infer any further prohibition — the reading rule at the top of this file still governs everything this file does not name.

### Engineering expression — what a worker does about a classification

*The team's implementation of the ruling above. Not Warwick's words.*

1. **The whole artefact is the test, not its body text.** Filename, path, frontmatter, `agent_id`, `linked_*` fields and wikilinks are part of the disclosure. A generic marker written into a new `session-logs/…_<specialist-slug>_….md` still discloses the specialist, the date, and — by joining the slug to the public agent index — the capability.
2. **Prefer adding one line to a public record that already exists** over creating any new public file. A new file must be named, and the name is itself a disclosure decision.
3. **Where public governance needs evidence that the work occurred, a generic marker is sufficient.** Serviceable wording:

   > Private application work completed under private build governance. Evidence retained in the authorised private surface.

4. **The full record lives in the approved private surface or runtime**, under that capability's own contracts, and is not thinned there.
5. **A classification is per-capability and per-fact, never per-project-by-association.** A capability whose existence is already named publicly for a legitimate reason does not thereby make its routes, data, paths, artefacts or implementation publishable.
6. **Where a classification is known to exist, a worker applies it rather than re-litigating it** — that decision is Warwick's and is already made. **Where the worker cannot establish whether one exists, that is the one-line question to Larry** the reading rule prescribes: not a unilateral refusal, and not an assumption in either direction. Withholding pending the answer is always available.

## Private/local by default

These remain private because they are Warwick's lived context, not because they concern a household:

- Journal entries.
- "About Warwick" and current-context views.
- Detailed personal aims, day-state, health or neurodivergence-related context, and lived experience.
- Personal evidence used to tune source valuation, agent routing, or retrieval.

**Note the deliberate removal.** This list previously read "aims, day-state, **preferences**, health…". That single word was read as covering ordinary shopping preferences, and on 2026-08-04 it caused correct, authorised work — committing a one-row corrective migration — to be refused on invented privacy grounds. Preferences about what the household buys are governed by the permitted list above. Preferences about how Warwick lives and works remain private under this list.

## Operating rule

When a public architecture change depends on personal context, record the mechanism publicly and keep the personal evidence local. Link abstractly where needed. Do not commit the personal evidence to a public branch unless Warwick explicitly approves that exact publication in the current session.

**Corollary, and it is why the ruling exists:** a database whose corrective migrations may not be committed can never be rebuilt from git, and every "reconstruct the migration for provenance" instruction becomes unsatisfiable by design. Under this classification that gap is closable for household operations content, and closing it is the expectation rather than an option.

## Git rule

`.gitignore` excludes the main local/private context surfaces while the repository remains public. `.gitignore` does not protect content that has already been committed, so personal material must be kept out of public commit history before pushing.

**A `.gitignore` entry is not itself a classification.** An ignore rule written under an earlier, broader reading of this file does not survive it: re-check the entry against the lists above before treating exclusion as a requirement. Removing an ignore rule is a Larry decision, not an agent's — report the finding, name the file, do not edit `.gitignore` to enact your own reading.

## Version history

- **2026-08-08** — added "No-public-trace classifications", plus the matching narrow exception on the public-by-default session-log bullet. **Authority: Warwick's ruling of 2026-07-28**, corroborated by Warwick on 2026-08-08 from a conversation record independent of Git. **RECONCILED, not restored.** A recovered draft of this material (commit `95c265d`, 2026-07-31) reached neither canon nor `main`; it placed the rule inside [[GL-012-secrets-store-access-boundary]], which the 2026-08-04 sole-source rule below does not permit, it carried an **unsupported attribution to a 2026-07-29 ruling**, and it mixed engineering generalisation into the ruling's voice. The verified ruling is quoted; the generalisation is removed or narrowed and labelled as the team's own. Recorded by Nolan.
- **2026-08-04** — added the household-operations classification (permitted and prohibited lists), the closed-prohibition reading rule, and the `.gitignore` corollary. Removed "preferences" from the private-by-default list. Authority: Warwick, ruling `BUILD-015-SHOPPING-DATA-CLASSIFICATION`, recorded by Silas. Cause: an agent inferred a prohibition from the word "household" and refused an authorised migration. *(Larry, same day: removed a duplicated `## Git rule` section left by the edit — the superseded copy, not the amended one.)*
