-- 001_wedding_schema.sql

create table if not exists public.wedding_orders (
  id text primary key,
  status text not null default 'pending',
  amount_total integer not null default 0,
  currency text not null default 'brl',
  payment_method text,
  items jsonb not null default '[]'::jsonb,
  stripe_session_id text unique,
  stripe_payment_intent text,
  pix_payload text,
  pix_qr_code_image text,
  customer_email text,
  customer_name text,
  gift_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wedding_orders_status_idx on public.wedding_orders(status);
create index if not exists wedding_orders_created_at_idx on public.wedding_orders(created_at desc);

create table if not exists public.wedding_rsvps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  guests jsonb not null default '[]'::jsonb,
  guest_count integer not null default 1,
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wedding_rsvps_created_at_idx on public.wedding_rsvps(created_at desc);

create table if not exists public.wedding_gifts (
  id text primary key,
  name text not null,
  price integer not null,
  image text,
  store text,
  special boolean not null default false,
  active boolean not null default true,
  purchased boolean not null default false,
  purchased_order_id text references public.wedding_orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wedding_gifts_active_idx on public.wedding_gifts(active);
create index if not exists wedding_gifts_purchased_idx on public.wedding_gifts(purchased);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists wedding_orders_updated_at on public.wedding_orders;
create trigger wedding_orders_updated_at
before update on public.wedding_orders
for each row execute function public.set_updated_at();

drop trigger if exists wedding_rsvps_updated_at on public.wedding_rsvps;
create trigger wedding_rsvps_updated_at
before update on public.wedding_rsvps
for each row execute function public.set_updated_at();

drop trigger if exists wedding_gifts_updated_at on public.wedding_gifts;
create trigger wedding_gifts_updated_at
before update on public.wedding_gifts
for each row execute function public.set_updated_at();

-- 002_pix_and_gift_admin.sql

alter table if exists public.wedding_orders
  add column if not exists payment_method text,
  add column if not exists pix_payload text,
  add column if not exists pix_qr_code_image text;

alter table if exists public.wedding_gifts
  add column if not exists special boolean not null default false,
  add column if not exists purchased boolean not null default false,
  add column if not exists purchased_order_id text references public.wedding_orders(id) on delete set null;

-- 003_asaas_and_security.sql

-- Colunas usadas pelo Checkout/Webhook da Asaas (create-checkout-session.js, asaas-webhook.js).
alter table if exists public.wedding_orders
  add column if not exists asaas_checkout_id text,
  add column if not exists asaas_payment_id text,
  add column if not exists asaas_event_id text,
  add column if not exists asaas_payment_status text;

create index if not exists wedding_orders_asaas_checkout_idx on public.wedding_orders(asaas_checkout_id);

-- Segurança: RLS ligado e sem policies. Só a chave secreta/service_role usada nas
-- Netlify Functions acessa as tabelas; a chave anon/publishable não lê nada.
alter table if exists public.wedding_orders enable row level security;
alter table if exists public.wedding_rsvps enable row level security;
alter table if exists public.wedding_gifts enable row level security;

-- 004_order_installments.sql

-- Registro do parcelamento liberado em cada pedido (create-checkout-session.js).
alter table if exists public.wedding_orders
  add column if not exists installments_allowed boolean not null default false,
  add column if not exists max_installments integer not null default 1;

-- 005_order_fee_breakdown.sql

-- Repasse da taxa de parcelamento: valor dos presentes, taxa cobrada e parcelas escolhidas.
alter table if exists public.wedding_orders
  add column if not exists amount_gifts integer,
  add column if not exists amount_fee integer not null default 0,
  add column if not exists installments integer not null default 1;

