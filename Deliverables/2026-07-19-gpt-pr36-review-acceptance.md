# GPT review acceptance criteria — PR #36 (AsdAIr core) [GPT-PR36-PR37-FINAL-DELTA-0001]

PR #36 REQUEST-CHANGES on four bounded items. Acceptance = all four correctly implemented, no live migrations / no live data / no scope broadening, synthetic-only tests, CI verified in GitHub Actions.

1. **GitHub CI for services/asdair**: path-filtered workflow; `npm ci`; `node --test`; secret scan unchanged.
2. **Real clean-Postgres integration job/test**: start a throwaway Postgres; apply `services/asdair/db/001_asdair_schema.sql` from scratch; insert SYNTHETIC-only household/budget/product/rule/list/list-item rows; connect through `ASDAIR_DB_URL`; prove `data.js` loads them and `planner.js` produces the expected plan; no real household data or live Supabase.
3. **Nullable global uniqueness**: enforce exactly one global budget row where `household_id IS NULL`; prevent duplicate global product mappings for the same normalised list term; retain household-specific uniqueness; Postgres tests proving duplicates rejected.
4. **Explicit product-id household scoping**: `matched_product_id` resolves only to a global product or the active household; an id belonging to another household must NOT be accepted; fail safely as `needs_decision` / scope-mismatch; regression test.

Also: update PR #36 body to final test counts + exact CI evidence. Constraints: do not broaden AsdAIr, apply live migrations, alter live data, merge, or begin BUILD-002 B.
