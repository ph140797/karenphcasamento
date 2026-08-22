const { json, requireAdmin } = require('./_http');
const { isConfigured, readToken } = require('./_google-sheets');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  if (!requireAdmin(event)) return json(401, { error: 'Unauthorized' });
  const token = await readToken();
  return json(200, { configured: isConfigured(), connected: Boolean(token?.refresh_token), connectedAt: token?.connected_at || null });
};
