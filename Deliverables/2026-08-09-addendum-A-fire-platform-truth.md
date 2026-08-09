# Addendum A — Fire tablet, connectivity and accessibility platform truth

**Date:** 2026-08-09 · **Author:** Pax · **Type:** Read-only research brief
**Status:** NON-GATING. Does not alter, extend, delay or re-grade BUILD-015. No BUILD-015 branch or head was read or touched.
**Serves:** Can Mum (84, technology-phobic, poor eyesight and coordination) independently create and resolve her weekly shopping order from her Fire tablet, with Warwick needed only for the real ASDA checkout and payment?

---

## Executive summary

A **web Cockpit reached over Tailscale is viable** and remains the right shape — no evidence found that a native Android app is required, and no specific blocker justifies one. Two things must be settled by physical inspection before implementation, not by assumption: **the exact tablet model/Fire OS/Silk version**, and **whether Tailscale reconnects after a power cycle without a human touching it**. The second is the only finding with product-failure potential.

---

## Key findings

### 1. The device is UNKNOWN and must not be assumed — Confidence: N/A (statement of gap)

No household device record exists in this repo, and the platform question cannot be closed without one. **Do not design to a model.** What must be captured on the physical tablet before implementation (all read-only, one pass, ~2 minutes):

| Where | Capture |
|---|---|
| Settings → Device Options → About Fire Tablet | **Device model** (e.g. Fire HD 8, 12th gen), **Fire OS version**, **serial-prefix/product model** (KF…) |
| Settings → Display | Current **font size** and **display size** settings |
| Amazon Appstore → Silk Browser | Installed **Silk version** |
| Silk → any page | **User-agent string** via a "what is my browser" page — this yields Android version, product model and Chromium version in one string |

The UA string is the single highest-value artefact: Amazon's documented template is `Mozilla/5.0 (Linux; Android <ver>; <model> Build/…) AppleWebKit/537.36 (KHTML, like Gecko) Silk/<silk> like Chrome/<chromium> Safari/537.36` ([AWS Silk docs](https://docs.aws.amazon.com/es_es/silk/latest/developerguide/user-agent.html)).

