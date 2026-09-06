# Casamento Karen & Paulo Henrique

Site estático hospedado na Netlify com catálogo de presentes, confirmações de presença (RSVP) e pagamentos pelo Checkout da Asaas. O backend são Netlify Functions em `netlify/functions/`, com dados no Supabase.

## Banco de dados

A configuração de acesso ao Supabase fica em [`netlify/functions/_supabase.js`](netlify/functions/_supabase.js) e lê as credenciais das variáveis de ambiente. As credenciais nunca vão para o repositório: localmente ficam em `.env` (ignorado pelo git) e em produção nas variáveis de ambiente da Netlify.

Tabelas (schema em `supabase/migrations/`):

| Tabela | Uso |
| --- | --- |
| `wedding_rsvps` | Confirmações de presença enviadas pelo site. Listadas e exportadas em CSV no `/admin`. |
| `wedding_gifts` | Catálogo de presentes exibido no site e gerenciado no `/admin`. |
| `wedding_orders` | Pedidos criados no checkout e atualizados pelo webhook da Asaas. |

Sem `SUPABASE_URL` e chave, as functions caem automaticamente em Netlify Blobs (e em arquivos locais durante `netlify dev`). O catálogo padrão de `netlify/functions/_gift-catalog.js` é exibido enquanto o banco não tem presentes cadastrados.

### Configuração inicial

1. Crie o projeto no Supabase e copie a URL e a chave `secret` (Project Settings > API Keys).
2. Defina `SUPABASE_URL`, `SUPABASE_SECRET_KEY` e `SUPABASE_DB_URL` no `.env` e nas variáveis da Netlify.
3. Faça o deploy. O build roda `scripts/deploy-db.js`, que aplica `supabase/migrations/` e cadastra os presentes do catálogo padrão que ainda não existem.

Se preferir fazer à mão: `npm run migrate` aplica o schema, e o catálogo pode ser cadastrado pelo botão **Importar catálogo do site** no `/admin`, por `npm run seed:gifts` (`-- --overwrite` atualiza os existentes) ou por `supabase/manual-sql/004_seed_gifts.sql` no SQL Editor.

### Banco no deploy

`npm run build` executa `npm run check` e depois `node scripts/deploy-db.js`. Esse passo:

- só age quando há credenciais do Supabase no ambiente;
- aplica as migrations quando `SUPABASE_DB_URL` (ou `SUPABASE_ACCESS_TOKEN`) existe;
- insere no banco os presentes de `_gift-catalog.js` que faltam, sem alterar os já cadastrados;
- registra erros no log do build sem derrubar o deploy. `DB_DEPLOY_STRICT=true` faz o build falhar em caso de erro, e `DB_DEPLOY_SEED_OVERWRITE=true` faz o seed atualizar nome, preço e imagem dos existentes.

## Variáveis da Netlify

- `ASAAS_API_KEY`
- `ASAAS_ENV=production`
- `ASAAS_WEBHOOK_TOKEN`
- `ASAAS_CHECKOUT_EXPIRATION_MINUTES=30`
- `ADMIN_TOKEN`
- `URL`
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (ou `SUPABASE_SERVICE_ROLE_KEY`)
- `SUPABASE_DB_URL` (para as migrations no deploy)

Veja `.env.example` para o modelo completo.

## APIs

| Rota | Método | Auth | Função |
| --- | --- | --- | --- |
| `/api/rsvp` | POST | pública | Salva confirmação de presença |
| `/api/gifts` | GET | pública | Catálogo de presentes (banco ou padrão) |
| `/api/gifts` | POST, PUT | admin | Adiciona um presente / substitui o catálogo |
| `/api/gifts-seed` | POST | admin | Importa o catálogo padrão para o banco |
| `/api/create-checkout-session` | POST | pública | Cria pedido e checkout Asaas |
| `/api/asaas-webhook` | POST | token Asaas | Atualiza status do pedido |
| `/api/admin-auth` | GET | admin | Valida token e informa o backend de dados |
| `/api/admin-orders` | GET, PATCH | admin | Lista pedidos / marca pago |
| `/api/admin-rsvps` | GET | admin | Lista confirmações |

Rotas admin exigem `Authorization: Bearer <ADMIN_TOKEN>`.

## Webhook da Asaas

Configure a URL abaixo na área de integrações da Asaas:

    https://karenphcasamento.netlify.app/api/asaas-webhook

Use o mesmo valor de `ASAAS_WEBHOOK_TOKEN` como token de autenticação do webhook e ative os eventos:

- PAYMENT_CONFIRMED
- PAYMENT_RECEIVED
- PAYMENT_OVERDUE
- PAYMENT_DELETED
- PAYMENT_REFUNDED

O endpoint confirma a origem pelo cabeçalho `asaas-access-token` e atualiza o pedido após a notificação da Asaas.

## Admin

Abra `/admin` e use `ADMIN_TOKEN`. O painel mostra qual banco está ativo, o cadastro de presentes (adicionar, remover, salvar e importar o catálogo padrão), os pedidos e as confirmações de presença com exportação CSV.

## Música de fundo

Coloque a faixa em `assets/musica.mp3` ou `assets/musica.m4a` (compra da iTunes Store vem em .m4a; ideal até ~8 MB) e faça o deploy. Com o arquivo presente o site usa um player de áudio nativo, que começa a tocar no primeiro toque ou clique em qualquer navegador, celular incluído. Sem o arquivo, o site usa o player do YouTube, que no celular nem sempre libera o som.

## Desenvolvimento

    npm install
    npm run dev      # netlify dev, carrega o .env nas functions
    npm run check    # valida a sintaxe das functions e scripts
