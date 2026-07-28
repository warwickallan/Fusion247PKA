# Independent browser control — decisive experiment result

**Run 2026-07-28. Question: can AsdAIr drive an authenticated ASDA session WITHOUT Larry's Claude Code session?**

## Result: YES — proven, by the smallest viable route

```
INDEPENDENT CDP RESULT:
{"title":"Online Food Shopping - ASDA Groceries","url":"https://www.asda.com/","loggedIn":false,...}
```

A plain Node process (`cdp.js`, ~30 lines, zero dependencies) opened a tab, navigated to ASDA and read the DOM
back. **No Claude Code, no MCP, no browser extension, no Playwright.**

## The mechanism chosen, and why

**Chrome DevTools Protocol against a DEDICATED persistent Chrome profile.**

```
chrome.exe --remote-debugging-port=9222 --user-data-dir=C:\.fusion247\asdair\chrome-profile
```

Why this route rather than the alternatives:

| Route | Verdict |
|---|---|
| **CDP + dedicated persistent profile** | **CHOSEN.** Zero dependencies, real Chrome, session persists across restarts, and it is genuinely independent of Claude Code. |
| Playwright | Would work, but adds a large dependency and a driver-managed browser that ASDA is more likely to treat as automation. Not needed once CDP is proven. |
| Claude-in-Chrome extension | Host-level binding. **Proven unreachable** from a subagent (2026-07-28 probe) and unavailable to any independent process. |
| CDP against Warwick's DAILY Chrome | Rejected on purpose. It would require closing his browser (profile lock) and would put an automated writer inside the profile he uses for everything. |

The dedicated profile is the important design choice: the runner **owns** it, so automation never disturbs
Warwick's day-to-day browsing, and the ASDA login persists in it across machine restarts.

## What this corrects

The earlier probe proved only that **a Claude Code subagent does not inherit host MCP tools**. It did NOT prove
that independent browser operation is impossible — and this experiment shows it is not. "Asdair directs, Larry
clicks" was an honest description of one mechanism's limits, never a valid permanent operating mode.

## The one remaining human step — by design, not by limitation

`loggedIn: false`, because the profile is new. **Warwick logs into ASDA once in that Chrome window.** The
session then persists in the profile; the runner never sees or handles the password, and there is deliberately
no command that could enter one. Re-authentication, when ASDA eventually demands it, is also Warwick's — the
runner's job is to *detect and report* that state, never to resolve it.

## Boundaries the runner will carry (unchanged)

No checkout · no payment · no slot booking · no password entry · no substitutions · no accepting an unapproved
substitute. Stops at checkout-ready. Exactly one writer against the live trolley, enforced by a durable claim on
`asdair.browser_build_request`.

---

# PRACTICE SHOP — executed 2026-07-28, visible Chrome, real ASDA

Run entirely by a plain Node process over CDP. **No Claude-in-Chrome, no MCP, no extension, no Playwright.**

| # | Step | Result |
|---|---|---|
| 1 | Record starting state | **0 items, £0.00** (empty) |
| 2 | Open Regulars | logged-in surface confirmed ("Add selected to trolley" present) |
| 3 | Add known Regular **by product reference** | Cravendale `489747` → **1 item, £2.50** |
| 4 | Search + add approved non-Regular | `COOK by ASDA Mixed Herbs 12g` `544334` |
| 5 | Change quantity with the **real +/− stepper** | `Increase COOK by ASDA Cook Mixed Herbs 12g` |
| 6 | Read back | **3 units · £4.50 · 2 distinct products** |
| 7 | Persist to `browser_build_request.progress` | request 1, shop `SHOP-PRACTICE-2026-07-28` |
| 8 | Same state visible to Telegram/Cockpit | verified by SELECT: `regulars_added=1`, `searched_added=1`, `basket_product_count=2`, `estimated_total=4.50`, `human_reauth_required=false` |
| 12 | **Restore trolley** | decremented to **0 items** — exact starting state restored |

**Never touched:** checkout · payment · delivery slot · substitutions · password. There is no code path to any of them.

The stepper was used deliberately rather than typing a quantity — SOP-021's most expensive lesson is that typed
quantities do not persist server-side.

## On independence — what is and is not proven

**Proven:** every action above was issued by `node` talking CDP straight to Chrome. Claude Code launched the
process; it supplied **no browser capability whatsoever**. The same scripts run from any terminal:

```
node services/asdair/browser-runner/readTrolley.cjs
```

**Not yet proven:** the literal "close Larry's window and watch it run" demonstration, and steps 9–11 and 14
(pause/resume/stop-at-basket-ready, and restart-reconstructs-state). Those need the runner daemonised against a
real claimed request rather than driven step-by-step — that is the next build, and the mechanism it depends on
is now settled.

**Honest distinction:** "runs in a process Claude Code happened to start" is not the same claim as "runs with
Claude Code closed". The first is proven; the second is expected but untested, and should be tested rather
than assumed.
