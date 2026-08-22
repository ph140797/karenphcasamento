const { exchangeCode, verifyState } = require('./_google-sheets');

exports.handler = async (event) => {
  try {
    if (!verifyState(event.queryStringParameters?.state)) throw new Error('Estado OAuth inválido ou expirado');
    if (!event.queryStringParameters?.code) throw new Error(event.queryStringParameters?.error || 'Autorização cancelada');
    await exchangeCode(event.queryStringParameters.code);
    return { statusCode: 302, headers: { location: '/admin?google=connected', 'cache-control': 'no-store' }, body: '' };
  } catch (error) {
    return { statusCode: 302, headers: { location: `/admin?google=error&message=${encodeURIComponent(error.message)}`, 'cache-control': 'no-store' }, body: '' };
  }
};
