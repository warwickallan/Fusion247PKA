-- 0009 — GPT-002: implement CONTEXT-OUTBOX supersession.
-- context_packet.supersedes (a uuid pointer to the prior packet) already exists (0001), but no code
-- persisted it and there was no terminal state to retire the superseded packet into. A later
-- correction must leave no contradictory ACTIVE memory: on successful delivery of a packet that
-- carries `supersedes`, the prior packet is moved to 'superseded' (see src/core/contextOutbox.mjs).
-- Mirrors 0004's pattern for adding enum values idempotently.
alter type obsidiwikai.packet_state add value if not exists 'superseded';
