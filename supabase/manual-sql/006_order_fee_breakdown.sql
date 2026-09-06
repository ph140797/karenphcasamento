-- Repasse da taxa de parcelamento: valor dos presentes, taxa cobrada e parcelas escolhidas.
alter table if exists public.wedding_orders
  add column if not exists amount_gifts integer,
  add column if not exists amount_fee integer not null default 0,
  add column if not exists installments integer not null default 1;
