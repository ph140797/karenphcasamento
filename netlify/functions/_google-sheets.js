const { getStore } = require('@netlify/blobs');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '1RJBhCgQwr-Aub-fdRriy0ZV5jxgi6vy06ndXYvCsyW4';
const TOKEN_KEY = 'oauth';
const localTokenPath = path.join(process.cwd(), '.netlify', 'google-sheets-oauth.json');

function config() {
  const origin = (process.env.URL || 'http://localhost:8888').replace(/\/$/, '');
  return {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI || `${origin}/api/google-oauth-callback`
  };
}

function isConfigured() {
  const { clientId, clientSecret } = config();
  return Boolean(clientId && clientSecret && SPREADSHEET_ID);
}

async function readToken() {
  if (process.env.NETLIFY_DEV === 'true') {
    try { return JSON.parse(await fs.readFile(localTokenPath, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  return getStore('google-sheets-oauth').get(TOKEN_KEY, { type: 'json' });
}

async function writeToken(token) {
  if (process.env.NETLIFY_DEV === 'true') {
    await fs.mkdir(path.dirname(localTokenPath), { recursive: true });
    await fs.writeFile(localTokenPath, JSON.stringify(token, null, 2));
    return;
  }
  await getStore('google-sheets-oauth').setJSON(TOKEN_KEY, token);
}

function signState(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', process.env.ADMIN_TOKEN).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyState(state) {
  const [encoded, signature] = String(state || '').split('.');
  if (!encoded || !signature) return false;
  const expected = crypto.createHmac('sha256', process.env.ADMIN_TOKEN).update(encoded).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  return payload.exp > Date.now();
}

function authorizationUrl() {
  const { clientId, redirectUri } = config();
  const state = signState({ exp: Date.now() + 10 * 60 * 1000, nonce: crypto.randomUUID() });
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function exchangeCode(code) {
  const { clientId, clientSecret, redirectUri } = config();
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' })
  });
  const token = await response.json();
  if (!response.ok || !token.refresh_token) throw new Error(token.error_description || 'Google não retornou um refresh token');
  await writeToken({ refresh_token: token.refresh_token, connected_at: new Date().toISOString() });
}

async function accessToken() {
  const stored = await readToken();
  if (!stored?.refresh_token) throw new Error('Google Sheets ainda não foi conectado no admin');
  const { clientId, clientSecret } = config();
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: stored.refresh_token, grant_type: 'refresh_token' })
  });
  const token = await response.json();
  if (!response.ok) throw new Error(token.error_description || 'Não foi possível renovar o acesso ao Google');
  return token.access_token;
}

async function appendRsvp(rsvp) {
  if (!isConfigured()) return { skipped: true };
  const token = await accessToken();
  const guestCode = rsvp.id;
  const companions = (rsvp.guests || []).slice(1);
  const rows = [
    [guestCode, rsvp.name, 'Convidado', ''],
    ...companions.map((name, index) => [`${guestCode}-A${String(index + 1).padStart(2, '0')}`, name, 'Acompanhante', guestCode])
  ];
  const range = encodeURIComponent(process.env.GOOGLE_SHEETS_RANGE || 'A:D');
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ majorDimension: 'ROWS', values: rows })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || 'Não foi possível preencher a planilha');
  return result;
}

module.exports = { appendRsvp, authorizationUrl, exchangeCode, isConfigured, readToken, verifyState };
