# Karen & Paulo Henrique Wedding Site

Static wedding site prepared for Netlify hosting with: 

- Netlify Functions under `/api/*`
- Stripe Checkout for credit card gift payments
- Manual Pix checkout with QR Code registration
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
- `SUPABASE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `PIX_KEY`
- `PIX_QR_CODE_IMAGE_URL`

For deploy-time migrations, also set one of these options:

- `SUPABASE_DB_URL`, recommended
- or `SUPABASE_ACCESS_TOKEN` plus `SUPABASE_PROJECT_REF`

For Supabase server access, use `SUPABASE_SECRET_KEY` for new Supabase API keys, or `SUPABASE_SERVICE_ROLE_KEY` for legacy keys. The Supabase API keys can read/write through the app, but migrations require database or management API access because PostgREST cannot create tables.

The public site points to `/assets/pix-qr-code.png` for the Pix QR image. Add the real QR image there, or update both `PIX_QR_CODE_IMAGE_URL` and the `PIX_QR_CODE_IMAGE` value in `index.html`.

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
It also lets you register gifts with image, name, value, and special flag. Pix orders are saved as `pix_pending`; after checking the bank receipt, use "Marcar pago" in admin so the gifts become unavailable on the public page.
