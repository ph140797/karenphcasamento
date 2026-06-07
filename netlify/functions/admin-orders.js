const { json, requireAdmin } = require('./_http');
const { listOrders, updateOrder } = require('./_db');

exports.handler = async (event) => {
  if (!requireAdmin(event)) return json(401, { error: 'Unauthorized' });

  try {
    if (event.httpMethod === 'GET') return json(200, { orders: await listOrders() });

    if (event.httpMethod === 'PATCH') {
      const payload = JSON.parse(event.body || '{}');
      const id = String(payload.id || '').trim();
      const status = String(payload.status || '').trim();
      if (!id) return json(400, { error: 'Missing order id' });
      if (!['paid', 'pix_pending', 'expired'].includes(status)) return json(400, { error: 'Invalid status' });
      const order = await updateOrder(id, { status });
      if (!order) return json(404, { error: 'Order not found' });
      return json(200, { order });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (error) {
    return json(500, { error: error.message || 'Failed to load orders' });
  }
};
