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
