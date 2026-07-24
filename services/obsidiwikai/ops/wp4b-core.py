#!/usr/bin/env python3
"""Pinned LightRAG 1.5.4 helper for additive WP4B re-mining.

Modes:
  prove-create-edit   isolated create -> edit/backfill -> retrieval proof
  extract             isolated lens-steered extraction into a frozen JSON bundle
  freeze-authoritative read-only snapshot of the production source contribution

The isolated modes must run with a disposable working directory and without
Neo4j credentials or a production storage mount.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

SEP = "<SEP>"
PINNED_CORE = "1.5.4"


def dump(path: str, value: Any) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def load(path: str) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def split_refs(value: Any) -> list[str]:
    return [item for item in str(value or "").split(SEP) if item]


def unique(values: list[str]) -> list[str]:
    return list(dict.fromkeys(value for value in values if value))


def exact_spans(text: str, chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Recover deterministic full-document character spans for stored chunks."""
    out: list[dict[str, Any]] = []
    cursor = 0
    for chunk in sorted(chunks, key=lambda value: int(value.get("chunk_order_index", 0))):
        content = str(chunk.get("content") or "")
        start = text.find(content, max(0, cursor - 512))
        if start < 0:
            start = text.find(content)
        if start < 0:
            raise RuntimeError(f"chunk {chunk.get('_id') or chunk.get('id')} is not an exact source substring")
        end = start + len(content)
        cursor = end
        out.append(
            {
                "chunk_id": chunk.get("_id") or chunk.get("id"),
                "chunk_order_index": int(chunk.get("chunk_order_index", 0)),
                "tokens": chunk.get("tokens"),
                "start_char": start,
                "end_char": end,
                "content": content,
                "file_path": chunk.get("file_path"),
                "full_doc_id": chunk.get("full_doc_id"),
            }
        )
    return out


def require_isolated(workdir: str) -> None:
    path = Path(workdir).resolve()
    if not str(path).startswith(("/tmp/", "/var/tmp/")):
        raise RuntimeError(f"isolated workdir must live under /tmp or /var/tmp, got {path}")
    forbidden = [name for name in ("NEO4J_URI", "NEO4J_PASSWORD", "NEO4J_USERNAME", "NEO4J_USER") if os.getenv(name)]
    if forbidden:
        raise RuntimeError(f"isolated mode refuses production graph credentials: {', '.join(forbidden)}")


def api_key() -> str:
    value = os.getenv("OPENAI_API_KEY") or os.getenv("LLM_BINDING_API_KEY")
    if not value:
        raise RuntimeError("OPENAI_API_KEY or LLM_BINDING_API_KEY is required")
    return value


async def local_rag(workdir: str, guidance: str):
    require_isolated(workdir)
    from lightrag import LightRAG
    from lightrag.llm.openai import openai_complete_if_cache, openai_embed
    from lightrag.utils import EmbeddingFunc

    key = api_key()
    llm_model = os.getenv("WP4B_LLM_MODEL", "gpt-5-mini")
    embedding_model = os.getenv("WP4B_EMBEDDING_MODEL", "text-embedding-3-large")
    embedding_dim = int(os.getenv("WP4B_EMBEDDING_DIM", "3072"))
    llm_host = os.getenv("WP4B_LLM_HOST") or os.getenv("LLM_BINDING_HOST") or "https://api.openai.com/v1"
    embedding_host = (
        os.getenv("WP4B_EMBEDDING_HOST")
        or os.getenv("EMBEDDING_BINDING_HOST")
        or "https://api.openai.com/v1"
    )

    async def complete(prompt, system_prompt=None, history_messages=None, **kwargs):
        kwargs.pop("model", None)
        return await openai_complete_if_cache(
            llm_model,
            prompt,
            system_prompt=system_prompt,
            history_messages=history_messages or [],
            base_url=llm_host,
            api_key=key,
            **kwargs,
        )

    raw_embed = openai_embed.func if isinstance(openai_embed, EmbeddingFunc) else openai_embed

    async def embed(texts, context="document"):
        return await raw_embed(
            texts=texts,
            model=embedding_model,
            base_url=embedding_host,
            api_key=key,
            context=context,
        )

    embedding = EmbeddingFunc(
        embedding_dim=embedding_dim,
        max_token_size=8192,
        send_dimensions=False,
        model_name=embedding_model,
        supports_asymmetric=True,
        func=embed,
    )
    rag = LightRAG(
        working_dir=workdir,
        workspace="wp4b_temp",
        graph_storage="NetworkXStorage",
        kv_storage="JsonKVStorage",
        doc_status_storage="JsonDocStatusStorage",
        vector_storage="NanoVectorDBStorage",
        llm_model_func=complete,
        llm_model_name=llm_model,
        embedding_func=embedding,
        embedding_batch_num=32,
        embedding_func_max_async=4,
        default_embedding_timeout=120,
        enable_llm_cache=False,
        enable_llm_cache_for_entity_extract=False,
        entity_extract_max_gleaning=2,
        addon_params={
            "language": "English",
            "entity_types_guidance": guidance,
        },
    )
    await rag.initialize_storages()
    return rag, {
        "core": PINNED_CORE,
        "llm_model": llm_model,
        "embedding_model": embedding_model,
        "embedding_dim": embedding_dim,
    }


