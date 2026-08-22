const { json, requireAdmin } = require('./_http');
const { authorizationUrl, isConfigured } = require('./_google-sheets');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!requireAdmin(event)) return json(401, { error: 'Unauthorized' });
  if (!isConfigured()) return json(400, { error: 'Configure GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET' });
  return json(200, { url: authorizationUrl() });
};
