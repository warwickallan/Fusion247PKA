# View servers (deployed on the Fusion247 box, Tailscale-reachable)

Two live "views into the one Brain", both querying the production Neo4j/LightRAG directly
(no login, no Cypher). Managed as docker containers (`--restart unless-stopped`) on the box.

| view | container | port | URL (tailnet) | serves |
|---|---|---|---|---|
| 🕸️ Graph | `fusion-graph` | 8700 | http://100.101.240.85:8700 | interactive force-graph; search + tap-to-explore |
| 📋 "So what" report | `fusion-report` | 8701 | http://100.101.240.85:8701 | dashboard + per-source: why-it-matters, what changed, new/connected, WP5 suggestions, evidence, your-call→Honcho |

Both run from the `lightrag-neo4j:1.5.4-pinned` image (report adds `psycopg2-binary`), env in
`/root/report.env` and inline for graph. `report-server.py` mounts `lightrag_rebuild_data:/data:ro`
for the transcript store. Redeploy: `scp ops/<file> box:/root/<file> && docker restart <container>`.

Surfaces are joined: Directus/cockpit = ops/review queue · report = readable intelligence ·
Neo4j graph = exploration · Honcho = evolving Warwick lens.
