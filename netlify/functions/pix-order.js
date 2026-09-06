// Pix direto na chave dos noivos (fora da Asaas).
// Registra o pedido como `pix_pending`; o admin confirma com "Marcar pago" em /admin.
const crypto = require('node:crypto');
const { json } = require('./_http');
const { getCatalogGiftsById, saveOrder } = require('./_db');

const DEFAULT_PIX_KEY = '11953396177';
const DEFAULT_PIX_QR = '/assets/pix-qr-code.png';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const payload = JSON.parse(event.body || '{}');
    const giftsById = await getCatalogGiftsById();
    // Só o id vem do cliente; nome e valor saem do catálogo.
    const items = (Array.isArray(payload.items) ? payload.items : [])
      .slice(0, 50)
      .map((item) => giftsById.get(String(item.id || '')))
      .filter(Boolean)
      .map((gift) => ({
        id: String(gift.id),
        name: String(gift.name),
        amount: Math.round(Number(gift.amount ?? gift.price ?? 0)),
        image: gift.image || ''
      }))
      .filter((gift) => gift.amount > 0);
    if (!items.length) return json(400, { error: 'Carrinho vazio ou presentes inválidos.' });

    const pixKey = process.env.PIX_KEY || DEFAULT_PIX_KEY;
    const pixQrCodeImage = process.env.PIX_QR_CODE_IMAGE_URL || DEFAULT_PIX_QR;
    const order = await saveOrder({
      id: crypto.randomUUID(),
      status: 'pix_pending',
      payment_method: 'pix',
      amount_total: items.reduce((sum, item) => sum + item.amount, 0),
      currency: 'brl',
      items,
      pix_payload: pixKey,
      pix_qr_code_image: pixQrCodeImage,
      customer_name: String(payload.name || '').trim().slice(0, 120) || null,
      gift_message: String(payload.message || '').slice(0, 1000),
      created_at: new Date().toISOString()
    });

    return json(200, {
      order: { id: order.id, amount_total: order.amount_total, items: order.items },
      pix: { key: pixKey, qrCodeImage: pixQrCodeImage }
    });
  } catch (error) {
    return json(500, { error: error.message || 'Não foi possível registrar o Pix.' });
  }
};
