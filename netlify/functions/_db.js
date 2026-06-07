const { getStore } = require('@netlify/blobs');
const { createClient } = require('@supabase/supabase-js');

const hasSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

function supabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
}

function nowIso() {
  return new Date().toISOString();
}

async function saveOrder(order) {
  const record = { ...order, updated_at: nowIso() };

  if (hasSupabase) {
    const { error } = await supabase()
      .from('wedding_orders')
      .upsert(record, { onConflict: 'id' });
    if (error) throw error;
    return record;
  }

  const store = getStore('wedding-orders');
  await store.setJSON(record.id, record);
  return record;
}

async function getOrder(id) {
  if (hasSupabase) {
    const { data, error } = await supabase()
      .from('wedding_orders')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  return getStore('wedding-orders').get(id, { type: 'json' });
}

async function listOrders() {
  if (hasSupabase) {
    const { data, error } = await supabase()
      .from('wedding_orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  const store = getStore('wedding-orders');
  const { blobs } = await store.list();
  const orders = await Promise.all(blobs.map((blob) => store.get(blob.key, { type: 'json' })));
  return orders.filter(Boolean).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

async function updateOrder(id, patch) {
  const current = await getOrder(id);
  if (!current) return null;
  return saveOrder({ ...current, ...patch, id });
}

async function listGifts() {
  if (hasSupabase) {
    const { data, error } = await supabase()
      .from('wedding_gifts')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  const gifts = await getStore('wedding-gifts').get('catalog', { type: 'json' });
  return Array.isArray(gifts) ? gifts : [];
}

async function saveGifts(gifts) {
  if (hasSupabase) {
    const { error } = await supabase()
      .from('wedding_gifts')
      .upsert(gifts, { onConflict: 'id' });
    if (error) throw error;
    return gifts;
  }

  await getStore('wedding-gifts').setJSON('catalog', gifts);
  return gifts;
}

module.exports = {
  getOrder,
  listGifts,
  listOrders,
  saveGifts,
  saveOrder,
  updateOrder
};
