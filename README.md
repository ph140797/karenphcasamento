# Karen & Paulo Henrique Wedding Site

Static wedding site prepared for Netlify hosting with:

- Netlify Functions under `/api/*`
- Stripe Checkout for gift payments
- Admin dashboard at `/admin`
- Supabase storage for paid gifts, RSVPs, and admin data
- Deploy migration hook through `npm run build`

## Netlify Environment Variables

Set these in Netlify site settings:

- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `ADMIN_TOKEN`
- `URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

For deploy-time migrations, also set one of these options:

- `SUPABASE_DB_URL`, recommended
- or `SUPABASE_ACCESS_TOKEN` plus `SUPABASE_PROJECT_REF`

The Supabase API keys can read/write through the app, but migrations require database or management API access because PostgREST cannot create tables.

## Supabase Migrations

SQL migrations live in `supabase/migrations`. Netlify runs them during deploy through:

```text
npm run build
```

Locally:

```text
npm run migrate
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

## Admin

Open:

```text
/admin
```

Use `ADMIN_TOKEN` as the password. The dashboard shows paid gifts, pending checkouts, total paid amount, and RSVP guest count.
