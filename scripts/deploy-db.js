// Passo de banco executado no build da Netlify (ver "build" em package.json):
//   1. aplica supabase/migrations/*.sql (idempotentes);
//   2. cadastra no banco os presentes do catálogo padrão que ainda não existem.
//
// Só roda quando as credenciais do Supabase estão no ambiente. Erros são
// registrados no log mas NÃO derrubam o deploy, para o site continuar
// publicando mesmo com o banco fora do ar. Defina DB_DEPLOY_STRICT=true para
// falhar o build nesses casos. DB_DEPLOY_SEED_OVERWRITE=true faz o seed
// atualizar nome/preço/imagem dos presentes já cadastrados.
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const strict = process.env.DB_DEPLOY_STRICT === 'true';
const overwrite = process.env.DB_DEPLOY_SEED_OVERWRITE === 'true';

function fail(step, error) {
  console.error(`\n[deploy-db] ${step} FALHOU: ${error.message || error}`);
  if (strict) process.exit(1);
  console.error('[deploy-db] Deploy continua (DB_DEPLOY_STRICT não está ativo).\n');
}

async function main() {
  const { hasSupabase, describeSupabaseConfig } = require('../netlify/functions/_supabase');
  const { applyMigrations, migrationMethod } = require('./migrate-supabase');

  console.log('[deploy-db] Supabase:', JSON.stringify(describeSupabaseConfig()), '| migrations via:', migrationMethod() || 'nenhum');

  if (!hasSupabase && !migrationMethod()) {
    console.log('[deploy-db] Sem credenciais do Supabase no ambiente. Nada a fazer.');
    return;
  }

  let migrated = false;
  try {
    const result = await applyMigrations();
    if (result) {
      migrated = true;
      console.log(`[deploy-db] Migrations aplicadas via ${result.method}: ${result.files.join(', ')}`);
    } else {
      console.warn('[deploy-db] Migrations puladas (sem SUPABASE_DB_URL / SUPABASE_ACCESS_TOKEN). Aplique supabase/manual-sql/all.sql no SQL Editor.');
    }
  } catch (error) {
    fail('migrations', error);
  }

  if (!hasSupabase) {
    console.warn('[deploy-db] Seed pulado: SUPABASE_URL/SUPABASE_SECRET_KEY ausentes.');
    return;
  }

  try {
    const { seedGifts } = require('../netlify/functions/_db');
    const result = await seedGifts({ overwrite });
    console.log(`[deploy-db] Seed de presentes: ${result.inserted} novos, ${result.updated} atualizados, ${result.skipped} mantidos, ${result.gifts.length} ativos.`);
  } catch (error) {
    if (!migrated) console.error('[deploy-db] Dica: a tabela wedding_gifts pode não existir ainda; rode as migrations.');
    fail('seed de presentes', error);
  }
}

main().catch((error) => fail('execução', error));
