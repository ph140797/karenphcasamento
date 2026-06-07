const crypto = require('node:crypto');
const { json } = require('./_http');
const { saveOrder } = require('./_db');

function amountFromBRL(price) {
  if (typeof price === 'number') return Math.round(price * 100);
  const normalized = String(price || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  return Math.round(Number.parseFloat(normalized) * 100);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const payload = JSON.parse(event.body || '{}');
    const items = Array.isArray(payload.items) ? payload.items.map((item, index) => ({
      id: String(item.id || item.idx || `gift-${index}`),
      name: String(item.name || 'Presente de casamento').slice(0, 120),
      image: String(item.img || item.image || '').slice(0, 2000),
      amount: amountFromBRL(item.price)
    })).filter((item) => item.amount >= 100) : [];

    if (!items.length) return json(400, { error: 'Carrinho vazio' });

    const amountTotal = items.reduce((sum, item) => sum + item.amount, 0);
    const order = await saveOrder({
      id: crypto.randomUUID(),
      status: 'pix_pending',
      payment_method: 'pix',
      amount_total: amountTotal,
      currency: 'brl',
      items,
      pix_payload: process.env.PIX_KEY || '11953396177',
      pix_qr_code_image: process.env.PIX_QR_CODE_IMAGE_URL || '/assets/pix-qr-code.png',
      gift_message: String(payload.message || '').slice(0, 1000),
      created_at: new Date().toISOString()
    });

    return json(200, { order });
  } catch (error) {
    return json(500, { error: error.message || 'Nao foi possivel registrar o Pix' });
  }
};
