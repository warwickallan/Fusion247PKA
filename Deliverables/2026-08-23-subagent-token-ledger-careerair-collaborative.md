# Subagent token ledger — session 2026-08-23 (BUILD-016, collaborative half)

**Input for Pax's session report.** Larry holds this data and Pax cannot see it: every `Agent` return
emits a `<usage>` block visible only in Larry's transcript. **This ledger exists so per-specialist
usage is never again reported `UNESTABLISHED` when Larry could have supplied it** (Warwick, 2026-08-08,
after two consecutive reports did exactly that).

- **Branch:** `wo/2026-08-23-cockpit-grid` · **closing head:** `724f19fa504d552d5dc7066f6fc03c6653051850`
- **⛔ Larry-transcribed from return blocks, NOT independently instrumented.** Every figure below is a
  reading of what the harness reported, not a measurement Larry took.
- **This session was CONTINUED FROM A COMPACTED CONTEXT.** Dispatches from the earlier portion —
  including several Keel implementation orders — are **UNMEASURED, NOT ZERO.** Their usage blocks did
  not survive into this window. Any total below covers the post-compaction portion only and must be
  labelled that way.
- **No employer, role or opportunity name appears in this file.** It is a cost record, and this
  repository is public.

---

## The cumulative-versus-per-dispatch question — RE-TESTED, not assumed

The 2026-08-08 finding was that `subagent_tokens` is **cumulative per agent** while `tool_uses` and
`duration_ms` are **per-dispatch**. Getting this wrong inflated a total by ~80 %. **Re-tested against
this session's own data**, using the two agents that returned more than once:

| Agent ID | Return 1 | Return 2 | Return 3 | Monotonic? |
|---|---|---|---|---|
| Keel (cockpit grid) — `subagent_tokens` | 123,547 | 281,863 | 324,562 | **YES** |
| Keel (cockpit grid) — `tool_uses` | 30 | 87 | 29 | **NO** |
| Keel (origin allowlist) — `subagent_tokens` | 133,497 | 199,624 | — | **YES** |
| Keel (origin allowlist) — `tool_uses` | 25 | 29 | — | (2 points, weak) |

**Verdict: the 2026-08-08 finding STILL HOLDS.** `subagent_tokens` is cumulative per agent ID — both
resumed agents are strictly monotonic. `tool_uses` is per-dispatch — proven by the cockpit agent's
`30 → 87 → 29`, which **cannot** be cumulative. Duration is treated as per-dispatch on the same
evidence.

**Consequence for Total A:** take the **final** value per agent ID, never the sum of returns. Summing
every return would give **3,142,996** against a true **2,604,089** — an inflation of **538,907 tokens,
about 21 %.**

---

## Total A — deduplicated subagent token traffic (post-compaction portion)

**A = 2,604,089 tokens** across **19 unique agents / 22 dispatches**.

| # | Agent type | Purpose | Dispatches | Final `subagent_tokens` | Tool uses (summed per-dispatch) | Duration (ms, summed) |
|---|---|---|---|---|---|---|
| 1 | careerair | cluster base 3 | 1 | 156,478 | 33 | 539,361 |
| 2 | careerair | cluster base 2 | 1 | 164,897 | 32 | 601,317 |
| 3 | careerair | cluster base 4 | 1 | 163,635 | 31 | 606,275 |
| 4 | careerair | fork | 1 | 89,684 | 15 | 243,323 |
| 5 | careerair | fork | 1 | 101,679 | 18 | 358,602 |
| 6 | careerair | fork | 1 | 107,883 | 21 | 348,210 |
| 7 | careerair | fork | 1 | 109,224 | 20 | 308,859 |
| 8 | careerair | fork | 1 | 124,310 | 29 | 516,141 |
| 9 | careerair | fork | 1 | 104,635 | 20 | 344,863 |
| 10 | careerair | fork | 1 | 113,132 | 16 | 306,474 |
| 11 | careerair | fork | 1 | 103,595 | 19 | 279,082 |
| 12 | careerair | fork | 1 | 93,144 | 17 | 265,216 |
| 13 | careerair | apply two banked rulings | 1 | 187,774 | 74 | 1,005,439 |
| 14 | **keel** | **cockpit grid (read-back + build + 4 fixes)** | **3** | **324,562** | **146** | **1,644,388** |
| 15 | **keel** | **origin boundary (read-back + build)** | **2** | **199,624** | **54** | **995,012** |
| 16 | vex | security review | 1 | 163,239 | 45 | 827,196 |
| 17 | mack | first live + config | 1 | 97,331 | 53 | 540,417 |
| 18 | mack | restart for fixes | 1 | 99,508 | 41 | 324,857 |
| 19 | mack | restart closing the leak | 1 | 99,755 | 44 | 407,875 |

**By specialist:**

| Specialist | Agents | Dispatches | Tokens (dedup) | % of A | Tool uses |
|---|---|---|---|---|---|
| careerair | 13 | 13 | 1,620,070 | **62.2 %** | 345 |
| keel | 2 | 5 | 524,186 | **20.1 %** | 200 |
| vex | 1 | 1 | 163,239 | 6.3 % | 45 |
| mack | 3 | 3 | 296,594 | 11.4 % | 138 |
| **total** | **19** | **22** | **2,604,089** | 100 % | **728** |

## Total B — peak/final context footprint per persistent agent

The two resumed Keel agents are the only persistent ones. Final footprints: **324,562** and
**199,624**. Both are large because each carried a read-back, a build and a fix round in one context —
**by design**, since the alternative is a fresh agent re-reading its contract and its own prior work.
No agent was left running oversized in the background.

## Total C — dispatch and tool-use count per agent

In the table above. **Cost-to-work ratio worth noting:** the 13 `careerair` agents consumed 62 % of the
traffic for 345 tool uses, while the 5 Keel dispatches consumed 20 % for 200 tool uses. **The writing
work is token-heavy and tool-light; the engineering work is the reverse.** That is the expected shape
and is recorded so it is not read as inefficiency.

## ⛔ Larry's own context is DELIBERATELY EXCLUDED from A

**Context occupancy is a LEVEL; subagent traffic is a FLOW. Summing them produces a meaningless
number.** The only honest joint statement is a ratio, and Larry's own figures are for Pax to read from
the instrument, not for this ledger to assert.

## Stated uncertainties

1. **Larry-transcribed, not instrumented.** Transcription error is possible; the figures are readings.
2. **The pre-compaction portion is UNMEASURED, not zero.** Several dispatches — Gmail collector, link
   filter, false-gap fix, board rules, ATS extraction — returned before the context window rolled.
   Their usage is unavailable. **A is therefore a floor, not a total for the calendar session.**
3. **`subagent_tokens` is not defined in any contract Larry holds.** Whether it counts input, output or
   both is unestablished. The cumulative/per-dispatch behaviour is proven; the unit is not.
4. **Any agent that emitted no usage block is unmeasured, not zero.**
5. **Wall-clock is NOT the sum of durations** — most of these ran in parallel, several in batches of
   four or five. Summed duration is compute time, not elapsed session time.
