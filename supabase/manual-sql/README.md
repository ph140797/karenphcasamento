Manual Supabase SQL scripts

Run these scripts in the Supabase SQL Editor when you want to apply schema changes manually.

Recommended order:

1. `001_wedding_schema.sql`
2. `002_pix_and_gift_admin.sql`
3. `003_seed_gifts.sql`

You can also run `all.sql`, which contains the schema scripts in order.

`003_seed_gifts.sql` inserts or updates the gifts scraped from the original static catalog.
