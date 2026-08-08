---
source: Google Drive — "CAPAE Brief"
drive_file_id: 1GEVyWb2khKlSY4m3h37MadVRlT0M3Iu3nMzs7mTE25M
drive_modified: 2026-08-07T21:14:38.113Z
owner: warwickjunior2011@gmail.com
retrieved_by: Larry, 2026-08-08
retrieval_note: >
  Fetched via the Google Drive connector and staged to disk BYTE-FAITHFUL because
  subagents hold no MCP tools. This file is a MIRROR. The Drive document is canonical.
  Only the heading below and this frontmatter were added; the body is unaltered.
status: PROPOSAL TO CHALLENGE — NOT an implementation instruction (Warwick's own words)
phase_note: >
  The brief says "4C CAPAE" throughout because it was written 2026-08-07. Warwick has
  since moved CAPAE to Sub-phase 4D (Amendment 14, and confirmed by him 2026-08-08:
  "4D is CAPAE alone; 4E remains AsdAIr"). Read every "4C" in the body as "4D".
---

# CAPAE Brief — Warwick's proposal, staged from Google Drive

> **Warwick's framing, verbatim from the top of the document:** *"I'd give them this as a proposal to challenge, not an implementation instruction. The point is to preserve the North Star and the architecture we've reasoned toward, while leaving Larry/Pax/Nolan room to find a better implementation from the actual Proofline estate."*
>
> **And his closing instruction:** *"Do not assume the proposed mechanism is correct merely because Warwick and ChatGPT like it. Preserve the North Star and anti-bloat constraints. Challenge everything else."*

---

## Proposal — 4C CAPAE: Closed-Loop Operational Learning

### Purpose

Proofline has generated a large amount of real evidence about how Larry and the wider operating system fail, recover and improve.

We already capture many of the ingredients:

- mistakes discovered during normal contextual operation;
- Work Order REFUSE / CLARIFY / amendment evidence;
- Veritas findings;
- Codex findings;
- Warwick corrections;
- Pax `/rotate` reports;
- immediate corrections made to the affected work;
- Lessons Learned / self-improvement at closure.

The missing capability is a reliable closed loop between discovering a mistake and proving that whatever we changed actually made recurrence less likely.

This proposal calls that loop CAPAE.

### North Star

> CAPAE — Corrective Action, Preventive Action and Effectiveness — means not just fixing what went wrong, but identifying why it went wrong, making the smallest practical change that should reduce recurrence, and then proving through normal future operation that the prevention actually worked.

Every meaningful mistake the system discovers should make the next occurrence less likely.

The learning loop must become stronger over time without making the operating system steadily heavier, noisier, more expensive, or dependent on Warwick remembering to review it.

An important qualification:

> Effectiveness is not "we haven't seen the problem again yet". It is evidence from a meaningful future opportunity where the prevention should have worked.

And an equally important anti-bloat rule:

> A mistake is evidence for CAPAE; it is not automatically justification for another rule, mechanism or control.

The system should first establish whether an existing control already covered the situation, whether the problem was that it was missing, wrong, ambiguous, not invoked or not loaded, and whether any change is actually warranted.

---

### The full learning lifecycle

The proposed lifecycle is:

**Finding → Correction → Root Cause Analysis → Corrective/Preventive Action → Effectiveness → Proven Lesson**

These stages should remain distinct.

**Finding** — What actually went wrong? Evidence may originate from normal operation, a specialist refusal, Warwick correction, Pax observation, Veritas, Codex or another existing evidence source.

**Correction** — What was done to fix this occurrence? Correction is not the same as prevention. Regenerating a bad Work Order correctly fixes today's Work Order. It does not establish why Larry produced the bad one or make tomorrow's less likely.

**Root Cause Analysis** — Why did the failure happen? This should be lightweight and evidence-led rather than ceremonial Five Whys theatre.

Useful cause classes may include things such as:

- required control absent;
- control existed but was not invoked;
- control was not loaded or available;
- control itself was wrong or incomplete;
- guidance was ambiguous or contradictory;
- stale authority/state was treated as current;
- template/generator permitted the defect;
- verification did not test the claimed property;
- reasoning or judgement failure;
- cause genuinely unestablished.

**ROOT CAUSE: UNESTABLISHED is an acceptable answer.** A plausible fictional explanation is worse than an admitted unknown.

**Corrective / Preventive Action** — What is the smallest proportionate change justified by the cause? Possibilities could range from:

- no systemic change;
- clarification of existing guidance;
- strengthening an existing rule rather than adding another;
- changing retrieval;
- changing a Work Order generator/template;
- adding or changing a test;
- deterministic validation;
- removing contradictory guidance;
- another small operating change.

**The default must not be "add another rule".**

**Effectiveness** — Define how normal future work will demonstrate that the change worked. Prefer qualified exposures rather than calendar time.

For example:

> Preventive action: ensure every issued Work Order goes through the generated envelope route.

Effectiveness:

> Next five genuinely applicable Work Orders use that route correctly with no recurrence of this failure family.

Then: `0/5 → 1/5 → 2/5 ... → EFFECTIVE`

If the same defect occurs at exposure four: **INEFFECTIVE**. The CAPAE reopens for reconsideration.

**Do not manufacture Work Orders, QA exercises or test events merely to close a CAPAE.**

**Proven Lesson** — Once effectiveness evidence exists, the existing Lessons Learned/self-improvement mechanism can decide what transferable learning deserves permanent promotion. The strongest lessons are therefore not merely things we believe after an incident. They are changes that subsequently survived real operation.

---

### Proposed ownership

**CAPAE should not belong to Larry.** Larry should not be responsible for finding his mistakes, determining their root cause, choosing his own prevention and declaring himself effective. That is marking his own homework.

However, Larry can be a valuable operator witness. He may sometimes be uniquely able to explain:

> "I knew the generator existed but treated this amendment as exempt."

That explanation is evidence for RCA, not the RCA verdict itself.

**Pax — primary investigator.** The proposal is that Pax performs the lightweight RCA/CAPAE analysis as part of the existing `/rotate` session report. This is the best point because Pax still has access to the richest session-specific evidence before `/clear` destroys contextual information. Pax should identify material findings, corrections, likely cause, recurrence relationships and possible CAPAE disposition. **Pax should not redesign the operating system or implement the remedy.**

**Larry — operator witness and later implementer.** Larry's actions and explanations are evidence. If a CAPAE eventually requires a repository or operating-system change, Larry routes that change through the normal existing Work Package / Work Order / integration route. **CAPAE gives him no special authority.**

**Nolan — selective governance/process expertise.** Nolan should not review every CAPAE. Bring Nolan in only where the cause/remedy genuinely concerns governance architecture, role boundaries, operating doctrine or conflicting controls.

**Veritas and Codex — evidence sources, not CAPAE reviewers.** Their normal findings feed the process. CAPAE does not then send the CAPAE back through Veritas and Codex merely because it exists. A resulting product/governance change receives whatever normal assurance that change would already have required. **No additional CAPAE assurance loop.**

---

### `/rotate` is the right observation point — but not the remediation point

The earlier concern about CAPAE inside `/rotate` remains valid if CAPAE is allowed to change Git. **It should not.**

The distinction should be:

> `/rotate` may analyse and record learning. It must not implement preventative changes.

The existing transaction remains responsible for banking the session and establishing a truthful closing head. Pax can add a small CAPAE section to his existing report and populate/update CAPAE state in Supabase. If that analysis concludes that a preventative change is warranted, the action waits for normal future execution.

Therefore: **Pax observes → Supabase remembers → `/rotate` completes without CAPAE altering Git.** No moving-head paradox. No Veritas doom loop.

---

### Supabase should be the operational memory

Do not create a steadily growing `CAPAE.md` that Larry has to read. That would become expensive context, then wallpaper, then ignored instructions.

Supabase should hold the living structured state. A CAPAE/failure-family record only needs distilled information such as:

```
Failure family: Work Order generator bypass
Occurrences: 4
Likely root cause: amendments/small orders treated as exempt from generation route
RCA confidence: high
Latest correction: offending WO regenerated
Current prevention: generator/read-back route required for applicable issued WOs
Required Larry behaviour: generate → read back → issue
Effectiveness: 3/5 qualified exposures clean
Status: MONITORING
Evidence refs: WO / Pax report / receipt / SHA references
```

The evidence itself remains in its existing authoritative location. Supabase points to it rather than duplicating it.

Repeated incidents should update an existing failure family, not create CAPAE-087 because Larry committed the same sin on a Tuesday instead of a Thursday.

---

### What Larry should see at Continue

Larry should not fetch or read the complete CAPAE history. Nor should he have to remember:

> "After Continue I must query the CAPAE table."

Proofline's successful interface is already:

> Warwick says Continue; the system brings Larry what he needs.

**Keep that contract.**

The existing Honcho/reorientation path should eventually receive a small precomputed active CAPAE brief from Supabase. Maximum perhaps 10 active patterns, but usually fewer. They should be ranked not merely by raw frequency, but approximately by:

`current relevance × recurrence × consequence × prevention still unproven`

Example:

> **CAPAE WATCH — 4 applicable**
> - WO generator bypass — cause: amendments treated as exempt — MUST: generate/read-back every applicable WO — effectiveness 2/5
> - Acceptance proves mechanism not outcome — cause: acceptance authored against implementation rather than claimed boundary — MUST: prove claimed outcome — 1/5
> - Canonical constraints rewritten from memory — cause: narrative drafting — MUST: derive constrained fields from source — 4/5
> - Completion claim without independent evidence — cause: worker output treated as proof — MUST: use required receipt/evidence — monitoring

This should be hundreds of tokens, not tens of thousands. **No actionable CAPAE state means no CAPAE noise.**

---

### The list should naturally rotate

This is an important desired property. The active CAPAE brief is not a permanent list of Larry's historical sins. 😂

As prevention proves effective: the item becomes EFFECTIVE; it leaves Larry's active attention; any worthwhile transferable learning can be promoted through Lessons Learned.

If the defect subsequently recurs: the same failure family reopens; its effectiveness is challenged; it returns to the active list.

Therefore Larry's scarce context remains concentrated on the mistakes he is still at material risk of making, rather than every error he has made since June.

---

### Pax `/rotate` addition should be tiny

Do not turn the session report into a CAPA dissertation. For each material candidate finding, something roughly this size is enough:

> Failure family: WO generation route bypass
> Correction: WO regenerated through correct route
> RCA: existing control not invoked
> Why: amendment treated as outside generator requirement
> Confidence: high — supported by order + session evidence
> Prior family: CAPAE-003, occurrence +1
> Disposition: recurrence — current prevention effectiveness challenged

Supabase handles historical accumulation. **Pax analyses this session, not the entire history every rotation.**

---

### Effectiveness should reuse normal future operation

The ideal loop is therefore:

```
Larry operates
 ↓ existing operational + QA evidence captures failures
 ↓ Pax /rotate performs lightweight RCA/CAPAE analysis while context still exists
 ↓ Supabase updates failure families / causes / prevention / exposure state
 ↓ /clear
 ↓ Honcho/reorient injects only the relevant active CAPAE brief
 ↓ Continue
 ↓ Larry operates with the currently relevant failure patterns in context
 ↓ future real work provides qualified exposures
 ↓ later Pax reports record clean exposure or recurrence
 ↓ Supabase advances EFFECTIVENESS or marks INEFFECTIVE
 ↓ effective learning leaves the active list and may enter Lessons Learned
```

No human diary. No Warwick CAPA inbox. No scheduled meeting. No separate quality department staffed by increasingly exotic zoo animals.

---

### Anti-bloat / anti-doom-loop constraints

**Any design proposed for 4C [→ 4D] should preserve these:**

- Not every incident becomes a CAPAE.
- Not every CAPAE creates a rule.
- Prefer strengthening/removing/changing existing controls over adding new ones.
- CAPAE itself cannot mutate Git during `/rotate`.
- CAPAE cannot automatically commission Veritas or Codex.
- No CAPAE-about-CAPAE recursion.
- A recurrence updates the existing failure family.
- INEFFECTIVE means reconsider the cause/remedy; it does not automatically add another control.
- Open MONITORING items do not block unrelated safe work.
- Effectiveness should normally arise from future real work, not bespoke assurance exercises.
- Larry should never load the complete CAPAE history into context.
- The active brief must remain strictly bounded and relevance-ranked.
- Prefer existing Proofline pieces over inventing a new platform, service or agent.
- **The total system should become lighter as controls become effective, not progressively heavier.**

---

### Evidence worth using during 4C [→ 4D]

Proofline already contains real cases suitable for testing the idea. The clearest is the repeated Work Order generation defect:

> Larry acknowledged the generator-route failure on one Work Order and subsequently repeated it on another.

That is useful precisely because it demonstrates: **finding existed → correction happened → recurrence still happened.** What was missing was an explicit RCA, a prevention disposition and later effectiveness measurement.

Other Proofline evidence should be examined as candidate input, not assumed to require new controls. A shared-worktree/concurrency incident, for example, may reveal that an existing rule was sufficient but not followed. The right CAPAE response might therefore be one tiny clarification — or no new control at all.

---

### Question for Larry, Pax and Nolan

This proposal deliberately stops short of prescribing the implementation. Please challenge it against the actual Proofline operating system and answer:

> **What is the smallest, most token-efficient way to make this closed learning loop real using the pieces already built — while keeping `/rotate` stable, keeping Larry's Continue context tiny, preserving independent judgement, and preventing CAPAE itself from becoming the next governance problem?**

**Do not assume the proposed mechanism is correct merely because Warwick and ChatGPT like it. Preserve the North Star and anti-bloat constraints. Challenge everything else.**
