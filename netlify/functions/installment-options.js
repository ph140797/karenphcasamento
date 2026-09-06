// POST /api/installment-options { items: [{id}] }
// Devolve, para 1x..10x, o total com a taxa da Asaas repassada e o valor da parcela.
const { json } = require('./_http');
const { getCatalogGiftsById } = require('./_db');
const { MAX_INSTALLMENTS, quoteInstallments } = require('./_asaas');

function itemsFromPayload(payload, giftsById) {
  return (Array.isArray(payload.items) ? payload.items : [])
    .slice(0, 50)
    .map((item) => giftsById.get(String(item.id || '')))
    .filter(Boolean)
    .map((gift) => Math.round(Number(gift.amount ?? gift.price ?? 0)))
    .filter((amount) => amount > 0);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const payload = JSON.parse(event.body || '{}');
    const amounts = itemsFromPayload(payload, await getCatalogGiftsById());
    if (!amounts.length) return json(400, { error: 'Carrinho vazio ou presentes inválidos.' });

    const giftsCents = amounts.reduce((sum, amount) => sum + amount, 0);
    const quotes = await quoteInstallments(giftsCents, MAX_INSTALLMENTS);
    return json(200, {
      giftsCents,
      maxInstallments: MAX_INSTALLMENTS,
      options: quotes.map((quote) => ({
        installments: quote.installments,
        totalCents: quote.grossCents,
        installmentCents: quote.installmentCents,
        feeCents: quote.feeCents
      }))
    });
  } catch (error) {
    return json(500, { error: error.message || 'Não foi possível calcular as parcelas.' });
  }
};
