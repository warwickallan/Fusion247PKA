# Honcho v3 `messages/list` — pagination contract

**Author:** Pax (Senior Researcher)
**Date:** 2026-08-02
**Retrieval date for every source below:** 2026-08-02
**Status:** CONTRACT ESTABLISHED — documented, and cross-confirmed against server source and SDK source
**For:** operating-reset Phase 7 build unblock

---

## Executive summary

The contract is fully documented and it is not what we were sending. **`page`, `size` and `reverse` are QUERY-STRING parameters, not JSON body fields.** The request body accepts exactly one property: `filters`. Everything we put in the body — `size`, `page` — was silently discarded, and the server applied its defaults (`page=1`, `size=50`, `reverse=false`, oldest-first). That single fact explains all three symptoms at once.

Two corrections to our working assumptions follow from it:

- **50 is not a cap, it is the default.** The real maximum is **100** (`size` has `maximum: 100`). We never hit a cap; we never sent a size.
- **The whole session fits in one request.** 86 messages, `reverse=true`, `size=100` → one call returns the newest 100 in newest-first order. No paging loop is needed at this size.

The response envelope also carries `total` and `pages`, so paging is bounded and self-terminating — no cursor, no continuation token, no `has_more`.

---

## 1. The five questions, each labelled

### Q1 — Response envelope: exact field names

**DOCUMENTED.** The 200 response is a `fastapi_pagination` `Page` object with exactly five top-level fields:

| Field | Type | Notes |
|---|---|---|
| `items` | array of Message | the page of messages |
| `total` | integer, min 0 | total matching messages across all pages |
| `page` | integer, min 1 | the page you are on |
| `size` | integer, min 1 | the page size in effect |
| `pages` | integer, min 0 | total number of pages |

Each `items[]` element: `id`, `content`, `peer_id`, `session_id`, `metadata`, `created_at` (date-time), `workspace_id`, `token_count`.

**There is NO `has_more`, NO `next_page`, NO cursor and NO continuation token.** That is a positive finding, not a "not found": the schema is fully enumerated in the official reference and in the library's `Page` class, and those five fields are all of it.

