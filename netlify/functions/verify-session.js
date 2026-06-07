const Stripe = require('stripe');
const { json } = require('./_http');
const { getOrder, updateOrder } = require('./_db');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'missing-key');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  if (!process.env.STRIPE_SECRET_KEY) return json(500, { error: 'Missing STRIPE_SECRET_KEY' });

  try {
    const sessionId = event.queryStringParameters && event.queryStringParameters.session_id;
    if (!sessionId) return json(400, { error: 'Missing session_id' });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const orderId = session.metadata && session.metadata.order_id;
    let order = orderId ? await getOrder(orderId) : null;

    if (orderId && session.payment_status === 'paid' && order && order.status !== 'paid') {
      order = await updateOrder(orderId, {
        status: 'paid',
        stripe_session_id: session.id,
        stripe_payment_intent: session.payment_intent,
        customer_email: session.customer_details && session.customer_details.email,
        customer_name: session.customer_details && session.customer_details.name
      });
    }

    return json(200, {
      paid: session.payment_status === 'paid',
      status: session.payment_status,
      order
    });
  } catch (error) {
    return json(500, { error: error.message || 'Failed to verify payment' });
  }
};
