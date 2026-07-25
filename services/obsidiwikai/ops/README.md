# View servers (deployed on the Fusion247 box, Tailscale-reachable)

Two live "views into the one Brain", both querying the production Neo4j/LightRAG directly
(no login, no Cypher). Managed as docker containers (`--restart unless-stopped`) on the box.

| view | container | port | URL (tailnet) | serves |
|---|---|---|---|---|
| 🕸️ Graph | `fusion-graph` | 8700 | http://100.101.240.85:8700 | interactive force-graph; search + tap-to-explore |
| 📋 "So what" report | `fusion-report` | 8701 | http://100.101.240.85:8701 | dashboard + per-source: why-it-matters, what changed, new/connected, WP5 suggestions, evidence, your-call→Honcho |

Both run from the `lightrag-neo4j:1.5.4-pinned` image (report adds `psycopg2-binary`), env in
`/root/report.env` and inline for graph. The report bind source is `/root/report_server.py` (underscore) and
the transcript store is `lightrag_rebuild_data:/data:ro`. A code-only redeploy can replace that file and restart
`fusion-report`; adding or changing an env-file variable requires controlled container recreation because `docker restart`
does not reload `--env-file`. Preserve image, port 8701, network `coolify`, mounts, and `unless-stopped`.

Surfaces are joined: Directus/cockpit = ops/review queue · report = readable intelligence ·
Neo4j graph = exploration · Honcho = evolving Warwick lens.
