const { json, requireAdmin } = require('./_http');
const { listGifts, saveGifts } = require('./_db');
const crypto = require('node:crypto');

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'GET') return json(200, { gifts: await listGifts() });

    if (event.httpMethod === 'PUT') {
      if (!requireAdmin(event)) return json(401, { error: 'Unauthorized' });
      const payload = JSON.parse(event.body || '{}');
      if (!Array.isArray(payload.gifts)) return json(400, { error: 'Expected gifts array' });
      return json(200, { gifts: await saveGifts(payload.gifts) });
    }

    if (event.httpMethod === 'POST') {
      if (!requireAdmin(event)) return json(401, { error: 'Unauthorized' });
      const payload = JSON.parse(event.body || '{}');
      const current = await listGifts();
      const gift = {
        id: String(payload.id || crypto.randomUUID()),
        image: String(payload.image || payload.img || ''),
        name: String(payload.name || '').trim(),
        price: Number(payload.price || payload.amount || 0),
        store: String(payload.store || 'Presente de casamento'),
        special: Boolean(payload.special || payload.comic),
        active: payload.active !== false
      };
      if (!gift.name || gift.price <= 0) return json(400, { error: 'Missing gift name or price' });
      return json(200, { gifts: await saveGifts([...current, gift]) });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (error) {
    return json(500, { error: error.message || 'Gift API failed' });
  }
};
