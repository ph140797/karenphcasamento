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
