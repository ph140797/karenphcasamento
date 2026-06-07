const { json, requireAdmin } = require('./_http');
const { listOrders } = require('./_db');

exports.handler = async (event) => {
  if (!requireAdmin(event)) return json(401, { error: 'Unauthorized' });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  try {
    return json(200, { orders: await listOrders() });
  } catch (error) {
    return json(500, { error: error.message || 'Failed to load orders' });
  }
};