- Primary: [Get Messages — official v3 API reference](https://honcho.dev/docs/v3/api-reference/endpoint/messages/get-messages.md)
- Cross-source (server): route decorator is `response_model=Page[schemas.Message]`, with `from fastapi_pagination import Page` — the stock class, no subclass — in [`src/routers/messages.py`](https://github.com/plastic-labs/honcho/blob/main/src/routers/messages.py)
- Cross-source (library): `class Page(BasePage[TAny])` declares `page`, `size`, `pages`; `items` and `total` come from `BasePage` — [`fastapi_pagination/default.py`](https://github.com/uriyyo/fastapi-pagination/blob/main/fastapi_pagination/default.py)
- Cross-source (SDK): the Python SDK's own page class declares `total`, `items`, `page`, `size`, `pages` — [`honcho_core/pagination.py`](https://github.com/plastic-labs/honcho-python/blob/main/src/honcho_core/pagination.py)

Four independent artefacts agree. Confidence: **High.**

### Q2 — Request fields: exact names, types, and *where they go*

**DOCUMENTED.** This is the load-bearing finding.

**Query string:**

| Param | Type | Default | Min | Max |
|---|---|---|---|---|
| `page` | integer | `1` | 1 | — |
| `size` | integer | `50` | 1 | **100** |
| `reverse` | boolean | `false` | — | — |

**Request body — one property only:**

```json
{ "filters": {} }
```

`filters` is an optional object or `null`, supporting field-level filtering and logical `AND` / `OR` / `NOT` composition.

**Not accepted, in either location:** `offset`, `cursor`, `after`, `before`, `order`, `sort`, `direction`, `limit`. Ordering is expressed *only* through the boolean `reverse`.

- Primary: [Get Messages — official v3 API reference](https://honcho.dev/docs/v3/api-reference/endpoint/messages/get-messages.md) lists `reverse`, `page`, `size` explicitly under **Query Parameters** and `filters` under **Request Body**.
- Cross-source (server): the handler signature separates them by FastAPI type — `options: schemas.MessageGet | None = Body(...)` versus `reverse: bool | None = Query(False, ...)`; `page`/`size` are injected by `add_pagination(app)` as query params. [`src/routers/messages.py`](https://github.com/plastic-labs/honcho/blob/main/src/routers/messages.py), [`src/main.py`](https://github.com/plastic-labs/honcho/blob/main/src/main.py)
- Cross-source (SDK): the official Python client builds the call with `page`, `reverse`, `size` passed to `query=` and `filters` passed to `body=`. This is decisive — the vendor's own generated client puts them in the query string. [`honcho_core/resources/.../messages.py`](https://github.com/plastic-labs/honcho-python/blob/main/src/honcho_core/resources/workspaces/sessions/messages.py)

Confidence: **High.** Three independent artefacts, including the vendor's own client.

> **This is the root cause of every symptom in the brief.** `{"size": 50, "page": 2}` in the body is not "a field name we guessed wrong" — it is a body the server ignores wholesale, because the body model has one property and it is `filters`. The identical window returned on the second call is exactly what an ignored `page` produces.

### Q3 — Default ordering

**DOCUMENTED + SOURCE-EVIDENCED: oldest-first by default.**

`reverse` defaults to `false`. In the server's query builder, `reverse=False` applies `order_by(models.Message.id.asc())` and `reverse=True` applies `order_by(models.Message.id.desc())` — consistently across all three branches of the function.

Critically, `Message.id` is **not** an opaque string: it is `Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True, autoincrement=True)` — a monotonic, database-assigned sequence. So ordering by `id` ascending **is** insertion order, which is chronological. There is no risk here of a ULID/nanoid sort that merely looks chronological.

- Primary: [Get Messages reference](https://honcho.dev/docs/v3/api-reference/endpoint/messages/get-messages.md) — `reverse` default `false`, "Whether to reverse the order of results"
- Cross-source: [`src/crud/message.py`](https://github.com/plastic-labs/honcho/blob/main/src/crud/message.py) `get_messages()` order_by branches; [`src/models.py`](https://github.com/plastic-labs/honcho/blob/main/src/models.py) `Message.id`
- Cross-source (SDK docs): the official example names the result of `session.messages(reverse=True)` as `recent_first` — [SDK Reference](https://honcho.dev/docs/v3/documentation/reference/sdk)

Confidence: **High.** And it independently corroborates our execution evidence — page 1 of 2 pages, oldest-first, is precisely "the newest reachable message is the 51st of 86".

### Q4 — Is `size` capped server-side? Is 50 the maximum?

**DOCUMENTED — and our reading of this was wrong.** `size` is `default: 50, minimum: 1, maximum: 100`. **50 is the DEFAULT; 100 is the MAXIMUM.**

The `size: 500 → 50` observation was not a server-side clamp. It was the body being discarded and the default applying. This matters practically: had `size=500` been sent as a query parameter, `fastapi_pagination` validation would have returned **HTTP 422**, not a silently clamped 50. Do not write code that assumes over-limit values are clamped — they are rejected.

- Primary: [Get Messages reference](https://honcho.dev/docs/v3/api-reference/endpoint/messages/get-messages.md) — "maximum: 100"
- Cross-source (library): `size: int = Query(50, ge=1, le=100, description="Page size")` in [`fastapi_pagination/default.py`](https://github.com/uriyyo/fastapi-pagination/blob/main/fastapi_pagination/default.py). Honcho imports stock `Page` and calls bare `add_pagination(app)` with no custom `Params`, so the library defaults are the effective contract.

Confidence: **High.** Two independent artefacts, one of them the authoritative reference.

### Q5 — Is there a better endpoint for "the latest message(s)"?

**DOCUMENTED. Two alternatives exist; for our purpose neither beats `messages/list` with `reverse=true`.**

1. **`GET /v3/workspaces/{workspace_id}/sessions/{session_id}/context`** — returns `{ id, messages, summary?, peer_representation?, peer_card? }`. It fills a token budget (`tokens`, max 100000) and allocates roughly 60% of it to *recent* messages. This is the purpose-built "give me the latest state of the conversation" endpoint, and it is the right choice if the consumer is an LLM prompt. It is the *wrong* choice if you need exact, complete, deterministic message retrieval, because what it returns is budget-shaped, not list-shaped.
2. **`GET /v3/.../sessions/{session_id}/summaries`** — short and long summaries with coverage metadata. Not raw messages.
3. **`POST /v3/.../sessions/{session_id}/search`** — semantic search, not chronological retrieval.

There is **no** `GET` variant of the message list. The reference explicitly notes list operations use `POST` so that complex filter payloads can travel in the body.

- Primary: [Get Session Context reference](https://honcho.dev/docs/v3/api-reference/endpoint/sessions/get-session-context.md)
- Cross-source: [`src/routers/sessions.py`](https://github.com/plastic-labs/honcho/blob/main/src/routers/sessions.py) route table; [DeepWiki API Reference](https://deepwiki.com/plastic-labs/honcho/4-api-reference)

Confidence: **High** for the endpoints existing and their shape. **Medium** for the "~60% of budget to recent messages" allocation figure — that came from one derived source (DeepWiki summarising the docs) and is an implementation detail likely to drift. Do not build on the 60% number.

---

## 2. The exact requests to send

**Recommended — the newest 100 messages, newest-first, in one call.** For an 86-message session this returns everything in a single request.

```
POST https://api.honcho.dev/v3/workspaces/{workspace}/sessions/{session}/messages/list?reverse=true&size=100&page=1
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{}
```

The body may be `{}`, omitted, or `{"filters": null}` — all three are valid. **Do not put `size` or `page` in the body.**

**Just the single newest message:**

```
POST .../messages/list?reverse=true&size=1&page=1
```

Body `{}`. Read `items[0]`. `total` on the same response gives the full session message count for free — useful as an independent check against our observed 86.

**Walking the entire list, oldest-first, terminating correctly:**

```
POST .../messages/list?reverse=false&size=100&page=1     -> read response.pages
POST .../messages/list?reverse=false&size=100&page=2
...
POST .../messages/list?reverse=false&size=100&page=N     where N == response.pages
```

Terminate on `page >= pages`, not on a short page and not on a repeat-detection guard. `pages` is authoritative and present on the very first response, so the loop bound is known after one call. This is also exactly the rule the vendor's own SDK uses: its `next_page_info()` returns `None` when `current_page >= pages`, otherwise `{"page": current_page + 1}`.

---

## 3. Caps, limits and gotchas for walking ~100 messages

1. **Query vs body is the whole ballgame.** Body-borne pagination fields are dropped in silence — no 400, no warning. A wrong-place parameter looks identical to a server that ignores you. This is what cost us the last cycle.
2. **`size` over 100 is a 422, not a clamp.** Validate before sending.
3. **86 messages = 1 request at `size=100`.** Any paging loop we write here is dead code for the current session size. Write it if we need generality; do not let it be the thing that blocks Phase 7.
4. **`page` is 1-based, not 0-based.** `page=0` is a 422 (`minimum: 1`).
5. **Offset pagination drifts under concurrent writes.** If messages are being appended while we walk oldest-first, later pages shift and a message can be missed or duplicated. With `reverse=true` the drift lands on the *last* page instead. For a single-shot read of 86 messages this is immaterial, but do not build a long-running incremental sync on `page` alone — filter on `created_at` or track the last seen `id`.
6. **`total` and `pages` are free correctness checks.** If `total` != 86, our count of delivered messages is wrong, not the API.
7. **Rate limits: NOT FOUND.** No published per-minute or per-hour rate limit for the Honcho API was located in the official documentation, the repository README, or the SDK sources. The SDKs implement generic retry/backoff behaviour, which implies rate limiting exists but does not document its thresholds. **Treat this as unknown, not as unlimited.** At 1–2 requests for this task the risk is negligible; assume nothing for a bulk backfill.

---

## 4. Version integrity — read this before coding

- **The server contract above is v3 and current.** The route lives under the `/v3` prefix; DeepWiki, reading the repository, states "All API endpoints are versioned with a `/v3` prefix. The current version is `3.0.11`." The official reference page is under `/docs/v3/api-reference/`.
- **FLAGGED SKEW — the published SDK repos list `/v2` paths.** `api.md` on the `main` branch of both `plastic-labs/honcho-python` and `plastic-labs/honcho-node` documents the operation as `post /v2/workspaces/{workspace_id}/sessions/{session_id}/messages/list`. Retrieved 2026-08-02.
  - **What this does and does not affect:** it affects the **path prefix only**. The parameter placement (query vs body), the field names, the defaults, the max, and the response envelope are identical in the v2 SDK and the v3 reference. I used the SDK strictly as corroborating evidence for *shape*, never for the path.
  - **Use `/v3` in the path.** That is what the v3 reference and the v3 server source both say. If a request 404s, the prefix is the first thing to check.
- Nothing in this brief is sourced from v1 documentation.

---

## 5. Methodology

Searched in this order: official docs (`honcho.dev/docs/v3/**`, reached via the site's own `llms.txt` index, which listed the exact endpoint page); the server repository `plastic-labs/honcho` (`src/routers/messages.py`, `src/crud/message.py`, `src/models.py`, `src/main.py`, `src/routers/sessions.py`) read as raw source; the official Python SDK (`honcho-python`) for request construction and page-object shape; `uriyyo/fastapi-pagination` for the underlying `Params`/`Page` definitions Honcho inherits unmodified; DeepWiki and the SDK Reference page as secondary corroboration.

`https://api.honcho.dev/openapi.json` returned **HTTP 401** — the OpenAPI document is auth-gated, so the single best artefact was unavailable. The `.md` variant of the official reference page proved an adequate substitute: it is generated from that same spec and gave the constraints verbatim (`minimum: 1, maximum: 100`).

**No live Honcho API call was made.** Per the constraint, this is documentation and source research only.

## 6. Limitations

- The endpoint reference page is generated from an OpenAPI spec I could not read directly (401). Two independent source-code artefacts agree with it on every field, which is why confidence is High regardless — but the spec itself remains unverified at first hand.
- Repository source was read from the `main` branch, which is not guaranteed to be the exact commit deployed at `api.honcho.dev`. Confidence rests on `main` and the published v3 reference agreeing.
- Rate limits are genuinely unestablished, not merely unsearched.
- The `context` endpoint's internal token allocation (the ~60% figure) is single-sourced and derived. Do not build on it.

## 7. Recommendation

Change the call to put `reverse=true&size=100&page=1` in the **query string** and send `{}` as the body. Expect all 86 messages back in one response with `total: 86`, `pages: 1`, newest first. Terminate any general loop on `page >= pages`.

Bookmark [https://honcho.dev/docs/v3/api-reference/endpoint/messages/get-messages.md](https://honcho.dev/docs/v3/api-reference/endpoint/messages/get-messages.md) — the `.md` suffix on any Honcho docs page returns a clean machine-readable version, and `https://honcho.dev/docs/llms.txt` is the full page index. That pair is the fastest route to any other Honcho endpoint contract we need.

## 8. Sources

1. [Get Messages — Honcho v3 API Reference](https://honcho.dev/docs/v3/api-reference/endpoint/messages/get-messages.md) — PRIMARY, official, generated from the OpenAPI spec
2. [Get Session Context — Honcho v3 API Reference](https://honcho.dev/docs/v3/api-reference/endpoint/sessions/get-session-context.md) — PRIMARY, official
3. [plastic-labs/honcho — `src/routers/messages.py`](https://github.com/plastic-labs/honcho/blob/main/src/routers/messages.py) — server source, Query vs Body split
4. [plastic-labs/honcho — `src/crud/message.py`](https://github.com/plastic-labs/honcho/blob/main/src/crud/message.py) — ordering
5. [plastic-labs/honcho — `src/models.py`](https://github.com/plastic-labs/honcho/blob/main/src/models.py) — `Message.id` is a monotonic BigInteger identity
6. [plastic-labs/honcho — `src/main.py`](https://github.com/plastic-labs/honcho/blob/main/src/main.py) — bare `add_pagination(app)`, `/v3` router prefix
7. [plastic-labs/honcho — `src/routers/sessions.py`](https://github.com/plastic-labs/honcho/blob/main/src/routers/sessions.py) — alternative endpoints
8. [plastic-labs/honcho-python — messages resource](https://github.com/plastic-labs/honcho-python/blob/main/src/honcho_core/resources/workspaces/sessions/messages.py) — SDK sends page/size/reverse as `query=`
9. [plastic-labs/honcho-python — `pagination.py`](https://github.com/plastic-labs/honcho-python/blob/main/src/honcho_core/pagination.py) — page envelope + next-page logic
10. [uriyyo/fastapi-pagination — `default.py`](https://github.com/uriyyo/fastapi-pagination/blob/main/fastapi_pagination/default.py) — `Query(50, ge=1, le=100)`
11. [Honcho SDK Reference](https://honcho.dev/docs/v3/documentation/reference/sdk) — `page` / `size` / `reverse` usage examples
12. [DeepWiki — plastic-labs/honcho API Reference](https://deepwiki.com/plastic-labs/honcho/4-api-reference) — secondary corroboration, `/v3`, version 3.0.11