async def finalize(rag) -> None:
    await rag.finalize_storages()


async def proof(args) -> dict[str, Any]:
    from lightrag import QueryParam
    from lightrag.utils import compute_mdhash_id, make_relation_chunk_key, make_relation_vdb_ids

    guidance = (
        "Perform broad extraction. Classify people, organisations, concepts, methods, data, "
        "artifacts and relationships without suppressing material outside any current interest."
    )
    rag, model = await local_rag(args.workdir, guidance)
    content = (
        "WP4B Provenance Beacon Alpha works with WP4B Provenance Beacon Beta. "
        "Their verified relation exists solely to prove chunk-grounded additive graph writes."
    )
    file_path = "wp4b-isolated-proof"
    source_token = "proof-source-token"
    full_doc_id = "doc-wp4b-isolated-proof"
    try:
        await rag.ainsert_custom_kg(
            {"chunks": [{"content": content, "source_id": source_token, "file_path": file_path}]},
            full_doc_id=full_doc_id,
        )
        chunk_id = compute_mdhash_id(content, prefix="chunk-")
        alpha = "WP4B Provenance Beacon Alpha"
        beta = "WP4B Provenance Beacon Beta"
        common = {"source_id": chunk_id, "file_path": file_path}
        await rag.acreate_entity(alpha, {**common, "description": "An isolated provenance proof entity.", "entity_type": "Concept"})
        await rag.acreate_entity(beta, {**common, "description": "The second isolated provenance proof entity.", "entity_type": "Concept"})
        await rag.acreate_relation(
            alpha,
            beta,
            {**common, "description": "Alpha works with Beta in the isolated proof.", "keywords": "provenance,proof", "weight": 1.0},
        )

        # Pinned 1.5.4 create wrappers omit reverse-index handles. A verified
        # edit with the same provenance backfills those indexes.
        await rag.aedit_entity(alpha, common, allow_rename=False)
        await rag.aedit_entity(beta, common, allow_rename=False)
        await rag.aedit_relation(alpha, beta, common)

        alpha_reverse = await rag.entity_chunks.get_by_id(alpha)
        beta_reverse = await rag.entity_chunks.get_by_id(beta)
        relation_key = make_relation_chunk_key(alpha, beta)
        relation_reverse = await rag.relation_chunks.get_by_id(relation_key)
        entity_vector = await rag.entities_vdb.get_by_id(compute_mdhash_id(alpha, prefix="ent-"))
        relation_vectors = await rag.relationships_vdb.get_by_ids(make_relation_vdb_ids(alpha, beta))
        text_chunk = await rag.text_chunks.get_by_id(chunk_id)
        retrieval = await rag.aquery_data(
            "WP4B Provenance Beacon Alpha Beta",
            QueryParam(
                mode="local",
                only_need_context=True,
                top_k=10,
                chunk_top_k=10,
                hl_keywords=["WP4B Provenance Beacon"],
                ll_keywords=[alpha, beta],
                include_references=True,
            ),
        )
        retrieval_blob = json.dumps(retrieval, ensure_ascii=False)
        checks = {
            "alpha_reverse": chunk_id in (alpha_reverse or {}).get("chunk_ids", []),
            "beta_reverse": chunk_id in (beta_reverse or {}).get("chunk_ids", []),
            "relation_reverse": chunk_id in (relation_reverse or {}).get("chunk_ids", []),
            "entity_vector": chunk_id in split_refs((entity_vector or {}).get("source_id")),
            "relation_vector": any(chunk_id in split_refs((item or {}).get("source_id")) for item in relation_vectors),
            "text_chunk": (text_chunk or {}).get("content") == content,
            "retrieval_entity": alpha in retrieval_blob and beta in retrieval_blob,
            "retrieval_provenance": file_path in retrieval_blob or chunk_id in retrieval_blob,
        }
        result = {
            "passed": all(checks.values()),
            "checks": checks,
            "chunk_id": chunk_id,
            "file_path": file_path,
            "model": model,
        }
        if not result["passed"]:
            raise RuntimeError("isolated create/edit provenance proof failed: " + json.dumps(checks))
        return result
    finally:
        await finalize(rag)


