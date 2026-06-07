const { getStore } = require('@netlify/blobs');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const hasSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const useLocalFiles = !hasSupabase && process.env.NETLIFY_DEV === 'true';
const localRoot = path.join(process.cwd(), '.netlify', 'local-db');

function supabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
}

function nowIso() {
  return new Date().toISOString();
}

async function readLocal(bucket, key, fallback = null) {
  try {
    const raw = await fs.readFile(path.join(localRoot, bucket, `${key}.json`), 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeLocal(bucket, key, value) {
  const dir = path.join(localRoot, bucket);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${key}.json`), JSON.stringify(value, null, 2));
}

async function listLocal(bucket) {
  const dir = path.join(localRoot, bucket);
  try {
    const files = await fs.readdir(dir);
    const records = await Promise.all(
      files.filter((file) => file.endsWith('.json')).map((file) => readLocal(bucket, file.replace(/\.json$/, '')))
    );
    return records.filter(Boolean);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
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

  if (useLocalFiles) {
    await writeLocal('wedding-orders', record.id, record);
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

  if (useLocalFiles) return readLocal('wedding-orders', id);

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

  if (useLocalFiles) {
    return (await listLocal('wedding-orders'))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }

  const store = getStore('wedding-orders');
  const { blobs } = await store.list();
  const orders = await Promise.all(blobs.map((blob) => store.get(blob.key, { type: 'json' })));
  return orders.filter(Boolean).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

async function updateOrder(id, patch) {
  const current = await getOrder(id);
  if (!current) return null;
  const updated = await saveOrder({ ...current, ...patch, id });
  if (updated.status === 'paid') await markGiftsPurchased(updated.items || [], updated.id);
  return updated;
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

  if (useLocalFiles) {
    const gifts = await readLocal('wedding-gifts', 'catalog', []);
    return Array.isArray(gifts) ? gifts : [];
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

  if (useLocalFiles) {
    await writeLocal('wedding-gifts', 'catalog', gifts);
    return gifts;
  }

  await getStore('wedding-gifts').setJSON('catalog', gifts);
  return gifts;
}

async function saveRsvp(rsvp) {
  const record = { ...rsvp, updated_at: nowIso() };

  if (hasSupabase) {
    const { data, error } = await supabase()
      .from('wedding_rsvps')
      .insert(record)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  if (useLocalFiles) {
    const id = record.id || crypto.randomUUID();
    await writeLocal('wedding-rsvps', id, { ...record, id });
    return { ...record, id };
  }

  const id = record.id || crypto.randomUUID();
  await getStore('wedding-rsvps').setJSON(id, { ...record, id });
  return { ...record, id };
}

async function listRsvps() {
  if (hasSupabase) {
    const { data, error } = await supabase()
      .from('wedding_rsvps')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  if (useLocalFiles) {
    return (await listLocal('wedding-rsvps'))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }

  const store = getStore('wedding-rsvps');
  const { blobs } = await store.list();
  const rsvps = await Promise.all(blobs.map((blob) => store.get(blob.key, { type: 'json' })));
  return rsvps.filter(Boolean).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

async function markGiftsPurchased(items, orderId) {
  const ids = (items || []).map((item) => String(item.id)).filter(Boolean);
  if (!ids.length) return;

  if (hasSupabase) {
    const { error } = await supabase()
      .from('wedding_gifts')
      .update({ purchased: true, purchased_order_id: orderId, updated_at: nowIso() })
      .in('id', ids);
    if (error) throw error;
  }
}

async function listPaidGiftIds() {
  const orders = await listOrders();
  return Array.from(new Set(
    orders
      .filter((order) => order.status === 'paid')
      .flatMap((order) => order.items || [])
      .map((item) => String(item.id))
      .filter(Boolean)
  ));
}

module.exports = {
  getOrder,
  listGifts,
  listOrders,
  listPaidGiftIds,
  listRsvps,
  saveRsvp,
  saveGifts,
  saveOrder,
  updateOrder
};
