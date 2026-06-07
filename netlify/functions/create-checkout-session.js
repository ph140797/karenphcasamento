const crypto = require('node:crypto');
const Stripe = require('stripe');
const { json } = require('./_http');
const { saveOrder } = require('./_db');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'missing-key');
const currency = (process.env.STRIPE_CURRENCY || 'brl').toLowerCase();

function amountFromBRL(price) {
  if (typeof price === 'number') return Math.round(price * 100);
  const normalized = String(price || '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  return Math.round(Number.parseFloat(normalized) * 100);
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 50).map((item, index) => {
    const amount = amountFromBRL(item.price);
    return {
      id: String(item.id || item.idx || `gift-${index}`),
      name: String(item.name || 'Presente de casamento').slice(0, 120),
      image: String(item.img || item.image || '').slice(0, 2000),
      amount
    };
  }).filter((item) => item.amount >= 100);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!process.env.STRIPE_SECRET_KEY) return json(500, { error: 'Missing STRIPE_SECRET_KEY' });

  try {
    const payload = JSON.parse(event.body || '{}');
    const items = normalizeItems(payload.items);
    if (!items.length) return json(400, { error: 'Cart is empty' });

    const origin = process.env.URL || event.headers.origin || 'http://localhost:8888';
    const orderId = crypto.randomUUID();
    const amountTotal = items.reduce((sum, item) => sum + item.amount, 0);

    await saveOrder({
      id: orderId,
      status: 'pending',
      amount_total: amountTotal,
      currency,
      items,
      gift_message: String(payload.message || '').slice(0, 1000),
      created_at: new Date().toISOString()
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: items.map((item) => ({
        quantity: 1,
        price_data: {
          currency,
          unit_amount: item.amount,
          product_data: {
            name: item.name,
            images: item.image && item.image.startsWith('http') ? [item.image] : []
          }
        }
      })),
      metadata: { order_id: orderId },
      locale: 'pt-BR',
      allow_promotion_codes: false,
      billing_address_collection: 'auto',
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#presentes`
    });

    await saveOrder({
      id: orderId,
      status: 'checkout_created',
      payment_method: 'card',
      amount_total: amountTotal,
      currency,
      items,
      gift_message: String(payload.message || '').slice(0, 1000),
      stripe_session_id: session.id,
      created_at: new Date().toISOString()
    });

    return json(200, { url: session.url, sessionId: session.id, orderId });
  } catch (error) {
    return json(500, { error: error.message || 'Checkout failed' });
  }
};
