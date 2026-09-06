const crypto = require('node:crypto');
const { json, requireAdmin } = require('./_http');
const { listCatalogGifts, listGifts, saveGifts } = require('./_db');
const { DEFAULT_STORE } = require('./_gift-catalog');

exports.handler = async (event) => {
  try {
    // Público: catálogo exibido no site (banco, ou padrão se o banco estiver vazio).
    if (event.httpMethod === 'GET') {
      const { source, gifts } = await listCatalogGifts();
      return json(200, { source, gifts });
    }

    if (!requireAdmin(event)) return json(401, { error: 'Unauthorized' });

    // Admin: substitui o catálogo inteiro.
    if (event.httpMethod === 'PUT') {
      const payload = JSON.parse(event.body || '{}');
      if (!Array.isArray(payload.gifts)) return json(400, { error: 'Expected gifts array' });
      return json(200, { source: 'db', gifts: await saveGifts(payload.gifts) });
    }

    // Admin: adiciona um presente ao catálogo atual.
    if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || '{}');
      const current = await listGifts();
      const gift = {
        id: String(payload.id || crypto.randomUUID()),
        image: String(payload.image || payload.img || ''),
        name: String(payload.name || '').trim(),
        price: Number(payload.price || payload.amount || 0),
        store: String(payload.store || DEFAULT_STORE),
        special: Boolean(payload.special || payload.comic),
        active: payload.active !== false
      };
      if (!gift.name || gift.price <= 0) return json(400, { error: 'Missing gift name or price' });
      return json(200, { source: 'db', gifts: await saveGifts([...current, gift]) });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (error) {
    return json(500, { error: error.message || 'Gift API failed' });
  }
};
