// Camada de persistência das Netlify Functions.
//
// Prioridade de armazenamento:
//   1. Supabase (quando SUPABASE_URL + chave secreta estão definidos) — ver _supabase.js
//   2. Arquivos locais em .netlify/local-db (apenas em `netlify dev`, sem Supabase)
//   3. Netlify Blobs (fallback em produção sem Supabase)

const { getStore } = require('@netlify/blobs');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { TABLES, hasSupabase, getSupabase } = require('./_supabase');
const catalog = require('./_gift-catalog');

const useLocalFiles = !hasSupabase && process.env.NETLIFY_DEV === 'true';
const localRoot = path.join(process.cwd(), '.netlify', 'local-db');

function storageBackend() {
  if (hasSupabase) return 'supabase';
  if (useLocalFiles) return 'local-files';
  return 'netlify-blobs';
}

function nowIso() {
  return new Date().toISOString();
}

function byCreatedDesc(a, b) {
  return String(b.created_at).localeCompare(String(a.created_at));
}

// ---------- fallback local (netlify dev) ----------

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

// ---------- pedidos ----------

async function saveOrder(order) {
  const record = { ...order, updated_at: nowIso() };

  if (hasSupabase) {
    const { error } = await getSupabase()
      .from(TABLES.orders)
      .upsert(record, { onConflict: 'id' });
    if (error) throw error;
    return record;
  }

  if (useLocalFiles) {
    await writeLocal('wedding-orders', record.id, record);
    return record;
  }

  await getStore('wedding-orders').setJSON(record.id, record);
  return record;
}

