// Aplica supabase/migrations/*.sql (idempotentes) no projeto Supabase.
//
//   npm run migrate
//
// Usa SUPABASE_DB_URL (pooler Postgres) ou, como alternativa,
// SUPABASE_ACCESS_TOKEN + SUPABASE_URL/SUPABASE_PROJECT_REF (Management API).
// Também é chamado no deploy por scripts/deploy-db.js.
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

function migrationFiles() {
  return fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();
}

function migrationSql() {
  return migrationFiles()
    .map((file) => `-- ${file}\n${fs.readFileSync(path.join(migrationsDir, file), 'utf8')}`)
    .join('\n\n');
}

function normalizedDatabaseUrl() {
  const raw = process.env.SUPABASE_DB_URL;
  try {
    new URL(raw);
    return raw;
  } catch (error) {
    // Senha com caracteres especiais sem encode: codifica só o trecho da senha.
    const authStart = raw.indexOf('://');
    const authEnd = raw.lastIndexOf('@');
    const passwordStart = raw.indexOf(':', authStart + 3);
    if (authStart === -1 || authEnd === -1 || passwordStart === -1 || passwordStart > authEnd) throw error;
    return `${raw.slice(0, passwordStart + 1)}${encodeURIComponent(raw.slice(passwordStart + 1, authEnd))}${raw.slice(authEnd)}`;
  }
}

async function runWithPg(sql) {
  const { Client } = require('pg');
  const client = new Client({
    connectionString: normalizedDatabaseUrl(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000
  });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

async function runWithManagementApi(sql) {
  const projectRef = process.env.SUPABASE_PROJECT_REF || new URL(process.env.SUPABASE_URL).hostname.split('.')[0];
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });
  if (!response.ok) {
    throw new Error(`Supabase Management API falhou: ${response.status} ${await response.text()}`);
  }
}

function migrationMethod() {
  if (process.env.SUPABASE_DB_URL) return 'db-url';
  if (process.env.SUPABASE_ACCESS_TOKEN && (process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_REF)) return 'management-api';
  return null;
}

// Retorna { method, files } ou null quando não há credenciais para migrar.
async function applyMigrations() {
  const method = migrationMethod();
  if (!method) return null;
  const sql = migrationSql();
  if (method === 'db-url') await runWithPg(sql);
  else await runWithManagementApi(sql);
  return { method, files: migrationFiles() };
}

async function main() {
  const result = await applyMigrations();
  if (!result) {
    console.warn('Migrations puladas: defina SUPABASE_DB_URL ou SUPABASE_ACCESS_TOKEN.');
    return;
  }
  console.log(`Migrations aplicadas via ${result.method}: ${result.files.join(', ')}`);
}

module.exports = { applyMigrations, migrationMethod };

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
