const { json, requireAdmin } = require('./_http');
const { storageBackend } = require('./_db');
const { describeSupabaseConfig } = require('./_supabase');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  if (!requireAdmin(event)) return json(401, { error: 'Unauthorized' });
  return json(200, { ok: true, storage: storageBackend(), supabase: describeSupabaseConfig() });
};
