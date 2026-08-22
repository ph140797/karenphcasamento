const crypto = require('node:crypto');
const { json } = require('./_http');
const { saveOrder } = require('./_db');
const { giftsById } = require('./_gift-catalog');

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

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 43).map((item) => giftsById.get(String(item.id || ''))).filter(Boolean);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!process.env.ASAAS_API_KEY) return json(500, { error: 'Missing ASAAS_API_KEY' });

  try {
    const payload = JSON.parse(event.body || '{}');
    const items = normalizeItems(payload.items);
    if (!items.length) return json(400, { error: 'Carrinho vazio ou presentes inválidos.' });

    const orderId = crypto.randomUUID();
    const amountTotal = items.reduce((sum, item) => sum + item.amount, 0);
    const origin = process.env.URL || event.headers.origin || 'http://localhost:8888';
    const minutesToExpire = Math.min(1440, Math.max(10, Number(process.env.ASAAS_CHECKOUT_EXPIRATION_MINUTES || 30)));

    await saveOrder({
      id: orderId,
      status: 'checkout_created',
      payment_method: 'asaas_checkout',
      amount_total: amountTotal,
      currency: 'brl',
      items,
      gift_message: String(payload.message || '').slice(0, 1000),
      created_at: new Date().toISOString()
    });

    const response = await fetch(`${apiBase()}/checkouts`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        access_token: process.env.ASAAS_API_KEY
      },
      body: JSON.stringify({
        billingTypes: ['PIX', 'CREDIT_CARD'],
        chargeTypes: ['DETACHED'],
        minutesToExpire,
        externalReference: orderId,
        callback: {
          successUrl: `${origin}/success.html?order_id=${encodeURIComponent(orderId)}`,
          cancelUrl: `${origin}/#presentes`,
          expiredUrl: `${origin}/#presentes`
        },
        items: items.map((item) => ({
          name: item.name,
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
      payment_method: 'asaas_checkout',
      amount_total: amountTotal,
      currency: 'brl',
      items,
      asaas_checkout_id: checkout.id,
      gift_message: String(payload.message || '').slice(0, 1000),
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