def normalize_node(item: dict[str, Any]) -> dict[str, Any]:
    props = dict(item.get("properties") or item)
    name = props.get("entity_id") or props.get("entity_name") or item.get("id")
    return {
        "name": name,
        "entity_type": props.get("entity_type"),
        "description": props.get("description") or "",
        "source_ids": split_refs(props.get("source_id")),
        "file_paths": split_refs(props.get("file_path")),
        "properties": props,
    }


def normalize_edge(item: dict[str, Any]) -> dict[str, Any]:
    props = dict(item.get("properties") or item)
    source = item.get("source") or props.get("src_id") or props.get("source")
    target = item.get("target") or props.get("tgt_id") or props.get("target")
    return {
        "source": source,
        "target": target,
        "description": props.get("description") or "",
        "keywords": props.get("keywords") or "",
        "weight": props.get("weight", 1.0),
        "source_ids": split_refs(props.get("source_id")),
        "file_paths": split_refs(props.get("file_path")),
        "properties": props,
    }


async def extract(args) -> dict[str, Any]:
    request = load(args.request)
    text = str(request["faithful_clean"])
    doc_id = str(request["document_id"])
    file_path = str(request["file_path"])
    lens = request.get("lens") or {}
    additions = request.get("approved_additions") or []
    guidance = """Perform broad semantic discovery across the complete source first. Do not discard
important material merely because it is outside the current interest lens. Identify source-grounded
entities, concepts, claims, methods, evidence and relationships.

Then give additional attention to this bounded, Warwick-approved lens expansion:
%s

The lens expands attention; it must not suppress broad discovery. Extract only material genuinely
present in the supplied source. Prefer specific concepts and relationships supported by the text."""
    guidance = guidance % json.dumps({"approved_additions": additions, "lens": lens}, ensure_ascii=False)
    rag, model = await local_rag(args.workdir, guidance)
    try:
        await rag.ainsert(text, ids=doc_id, file_paths=file_path)
        status = await rag.doc_status.get_by_id(doc_id)
        status_value = getattr((status or {}).get("status"), "value", (status or {}).get("status"))
        if not status or str(status_value).lower() != "processed":
            raise RuntimeError(f"temporary extraction did not process {doc_id}: {status}")
        chunk_ids = status.get("chunks_list") or []
        chunks = [item for item in await rag.text_chunks.get_by_ids(chunk_ids) if item]
        nodes = [normalize_node(item) for item in await rag.chunk_entity_relation_graph.get_all_nodes()]
        edges = [normalize_edge(item) for item in await rag.chunk_entity_relation_graph.get_all_edges()]
        spans = exact_spans(text, chunks)
        span_ids = {item["chunk_id"] for item in spans}
        for node in nodes:
            node["evidence"] = [item for item in spans if item["chunk_id"] in node["source_ids"]]
        for edge in edges:
            edge["evidence"] = [item for item in spans if item["chunk_id"] in edge["source_ids"]]
        if any(ref not in span_ids for item in [*nodes, *edges] for ref in item["source_ids"]):
            raise RuntimeError("temporary graph contains provenance outside the frozen source chunks")
        return {
            "kind": "wp4b_candidate_bundle",
            "source_id": request["source_id"],
            "file_path": file_path,
            "document_id": doc_id,
            "faithful_clean_sha256": sha256_text(text),
            "lens_fingerprint": request["lens_fingerprint"],
            "extraction_profile_version": request["extraction_profile_version"],
            "approved_additions": additions,
            "lens": lens,
            "model": model,
            "chunks": spans,
            "entities": nodes,
            "relationships": edges,
            "counts": {"chunks": len(spans), "entities": len(nodes), "relationships": len(edges)},
        }
    finally:
        await finalize(rag)


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def vdb_index(path: Path, name_key: str, pair: bool = False) -> dict[Any, dict[str, Any]]:
    raw = read_json(path)
    out: dict[Any, dict[str, Any]] = {}
    for item in raw.get("data", []):
        if pair:
            key = tuple(sorted((item.get("src_id"), item.get("tgt_id"))))
        else:
            key = item.get(name_key)
        if key:
            out[key] = {field: value for field, value in item.items() if field not in {"vector", "__vector__"}}
    return out


