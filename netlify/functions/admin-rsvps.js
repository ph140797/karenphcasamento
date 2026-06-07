const { json, requireAdmin } = require('./_http');
const { listRsvps } = require('./_db');

exports.handler = async (event) => {
  if (!requireAdmin(event)) return json(401, { error: 'Unauthorized' });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  try {
    return json(200, { rsvps: await listRsvps() });
  } catch (error) {
    return json(500, { error: error.message || 'Failed to load RSVPs' });
  }
};
