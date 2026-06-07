function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    },
    body: JSON.stringify(body)
  };
}

function requireAdmin(event) {
  const expected = process.env.ADMIN_TOKEN;
  const auth = event.headers.authorization || event.headers.Authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  return Boolean(expected && token && token === expected);
}

module.exports = { json, requireAdmin };
