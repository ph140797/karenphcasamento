require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');

function migrationSql() {
  return fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => fs.readFileSync(path.join(migrationsDir, file), 'utf8'))
    .join('\n\n');
}

async function runWithPg(sql) {
  const { Client } = require('pg');
  const client = new Client({
    connectionString: normalizedDatabaseUrl(),
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

function normalizedDatabaseUrl() {
  const raw = process.env.SUPABASE_DB_URL;
  try {
    new URL(raw);
    return raw;
  } catch (error) {
    const authStart = raw.indexOf('://');
    const authEnd = raw.lastIndexOf('@');
    const passwordStart = raw.indexOf(':', authStart + 3);
    if (authStart === -1 || authEnd === -1 || passwordStart === -1 || passwordStart > authEnd) throw error;
    return `${raw.slice(0, passwordStart + 1)}${encodeURIComponent(raw.slice(passwordStart + 1, authEnd))}${raw.slice(authEnd)}`;
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
    const text = await response.text();
    throw new Error(`Supabase migration API failed: ${response.status} ${text}`);
  }
}

async function main() {
  const sql = migrationSql();

  if (process.env.SUPABASE_DB_URL) {
    await runWithPg(sql);
    console.log('Supabase migrations applied with SUPABASE_DB_URL.');
    return;
  }

  if (process.env.SUPABASE_ACCESS_TOKEN && process.env.SUPABASE_URL) {
    await runWithManagementApi(sql);
    console.log('Supabase migrations applied with Supabase Management API.');
    return;
  }

  console.warn('Skipping Supabase migrations: set SUPABASE_DB_URL or SUPABASE_ACCESS_TOKEN for deploy-time schema changes.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
