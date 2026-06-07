alter table if exists public.wedding_orders
  add column if not exists payment_method text,
  add column if not exists pix_payload text,
  add column if not exists pix_qr_code_image text;

alter table if exists public.wedding_gifts
  add column if not exists special boolean not null default false,
  add column if not exists purchased boolean not null default false,
  add column if not exists purchased_order_id text references public.wedding_orders(id) on delete set null;

