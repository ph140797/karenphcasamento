// Cadastra no banco os presentes do catálogo padrão (netlify/functions/_gift-catalog.js).
//
//   npm run seed:gifts                 insere os que faltam (Supabase se configurado)
//   npm run seed:gifts -- --overwrite  também atualiza nome/preço/imagem dos existentes
//   npm run seed:gifts:sql             imprime o SQL de upsert (para o SQL Editor do Supabase)
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const args = new Set(process.argv.slice(2));

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

function seedSql() {
  const { toGiftRecords } = require('../netlify/functions/_gift-catalog');
  const columns = ['id', 'name', 'price', 'image', 'store', 'special', 'active', 'purchased'];
  const values = toGiftRecords()
    .map((gift) => `  (${columns.map((column) => sqlLiteral(gift[column])).join(', ')})`)
    .join(',\n');
  return [
    '-- Seed gerado a partir de netlify/functions/_gift-catalog.js.',
    '-- Regenerar com: npm run seed:gifts:sql > supabase/manual-sql/004_seed_gifts.sql',
    '-- Rodar depois de 001..003. Ids existentes são atualizados (nome, preço, imagem, loja).',
    '',
    `insert into public.wedding_gifts (${columns.join(', ')})`,
    'values',
    values,
    'on conflict (id) do update set',
    '  name = excluded.name,',
    '  price = excluded.price,',
    '  image = excluded.image,',
    '  store = excluded.store,',
    '  updated_at = now();',
    ''
  ].join('\n');
}

async function main() {
  if (args.has('--sql')) {
    process.stdout.write(seedSql());
    return;
  }

  const { seedGifts, storageBackend } = require('../netlify/functions/_db');
  const backend = storageBackend();
  if (backend === 'netlify-blobs') {
    throw new Error(
      'Sem Supabase configurado. Defina SUPABASE_URL e SUPABASE_SECRET_KEY no .env, ' +
      'ou rode com NETLIFY_DEV=true para gravar em .netlify/local-db.'
    );
  }

  const result = await seedGifts({ overwrite: args.has('--overwrite') });
  console.log(`[${result.backend}] inseridos: ${result.inserted}, atualizados: ${result.updated}, mantidos: ${result.skipped}, ativos no catálogo: ${result.gifts.length}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
