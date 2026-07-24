ChatGPT-to-Honcho Context Outbox & Acceptance Test

Decision date: 2026-07-22
Status: Product requirement recorded; implementation not yet authorised
Owner: Larry as part of the ObsidiWikAi production integration

Requirement

Warwick’s main conversational relationship is with ChatGPT. ChatGPT already holds the richest accumulated understanding of his preferences, corrections, decisions, interests and working style.

The missing direction is therefore not primarily:

Honcho tells ChatGPT who Warwick is.

It is:

ChatGPT sends selected, governed context updates to Honcho so the rest of the Fusion247 agent ecosystem can benefit from what Warwick has established here.

Current product restrictions may prevent this ChatGPT workspace from writing directly to Honcho through full MCP. ObsidiWikAi must therefore provide a controlled Context Outbox rather than waiting for unrestricted MCP access.

Proposed boundary

Warwick talks with ChatGPT
        ↓
Warwick explicitly says “Send that to Honcho”
        ↓
ChatGPT creates a compact structured context packet
        ↓
Private durable Context Outbox
        ↓
VPS worker validates, deduplicates and submits once to managed Honcho
        ↓
Supabase receipt + Directus visibility
        ↓
Fresh Honcho/Larry session can retrieve the accepted context

The transport may initially be a private GitHub outbox or a safer Supabase-backed endpoint. Larry must choose the smallest secure option that does not create a competing source of truth.

Context packet contract

Each packet should contain only the useful change:

packet_id and idempotency key;
type: preference, correction, decision, current interest, standing instruction or compact session conclusion;
concise summary;
evidence: the relevant Warwick statement or tightly bounded excerpt;
confidence: explicit or inferred;
sensitivity: ordinary, restricted or prohibited;
lifespan: permanent, temporary or review date;
source pointer to the originating conversation/session where available;
supersedes/replaces pointer where the new packet corrects earlier context.

Do not dump raw conversations, long assistant answers, tool logs, code diffs, credentials, health/family/client material or repetitive status narration into Honcho.

Authority rule

The Context Outbox is a transport and audit mechanism, not canonical knowledge.

MyPKA/Obsidian remains canonical for accepted durable knowledge.
Honcho remains contextual memory, subordinate to MyPKA.
Supabase records delivery state and receipts.
Directus shows Warwick what was queued, delivered, rejected or superseded.
ChatGPT proposes the compact packet; Warwick’s explicit trigger authorises transmission.

Acceptance test — ChatGPT teaches Honcho

The feature is accepted only when all of the following are proven end to end:

Warwick states a new non-sensitive preference or decision in ChatGPT.
Warwick explicitly says “Send that to Honcho.”
ChatGPT produces one compact packet matching the approved contract.
The packet is written to a private durable outbox without exposing credentials or private infrastructure details.
The VPS worker validates the packet and sends it to Honcho exactly once.
A durable receipt is visible in Supabase/Directus with packet ID, status, timestamp and safe error detail.
A fresh Honcho or Larry session retrieves the new context correctly.
Replaying the same packet creates no duplicate memory.
A later correction supersedes the earlier context rather than leaving contradictory active memories.
A temporary delivery failure leaves the packet safely retryable and does not lose or duplicate it.
Prohibited/sensitive content is rejected or held for explicit review.
The full path is rebuildable from GitHub/MyPKA plus Supabase state and documented secrets, without relying on an open ChatGPT session.

Smallest walking skeleton

Use one harmless explicit preference, for example:

Warwick prefers visual routing maps but does not want to configure n8n himself.

Prove:

ChatGPT packet
→ durable outbox
→ one Honcho write
→ receipt
→ fresh retrieval by Larry/Honcho

Stop after this proof. Do not connect every ChatGPT turn or bulk-export historical chats.

Build boundary

Larry owns:

final packet schema;
privacy and approval policy;
transport choice;
worker implementation;
Honcho write semantics;
receipts and Directus view;
idempotency, retry and supersession;
integration with the wider ObsidiWikAi Knowledge Compiler.

Claude’s infrastructure build may provide the hosting surface and secret store, but must not implement this product flow without Larry’s governed build authority.