async function getOrder(id) {
  if (hasSupabase) {
    const { data, error } = await getSupabase()
      .from(TABLES.orders)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  if (useLocalFiles) return readLocal('wedding-orders', id);

  return getStore('wedding-orders').get(id, { type: 'json' });
}

async function listOrders() {
  if (hasSupabase) {
    const { data, error } = await getSupabase()
      .from(TABLES.orders)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  if (useLocalFiles) return (await listLocal('wedding-orders')).sort(byCreatedDesc);

  const store = getStore('wedding-orders');
  const { blobs } = await store.list();
  const orders = await Promise.all(blobs.map((blob) => store.get(blob.key, { type: 'json' })));
  return orders.filter(Boolean).sort(byCreatedDesc);
}

async function updateOrder(id, patch) {
  const current = await getOrder(id);
  if (!current) return null;
  return saveOrder({ ...current, ...patch, id });
}

// ---------- presentes ----------

function normalizeGiftRecord(gift, index) {
  return {
    id: String(gift.id || `gift-${index}`),
    name: String(gift.name || '').trim(),
    price: Number(gift.price || gift.amount || 0),
    image: String(gift.image || gift.img || ''),
    store: String(gift.store || catalog.DEFAULT_STORE),
    special: Boolean(gift.special || gift.comic),
    active: gift.active !== false,
    purchased: Boolean(gift.purchased),
    purchased_order_id: gift.purchased_order_id || null
  };
}

// Presentes cadastrados no banco (ativos). Vazio se nada foi cadastrado.
async function listGifts() {
  if (hasSupabase) {
    const { data, error } = await getSupabase()
      .from(TABLES.gifts)
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  if (useLocalFiles) {
    const gifts = await readLocal('wedding-gifts', 'catalog', []);
    return Array.isArray(gifts) ? gifts.filter((gift) => gift.active !== false) : [];
  }

  const gifts = await getStore('wedding-gifts').get('catalog', { type: 'json' });
  return Array.isArray(gifts) ? gifts.filter((gift) => gift.active !== false) : [];
}

// Catálogo efetivo do site: banco quando há presentes, senão o catálogo padrão.
async function listCatalogGifts() {
  try {
    const stored = await listGifts();
    if (stored.length) return { source: storageBackend(), gifts: stored };
  } catch (error) {
    console.error('listGifts falhou, usando catálogo padrão:', error.message);
  }
  return { source: 'static', gifts: catalog.gifts };
}

async function getCatalogGiftsById() {
  const { gifts } = await listCatalogGifts();
  return new Map(gifts.map((gift) => [String(gift.id), gift]));
}

// Substitui o catálogo inteiro: o que não vier na lista é desativado.
async function saveGifts(gifts) {
  const records = gifts.map(normalizeGiftRecord).filter((gift) => gift.name && gift.price > 0);

  if (hasSupabase) {
    const db = getSupabase();
    const incomingIds = records.map((gift) => gift.id);
    const { data: current, error: currentError } = await db
      .from(TABLES.gifts)
      .select('id')
      .eq('active', true);
    if (currentError) throw currentError;

    const removedIds = (current || []).map((gift) => gift.id).filter((id) => !incomingIds.includes(id));
    if (removedIds.length) {
      const { error } = await db
        .from(TABLES.gifts)
        .update({ active: false, updated_at: nowIso() })
        .in('id', removedIds);
      if (error) throw error;
    }

    if (records.length) {
      const { error } = await db.from(TABLES.gifts).upsert(records, { onConflict: 'id' });
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

// Cadastra no banco os presentes do catálogo padrão (_gift-catalog.js).
// Sem `overwrite`, presentes já existentes são mantidos como estão.
async function seedGifts({ overwrite = false } = {}) {
  const records = catalog.toGiftRecords();

  if (hasSupabase) {
    const db = getSupabase();
    const { data: existing, error: existingError } = await db
      .from(TABLES.gifts)
      .select('id')
      .in('id', records.map((gift) => gift.id));
    if (existingError) throw existingError;
    const existingIds = new Set((existing || []).map((gift) => gift.id));

    const { error } = await db
      .from(TABLES.gifts)
      .upsert(records, { onConflict: 'id', ignoreDuplicates: !overwrite });
    if (error) throw error;

    return {
      backend: 'supabase',
      inserted: records.filter((gift) => !existingIds.has(gift.id)).length,
      updated: overwrite ? existingIds.size : 0,
      skipped: overwrite ? 0 : existingIds.size,
      gifts: await listGifts()
    };
  }

  const current = useLocalFiles
    ? await readLocal('wedding-gifts', 'catalog', [])
    : await getStore('wedding-gifts').get('catalog', { type: 'json' });
  const currentList = Array.isArray(current) ? current : [];
  const currentById = new Map(currentList.map((gift) => [String(gift.id), gift]));

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  for (const record of records) {
    if (!currentById.has(record.id)) {
      currentById.set(record.id, record);
      inserted += 1;
    } else if (overwrite) {
      currentById.set(record.id, { ...currentById.get(record.id), ...record });
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  const merged = Array.from(currentById.values());
  if (useLocalFiles) await writeLocal('wedding-gifts', 'catalog', merged);
  else await getStore('wedding-gifts').setJSON('catalog', merged);

  return { backend: storageBackend(), inserted, updated, skipped, gifts: merged.filter((gift) => gift.active !== false) };
}

// ---------- confirmações de presença ----------

async function saveRsvp(rsvp) {
  const record = { ...rsvp, id: rsvp.id || crypto.randomUUID(), updated_at: nowIso() };

  if (hasSupabase) {
    const { data, error } = await getSupabase()
      .from(TABLES.rsvps)
      .insert(record)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  if (useLocalFiles) {
    await writeLocal('wedding-rsvps', record.id, record);
    return record;
  }

  await getStore('wedding-rsvps').setJSON(record.id, record);
  return record;
}

async function listRsvps() {
  if (hasSupabase) {
    const { data, error } = await getSupabase()
      .from(TABLES.rsvps)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  if (useLocalFiles) return (await listLocal('wedding-rsvps')).sort(byCreatedDesc);

  const store = getStore('wedding-rsvps');
  const { blobs } = await store.list();
  const rsvps = await Promise.all(blobs.map((blob) => store.get(blob.key, { type: 'json' })));
  return rsvps.filter(Boolean).sort(byCreatedDesc);
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
  storageBackend,
  getOrder,
  getCatalogGiftsById,
  listCatalogGifts,
  listGifts,
  listOrders,
  listPaidGiftIds,
  listRsvps,
  saveRsvp,
  saveGifts,
  seedGifts,
  saveOrder,
  updateOrder
};
