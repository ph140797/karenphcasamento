# Casamento Karen & Paulo Henrique

Site estático hospedado na Netlify, com catálogo de presentes no código, confirmações de presença e pagamentos pelo Checkout da Asaas.

## Variáveis da Netlify

- ASAAS_API_KEY
- ASAAS_ENV=production
- ASAAS_WEBHOOK_TOKEN
- ASAAS_CHECKOUT_EXPIRATION_MINUTES=30
- ADMIN_TOKEN
- URL

Os pedidos e confirmações são armazenados em Netlify Blobs. O catálogo de presentes é fixo no código do site.

## Webhook da Asaas

Configure a URL abaixo na área de integrações da Asaas:

    https://karenphcasamento.netlify.app/api/asaas-webhook

Use o mesmo valor de ASAAS_WEBHOOK_TOKEN como token de autenticação do webhook e ative os eventos:

- PAYMENT_CONFIRMED
- PAYMENT_RECEIVED
- PAYMENT_OVERDUE
- PAYMENT_DELETED
- PAYMENT_REFUNDED

O endpoint confirma a origem pelo cabeçalho asaas-access-token e atualiza o pedido após a notificação da Asaas.

## Admin

Abra /admin e use ADMIN_TOKEN. O painel mostra pedidos e confirmações de presença, incluindo a exportação CSV.
