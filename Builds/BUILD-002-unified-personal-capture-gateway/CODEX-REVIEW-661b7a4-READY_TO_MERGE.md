Warwick, Round 6 passes.

Reviewer independence: **Same-model review — not independently verified.**

Bound HEAD verified as `661b7a4cbb774d2a799b7aa7129fad229398f495`.

The Round-5 regression is genuinely fixed:

- Filing exceptions set `durableFailure:true`.
- The acknowledgement honestly says “Couldn't record that — please tap again.” with `show_alert:true`.
- `pollOnce` checks the failure before offset persistence, holds the cursor, and breaks the batch.
- Therefore, the failed tap and all later updates remain available for redelivery.
- Successful filings and stated benign outcomes continue to advance normally.
- The two new tests correctly cover offset-held-on-failure and offset-advanced-on-success.
- Existing callback handling, authorization, redaction, and non-decision paths remain structurally unchanged.

No new regression or remaining genuine correctness, accidental-leak, availability, or audit blocker was found under normal single-user first-party use. The two Warwick-gated activation residuals were excluded as instructed.

The asserted test results were assessed for code consistency only and were not re-executed. The mandatory SOP-018 report/session-log files could not be written because the workspace is read-only.

READY_TO_MERGE
