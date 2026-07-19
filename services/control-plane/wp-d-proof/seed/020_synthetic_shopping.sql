-- =============================================================================
-- BUILD-014 WP-D increment 1 — SYNTHETIC shopping lists                 (author: mack)
--
-- A couple of clearly-SYNTHETIC shopping lists + items, in the `public` schema so
-- Directus manages them natively as first-class collections.
--
-- !! DECISION #4 DEFAULT — SYNTHETIC / DEV DATA ONLY. !!
--   NO real AsdAIr / household / entrusted data touches this table, Directus, or any
--   committed file. The owner labels below are a DEV PERSONA ("Mum (dev persona)"),
--   NOT a real person. Every row carries is_synthetic = true. Live household data
--   would require Warwick's explicit OK + RLS/rollback and is out of scope here.
-- =============================================================================

begin;

drop table if exists public.list_items cascade;
drop table if exists public.lists cascade;

create table public.lists (
  id           integer generated always as identity primary key,
  owner_label  text not null,
  list_name    text not null,
  is_synthetic boolean not null default true,
  note         text,
  created_at   timestamptz not null default now()
);

create table public.list_items (
  id           integer generated always as identity primary key,
  list_id      integer not null references public.lists (id) on delete cascade,
  item_name    text not null,
  quantity     text,
  is_checked   boolean not null default false,
  is_synthetic boolean not null default true,
  created_at   timestamptz not null default now()
);

create index list_items_list_idx on public.list_items (list_id);

comment on table public.lists is 'SYNTHETIC / DEV shopping lists (WP-D proof). No real household data — decision #4 default.';
comment on table public.list_items is 'SYNTHETIC / DEV shopping list items (WP-D proof). No real household data.';

insert into public.lists (owner_label, list_name, note) values
  ('SYNTHETIC — "Mum" (dev persona, not a real person)', 'Weekly groceries', 'Dev fixture list for the WP-D cockpit proof'),
  ('SYNTHETIC — "Mum" (dev persona, not a real person)', 'Hardware store', 'Dev fixture list for the WP-D cockpit proof');

insert into public.list_items (list_id, item_name, quantity, is_checked)
select l.id, i.item_name, i.quantity, i.is_checked
from public.lists l
join (values
  ('Weekly groceries', 'Oat milk',      '2 cartons', false),
  ('Weekly groceries', 'Bananas',       '1 bunch',   false),
  ('Weekly groceries', 'Wholemeal bread','1 loaf',   true),
  ('Weekly groceries', 'Cheddar',       '400g',      false),
  ('Hardware store',   'AA batteries',  '1 pack',    false),
  ('Hardware store',   'Masking tape',  '2 rolls',   false),
  ('Hardware store',   'LED bulb (B22)','3',         false)
) as i(list_name, item_name, quantity, is_checked)
  on i.list_name = l.list_name;

commit;