**Constraints that bound the answer regardless of model:**
- Tailscale supports "most Fire Tablets released after 2018" ([Tailscale install doc](https://tailscale.com/docs/install/amazon-fire); [Tailscale on Amazon Appstore](https://www.amazon.com/Tailscale-Inc/dp/B0D38TRB3N)). A pre-2018 tablet is a hardware-replacement decision, not an engineering one.
- Fire OS 8 = **Android 11 / API 30**, shipping on Fire 7 (12th gen), Fire HD 8 (12th gen), Fire HD 10 (13th gen) and Fire Max 11 ([Amazon developer: Fire OS 8](https://developer.amazon.com/docs/fire-tablets/fire-os-8.html); [Amazon blog, Sept 2023](https://developer.amazon.com/apps-and-games/blogs/2023/09/fireos8-on-new-fire-devices)). Older in-support tablets run Fire OS 7 (Android 9).

### 2. Silk is a MODERN Chromium, updated independently of Fire OS — Confidence: Medium-High

This is the most useful surprise. Silk ships from the Amazon Appstore as an ordinary app and tracks Chromium far ahead of the device's Android base:

- APKMirror lists **Silk 130.6.5.…, released 1 Feb 2025**; Uptodown lists **Silk 144.2.5.…** — the leading number is the Chromium base.
- A real-world UA captured on a `KFTRWI` (Fire HD 10, 2021, **Android 9**) reads `Silk/138.10.4 like Chrome/138.0.7204.244` — Chromium **138** on an Android 9 device.
- Amazon states Silk "is built on the Chromium Project and is consistently updated" ([AWS: What is Amazon Silk?](https://docs.aws.amazon.com/silk/latest/developerguide/what-is-silk.html)).

**Consequence:** modern CSS (`dvh`/`svh`, `gap`, `clamp()`, `:has()`, container queries) is *probably* available even on an older tablet. **Probably is not established.** Ship a one-page capability probe (`CSS.supports('height','100dvh')`, `@supports` reporting, UA echo, viewport dimensions) and open it on the actual device. That single page converts this from Medium-High to High in one minute.

**⚠️ Anti-pattern flagged:** Amazon's own Silk developer guide is **stale and will mislead you**. Its screen-resolution table stops at Fire 7 (9th gen) ([AWS screen-size page](https://docs.aws.amazon.com/silk/latest/developerguide/screen-size.html)), and the widely-cited third-party dev guide describes Silk at Chromium 79/80 with an HTML5test score of 465/555 ([Christian Oliff, 2020](https://christianoliff.com/blog/web-developer-guide-kindle-fire-tablets/)). Designing to those documents would produce a needlessly primitive UI. **Design to the probe, not to the docs.**

### 3. `100vh` — treat as a known Chromium hazard, verify on device — Confidence: Low-Medium (inference, flagged)

I found **no Silk-specific** published evidence on `100vh`. What is established is that Silk is Chromium/Blink, so the standard Chromium mobile behaviour applies: `100vh` resolves to the *large* viewport and is clipped by the collapsing browser chrome, causing a bottom action bar to sit below the fold. **Single-source-by-inference — flagged, not proven.**

Safe handling that needs no verification: `height: 100vh; height: 100dvh;` (progressive fallback), never place the primary action in a `100vh`-pinned bar, and prefer normal document flow with a sticky footer that has real bottom padding. Confirm with the probe page in both orientations.

### 4. Fire OS system font scaling does NOT scale Silk web pages — Confidence: Medium

Fire OS Settings → Display/Accessibility font size governs the tablet UI and menus; **Silk web content keeps its own scale** until changed inside Silk (Menu → Settings → Accessibility → Text Scaling) or by pinch-zoom ([Amazon: Adjust the Font Size on Your Fire Tablet](https://www.amazon.com/gp/help/customer/display.html?nodeId=TfGArGdKwTYxHzyXBg); [Amazon: Silk Browser Basics](https://www.amazon.com/gp/help/customer/display.html?nodeId=201829650); corroborated by two independent how-to guides). Both are secondary/help-desk sources rather than a developer spec — **Medium confidence, cheap to verify on device.**

**Consequence, and it is load-bearing:** *"we'll turn up the accessibility settings for her"* is not a design strategy. **The Cockpit must be legible at default settings, out of the box, with nothing configured.** Any per-user browser setting is one factory reset, one app update or one accidental tap away from being lost — and re-applying it is exactly the recurring technical ceremony the North Star forbids. Setting Silk's text scaling is acceptable as a *bonus*, never as a *dependency*.

### 5. Tailscale on Fire — the one genuine product-failure risk — Confidence: High (that the risk class is real); Unresolved (whether it bites this device)

**Install and first-run are fine.** Tailscale is on the Amazon Appstore for Fire; Warwick performs the one-time setup: open app → accept connection request → Get Started → accept the VPN configuration prompt → Log in ([Tailscale install doc](https://tailscale.com/docs/install/amazon-fire)). None of that recurs, and none of it lands on Mum.

**Reboot survival is the problem.** The Tailscale Android client has a long-running, repeatedly-reported class of defect where the VPN does not come back after a restart — including when Android's own **Always-on VPN** is enabled:

- [#8260 — VPN profile does not survive reboots](https://github.com/tailscale/tailscale/issues/8260)
- [#9428 — Always-On-VPN turns off after a restart (Active → Stopped)](https://github.com/tailscale/tailscale/issues/9428)
- [#10013 — does not autostart when selected as Always-On VPN](https://github.com/tailscale/tailscale/issues/10013)
- [#2481 — Always-on VPN does not connect if disconnected before reboot](https://github.com/tailscale/tailscale/issues/2481)
- [#11432](https://github.com/tailscale/tailscale/issues/11432), [#16935](https://github.com/tailscale/tailscale/issues/16935) — same symptom on other Android-based devices

**Severity, stated plainly:** if the tablet is power-cycled — battery flat, a plug switched off, a "have you tried turning it off and on again" — and Mum must find and open a blue app before her shopping list works, **the product has failed her.** That is precisely the recurring ceremony the brief names as a product failure, not a caveat.

**⚠️ Second anti-pattern, and it is worse than the first:** Android's **"Block connections without VPN"** (kill-switch) is described in these reports as commonly on alongside Always-on VPN. When Tailscale then fails to reconnect after reboot, the tablet has **no network at all** — not a broken Cockpit, a broken tablet, with an alarming system notification on screen. **Do not enable the kill-switch on Mum's device under any circumstances.** A degraded state she can still use YouTube on is recoverable; a dead tablet is a phone call.

**This is a device test, not a research question.** It cannot be closed from GitHub issues, because the issues span client versions and devices and some are closed. Required evidence: install, enable Always-on VPN (kill-switch OFF), **fully power the tablet off and on**, wait, and open the Cockpit URL **without launching Tailscale first**. Pass = the page loads. Anything else is a fail and forces a fallback decision.

**Fallback options if it fails (Warwick's decision, not mine):** (a) serve the Cockpit on the home LAN so no VPN is needed while she is at home, with Tailscale only for Warwick's remote access; (b) a home-screen web-app shortcut whose landing page detects no-connection and shows one large "Tap here to reconnect" button; (c) accept a manual step and design it to be one obvious tap. **Option (a) is the simplest shape and the one I would test first** — it removes an entire moving part from her path.

### 6. VoiceView — the wrong lever here — Confidence: Medium-High

VoiceView is a genuine, capable screen reader; it ships on every Fire tablet, supports refreshable braille, and Silk honours it including heading/form-control navigation and system accessibility settings ([Amazon: Guide to VoiceView](https://www.amazon.com/gp/help/customer/display.html?nodeId=201829330); [Amazon developer: Assistive Technologies for Fire OS](https://developer.amazon.com/docs/fire-tablets/ft-assistive-technologies-fire-os.html); [AFB AccessWorld](https://www.afb.org/aw/20/1/14991)).

**Recommendation: do NOT enable VoiceView for Mum.** The reason is not quality — it is that turning it on **replaces the entire interaction model**: single tap explores and speaks, double tap activates, swipes become navigation. For a technology-phobic 84-year-old who is *not* a screen-reader user, that is a new skill to learn, and worse, a state she can enter **accidentally** and be unable to exit. Poor eyesight without blindness is served far better by **high-contrast, very large type and very large targets**, which cost her nothing to learn.

**Two actions follow:** (1) build the accessible semantics anyway — proper headings, `<label>`ed inputs, real `<button>`s, focus order — so VoiceView works correctly *if* it is ever needed or triggered; (2) find out whether the accessibility **shortcut gesture** is enabled on her tablet and, if so, consider turning it off, so she cannot switch VoiceView on by accident. *(Item 2 is Larry's/Warwick's call on the physical device; I could not verify the current Fire OS shortcut default.)*

### 7. Concrete accessibility targets — with numbers and sources

Published minimums first, then the deliberately more generous house bar.

| Dimension | Published figure | Source |
|---|---|---|
| Touch target, AA minimum | **24 × 24 CSS px** (SC 2.5.8, WCAG 2.2, with spacing/inline/essential exceptions) | [W3C WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) |
| Touch target, AAA enhanced | **44 × 44 CSS px**, no spacing escape hatch (SC 2.5.5) | [W3C WCAG 2.2 Understanding 2.5.5](https://w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html) |
| Touch target, Apple | **44 × 44 pt** minimum tappable area | [Apple HIG, via TetraLogical](https://tetralogical.com/blog/2022/12/20/foundations-target-size/) |
| Touch target + spacing, Google | **48 × 48 dp** (≈ 9 mm physical), separated by **≥ 8 dp** | [Material Design](https://m2.material.io/develop/web/supporting/touch-target) |
| Body text, older adults | **12–14 point**, sans-serif (Arial, Calibri, Verdana, Tahoma) | [NIA, *Making Your Website Senior Friendly*](https://www.nia.nih.gov/health/making-your-website-senior-friendly) (2001, rev. 2009); [ACL, *Basic Tips on Web Design for an Older Adult Audience*](https://acl.gov/sites/default/files/nutrition/BasicTipsOnWebDesignForAnOlderAdultAudience.pdf) |
| Text contrast, AA / AAA | **4.5:1** (SC 1.4.3) / **7:1** (SC 1.4.6) for normal text | [W3C WCAG](https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html) |

**⚠️ The NIA figure is the trap.** 12–14 point is a **print/2001-era** recommendation and is *below* today's ordinary 16 px web default. Citing it as a target would make the Cockpit **worse** than doing nothing. It is included here as evidence of the *direction* (larger, sans-serif, high contrast), never as a number to build to. This is exactly the "do not merely write 'WCAG compliant'" failure in a different costume: an authoritative-looking number, applied without checking what it is a number *of*.

**Proposed house bar for the Cockpit — deliberately more generous than every row above:**

| Property | Target | Why this number |
|---|---|---|
| Body text | **≥ 22 px** (≈ 1.375 rem) | ~1.4× the 16 px web default; legible without configuring anything |
| Primary action text | **≥ 26 px**, semi-bold | Distinguishable at arm's length, without relying on colour |
| Contrast, body text | **≥ 7:1** | AAA (1.4.6), not AA — the whole point is poor eyesight |
| Contrast, all UI/icons | **≥ 4.5:1** | Exceeds the 3:1 non-text minimum |
| Primary touch targets | **≥ 64 × 64 CSS px** | ~1.45× Apple's 44, ~1.33× Material's 48, ~2.7× WCAG AA |
| Secondary touch targets | **≥ 48 × 48 CSS px** | Material's floor as an absolute floor, never a goal |
| Spacing between adjacent targets | **≥ 16 px**, **≥ 24 px** where one is destructive | 2–3× Material's 8 dp; the primary defence against coordination-related mis-taps |
| Line height / measure | **≥ 1.6**, **≤ 60 characters** | Reduces line-tracking loss |
| Max simultaneous choices | **≤ 5** per screen | Chunking; the one NIA/ACL recommendation that transfers cleanly |

**Accidental-tap recovery — non-negotiable, and cheaper than any of the above:**

1. **No irreversible action reachable in one tap.** Every destructive action gets a full-screen confirm with the *safe* option visually dominant.
2. **Undo on every list mutation** — removing an item, changing a quantity — persisting for the whole session, not a 5-second toast she will never see in time.
3. **No swipe-to-delete, no long-press, no drag, no double-tap, no pinch requirement.** Tap only. Every gesture is a coordination test she did not ask to sit.
4. **No timeouts, no auto-dismissing messages, no carousels, no auto-advance.** (SC 2.2.1 / 2.2.2.)
5. **Never colour alone** to convey state — pair with text and shape.
6. **Portrait AND landscape must both work** (SC 1.3.4 Orientation). She will hold it however she holds it, and a tablet in a case is often landscape. Test both.
7. **Nothing under the thumb-rest zone** at the screen edges where a two-handed grip lands.

---

## Recommendation

**Keep the simplest shape: Fire tablet → Tailscale → private Cockpit → existing pipeline.** I found **no evidence** that a web Cockpit cannot meet the requirement, and therefore **no case for an Android-native project.** Silk is a modern Chromium and every accessibility target above is reachable in CSS. A native app would add an install/update/signing burden and a second surface to maintain, in exchange for solving nothing that is currently broken.

**The one thing that could change that answer is Finding 5**, and it is a *connectivity* problem, not a *rendering* one — so the correct response is to remove or soften the VPN dependency (LAN-first), not to rewrite the UI as a native app.

**Before implementation, in order — all read-only, all on the physical device, roughly 15 minutes total:**

1. Capture model / Fire OS / Silk version / UA string (Finding 1).
2. Open a capability + viewport probe page in Silk, both orientations (Findings 2, 3).
3. Confirm whether Fire OS font scaling moves Silk web text (Finding 4).
4. **Power-cycle test for Tailscale auto-reconnect, kill-switch OFF** (Finding 5). *This is the gating test.*
5. Confirm the accessibility shortcut gesture state (Finding 6).

---

## Methodology

Desk research only, 2026-08-09. Sources: Tailscale official install documentation and its public GitHub issue tracker; AWS/Amazon Silk developer documentation; Amazon developer Fire OS 8 documentation; Amazon customer-help pages; W3C WCAG 2.2 Understanding documents; Material Design and Apple HIG (the latter via TetraLogical); NIA and ACL older-adult design guidance; APKMirror/Uptodown/whatismybrowser for Silk version and UA evidence. Every load-bearing claim carries at least two independent sources except where explicitly flagged.

## Limitations

- **No device was inspected.** Every device-specific claim is a constraint or a probability, not a fact about Mum's tablet.
- **Finding 3 (`100vh`) is an inference** from Silk being Chromium, not Silk-specific published evidence. Flagged as single-source-by-inference.
- **Finding 4** rests on Amazon help-desk pages and secondary guides, not a developer specification.
- **Finding 5 is unresolved by design.** Public issue trackers span client versions and devices; some issues are closed. Whether the *current* client on *this* tablet reconnects can only be settled by a physical power cycle.
- The **Fire OS accessibility-shortcut default** could not be verified.
- Keyboard behaviour on free-text entry (soft-keyboard overlay, viewport resize vs. overlay, autocorrect/autocapitalise on an elderly user's typing) was **not resolved** — no reliable Silk-specific source found. Fold it into the probe page: one focused text input, observe whether it is obscured. *(Separately worth asking whether Mum should be typing free text at all, or choosing from lists and speaking — a product question for Warwick, not a platform question.)*
- No household personal data or network-identifying detail appears in this brief, per the public-repo constraint.
