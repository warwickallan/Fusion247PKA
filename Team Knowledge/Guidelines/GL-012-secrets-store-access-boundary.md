# GL-012 - Secrets-store access boundary

- **Status:** Active (Warwick's ruling, 2026-07-29). Supersedes both earlier formulations — see §8.
- **Applies to:** **every** agent, specialist, subagent or ephemeral worker dispatched in this estate, whether or not it reads a role contract. There is no role this does not bind and no dispatch it does not travel with.
- **Owner:** Larry, as the party who issues Work Orders and commissions workers.
- **Related:** [[GL-009-public-private-knowledge-boundary]] governs what may enter the public repo. This Guideline governs **access to the off-repo secrets store**. Different question, different file.

## 1. The rule

**`C:\.fusion247\**` is DENIED BY DEFAULT.**

A worker may access `C:/.fusion247/private/<project>/**` **only** when that exact project subtree is explicitly declared in the Work Order's `file_surface`.

**"Access" means read AND write.** A read-only escape from the declared subtree is precisely the leak this boundary exists to close, so the two are never separated. Wherever this Guideline says access, it means both.

**The permission is exact and implies nothing else.** Being granted one project subtree does **not** grant:

- the root of `C:\.fusion247`
- any sibling project folder under `C:/.fusion247/private/`
- any parent directory of the declared subtree
- any file or surface the Work Order did not declare

There is no "while I am in there anyway". The door opens onto the declared subtree and onto nothing adjacent to it.

## 2. Credential material is forbidden everywhere

**Including inside an allowed private project subtree.** The declared surface is a permission to work on a project; it is never a permission to touch that project's secrets.

Forbidden material, enumerated:

- `.env` files — any of `.env`, `.env.*`, `*.env`, or a file whose evident purpose is to carry environment secrets regardless of extension
- API keys
- access tokens and refresh tokens
- passwords
- private keys
- certificates containing a private key
- connection strings containing credentials
- credential stores, keychain entries, and exported sessions (including `~/.codex/*` auth files)

Never read, request, echo, copy, log, quote or write any of it. `credential_scope: none` is the standing authority for every worker and is unchanged by this Guideline; a `file_surface` under `C:/.fusion247/private/<project>/**` does not widen it and never has.

## 3. No worker decides whether a file "looks sensitive"

**This is the specific weakness this ruling closes, and it is the clause most likely to be softened by someone trying to be helpful.**

Protection must not depend on a worker's judgement at the moment it is being asked to be permissive. A rule that reads "do not read anything sensitive" has a judgement step in it, and a judgement step is a place where a plausible-sounding argument wins. The controls below are written so that following them requires no opinion about the content:

| Control | What makes it mechanical |
|---|---|
| **Exact declared `file_surface`** | The set of permitted paths is enumerated in the order. Membership is a comparison, not an assessment. |
| **Path normalisation before every comparison** | Resolve `.` and `..`, resolve symlinks and junctions, normalise slash direction, case and any short-name form **first**, then compare. A path is permitted only if its normalised form is a descendant of a declared subtree. |
| **No traversal outside the allowed subtree** | Any path that normalises outside the declared subtree is denied, no matter how it was constructed or what it appears to contain. Denial happens before the file is opened, so its contents never inform the decision. |
| **Credential-shaped filename deny-list** | The filename patterns in §2 are refused on sight, inside a declared surface as much as outside it. |
| **Scanner coverage of the declared private surface** | §5. Content-class material that no filename reveals is the scanner's job, not the worker's judgement. |
| **Refusal when the surface cannot be scanned** | §5. The boundary either establishes itself mechanically or the work does not hand back. |

When these controls cannot be applied to a surface, the answer is **refusal** — not a caveat, not a note in the return, not proceeding carefully.

## 4. Declaring a surface — the order author's obligation

Name the specific project directory. `C:/.fusion247/private/<project>/**` is a correct surface.

**Not valid grants, and a worker refuses them at read-back:**

- `C:/.fusion247/**`
- `C:/.fusion247/private/**`
- any surface at or above a project directory
- any surface that resolves to the secrets-bearing root

The root genuinely holds a large number of `.env` files and assorted secret material. A surface declared at or near it points a worker straight at them, and defence-in-depth means never resting the outcome on one rule holding. The worker is the last line here, not the only one.

**How this Guideline reaches a worker that has no contract: the `private_surface` envelope field.** [[Templates/work-order]] carries `private_surface` as a **mandatory** field on every Work Order, **including the overwhelming majority where it is `none`**, and its comment names this file. That is deliberate and it is the mechanism, not decoration.

This Guideline binds every worker in the estate — but a rule only reaches the workers who are told about it. A contract-bound specialist finds it through its own contract. **An ephemeral worker commissioned in a single message inherits nothing it is not handed**, and trusting each brief to remember is the weak version of this control. Because the field is mandatory, every order copied from the template names the boundary, so no dispatch falls quietly outside it. A `none` value is not ceremony: it is the boundary being stated and found not to apply, by an author who had to consider it.

Omitting the field is under-specification like any other missing mandatory field — the worker returns `REFUSE` at read-back, naming it. The worker **reads** the field and never infers it, and where `private_surface` and `file_surface` disagree, that is a contradiction to name rather than resolve.

## 5. Scanner coverage, and the preflight/handback asymmetry

Run the surface-scoped scan and report **coverage as well as exit code**:

```
bash scripts/secret-scan.sh --surface <declared paths>
```

Three exits, and "non-zero means failure" is wrong here: `0` = scanned and clean; `1` = secret FOUND, blocking, never hand back over it; **`2` = NOT SCANNED — the question was never asked.**

**The asymmetry below is deliberate. It was ruled, not drifted into. Do not "harmonise" it.**

- **At preflight, a declared private surface that enumerates to zero files is the honest case and must NOT be refused.** A greenfield project directory has nothing in it yet, and exit `2` there says only that the work has not happened. Refusing it would fire the gate on the one case that is definitionally innocent — and **a gate that fires on the honest case gets reclassified as noise, which is how gates die.**

  Refuse at preflight only for reasons that will **still hold at handback**: the declared subtree's parent is unreadable, the path is a symlink, the scanner cannot traverse it, or the declaration is a root-level or `private/**`-level surface rather than a project subtree (§4).

- **At handback, exit `2` over a declared private surface is BLOCKING.** Not reportable, not weighable by Larry, never `COMPLETED`. Files were written; if the surface now enumerates to zero or cannot be traversed, something is wrong and the boundary was never established. Return `FAILED` or `REFUSED` and say which control could not run.

- **On a public `services/**` surface, exit `2` remains a reportable limitation** for Larry to weigh, exactly as before. The difference in treatment is the difference in stake: an unscanned public surface risks a defect, an unscanned private surface risks a secret.

**A control that reports on ground it did not examine is worse than no control.** An absent control invites caution; a lying one invites confidence. State what the scan covered next to whatever it returned, always.

### 5a. The content-class clause depends on scanner work not yet landed

Read this limitation exactly as far as it goes, because the contract must not claim coverage nothing delivers.

The forbidden list in §2 is half **filename-shaped** (`.env` files, key files, certificates) and half **content-shaped** ("connection strings containing credentials", credential stores, exported sessions). Filename-shaped material is caught mechanically by the deny-list. **Content-shaped material sitting in an ordinarily-named file that a worker legitimately has to open is catchable only by the scanner** — anything else collapses back into "does this look sensitive?", which §3 forbids.

So for the content class the scanner is **not** defence-in-depth. It is the sole mechanical control.

**Dependency, stated openly:** this clause assumes `scripts/secret-scan.sh` performs content-class detection over an arbitrary declared private surface. That work was commissioned separately and is **not confirmed landed as of 2026-07-29.** Until it is, treat content-class credential material inside a declared private surface as a **known uncovered class**, and say so in any return that cites a clean scan as assurance. Do not let a green exit stand in for a control that does not yet exist.

## 6. The return channel is unscanned ground

**Every control in this estate inspects what was *written*.** The secret scan reads the surface; `git diff --stat` reads the diff; Larry reads the diff. **The leak vector this Guideline governs is *reading*, and a prohibited read leaves no artefact in any of them.** Worse, material read into a worker's context can be echoed into the **return message to Larry**, which no scanner examines at all.

The rule, therefore:

- **A return never quotes file content from a private surface.** Paths, counts, exit codes, and what was proven — never the contents. Where evidence seems to require a quotation, it does not; describe it instead.
- **An undeclared path appearing in a worker's return is an incident, not a tidy-up.** Larry treats it as evidence the boundary was crossed and investigates rather than correcting it in passing.

**This narrows the gap. It does not close it.** Read-prohibition cannot be enforced by post-hoc inspection of artefacts, because a read produces no artefact. The mitigation above is a discipline on the one channel we can see; the structural gap survives it and every reader of this Guideline should know that it survives.

## 7. What "mechanical" means here — and what it does not

**"Mechanical" in this Guideline means there is no judgement step *in the rule*. It does not mean the rule is enforced by the runtime.**

There is no filesystem sandbox behind any of this. A dispatched subagent receives ordinary tool access — `Read`, `Write`, `Edit`, `Bash`, `Glob`, `Grep` — and **the host does not confine a subagent to its `file_surface`.** The genuinely enforcing controls in this estate are the secret-scan script and Larry's review of the diff. Everything else is a rule an instance chooses to honour.

This is stated for the same reason [[Templates/work-order]] states it about `network: none` — that field "documents intent; it is **not** an enforced control". **A contract that reads like a sandbox produces a reviewer who relaxes accordingly, and that is worse than no rule at all.**

## 8. Supersession record — two failures in opposite directions

**Read this before "simplifying" anything above.** Two previous versions of this boundary were wrong in opposite ways, and knowing both is what makes the current model legible.

**Version 1 — the flat prefix ban (original).** Keel's contract said, in effect, "no `C:\.fusion247\*`". Mechanical, no judgement step, and **wrong**: this estate's privacy doctrine deliberately places private, non-public build surfaces — source, tests and contracts that may not exist in the public repo — under `C:/.fusion247/private/**`. The ban therefore forbade the only location such a Work Order can legally write. A live worker instance hit the contradiction mid-Work-Order.

**Version 2 — the by-kind rule (superseded, and this is the honest part).** The by-kind replacement — "this rule prohibits by *kind*, not by path prefix" — was **Larry's, made inline to unblock that worker**, and it **widened a security boundary on Warwick's secrets store without Warwick's authorisation.** Warwick has classified it as an **unauthorised temporary broadening**. It fixed version 1's real defect and introduced a worse one: it turned a mechanical prefix ban into a judgement call about what counts as credential material, at exactly the point where a worker is motivated to judge permissively. The cost was flagged at the time it was made and was accepted as temporary; this Guideline is the ruling that ends it.

**Version 3 — this model (Warwick's ruling, 2026-07-29).** Deny-by-default with an explicitly declared project-subtree allowlist, plus by-kind prohibition of credential material *inside* the allowed subtree. It keeps version 1's mechanical character, gives version 2's legitimate private surfaces a legal door, and removes the worker's discretion from both halves.

**The useful lesson, and the reason all three are recorded rather than the last one quietly replacing the others:** a boundary can fail by being too tight *or* too loose, and each failure looks like a correction of the other. Version 2 was a reasonable-looking fix that traded a false negative for a class of false positives nobody would ever see. Anyone proposing to loosen §1 or soften §3 is re-walking that path — and anyone proposing to restore the flat prefix ban re-breaks every private-surface Work Order.

## References

- [[SOP-022-work-order-preflight]] — the read-back gate and the preflight that checks a declared surface against reality. Canonical there.
- [[Templates/work-order]] — the canonical Work Order shape and the `file_surface` declaration rules the order author must satisfy.
- [[GL-009-public-private-knowledge-boundary]] — the sibling boundary: what may enter the public repo.
- [[Team/Keel - Implementation Engineer/AGENTS]] — the Work-Order-bound contract that links here and restates none of it.
