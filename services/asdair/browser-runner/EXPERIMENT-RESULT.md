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
