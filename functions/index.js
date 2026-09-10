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
  .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632))
  .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776))
  .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const normalizeKey = value => normalize(value).replace(/\s+/g, '');
const tokens = (...values) => [...new Set(values.flatMap(value => {
  const text = normalize(value); const words = text.split(/\s+/).filter(Boolean);
  return words.flatMap(word => Array.from({ length: Math.min(word.length, 12) }, (_, i) => word.slice(0, i + 1)));
}))].slice(0, 100);
const authorized = request => request.auth?.token?.email === 'admin@alsaqri.store' || request.auth?.token?.email === 'user@alsaqri.store';
const inventoryFields = (name, data) => name === 'phones'
  ? [data.manufacturer, data.brand, data.model, data.phone_number, data.device_number, data.serial_number, data.condition, data.phone_type]
  : [data.name, data.arabic_name, data.category, data.barcode, data.barcode_id, data.sku, data.serial_number];
const matchesQuery = (name, data, terms) => {
  const words = normalize(inventoryFields(name, data).join(' ')).split(/\s+/).filter(Boolean);
  return terms.every(term => words.some(word => word.startsWith(term)));
};

/**
 * صفحة بحث مستقلة لنوع مخزون واحد. تستخدم أطول كلمة كمرشح Firestore ثم
 * تتحقق من كل الكلمات على الخادم، لذلك لا تفقد نتائج البحث متعدد الكلمات.
 */
exports.searchInventoryPage = onCall(async request => {
  if (!authorized(request)) throw new HttpsError('permission-denied', 'يلزم تسجيل الدخول');
  const { collection: name, query: rawQuery, cursor = null, pageSize = 20, includeExact = true, includeTotal = false } = request.data || {};
  if (!['phones', 'accessories'].includes(name)) throw new HttpsError('invalid-argument', 'نوع المخزون غير مدعوم');
  const terms = normalize(rawQuery).split(/\s+/).filter(Boolean);
  if (!terms.length) throw new HttpsError('invalid-argument', 'عبارة البحث مطلوبة');
  const safeSize = Math.min(Math.max(Number(pageSize) || 20, 1), 50);
  const primary = terms.slice().sort((a, b) => b.length - a.length)[0].slice(0, 12);
  const ref = db.collection(name);
  const rawKey = normalizeKey(rawQuery);
  const exactFields = name === 'phones' ? ['normalizedBarcode', 'normalizedSerial'] : ['normalizedBarcode', 'normalizedSerial'];
  const exactSnapshots = rawKey ? await Promise.all(exactFields.map(field => ref.where(field, '==', rawKey).get())) : [];
  const exact = new Map();
  exactSnapshots.flatMap(snapshot => snapshot.docs).forEach(row => {
    if (matchesQuery(name, row.data(), terms)) exact.set(row.id, { id: row.id, ...row.data() });
  });
  const exactIds = new Set(exact.keys());
  let candidate = ref.where('searchTokens', 'array-contains', primary);
  if (name === 'phones') candidate = candidate.orderBy('searchStatus', 'asc');
  candidate = candidate.orderBy('sortAt', 'desc').orderBy(admin.firestore.FieldPath.documentId(), 'desc');
  if (cursor?.sortAtMillis && cursor?.id) {
    const values = name === 'phones'
      ? [Number(cursor.searchStatus) || 0, admin.firestore.Timestamp.fromMillis(Number(cursor.sortAtMillis)), String(cursor.id)]
      : [admin.firestore.Timestamp.fromMillis(Number(cursor.sortAtMillis)), String(cursor.id)];
    candidate = candidate.startAfter(...values);
  }

  const results = includeExact ? [...exact.values()] : [];
  let lastCandidate = null;
  let exhausted = false;
  while (results.length < safeSize && !exhausted) {
    const batch = await candidate.limit(100).get();
    if (batch.empty) { exhausted = true; break; }
    for (const row of batch.docs) {
      lastCandidate = row;
      if (!exactIds.has(row.id) && matchesQuery(name, row.data(), terms)) {
        results.push({ id: row.id, ...row.data() });
        if (results.length === safeSize) break;
      }
    }
    if (batch.size < 100 || results.length === safeSize) exhausted = batch.size < 100;
    if (!exhausted && results.length < safeSize) {
      candidate = candidate.startAfter(lastCandidate);
    }
  }

  let total = null;
  if (includeTotal) {
    const allCandidates = await ref.where('searchTokens', 'array-contains', primary).get();
    const ids = new Set(exactIds);
    allCandidates.docs.forEach(row => { if (matchesQuery(name, row.data(), terms)) ids.add(row.id); });
    total = ids.size;
  }
  const finalRows = results.slice(0, safeSize);
  const last = finalRows.length && lastCandidate ? lastCandidate : null;
  return {
    items: finalRows,
    nextCursor: last ? { id: last.id, sortAtMillis: last.data().sortAt.toMillis(), searchStatus: name === 'phones' ? Number(last.data().searchStatus) || 0 : undefined } : null,
    hasMore: !exhausted,
    total
  };
});
exports.syncSaleSummaryEvents = onDocumentWritten('sales/{saleId}', async event => {
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
      patch.normalizedBarcode = normalizeKey(data.phone_number || data.device_number);
      patch.normalizedSerial = normalizeKey(data.serial_number);
      patch.searchTokens = tokens(data.manufacturer || data.brand, data.model, data.phone_number, data.serial_number);
      patch.searchStatus = data.sold === true ? 1 : 0;
    } else if (name === 'accessories') {
      patch.normalizedBarcode = normalizeKey(data.barcode || data.barcode_id || data.sku);
      patch.normalizedSerial = normalizeKey(data.serial_number);
      patch.searchTokens = tokens(data.name, data.arabic_name, data.category, data.barcode, data.sku);
    }
    batch.set(row.ref, patch, { merge: true });
  });
  await batch.commit();
  return { collection: name, processed: rows.size, nextAfterId: rows.empty ? null : rows.docs[rows.docs.length - 1].id, done: rows.size < size };
});
