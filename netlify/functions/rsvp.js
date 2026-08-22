const { json } = require('./_http');
const { saveRsvp } = require('./_db');
const { appendRsvp } = require('./_google-sheets');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const payload = JSON.parse(event.body || '{}');
    const name = String(payload.name || '').trim();
    const rawPhone = String(payload.phone || '').trim();
    const phoneDigits = rawPhone.replace(/\D/g, '');
    const phone = phoneDigits.length === 11
      ? `(${phoneDigits.slice(0, 2)}) ${phoneDigits.slice(2, 7)}-${phoneDigits.slice(7)}`
      : `(${phoneDigits.slice(0, 2)}) ${phoneDigits.slice(2, 6)}-${phoneDigits.slice(6)}`;
    const guests = Array.isArray(payload.guests) ? payload.guests.map((guest) => String(guest).trim()).filter(Boolean) : [];
    const isFullName = (value) => {
      const parts = value.trim().split(/\s+/);
      return parts.length >= 2 && parts.every((part) => /^[A-Za-zÀ-ÖØ-öø-ÿ'’-]{2,}$/.test(part));
    };

    if (!name) return json(400, { error: 'Nome completo obrigatório' });
    if (!isFullName(name)) return json(400, { error: 'Informe nome e sobrenome' });
    if (!rawPhone) return json(400, { error: 'WhatsApp obrigatório' });
    if (!/^[1-9]{2}(?:\d{8}|\d{9})$/.test(phoneDigits) || /^(\d)\1+$/.test(phoneDigits)) {
      return json(400, { error: 'Informe um WhatsApp válido com DDD' });
    }
    if (guests.length > 10) return json(400, { error: 'Limite de 10 pessoas por confirmação' });

    const companions = guests.slice(1);
    if (companions.some((companion) => !isFullName(companion))) {
      return json(400, { error: 'Informe nome e sobrenome de todos os acompanhantes' });
    }
    const guestList = [name, ...companions];

    const rsvp = await saveRsvp({
      id: require('node:crypto').randomUUID(),
      name,
      phone,
      guests: guestList,
      guest_count: guestList.length,
      message: String(payload.message || '').slice(0, 1000),
      created_at: new Date().toISOString()
    });
    await appendRsvp(rsvp);

    return json(200, { rsvp });
  } catch (error) {
    return json(500, { error: error.message || 'Não foi possível confirmar presença' });
  }
};
