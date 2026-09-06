Scripts SQL manuais do Supabase

Rode no SQL Editor do Supabase quando quiser aplicar o schema manualmente
(alternativa ao `npm run migrate`, que usa `supabase/migrations/`).

Ordem recomendada:

1. `001_wedding_schema.sql` — tabelas wedding_orders, wedding_rsvps, wedding_gifts
2. `002_pix_and_gift_admin.sql` — colunas de Pix e admin de presentes
3. `003_asaas_and_security.sql` — colunas da Asaas e RLS ligado
4. `004_seed_gifts.sql` — cadastra o catálogo padrão de presentes

`all.sql` contém os scripts de schema (001 a 003) em ordem, sem o seed.

`004_seed_gifts.sql` é gerado a partir de `netlify/functions/_gift-catalog.js`
com `npm run seed:gifts:sql`. Também dá para cadastrar pelo painel /admin
(botão "Importar catálogo do site") ou com `npm run seed:gifts`.
