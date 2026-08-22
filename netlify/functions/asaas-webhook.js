const crypto = require('node:crypto');
const { json } = require('./_http');
const { getOrder, listOrders, updateOrder } = require('./_db');

function secureEquals(received, expected) {
  if (!received || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const receivedToken = event.headers['asaas-access-token'] || event.headers['Asaas-Access-Token'];
  if (!secureEquals(receivedToken, process.env.ASAAS_WEBHOOK_TOKEN)) return json(401, { error: 'Unauthorized' });

  try {
    const payload = JSON.parse(event.body || '{}');
    const payment = payload.payment || {};
    const externalReference = String(payment.externalReference || payload.externalReference || '').trim();
    let order = externalReference ? await getOrder(externalReference) : null;
    if (!order && payment.checkoutSession) {
      order = (await listOrders()).find((item) => item.asaas_checkout_id === payment.checkoutSession) || null;
    }
    if (!order) return json(200, { received: true, ignored: 'order_not_found' });

    const patch = {
      asaas_event_id: String(payload.id || ''),
      asaas_payment_id: String(payment.id || order.asaas_payment_id || ''),
      asaas_checkout_id: String(payment.checkoutSession || order.asaas_checkout_id || ''),
      asaas_payment_status: String(payment.status || ''),
      payment_method: String(payment.billingType || order.payment_method || 'asaas_checkout').toLowerCase()
    };

    if (['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(payload.event)) {
      patch.status = 'paid';
    } else if (['PAYMENT_OVERDUE', 'PAYMENT_DELETED'].includes(payload.event)) {
      patch.status = 'expired';
    } else if (['PAYMENT_REFUNDED', 'PAYMENT_RECEIVED_IN_CASH_UNDONE'].includes(payload.event)) {
      patch.status = 'refunded';
    } else {
      return json(200, { received: true, ignored: 'event_not_tracked' });
    }

    await updateOrder(order.id, patch);
    return json(200, { received: true });
  } catch (error) {
    return json(500, { error: error.message || 'Webhook processing failed' });
  }
};
