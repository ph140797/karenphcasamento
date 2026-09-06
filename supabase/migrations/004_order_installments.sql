-- Registro do parcelamento liberado em cada pedido (create-checkout-session.js).
alter table if exists public.wedding_orders
  add column if not exists installments_allowed boolean not null default false,
  add column if not exists max_installments integer not null default 1;
