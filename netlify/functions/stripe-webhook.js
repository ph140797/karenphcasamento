const Stripe = require('stripe');
const { updateOrder } = require('./_db');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'missing-key');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      event.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    return { statusCode: 400, body: `Webhook error: ${error.message}` };
  }

  const session = stripeEvent.data.object;
  const orderId = session.metadata && session.metadata.order_id;

  if (orderId && stripeEvent.type === 'checkout.session.completed') {
    await updateOrder(orderId, {
      status: 'paid',
      stripe_session_id: session.id,
      stripe_payment_intent: session.payment_intent,
      customer_email: session.customer_details && session.customer_details.email,
      customer_name: session.customer_details && session.customer_details.name
    });
  }

  if (orderId && stripeEvent.type === 'checkout.session.expired') {
    await updateOrder(orderId, {
      status: 'expired',
      stripe_session_id: session.id
    });
  }

  return { statusCode: 200, body: 'ok' };
};
