# Karen & Paulo Henrique Wedding Site

Static wedding site prepared for Netlify hosting with:

- Netlify Functions under `/api/*`
- Stripe Checkout for gift payments
- Admin dashboard at `/admin`
- Supabase storage when configured, with Netlify Blobs fallback

## Netlify Environment Variables

Set these in Netlify site settings:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `ADMIN_TOKEN`
- `URL`

Optional Supabase database:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Supabase Tables

If using Supabase, create:

```sql
create table if not exists wedding_orders (
  id text primary key,
  status text not null,
  amount_total integer not null default 0,
  currency text not null default 'brl',
  items jsonb not null default '[]'::jsonb,
  stripe_session_id text,
  customer_email text,
  customer_name text,
  gift_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists wedding_gifts (
  id text primary key,
  name text not null,
  price integer not null,
  image text,
  store text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## Stripe Webhook

Create a Stripe webhook endpoint pointing to:

```text
https://your-domain.com/api/stripe-webhook
```

Listen for:

- `checkout.session.completed`
- `checkout.session.expired`

Use the signing secret as `STRIPE_WEBHOOK_SECRET`.
