-- Context Outbox delivery hardening. Unique enqueue prevents duplicate ROWS, but delivery itself
-- (select queued → call Honcho → mark delivered) had a crash/concurrency window: two workers could
-- both deliver one packet, or a crash after Honcho accepted but before 'delivered' was recorded
-- would re-send on retry. Add an atomic single-worker CLAIM + a fail-safe reconcile state.
-- Idempotent; safe to re-run.

set search_path to obsidiwikai, public;

-- Claim/lease + a terminal "we cannot safely retry — human verify" state.
alter type obsidiwikai.packet_state add value if not exists 'delivering';
alter type obsidiwikai.packet_state add value if not exists 'needs_reconcile';

alter table obsidiwikai.context_packet add column if not exists claimed_at timestamptz;
