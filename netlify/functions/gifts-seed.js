// Cadastra no banco os presentes do catálogo padrão (os que estavam fixos no site).
// POST /api/gifts-seed  { "overwrite": false }
//   overwrite=false (padrão): só insere os que ainda não existem.
//   overwrite=true: também atualiza nome, preço e imagem dos existentes.
const { json, requireAdmin } = require('./_http');
const { seedGifts } = require('./_db');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!requireAdmin(event)) return json(401, { error: 'Unauthorized' });

  try {
    const payload = JSON.parse(event.body || '{}');
    const result = await seedGifts({ overwrite: Boolean(payload.overwrite) });
    return json(200, result);
  } catch (error) {
    return json(500, { error: error.message || 'Não foi possível importar o catálogo' });
  }
};
