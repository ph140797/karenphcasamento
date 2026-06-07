const { json } = require('./_http');
const { listPaidGiftIds } = require('./_db');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  try {
    return json(200, { paidGiftIds: await listPaidGiftIds() });
  } catch (error) {
    return json(500, { error: error.message || 'Failed to load paid gifts' });
  }
};
