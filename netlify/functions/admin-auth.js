const { json, requireAdmin } = require('./_http');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  if (!requireAdmin(event)) return json(401, { error: 'Unauthorized' });
  return json(200, { ok: true });
};

