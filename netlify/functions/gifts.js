const { json, requireAdmin } = require('./_http');
const { listGifts, saveGifts } = require('./_db');

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'GET') return json(200, { gifts: await listGifts() });

    if (event.httpMethod === 'PUT') {
      if (!requireAdmin(event)) return json(401, { error: 'Unauthorized' });
      const payload = JSON.parse(event.body || '{}');
      if (!Array.isArray(payload.gifts)) return json(400, { error: 'Expected gifts array' });
      return json(200, { gifts: await saveGifts(payload.gifts) });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (error) {
    return json(500, { error: error.message || 'Gift API failed' });
  }
};
