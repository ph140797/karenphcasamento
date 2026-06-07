const { json } = require('./_http');
const { saveRsvp } = require('./_db');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const payload = JSON.parse(event.body || '{}');
    const name = String(payload.name || '').trim();
    const phone = String(payload.phone || '').trim();
    const guests = Array.isArray(payload.guests) ? payload.guests.map((guest) => String(guest).trim()).filter(Boolean) : [];

    if (!name) return json(400, { error: 'Nome obrigatório' });
    if (!phone) return json(400, { error: 'WhatsApp obrigatório' });

    const rsvp = await saveRsvp({
      name,
      phone,
      guests,
      guest_count: Math.max(1, Number(payload.guestCount || guests.length || 1)),
      message: String(payload.message || '').slice(0, 1000),
      created_at: new Date().toISOString()
    });

    return json(200, { rsvp });
  } catch (error) {
    return json(500, { error: error.message || 'Não foi possível confirmar presença' });
  }
};
