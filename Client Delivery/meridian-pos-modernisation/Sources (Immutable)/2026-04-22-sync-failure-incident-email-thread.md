# Meridian POS Modernisation — Sync Failure Incident Email Thread

> **SYNTHETIC SOURCE.** Entirely invented email thread, invented people, invented company. Captured only for the GL-006 schema-validation proof ([[tsk-2026-07-12-002-synthetic-client-delivery-engagement-proof]]). Immutable from this point — never edit this file after capture; see [[SOP-010-warden-extract-source-to-evidence-pack]].

**Captured:** 2026-04-22 through 2026-05-06
**Participants:** Marcus Webb (Meridian, Store #14), Priya Shah (internal), Daniel Osei (internal), Elena Vasquez (Meridian)

---

**From:** Marcus Webb
**Date:** 2026-04-22, 13:12
**Subject:** POS terminals dropping transactions during lunch rush

Priya — since we went live with the new terminals in Store #14 on Monday, we've had transactions fail to sync back to head office during our lunch rush (roughly 12-1:30pm) on three separate days this week. Tills show "pending sync," then the transaction just disappears from the daily report. Cashiers are having to re-ring some sales. This is a real problem for us, not a one-off.

---

**From:** Priya Shah
**Date:** 2026-04-23, 09:40
**Subject:** RE: POS terminals dropping transactions during lunch rush

Marcus — thanks for flagging, and sorry for the disruption. I pulled the terminal logs overnight: I can confirm the sync failures are real and are happening exactly when the store's network utilization spikes (matches your lunch-rush timing). The current firmware (v3.1) has no local queue — if the sync call fails, the transaction is dropped rather than retried. This is a demonstrated defect, not a one-off glitch. Logging this as a critical issue on our register today.

---

**From:** Priya Shah
**Date:** 2026-04-24, 16:05
**Subject:** RE: POS terminals dropping transactions during lunch rush — proposed fix

Daniel, Marcus — I've spoken to Zentra Systems (terminal vendor) support. They confirm firmware v3.2 (due for release next week) adds offline transaction queuing — terminals will hold failed syncs locally and retry automatically rather than dropping them. Recommend we apply v3.2 to all six pilot terminals in Store #14 as soon as it's available, and validate over a full trading week before we call the pilot stable. This runs on the store's existing network segment (VLAN 40), same as today — no infrastructure change needed on our side.

---

**From:** Daniel Osei
**Date:** 2026-04-24, 17:20
**Subject:** RE: POS terminals dropping transactions during lunch rush — proposed fix

Agreed — please proceed with the v3.2 firmware update to Store #14 as soon as Zentra ships it, and add a validation week to the pilot's done-state before we sign this work package off as complete.

---

**From:** Priya Shah
**Date:** 2026-05-04, 11:00
**Subject:** RE: POS terminals dropping transactions during lunch rush — v3.2 deployed

Firmware v3.2 deployed to all six Store #14 terminals on 2026-05-02. Zero sync failures logged over the past two trading days, including yesterday's lunch rush. Marking this issue resolved on our side, pending the full validation week.

---

**From:** Elena Vasquez
**Date:** 2026-05-06, 10:15
**Subject:** RE: POS terminals dropping transactions during lunch rush — timeline impact

Thanks all — given the week we lost diagnosing and fixing this, and given how important a stable pilot is before we go anywhere near the other 39 stores, I'm comfortable agreeing to push the pilot's stability window out by two weeks. Daniel, please make sure the flagship store team and I are kept posted on the revised date so we can plan the steering update around it.

---

**From:** Daniel Osei
**Date:** 2026-05-06, 11:02
**Subject:** RE: POS terminals dropping transactions during lunch rush — timeline impact

Confirmed, thank you Elena. We'll extend the pilot stability window by two weeks and I'll make sure you and Marcus's team have the revised timeline well ahead of the next steering call.