def authoritative(args) -> dict[str, Any]:
    from neo4j import GraphDatabase
    from lightrag.utils import make_relation_chunk_key

    storage = Path(args.storage_dir)
    statuses = read_json(storage / "kv_store_doc_status.json")
    docs = read_json(storage / "kv_store_full_docs.json")
    chunks_store = read_json(storage / "kv_store_text_chunks.json")
    entity_chunks = read_json(storage / "kv_store_entity_chunks.json")
    relation_chunks = read_json(storage / "kv_store_relation_chunks.json")
    entity_vdb = vdb_index(storage / "vdb_entities.json", "entity_name")
    relation_vdb = vdb_index(storage / "vdb_relationships.json", "", pair=True)
    document = next(
        ({"id": doc_id, **value} for doc_id, value in statuses.items() if value.get("file_path") == args.file_path),
        None,
    )
    if not document:
        raise RuntimeError(f"no authoritative document with file_path={args.file_path}")
    doc_id = document["id"]
    full_doc = docs.get(doc_id)
    if not full_doc:
        raise RuntimeError(f"authoritative full document missing: {doc_id}")
    chunk_ids = document.get("chunks_list") or [
        key for key, value in chunks_store.items() if value.get("full_doc_id") == doc_id
    ]
    chunks = [{"_id": key, **chunks_store[key]} for key in chunk_ids if key in chunks_store]
    spans = exact_spans(full_doc["content"], chunks)

    label = os.getenv("NEO4J_WORKSPACE", "owai_rebuild_v1")
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", label):
        raise RuntimeError(f"unsafe Neo4j workspace label: {label}")
    uri = os.getenv("NEO4J_URI")
    user = os.getenv("NEO4J_USERNAME") or os.getenv("NEO4J_USER")
    password = os.getenv("NEO4J_PASSWORD")
    if not uri or not user or not password:
        raise RuntimeError("authoritative freeze requires Neo4j read credentials")
    driver = GraphDatabase.driver(uri, auth=(user, password))
    with driver.session() as session:
        node_rows = session.run(
            f"MATCH (n:`{label}`) RETURN properties(n) AS properties"
        ).data()
        edge_rows = session.run(
            f"MATCH (a:`{label}`)-[r]->(b:`{label}`) "
            "RETURN a.entity_id AS source,b.entity_id AS target,properties(r) AS properties"
        ).data()
    driver.close()
    catalog_entities = [normalize_node(row) for row in node_rows]
    catalog_relationships = [normalize_edge(row) for row in edge_rows]
    source_entities = [item for item in catalog_entities if args.file_path in item["file_paths"]]
    source_relationships = [item for item in catalog_relationships if args.file_path in item["file_paths"]]
    for item in catalog_entities:
        item["reverse_chunks"] = (entity_chunks.get(item["name"]) or {}).get("chunk_ids", [])
        item["vector"] = entity_vdb.get(item["name"])
    for item in catalog_relationships:
        pair = tuple(sorted((item["source"], item["target"])))
        item["reverse_chunks"] = (relation_chunks.get(make_relation_chunk_key(*pair)) or {}).get("chunk_ids", [])
        item["vector"] = relation_vdb.get(pair)
    result = {
        "kind": "wp4b_authoritative_snapshot",
        "source_id": args.source_id,
        "file_path": args.file_path,
        "document": {
            field: value
            for field, value in document.items()
            if field not in {"content_summary", "metadata"}
        },
        "faithful_clean_sha256": sha256_text(full_doc["content"]),
        "faithful_clean_chars": len(full_doc["content"]),
        "chunks": spans,
        "entities": source_entities,
        "relationships": source_relationships,
        "counts": {
            "chunks": len(spans),
            "entities": len(source_entities),
            "relationships": len(source_relationships),
        },
    }
    if args.include_catalog:
        result["catalog"] = {"entities": catalog_entities, "relationships": catalog_relationships}
    return result


async def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="mode", required=True)
    prove_parser = sub.add_parser("prove-create-edit")
    prove_parser.add_argument("--workdir", required=True)
    prove_parser.add_argument("--output", required=True)
    extract_parser = sub.add_parser("extract")
    extract_parser.add_argument("--request", required=True)
    extract_parser.add_argument("--workdir", required=True)
    extract_parser.add_argument("--output", required=True)
    freeze_parser = sub.add_parser("freeze-authoritative")
    freeze_parser.add_argument("--source-id", required=True)
    freeze_parser.add_argument("--file-path", required=True)
    freeze_parser.add_argument("--storage-dir", default="/app/data/rag_storage")
    freeze_parser.add_argument("--include-catalog", action="store_true")
    freeze_parser.add_argument("--output", required=True)
    args = parser.parse_args()

    import importlib.metadata as metadata

    version = metadata.version("lightrag-hku")
    if version != PINNED_CORE:
        raise RuntimeError(f"WP4B requires pinned LightRAG {PINNED_CORE}; found {version}")
    if args.mode == "prove-create-edit":
        result = await proof(args)
    elif args.mode == "extract":
        result = await extract(args)
    else:
        result = authoritative(args)
    dump(args.output, result)
    print(json.dumps({"mode": args.mode, "output": args.output, "counts": result.get("counts"), "passed": result.get("passed")}))


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as exc:
        print(f"WP4B CORE FAILED: {exc}", file=sys.stderr)
        raise
