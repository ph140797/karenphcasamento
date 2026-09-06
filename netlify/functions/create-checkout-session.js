const crypto = require('node:crypto');
const { json } = require('./_http');
const { getCatalogGiftsById, saveOrder } = require('./_db');

function apiBase() {
  return process.env.ASAAS_ENV === 'sandbox'
    ? 'https://api-sandbox.asaas.com/v3'
    : 'https://api.asaas.com/v3';
}

function checkoutBase() {
  return process.env.ASAAS_ENV === 'sandbox'
    ? 'https://sandbox.asaas.com'
    : 'https://asaas.com';
}

// Itens vêm do cliente só com o id; nome e valor saem do catálogo (banco ou padrão),
// nunca do payload.
function normalizeItems(items, giftsById) {
  if (!Array.isArray(items)) return [];
  return items
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
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!process.env.ASAAS_API_KEY) return json(500, { error: 'Missing ASAAS_API_KEY' });

  try {
    const payload = JSON.parse(event.body || '{}');
    const items = normalizeItems(payload.items, await getCatalogGiftsById());
    if (!items.length) return json(400, { error: 'Carrinho vazio ou presentes inválidos.' });

    const orderId = crypto.randomUUID();
    const customerName = String(payload.name || '').trim().slice(0, 120);
    const giftMessage = String(payload.message || '').slice(0, 1000);
    // Asaas só para cartão de crédito; Pix é feito direto na chave dos noivos (pix-order.js).
    const maxInstallments = Math.min(21, Math.max(1, Number(process.env.ASAAS_MAX_INSTALLMENTS || 10)));
    const amountTotal = items.reduce((sum, item) => sum + item.amount, 0);
    const origin = process.env.URL || event.headers.origin || 'http://localhost:8888';
    const minutesToExpire = Math.min(1440, Math.max(10, Number(process.env.ASAAS_CHECKOUT_EXPIRATION_MINUTES || 30)));

    await saveOrder({
      id: orderId,
      status: 'checkout_created',
      payment_method: 'credit_card',
      amount_total: amountTotal,
      currency: 'brl',
      items,
      customer_name: customerName || null,
      gift_message: giftMessage,
      created_at: new Date().toISOString()
    });

    const response = await fetch(`${apiBase()}/checkouts`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        access_token: process.env.ASAAS_API_KEY
      },
      body: JSON.stringify({
        billingTypes: ['CREDIT_CARD'],
        chargeTypes: ['DETACHED', 'INSTALLMENT'],
        installment: { maxInstallmentCount: maxInstallments },
        minutesToExpire,
        externalReference: orderId,
        callback: {
          successUrl: `${origin}/success.html?order_id=${encodeURIComponent(orderId)}`,
          cancelUrl: `${origin}/#presentes`,
          expiredUrl: `${origin}/#presentes`
        },
        items: items.map((item) => ({
          name: item.name.slice(0, 30),
          description: 'Presente de casamento Karen & Paulo Henrique'.slice(0, 150),
          quantity: 1,
          value: item.amount / 100
        }))
      })
    });
    const checkout = await response.json();
    if (!response.ok || !checkout.id) {
      throw new Error(checkout.errors?.[0]?.description || checkout.message || 'Não foi possível criar o checkout Asaas.');
    }

    await saveOrder({
      id: orderId,
      status: 'checkout_created',
      payment_method: 'credit_card',
      amount_total: amountTotal,
      currency: 'brl',
      items,
      asaas_checkout_id: checkout.id,
      customer_name: customerName || null,
      gift_message: giftMessage,
      created_at: new Date().toISOString()
    });

    return json(200, {
      orderId,
      checkoutId: checkout.id,
      url: checkout.url || `${checkoutBase()}/checkoutSession/show?id=${encodeURIComponent(checkout.id)}`
    });
  } catch (error) {
    return json(500, { error: error.message || 'Não foi possível iniciar o checkout.' });
  }
};
