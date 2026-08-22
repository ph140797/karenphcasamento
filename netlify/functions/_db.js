const { getStore } = require('@netlify/blobs');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const supabaseServerKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
// Orders and RSVPs are persisted in Netlify Blobs. The gift catalogue lives in
// index.html, so the site no longer depends on a Supabase project.
const hasSupabase = false;
const useLocalFiles = !hasSupabase && process.env.NETLIFY_DEV === 'true';
const localRoot = path.join(process.cwd(), '.netlify', 'local-db');

function supabase() {
  return createClient(process.env.SUPABASE_URL, supabaseServerKey, {
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

  if (useLocalFiles) {
    const gifts = await readLocal('wedding-gifts', 'catalog', []);
    return Array.isArray(gifts) ? gifts : [];
  }

  const gifts = await getStore('wedding-gifts').get('catalog', { type: 'json' });
  return Array.isArray(gifts) ? gifts : [];
}

async function saveGifts(gifts) {
  const records = gifts.map((gift, index) => ({
    id: String(gift.id || `gift-${index}`),
    name: String(gift.name || '').trim(),
    price: Number(gift.price || gift.amount || 0),
    image: String(gift.image || gift.img || ''),
    store: String(gift.store || 'Contribuicao especial'),
    special: Boolean(gift.special || gift.comic),
    active: gift.active !== false,
    purchased: Boolean(gift.purchased),
    purchased_order_id: gift.purchased_order_id || null
  })).filter((gift) => gift.name && gift.price > 0);

  if (hasSupabase) {
    const incomingIds = records.map((gift) => gift.id);
    const { data: current, error: currentError } = await supabase()
      .from('wedding_gifts')
      .select('id')
      .eq('active', true);
    if (currentError) throw currentError;

    const removedIds = (current || [])
      .map((gift) => gift.id)
      .filter((id) => !incomingIds.includes(id));

    if (removedIds.length) {
      const { error } = await supabase()
        .from('wedding_gifts')
        .update({ active: false, updated_at: nowIso() })
        .in('id', removedIds);
      if (error) throw error;
    }

    if (records.length) {
      const { error } = await supabase()
        .from('wedding_gifts')
        .upsert(records, { onConflict: 'id' });
      if (error) throw error;
    }

    return listGifts();
  }

  if (useLocalFiles) {
    await writeLocal('wedding-gifts', 'catalog', records);
    return records;
  }

  await getStore('wedding-gifts').setJSON('catalog', records);
  return records;
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
