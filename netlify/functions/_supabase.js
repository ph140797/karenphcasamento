// Configuração central de acesso ao Supabase.
//
// Este módulo roda SOMENTE no backend (Netlify Functions). As credenciais vêm
// de variáveis de ambiente e nunca devem ser commitadas no repositório:
//
//   SUPABASE_URL                 https://<project-ref>.supabase.co
//   SUPABASE_SECRET_KEY          chave "secret" (sb_secret_...)  — preferida
//   SUPABASE_SERVICE_ROLE_KEY    chave service_role legada        — alternativa
//
// Localmente: coloque os valores em `.env` (já ignorado pelo git) e rode
// `npm run dev`; o Netlify CLI injeta o arquivo nas functions.
// Em produção: Site settings > Environment variables na Netlify.
//
// A chave secreta/service_role ignora RLS, por isso as tabelas ficam com RLS
// ligado e sem policies: só as functions acessam os dados.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_SECRET_KEY = (process.env.SUPABASE_SECRET_KEY || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const SUPABASE_SERVER_KEY = SUPABASE_SECRET_KEY || SUPABASE_SERVICE_ROLE_KEY;

const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_SERVER_KEY);

const TABLES = Object.freeze({
  orders: 'wedding_orders',
  rsvps: 'wedding_rsvps',
  gifts: 'wedding_gifts'
});

let client = null;

function getSupabase() {
  if (!hasSupabase) {
    throw new Error(
      'Supabase não configurado: defina SUPABASE_URL e SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY).'
    );
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_SERVER_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { 'x-application-name': 'karen-ph-casamento' } }
    });
  }
  return client;
}

// Resumo seguro para logs/admin: nunca expõe a chave.
function describeSupabaseConfig() {
  let host = null;
  try {
    host = SUPABASE_URL ? new URL(SUPABASE_URL).hostname : null;
  } catch (error) {
    host = 'url-invalida';
  }
  return {
    configured: hasSupabase,
    host,
    keyType: SUPABASE_SECRET_KEY ? 'secret' : SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : null
  };
}

module.exports = { TABLES, hasSupabase, getSupabase, describeSupabaseConfig };
