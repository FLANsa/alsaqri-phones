const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

admin.initializeApp();
setGlobalOptions({ region: 'me-central1', maxInstances: 10 });
const db = admin.firestore();

const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const dayKey = value => {
  const date = value && typeof value.toDate === 'function' ? value.toDate() : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};
const saleDelta = sale => {
  if (!sale || !Array.isArray(sale.items)) return null;
  const returned = sale.returned === true || sale.status === 'مسترجعة';
  const sign = returned ? -1 : 1;
  return {
    salesCount: sign,
    returnedCount: returned ? 1 : 0,
    salesTotal: sign * number(sale.total_amount),
    purchaseCost: sign * number(sale.total_purchase_cost),
    profit: sign * number(sale.total_profit)
  };
};
const normalize = value => String(value || '').toLowerCase().trim()
  .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const tokens = (...values) => [...new Set(values.flatMap(value => {
  const text = normalize(value); const words = text.split(/\s+/).filter(Boolean);
  return words.flatMap(word => Array.from({ length: Math.min(word.length, 12) }, (_, i) => word.slice(0, i + 1)));
}))].slice(0, 100);
exports.syncSaleSummaries = onDocumentWritten('sales/{saleId}', async event => {
  const before = event.data.before.exists ? event.data.before.data() : null;
  const after = event.data.after.exists ? event.data.after.data() : null;
  const changes = new Map();
  for (const [sale, multiplier] of [[before, -1], [after, 1]]) {
    if (!sale) continue;
    const day = dayKey(sale.sortAt || sale.date_created || sale.createdAt);
    const delta = saleDelta(sale);
    if (!day || !delta) continue;
    for (const id of [`daily_summaries/${day}`, `monthly_summaries/${day.slice(0, 7)}`]) {
      const row = changes.get(id) || { salesCount: 0, returnedCount: 0, salesTotal: 0, purchaseCost: 0, profit: 0 };
      for (const key of Object.keys(row)) row[key] += delta[key] * multiplier;
      changes.set(id, row);
    }
  }
  const eventRef = db.doc(`summary_events/${event.id}`);
  await db.runTransaction(async tx => {
    if ((await tx.get(eventRef)).exists) return;
    for (const [path, delta] of changes) {
      const ref = db.doc(path); const current = (await tx.get(ref)).data() || {};
      const next = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
      for (const key of Object.keys(delta)) next[key] = number(current[key]) + delta[key];
      tx.set(ref, next, { merge: true });
    }
    tx.set(eventRef, { saleId: event.params.saleId, processedAt: admin.firestore.FieldValue.serverTimestamp() });
  });
});

exports.rebuildSummary = onCall(async request => {
  if (request.auth?.token?.email !== 'admin@alsaqri.store') throw new HttpsError('permission-denied', 'المدير فقط');
  const { period, id } = request.data || {};
  if (!['day', 'month'].includes(period) || !/^\d{4}-\d{2}(-\d{2})?$/.test(String(id || ''))) {
    throw new HttpsError('invalid-argument', 'الفترة غير صالحة');
  }
  const rows = await db.collection('sales').get();
  const totals = { salesCount: 0, returnedCount: 0, salesTotal: 0, purchaseCost: 0, profit: 0 };
  rows.forEach(doc => {
    const sale = doc.data(); const key = dayKey(sale.sortAt || sale.date_created || sale.createdAt);
    if (!key || !(period === 'day' ? key === id : key.startsWith(id))) return;
    const delta = saleDelta(sale); if (!delta) return;
    for (const field of Object.keys(totals)) totals[field] += delta[field];
  });
  const name = period === 'day' ? 'daily_summaries' : 'monthly_summaries';
  await db.doc(`${name}/${id}`).set({ ...totals, rebuiltAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return { id, ...totals };
});

exports.rebuildAllSummaries = onCall(async request => {
  if (request.auth?.token?.email !== 'admin@alsaqri.store') throw new HttpsError('permission-denied', 'المدير فقط');
  const days = new Map(); const months = new Map();
  const add = (map, id, delta) => {
    const row = map.get(id) || { salesCount: 0, returnedCount: 0, salesTotal: 0, purchaseCost: 0, profit: 0 };
    for (const key of Object.keys(row)) row[key] += delta[key]; map.set(id, row);
  };
  const rows = await db.collection('sales').get();
  rows.forEach(doc => {
    const sale = doc.data(); const day = dayKey(sale.sortAt || sale.date_created || sale.createdAt); const delta = saleDelta(sale);
    if (day && delta) { add(days, day, delta); add(months, day.slice(0, 7), delta); }
  });
  const batch = db.batch();
  for (const [id, row] of days) batch.set(db.doc(`daily_summaries/${id}`), { ...row, rebuiltAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  for (const [id, row] of months) batch.set(db.doc(`monthly_summaries/${id}`), { ...row, rebuiltAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit();
  return { sales: rows.size, days: days.size, months: months.size };
});

exports.migrateCollectionBatch = onCall(async request => {
  if (request.auth?.token?.email !== 'admin@alsaqri.store') throw new HttpsError('permission-denied', 'المدير فقط');
  const { collection: name, afterId = null, batchSize = 200 } = request.data || {};
  if (!['phones', 'accessories', 'sales', 'maintenanceJobs'].includes(name)) {
    throw new HttpsError('invalid-argument', 'المجموعة غير مدعومة');
  }
  const size = Math.min(Math.max(Number(batchSize) || 200, 1), 400);
  let query = db.collection(name).orderBy(admin.firestore.FieldPath.documentId()).limit(size);
  if (afterId) query = query.startAfter(String(afterId));
  const rows = await query.get();
  const batch = db.batch();
  rows.forEach(row => {
    const data = row.data();
    const rawDate = data.sortAt || data.date_created || data.date_added || data.visitDate || data.createdAt;
    const parsed = rawDate && typeof rawDate.toDate === 'function' ? rawDate.toDate() : new Date(rawDate || Date.now());
    const patch = { sortAt: admin.firestore.Timestamp.fromDate(Number.isNaN(parsed.getTime()) ? new Date() : parsed) };
    if (name === 'phones') {
      patch.normalizedBarcode = normalize(data.phone_number || data.device_number);
      patch.normalizedSerial = normalize(data.serial_number);
      patch.searchTokens = tokens(data.manufacturer || data.brand, data.model, data.phone_number, data.serial_number);
    } else if (name === 'accessories') {
      patch.normalizedBarcode = normalize(data.barcode || data.barcode_id || data.sku);
      patch.searchTokens = tokens(data.name, data.arabic_name, data.category, data.barcode, data.sku);
    }
    batch.set(row.ref, patch, { merge: true });
  });
  await batch.commit();
  return { collection: name, processed: rows.size, nextAfterId: rows.empty ? null : rows.docs[rows.docs.length - 1].id, done: rows.size < size };
});
