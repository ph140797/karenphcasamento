// Catálogo padrão de presentes (o mesmo que está "chumbado" em index.html).
//
// Serve para três coisas:
//   1. fallback do site quando o banco ainda não tem presentes cadastrados;
//   2. seed do Supabase (`npm run seed:gifts` ou POST /api/gifts-seed no admin);
//   3. validação dos itens no checkout quando o banco está indisponível.
//
// Valores em centavos. As imagens ficam em assets/presentes-preview/.

const IMAGE_PREFIX = 'assets/presentes-preview/WhatsApp Image 2026-08-22 at ';
const DEFAULT_STORE = 'Presente de casamento';

const rows = [
  ['geladeira', 'Geladeira', 700000, '18.37.41'],
  ['fogao', 'fogão', 150000, '18.37.50'],
  ['tv', 'Tv', 350000, '18.39.03'],
  ['sofa', 'Sofá', 200000, '18.39.03 (1)'],
  ['guarda-roupa', 'guarda roupa', 190000, '18.39.03 (2)'],
  ['cama', 'Cama', 90000, '18.39.03 (3)'],
  ['maquina-lavar', 'maquina de lavar', 140000, '18.39.03 (4)'],
  ['lava-louca', 'Lava louça', 190000, '18.39.03 (5)'],
  ['jogo-cama-queen', 'Jogo de cama Queen', 70000, '18.39.20'],
  ['alexa', 'Alexa', 48000, '18.39.30'],
  ['robo-limpeza', 'Robo de limpeza', 60000, '18.39.43'],
  ['mesa-jantar', 'Mesa de jantar', 167000, '18.39.57'],
  ['aspirador-po', 'Aspirador de pó', 60000, '18.40.08'],
  ['painel-tv', 'Painel sala de TV', 55000, '18.40.27'],
  ['jogo-toalha', 'Jogo de toalha', 38000, '18.40.40'],
  ['aparelho-jantar', 'Aparelho de Jantar', 40000, '18.40.53'],
  ['microondas', 'Microondas', 35000, '18.41.06'],
  ['forno-eletrico', 'forno eletrico', 40000, '18.41.44'],
  ['liquidificador', 'Liquidificador', 30000, '18.41.57'],
  ['air-frier', 'Air frier', 40000, '18.42.10'],
  ['exaustor', 'Exaustor', 40000, '18.42.59'],
  ['jogo-talheres', 'Jogo de Talheres', 44000, '18.43.12'],
  ['jogo-tacas', 'Jogo de taças', 30000, '18.43.26'],
  ['aparelho-fundue', 'Aparelho de fundue', 40000, '18.43.39'],
  ['panela-le-creuset', 'Jogo de panela le creuset', 250000, '18.43.56'],
  ['cafeteira-premium', 'Cafeteira premium', 135700, '18.44.09'],
  ['kit-capsulas-cafe', 'Kit capsulas de café', 37500, '18.44.29'],
  ['panela-arroz', 'Panela eletrica de arroz', 42000, '18.44.50'],
  ['panela-pressao', 'Panela de pressão eletrica', 40000, '18.45.11'],
  ['tapete-sala', 'Tapete da sala de estar', 30000, '18.45.26'],
  ['cooktop', 'Cooktop', 45000, '18.45.41'],
  ['frigobar', 'Frigobar', 90000, '18.46.03'],
  ['chaleira-eletrica', 'Chaleira eletrica', 35000, '18.46.15'],
  ['torradeira', 'Torradeira', 30000, '18.46.26'],
  ['maquina-paes', 'Maquina de pães', 50000, '18.46.37'],
  ['lava-e-seca', 'lava e seca', 280000, '18.46.45'],
  ['churrasqueira-eletrica', 'Churrasqueira eletrica', 30000, '18.47.16'],
  ['kit-churrasco', 'Kit churrasco', 40000, '18.47.26'],
  ['cortina', 'Cortina', 45000, '18.47.35'],
  ['espremedor-succo', 'Expremedor de suco eletrico', 200000, '18.47.51'],
  ['kit-mesa-posta', 'Kit mesa posta', 40000, '18.48.02'],
  ['filtro-agua', 'Filtro de agua', 45000, '18.48.13'],
  ['ar-condicionado', 'ar condicionado', 719900, '18.48.25'],
  ['produto-teste', 'Produto de teste', 1000, '18.39.30']
];

function imagePath(time) {
  return encodeURI(`${IMAGE_PREFIX}${time}.jpeg`);
}

// Formato igual ao da tabela wedding_gifts (mais `amount` por compatibilidade
// com o checkout, que sempre trabalhou com esse nome).
const gifts = rows.map(([id, name, amount, time]) => ({
  id,
  name,
  price: amount,
  amount,
  image: imagePath(time),
  store: DEFAULT_STORE,
  special: false,
  active: true,
  purchased: false,
  purchased_order_id: null
}));

const giftsById = new Map(gifts.map((gift) => [gift.id, gift]));

// Linhas prontas para upsert no banco (sem o campo `amount`).
function toGiftRecords() {
  return gifts.map(({ amount, ...record }) => record);
}

module.exports = { gifts, giftsById, toGiftRecords, DEFAULT_STORE };
