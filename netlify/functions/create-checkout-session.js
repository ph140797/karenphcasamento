// Cria o pedido e o Checkout hospedado da Asaas (só cartão de crédito).
// O número de parcelas é escolhido no site; a taxa da Asaas para essa opção é
// repassada ao presenteador (ver _asaas.js) e o checkout sai com o total bruto
// e o parcelamento travado no número escolhido.
const crypto = require('node:crypto');
const { json } = require('./_http');
const { getCatalogGiftsById, saveOrder } = require('./_db');
const { MAX_INSTALLMENTS, asaasPost, checkoutBase, quoteInstallment } = require('./_asaas');

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

    const installments = Math.max(1, Math.min(MAX_INSTALLMENTS, Math.trunc(Number(payload.installments || 1))));
    const giftsCents = items.reduce((sum, item) => sum + item.amount, 0);
    const quote = await quoteInstallment(giftsCents, installments);

    const orderId = crypto.randomUUID();
    const customerName = String(payload.name || '').trim().slice(0, 120);
    const giftMessage = String(payload.message || '').slice(0, 1000);
    const origin = process.env.URL || event.headers.origin || 'http://localhost:8888';
    const minutesToExpire = Math.min(1440, Math.max(10, Number(process.env.ASAAS_CHECKOUT_EXPIRATION_MINUTES || 30)));

    const baseOrder = {
      id: orderId,
      status: 'checkout_created',
      payment_method: 'credit_card',
      amount_total: quote.grossCents,
      amount_gifts: giftsCents,
      amount_fee: quote.feeCents,
      installments,
      currency: 'brl',
      items,
      customer_name: customerName || null,
      gift_message: giftMessage,
      created_at: new Date().toISOString()
    };
    await saveOrder(baseOrder);

    const checkoutItems = items.map((item) => ({
      name: item.name.slice(0, 30),
      description: 'Presente de casamento Karen & Paulo Henrique',
      quantity: 1,
      value: item.amount / 100
    }));
    if (quote.feeCents > 0) {
      checkoutItems.push({
        name: `Taxa cartão ${installments}x`.slice(0, 30),
        description: 'Taxa de processamento do cartão repassada ao presenteador',
        quantity: 1,
        value: quote.feeCents / 100
      });
    }

    const checkout = await asaasPost('/checkouts', {
      billingTypes: ['CREDIT_CARD'],
      chargeTypes: installments > 1 ? ['INSTALLMENT'] : ['DETACHED'],
      ...(installments > 1 ? { installment: { maxInstallmentCount: installments } } : {}),
      minutesToExpire,
      externalReference: orderId,
      callback: {
        successUrl: `${origin}/success.html?order_id=${encodeURIComponent(orderId)}`,
        cancelUrl: `${origin}/#presentes`,
        expiredUrl: `${origin}/#presentes`
      },
      items: checkoutItems
    });
    if (!checkout.id) throw new Error('Não foi possível criar o checkout Asaas.');

    await saveOrder({ ...baseOrder, asaas_checkout_id: checkout.id });

    return json(200, {
      orderId,
      checkoutId: checkout.id,
      installments,
      totalCents: quote.grossCents,
      feeCents: quote.feeCents,
      url: checkout.url || `${checkoutBase()}/checkoutSession/show?id=${encodeURIComponent(checkout.id)}`
    });
  } catch (error) {
    return json(500, { error: error.message || 'Não foi possível iniciar o checkout.' });
  }
};
