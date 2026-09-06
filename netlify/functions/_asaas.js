// Cliente mínimo da API da Asaas + cálculo do repasse da taxa de parcelamento.
//
// O simulador de vendas (/v3/payments/simulate) devolve a taxa percentual e a
// taxa fixa reais da conta para um valor e um número de parcelas. Usamos isso
// para cobrar do presenteador um total bruto tal que os noivos recebam o valor
// cheio do presente (líquido >= valor dos presentes).

const MAX_INSTALLMENTS = Math.min(21, Math.max(1, Number(process.env.ASAAS_MAX_INSTALLMENTS || 10)));
const QUOTE_TTL_MS = 60 * 60 * 1000;
const quoteCache = new Map(); // `${totalCents}:${n}` -> { quote, expires }

function apiBase() {
  return process.env.ASAAS_ENV === 'sandbox' ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3';
}

function checkoutBase() {
  return process.env.ASAAS_ENV === 'sandbox' ? 'https://sandbox.asaas.com' : 'https://asaas.com';
}

async function asaasPost(path, body) {
  if (!process.env.ASAAS_API_KEY) throw new Error('Missing ASAAS_API_KEY');
  const response = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', access_token: process.env.ASAAS_API_KEY },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.errors?.[0]?.description || data.message || `Asaas ${path} falhou (${response.status})`);
  }
  return data;
}

function toCents(value) {
  return Math.round(Number(value || 0) * 100);
}

async function simulateCard(totalCents, installments) {
  const body = { value: totalCents / 100, billingTypes: ['CREDIT_CARD'] };
  if (installments > 1) body.installmentCount = installments;
  const data = await asaasPost('/payments/simulate', body);
  const card = data.creditCard || {};
  return {
    feePercentage: Number(card.feePercentage || 0),
    operationFeeCents: toCents(card.operationFee),
    netCents: toCents(card.netValue)
  };
}

// Quanto cobrar (bruto) para que o líquido seja >= giftsCents, em `installments` parcelas.
async function quoteInstallment(giftsCents, installments) {
  const key = `${giftsCents}:${installments}`;
  const cached = quoteCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.quote;

  const sim = await simulateCard(giftsCents, installments);
  const pct = sim.feePercentage / 100;
  let grossCents = Math.ceil((giftsCents + sim.operationFeeCents) / (1 - pct));

  // Confirma com a própria Asaas e ajusta centavos de arredondamento, se preciso.
  const check = await simulateCard(grossCents, installments);
  if (check.netCents && check.netCents < giftsCents) grossCents += giftsCents - check.netCents;

  const quote = {
    installments,
    giftsCents,
    grossCents,
    feeCents: grossCents - giftsCents,
    installmentCents: Math.ceil(grossCents / installments),
    feePercentage: sim.feePercentage,
    operationFeeCents: sim.operationFeeCents
  };
  quoteCache.set(key, { quote, expires: Date.now() + QUOTE_TTL_MS });
  return quote;
}

async function quoteInstallments(giftsCents, maxInstallments = MAX_INSTALLMENTS) {
  const counts = Array.from({ length: maxInstallments }, (_, index) => index + 1);
  return Promise.all(counts.map((n) => quoteInstallment(giftsCents, n)));
}

module.exports = { MAX_INSTALLMENTS, apiBase, checkoutBase, asaasPost, quoteInstallment, quoteInstallments };
