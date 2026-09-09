// ============================================================
// طبقة بيانات Firestore — الصقري للاتصالات (نسخة معاد بناؤها)
//
// مبادئ التصميم:
// 1. كاش IndexedDB موحّد 5 دقائق لكل المجموعات (بلا حصة 5MB التي كانت
//    تُسقط الكاش صامتةً في localStorage) — الكاش لكل جهاز/متصفح، والتعديل
//    من جهاز آخر يظهر خلال 5 دقائق
// 2. كل كتابة تُرقّع صفوف الكاش المتأثرة بدل مسح المجموعة كاملة، وتمسح
//    فقط نتائج الاستعلامات المشتقة للمجموعة نفسها
// 3. ضيّق النطاق على الخادم متى أمكن: نطاق زمني أو حالة واحدة (فهارس
//    أحادية بلا فهارس مركّبة) — والفلاتر المركّبة داخل الذاكرة
// 4. قراءة موجّهة لسجل واحد (where/getDoc) بدل قراءة المجموعة كاملة
// 5. الكتابات المتعددة تمر عبر writeBatch (حد 400 عملية للدفعة)
// 6. قاطع دائرة 5 دقائق عند نفاد حصة Firestore (resource-exhausted)
// ============================================================
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  documentId,
  serverTimestamp,
  runTransaction,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ---------- قاطع دائرة حصة Firestore ----------
const QUOTA_COOLDOWN_MS = 5 * 60 * 1000;
function isQuotaCooling() {
  try {
    const t = parseInt(localStorage.getItem('__firestoreQuotaExhaustedAt') || '0', 10) || 0;
    return t && (Date.now() - t) < QUOTA_COOLDOWN_MS;
  } catch (_) { return false; }
}
function markQuotaExhausted() {
  try { localStorage.setItem('__firestoreQuotaExhaustedAt', String(Date.now())); } catch (_) {}
}
function clearQuotaCooling() {
  try { localStorage.removeItem('__firestoreQuotaExhaustedAt'); } catch (_) {}
}
function isQuotaError(error) {
  return !!(error && (error.code === 'resource-exhausted' || error.code === 'unavailable'));
}

// ---------- الكاش المحلي (IndexedDB) ----------
// كان الكاش في localStorage ومات صامتةً عند امتلاء حصته (~5MB): كل صفحة
// تصبح قراءة كاملة للمجموعات. IndexedDB سعته أكبر بمراتب ولا يعاني ذلك.
// مدة قصيرة تقلل عرض بيانات قديمة بعد تعديلها من جهاز آخر، مع إبقاء تجميع
// القراءات المتزامنة وكاش التنقل السريع بين صفحات التطبيق.
const CACHE_TTL_MS = 30 * 1000;
const IDB_NAME = 'alsaqri_fs_cache';
const IDB_STORE = 'kv';
// لقطة المجموعة الكاملة تحت 'full:<name>'، ونتائج الاستعلامات المشتقة
// تحت '<name>#...' حتى تُمسح دفعة واحدة عند أي كتابة على المجموعة
const FULL_KEY = (name) => 'full:' + name;
const DERIVED_PREFIX = (name) => name + '#';

let _idbPromise = null;
function idbOpen() {
  if (!_idbPromise) {
    _idbPromise = new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } catch (e) { reject(e); }
    });
    // اسمح بمحاولة افتتاح جديدة إذا فشلت الحالية (وضع التصفح الخاص مثلاً)
    _idbPromise.catch(() => { _idbPromise = null; });
  }
  return _idbPromise;
}

function idbRun(mode, fn) {
  return idbOpen().then((db) => new Promise((resolve, reject) => {
    let tx;
    try { tx = db.transaction(IDB_STORE, mode); } catch (e) { reject(e); return; }
    const done = new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error || new Error('idb aborted'));
    });
    try { fn(tx.objectStore(IDB_STORE)); } catch (e) { reject(e); return; }
    done.then(() => resolve(), reject);
  }));
}
const idbGetKey = (store, key) => new Promise((resolve, reject) => {
  const req = store.get(key);
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

async function idbGet(key) {
  try {
    let value;
    await idbRun('readonly', async (store) => { value = await idbGetKey(store, key); });
    return value;
  } catch (_) { return undefined; }
}

async function idbSet(key, value) {
  try {
    await idbRun('readwrite', (store) => { store.put(value, key); });
  } catch (e) {
    console.warn('⚠️ فشل تخزين الكاش في IndexedDB:', key, e);
  }
}

async function idbDelete(key) {
  try { await idbRun('readwrite', (store) => { store.delete(key); }); } catch (_) {}
}

/** احذف كل المفاتيح التي تبدأ ببادئة معينة (نطاق مفاتيح متصل) */
async function idbDeletePrefix(prefix) {
  try {
    await idbRun('readwrite', (store) => {
      const range = IDBKeyRange.bound(prefix, prefix + '\uffff', false, false);
      const cur = store.openCursor(range);
      cur.onsuccess = () => { const c = cur.result; if (c) { c.delete(); c.continue(); } };
    });
  } catch (_) {}
}

async function idbClearAll() {
  try { await idbRun('readwrite', (store) => { store.clear(); }); } catch (_) {}
}

class FirebaseDatabase {
  constructor() {
    this.db = window.firebaseDB;
    this.auth = window.firebaseAuth;
    // عدّاد قراءات Firestore للمراقبة — يُصفَّر مع كل تحميل صفحة
    // اقرأه من الكونسول: window.firebaseDatabase._reads
    this._reads = { rpcs: 0, docs: 0, full: {} };
    // طابور ترقيع تسلسلي يمنع سباق قراءة/كتابة بين عمليتي كتابة متتاليتين
    this._patchQueue = Promise.resolve();
    this._pendingReads = new Map();
    this._cacheRevision = 0;
    // إزالة مخلفات الكاش القديم من localStorage (لم تعد تُقرأ وتستهلك الحصة)
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('fs_cache_'))
        .forEach(k => localStorage.removeItem(k));
    } catch (_) {}
  }

  _trackReads(label, docs) {
    this._reads.rpcs += 1;
    this._reads.docs += docs;
    if (label.startsWith('full:')) {
      const name = label.slice(5);
      this._reads.full[name] = (this._reads.full[name] || 0) + docs;
    }
  }

  /** getDocs مع تتبّع القراءة */
  async _getDocs(label, q) {
    const snap = await getDocs(q);
    this._trackReads(label, snap.size ?? 1);
    return snap;
  }

  /** getDoc مع تتبّع القراءة */
  async _getDoc(label, ref) {
    const snap = await getDoc(ref);
    this._trackReads(label, snap.exists() ? 1 : 0);
    return snap;
  }

  // ===== أدوات الكاش =====
  /** يعيد الدخول كاملاً { t, data } أو null — الفحص الزمني هنا */
  async _cacheEntryGet(key) {
    try {
      const entry = await idbGet(key);
      if (!entry || typeof entry !== 'object' || !entry.data) return null;
      if (Date.now() - entry.t > CACHE_TTL_MS) {
        idbDelete(key); // إزالة الإدخال المنتهي — دون انتظار
        return null;
      }
      return entry;
    } catch (_) {
      return null;
    }
  }

  async _cacheEntryPeek(key) {
    try {
      const entry = await idbGet(key);
      return entry && typeof entry === 'object' && Array.isArray(entry.data) ? entry : null;
    } catch (_) { return null; }
  }

  async _cacheSet(key, data, t = Date.now()) {
    await idbSet(key, { t, data });
  }

  /** مسح كاش مجموعة كاملة — فقط للمسارات النادرة التي تعيد كتابة كل الصفوف */
  _dropCollectionCache(name) {
    this._cacheRevision++;
    return this._queuePatch(async () => {
      await idbDeletePrefix(DERIVED_PREFIX(name));
      await idbDelete(FULL_KEY(name));
    });
  }

  /** تسلسل عمليات الترقيع: كل عملية تنتظر انتهاء سابقتها فلا سباق قراءة/كتابة */
  _queuePatch(fn) {
    const run = this._patchQueue.then(fn).catch((e) => console.warn('⚠️ ترقيع الكاش:', e));
    this._patchQueue = run;
    return run;
  }

  /** مسح كل الكاش المحلي — يُستدعى عند تسجيل الخروج وزر التحديث */
  async clearAllCache() {
    this._cacheRevision++;
    await this._patchQueue;
    await idbClearAll();
    console.log('🗑️ تم مسح كاش Firestore المحلي بالكامل');
  }

  /**
   * يطبّق كتابة على المجموعة: يمسح نتائج استعلاماتها المشتقة دائماً،
   * ويُرقّع اللقطة الكاملة المخزنة عبر mutator إن وُجدت.
   * mutator يستقبل نسخة الصفوف ويعيد النسخة الجديدة، أو null للإبقاء عليها.
   */
  _applyWrite(name, mutateFull) {
    this._cacheRevision++;
    return this._queuePatch(async () => {
      // المشتقات تُمسح حتى بلا لقطة كاملة (قد تكون موجودة واللقطة منتهية)
      await idbDeletePrefix(DERIVED_PREFIX(name));
      if (!mutateFull) return;
      const key = FULL_KEY(name);
      const entry = await this._cacheEntryGet(key);
      if (!entry || !Array.isArray(entry.data)) return;
      const rows = mutateFull(entry.data.slice());
      if (Array.isArray(rows)) await this._cacheSet(key, rows, entry.t); // نحافظ على عمر الكاش الأصلي
    });
  }

  /** إضافة مستند جديد إلى الكاش إن وُجد (createdAt/updatedAt محلية مؤقتة) */
  _patchAddRow(name, row) {
    return this._applyWrite(name, (rows) => {
      const i = rows.findIndex(r => String(r.id) === String(row.id));
      if (i >= 0) rows[i] = { ...rows[i], ...row };
      else rows.push(row);
      return rows;
    });
  }

  /** دمج حقول في مستند موجود داخل الكاش إن وُجد */
  _patchUpdateRow(name, id, fields) {
    return this._applyWrite(name, (rows) => {
      const i = rows.findIndex(r => String(r.id) === String(id));
      if (i === -1) return null;
      rows[i] = { ...rows[i], ...fields };
      return rows;
    });
  }

  /** حذف مستند من الكاش إن وُجد */
  _patchRemoveRow(name, id) {
    return this._applyWrite(name, (rows) =>
      rows.filter(r => String(r.id) !== String(id)));
  }

  /** ترقيع عدة صفوف بشرط مسند (مثلاً أعلام sold دفعة واحدة) */
  _patchRowsWhere(name, predicate, fieldsFn) {
    return this._applyWrite(name, (rows) => {
      let touched = false;
      const next = rows.map(r => {
        if (!predicate(r)) return r;
        touched = true;
        return { ...r, ...fieldsFn(r) };
      });
      return touched ? next : null;
    });
  }

  async _readCached(key, label, buildQuery, mapRow) {
    await this._patchQueue;
    const revision = this._cacheRevision;
    const pendingKey = key + ':' + revision;
    if (this._pendingReads.has(pendingKey)) return this._pendingReads.get(pendingKey);
    const pending = (async () => {
      const stored = await this._cacheEntryPeek(key);
      if (stored && Date.now() - stored.t <= CACHE_TTL_MS) return stored.data;
      try {
        const snap = await this._getDocs(label, buildQuery());
        const rows = [];
        snap.forEach(d => rows.push(mapRow(d)));
        if (revision === this._cacheRevision && (rows.length || snap.metadata?.fromCache === false)) {
          await this._cacheSet(key, rows);
        }
        return rows;
      } catch (error) {
        if (!stored) throw error;
        window.dispatchEvent(new CustomEvent('firebase-stale-cache', { detail: { key, cachedAt: stored.t } }));
        return stored.data;
      }
    })();
    this._pendingReads.set(pendingKey, pending);
    try { return await pending; }
    finally { this._pendingReads.delete(pendingKey); }
  }

  async _getCollectionCached(name) {
    return this._readCached(FULL_KEY(name), FULL_KEY(name), () => collection(this.db, name),
      d => ({ ...d.data(), id: d.id }));
  }

  async _derivedQueryCached(cacheKey, label, buildQuery, mapRow) {
    return this._readCached(cacheKey, label, buildQuery, mapRow);
  }

  /** تطبيع قيمة تاريخ فلاتر الاستعلام (Date | ISO | نص) إلى Date أو null */
  _normFilterDate(v) {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  // يحوّل قيمة تاريخ (Timestamp | {seconds} | ISO | Date) إلى Date أو null
  _asDate(v) {
    if (v == null) return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    if (typeof v === 'object') {
      if (typeof v.toDate === 'function') {
        const d = v.toDate();
        return isNaN(d?.getTime()) ? null : d;
      }
      if ('seconds' in v || '_seconds' in v) {
        const sec = Number(v.seconds ?? v._seconds ?? 0);
        const nsec = Number(v.nanoseconds ?? v._nanoseconds ?? 0);
        const d = new Date(sec * 1000 + Math.floor(nsec / 1e6));
        return isNaN(d.getTime()) ? null : d;
      }
    }
    if (typeof v === 'string' || typeof v === 'number') {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  // ===== عداد أرقام الباركود =====

  /**
   * الرقم التالي الفريد (phone_number) من قراءة وزيادة في معاملة واحدة.
   * @returns {Promise<string>} بصيغة 000001، 000002، ...
   */
  async getNextPhoneNumber() {
    const counterRef = doc(this.db, 'counters', 'phones');
    const next = await runTransaction(this.db, async (transaction) => {
      const snap = await transaction.get(counterRef);
      const current = Number(snap.data()?.lastPhoneNumber || 0);
      if (!Number.isSafeInteger(current) || current < 0) throw new Error('عداد الباركود غير صالح');
      transaction.set(counterRef, { lastPhoneNumber: current + 1 }, { merge: true });
      return current + 1;
    });
    return String(next).padStart(6, '0');
  }

  /**
   * قراءة العداد مرة واحدة وتخزينه محلياً كقاعدة للفولباك —
   * تستدعيه صفحات الإضافة لحظة الحفظ فقط (وليس عند فتح الصفحة)
   */
  async primePhoneCounterBase() {
    if (isQuotaCooling()) return;
    try {
      const snap = await this._getDoc('counter', doc(this.db, 'counters', 'phones'));
      if (snap.exists() && snap.data().lastPhoneNumber != null) {
        const serverVal = Number(snap.data().lastPhoneNumber);
        if (!isNaN(serverVal) && serverVal > 0) {
          const prev = parseInt(localStorage.getItem('serverPhoneCounterBase') || '0', 10) || 0;
          if (serverVal > prev) localStorage.setItem('serverPhoneCounterBase', String(serverVal));
          const localCurr = parseInt(localStorage.getItem('localDeviceCounter') || '0', 10) || 0;
          if (serverVal > localCurr) localStorage.setItem('localDeviceCounter', String(serverVal));
          console.log('✅ primePhoneCounterBase: عداد الأجهزة محفوظ محلياً عند', serverVal);
        }
      }
      clearQuotaCooling();
    } catch (e) {
      if (isQuotaError(e)) markQuotaExhausted();
      console.warn('⚠️ primePhoneCounterBase: تعذر قراءة العداد', e && e.code);
    }
  }

  /**
   * البحث عن جهاز متاح (غير مباع) بنفس الرقم التسلسلي — يمنع تسجيل نفس
   * الجهاز الفيزيائي مرتين وهو متاح، ويقبل إعادة شرائه بعد بيعه (sold=true).
   * excludeId يستبعد الجهاز قيد التعديل (يقبل معرّف المستند أو الباركود).
   * @returns {Promise<object|null>} الهاتف المتاح المطابق أو null
   */
  async findAvailablePhoneBySerial(serial, excludeId = null) {
    const normalized = this._normalizePhoneKey(serial);
    if (!normalized) return null;
    const key = await this._getDoc('phones:serialKey', await this._phoneKeyRef('serial_number', normalized));
    for (const id of key.data()?.phoneIds || []) {
      const snap = await this._getDoc('phones:bySerial', doc(this.db, 'phones', id));
      if (!snap.exists()) continue;
      const data = snap.data();
      if (excludeId != null && (String(id) === String(excludeId) || String(data.phone_number) === String(excludeId))) continue;
      if (data.sold !== true && this._normalizePhoneKey(data.serial_number) === normalized) return { ...data, id };
    }
    return null;
  }

  _normalizePhoneKey(value) {
    return String(value ?? '').replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632))
      .replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776)).replace(/\s+/g, '').toUpperCase();
  }

  async _phoneKeyRef(field, value) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(this._normalizePhoneKey(value)));
    const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    return doc(this.db, 'phone_keys', field + '_' + hash);
  }

  async _reservePhoneKeys(transaction, phoneId, data) {
    const ready = await transaction.get(doc(this.db, 'counters', 'phone_keys'));
    if (ready.data()?.ready !== true) throw new Error('فهرس تفرد الأجهزة غير جاهز');
    const reservations = [];
    for (const field of ['phone_number', 'serial_number']) {
      const key = this._normalizePhoneKey(data[field]);
      if (!key) throw new Error('الباركود والرقم التسلسلي مطلوبان');
      const ref = await this._phoneKeyRef(field, key);
      const lock = await transaction.get(ref);
      const ids = lock.data()?.phoneIds || [];
      const existing = await Promise.all(ids.filter(id => id !== phoneId)
        .map(id => transaction.get(doc(this.db, 'phones', id))));
      const conflicts = existing.filter(snap => snap.exists() &&
        this._normalizePhoneKey(snap.data()[field]) === key &&
        (field === 'phone_number' || snap.data().sold !== true));
      if (conflicts.length && (field === 'phone_number' || data.sold !== true)) {
        throw new Error(field === 'phone_number' ? 'رقم الباركود مستخدم مسبقاً' : 'الجهاز مسجل ومتاح بنفس الرقم التسلسلي');
      }
      reservations.push({ ref, phoneIds: [...new Set([...conflicts.map(snap => snap.id), phoneId])] });
    }
    return reservations;
  }

  async _savePhoneAtomically(phoneId, phoneData, creating) {
    const ref = creating ? doc(collection(this.db, 'phones')) : doc(this.db, 'phones', phoneId);
    const saved = await runTransaction(this.db, async (transaction) => {
      const current = await transaction.get(ref);
      if (!creating && !current.exists()) throw new Error('الهاتف غير موجود');
      const data = { ...current.data(), ...phoneData };
      data.phone_number = this._normalizePhoneKey(data.phone_number);
      data.serial_number = this._normalizePhoneKey(data.serial_number);
      if (creating) data.sold = false;
      const reservations = await this._reservePhoneKeys(transaction, ref.id, data);
      transaction.set(ref, { ...data, ...(creating ? { createdAt: serverTimestamp() } : {}), updatedAt: serverTimestamp() });
      reservations.forEach(lock => transaction.set(lock.ref, { phoneIds: lock.phoneIds }));
      return data;
    });
    await this._patchAddRow('phones', { ...saved, id: ref.id, updatedAt: new Date() });
    return ref.id;
  }

  async addPhone(phoneData) {
    return this._savePhoneAtomically(null, phoneData, true);
  }

  async getPhones() {
    try {
      const phones = await this._getCollectionCached('phones');
      console.log('📱 Retrieved phones:', phones.length);
      return phones;
    } catch (error) {
      console.error('❌ Error getting phones:', error);
      throw error;
    }
  }

  async updatePhone(phoneId, phoneData) {
    return this._savePhoneAtomically(phoneId, phoneData, false);
  }

  async deletePhone(phoneId) {
    try {
      await deleteDoc(doc(this.db, 'phones', phoneId));
      await this._patchRemoveRow('phones', phoneId);
      console.log('✅ Phone deleted:', phoneId);
    } catch (error) {
      console.error('❌ Error deleting phone:', error);
      throw error;
    }
  }

  /** جلب هاتف واحد برقم الباركود — استعلام where بدل قراءة المجموعة كاملة */
  async getPhoneByNumberQuery(phoneNumber) {
    const normalized = String(phoneNumber || '').trim();
    if (!normalized) return null;
    try {
      const snap = await this._getDocs('phones:byNumber',
        query(collection(this.db, 'phones'), where('phone_number', '==', normalized))
      );
      let found = null;
      snap.forEach((d) => { if (!found) found = { ...d.data(), id: d.id }; });
      return found;
    } catch (error) {
      console.error('❌ Error getting phone by number:', error);
      throw error;
    }
  }

  /**
   * جلب عدة هواتف بمراجعها (معرّف مستند أو رقم باركود) دفعة واحدة
   * تعيد خريطة { المرجع الأصلي: الهاتف }
   */
  async getPhonesByRefs(refs) {
    const unique = [...new Set((refs || []).map(r => r != null ? String(r).trim() : '').filter(Boolean))];
    const map = {};
    if (unique.length === 0) return map;
    try {
      const idLike = unique.filter(r => !r.includes('/'));
      const fetchBy = async (field, values) => {
        for (let i = 0; i < values.length; i += 10) {
          const chunk = values.slice(i, i + 10);
          const constraint = field === '__docId'
            ? where(documentId(), 'in', chunk)
            : where(field, 'in', chunk);
          const snap = await this._getDocs('phones:byRefs', query(collection(this.db, 'phones'), constraint));
          snap.forEach((d) => {
            const phone = { ...d.data(), id: d.id };
            map[phone.id] = phone;
            if (phone.phone_number != null) map[String(phone.phone_number)] = phone;
          });
        }
      };
      await fetchBy('__docId', idLike);
      await fetchBy('phone_number', unique.filter(ref => !map[ref]));
      return map;
    } catch (error) {
      console.error('❌ Error getting phones by refs:', error);
      throw error;
    }
  }

  /**
   * ترحيل علم sold من المبيعات التاريخية — يكتب الهواتف المتغيرة فقط،
   * فإعادة التشغيل شبه مجانية. تعمل من الكونسول عند الحاجة:
   * await window.firebaseDatabase.migrateSoldFlags()
   */
  async migrateSoldFlags() {
    const sales = await this.getSales();
    const soldKeys = new Set();
    for (const sale of sales) {
      if (!sale || sale.returned === true || sale.status === 'مسترجعة') continue;
      for (const item of (sale.items || [])) {
        if (item && item.type === 'phone' && item.id != null) {
          soldKeys.add(String(item.id));
          if (item.phone_id != null) soldKeys.add(String(item.phone_id));
        }
      }
    }
    const phones = await this.getPhones();
    let soldCount = 0, availCount = 0, skipped = 0, batch = writeBatch(this.db), ops = 0;
    for (const phone of phones) {
      const key = String(phone.id != null ? phone.id : phone.phone_number);
      const alsoNumber = String(phone.phone_number != null ? phone.phone_number : '');
      const sold = soldKeys.has(key) || (alsoNumber && soldKeys.has(alsoNumber));
      sold ? soldCount++ : availCount++;
      if (phone.sold === sold) { skipped++; continue; }
      batch.update(doc(this.db, 'phones', phone.id), { sold });
      if (++ops === 400) { await batch.commit(); batch = writeBatch(this.db); ops = 0; }
    }
    if (ops > 0) await batch.commit();
    // إعادة كتابة جماعية نادرة (من الكونسول) — مسح كاش الهواتف كاملاً مقبول هنا
    await this._dropCollectionCache('phones');
    const summary = { phones: phones.length, sold: soldCount, available: availCount, skipped, written: soldCount + availCount - skipped };
    console.log('✅ migrateSoldFlags:', summary);
    return summary;
  }

  // ===== الأكسسوارات =====

  async addAccessory(accessoryData) {
    try {
      const docRef = await addDoc(collection(this.db, 'accessories'), {
        ...accessoryData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await this._patchAddRow('accessories', {
        id: docRef.id, ...accessoryData,
        createdAt: new Date(), updatedAt: new Date()
      });
      console.log('✅ Accessory added:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error adding accessory:', error);
      throw error;
    }
  }

  async getAccessories() {
    try {
      const accessories = await this._getCollectionCached('accessories');
      console.log('🛍️ Retrieved accessories:', accessories.length);
      return accessories;
    } catch (error) {
      console.error('❌ Error getting accessories:', error);
      throw error;
    }
  }

  async updateAccessory(accessoryId, accessoryData) {
    try {
      await updateDoc(doc(this.db, 'accessories', accessoryId), {
        ...accessoryData,
        updatedAt: serverTimestamp()
      });
      await this._patchUpdateRow('accessories', accessoryId, { ...accessoryData, updatedAt: new Date() });
      console.log('✅ Accessory updated:', accessoryId);
    } catch (error) {
      console.error('❌ Error updating accessory:', error);
      throw error;
    }
  }

  async deleteAccessory(accessoryId) {
    try {
      await deleteDoc(doc(this.db, 'accessories', accessoryId));
      await this._patchRemoveRow('accessories', accessoryId);
      console.log('✅ Accessory deleted:', accessoryId);
    } catch (error) {
      console.error('❌ Error deleting accessory:', error);
      throw error;
    }
  }

  /** جلب أكسسوار واحد بمعرّف المستند */
  async getAccessoryById(accessoryId) {
    try {
      const snap = await this._getDoc('accessories:byId', doc(this.db, 'accessories', accessoryId));
      return snap.exists() ? { ...snap.data(), id: snap.id } : null;
    } catch (error) {
      console.error('❌ Error getting accessory by id:', error);
      throw error;
    }
  }

  /** جلب أكسسوار واحد بباركوده (barcode ثم barcode_id) */
  async getAccessoryByBarcode(barcode) {
    const normalized = String(barcode || '').trim();
    if (!normalized) return null;
    try {
      for (const field of ['barcode', 'barcode_id']) {
        const snap = await this._getDocs('accessories:byBarcode',
          query(collection(this.db, 'accessories'), where(field, '==', normalized))
        );
        let found = null;
        snap.forEach((d) => { if (!found) found = { ...d.data(), id: d.id }; });
        if (found) return found;
      }
      return null;
    } catch (error) {
      console.error('❌ Error getting accessory by barcode:', error);
      throw error;
    }
  }

  /** جلب عدة أكسسوارات بمعرّفات مستنداتها دفعة واحدة — خريطة { المعرف: الأكسسوار } */
  async getAccessoriesByIds(ids) {
    const unique = [...new Set((ids || []).map(r => r != null ? String(r).trim() : '').filter(Boolean))];
    const map = {};
    if (unique.length === 0) return map;
    try {
      for (let i = 0; i < unique.length; i += 10) {
        const snap = await this._getDocs('accessories:byIds',
          query(collection(this.db, 'accessories'), where(documentId(), 'in', unique.slice(i, i + 10)))
        );
        snap.forEach((d) => {
          const acc = { ...d.data(), id: d.id };
          map[acc.id] = acc;
          if (acc.sku != null) map[String(acc.sku)] = acc;
        });
      }
      return map;
    } catch (error) {
      console.error('❌ Error getting accessories by ids:', error);
      throw error;
    }
  }

  // ===== فئات الأكسسوارات =====

  async addAccessoryCategory(categoryData) {
    try {
      const docRef = await addDoc(collection(this.db, 'accessory_categories'), {
        ...categoryData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await this._patchAddRow('accessory_categories', {
        id: docRef.id, ...categoryData,
        createdAt: new Date(), updatedAt: new Date()
      });
      console.log('✅ Category added:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error adding category:', error);
      throw error;
    }
  }

  async getAccessoryCategories() {
    try {
      const categories = await this._getCollectionCached('accessory_categories');
      console.log('📂 Retrieved categories:', categories.length);
      return categories;
    } catch (error) {
      console.error('❌ Error getting categories:', error);
      throw error;
    }
  }

  async deleteAccessoryCategory(categoryName) {
    try {
      const snap = await this._getDocs('accessory_categories:find',
        query(collection(this.db, 'accessory_categories'), where('arabic_name', '==', categoryName))
      );
      const deletes = [];
      snap.forEach((d) => deletes.push(deleteDoc(d.ref)));
      await Promise.all(deletes);
      await this._applyWrite('accessory_categories', (rows) =>
        rows.filter(r => r.arabic_name !== categoryName));
      console.log('✅ Accessory category deleted:', categoryName);
      return true;
    } catch (error) {
      console.error('❌ Error deleting accessory category:', error);
      throw error;
    }
  }

  // ===== أنواع الهواتف =====

  async addPhoneType(phoneTypeData) {
    try {
      const docRef = await addDoc(collection(this.db, 'phone_types'), {
        ...phoneTypeData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await this._patchAddRow('phone_types', {
        id: docRef.id, ...phoneTypeData,
        createdAt: new Date(), updatedAt: new Date()
      });
      console.log('✅ Phone type added:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error adding phone type:', error);
      throw error;
    }
  }

  async getPhoneTypes() {
    try {
      const types = await this._getCollectionCached('phone_types');
      console.log('📱 Retrieved phone types:', types.length);
      return types;
    } catch (error) {
      console.error('❌ Error getting phone types:', error);
      throw error;
    }
  }

  async deletePhoneType(brand, model) {
    try {
      const snap = await this._getDocs('phone_types:find',
        query(collection(this.db, 'phone_types'), where('brand', '==', brand), where('model', '==', model))
      );
      const deletes = [];
      snap.forEach((d) => deletes.push(deleteDoc(d.ref)));
      await Promise.all(deletes);
      await this._applyWrite('phone_types', (rows) =>
        rows.filter(r => !(r.brand === brand && r.model === model)));
      console.log('✅ Phone type deleted:', brand, model);
      return true;
    } catch (error) {
      console.error('❌ Error deleting phone type:', error);
      throw error;
    }
  }

  // ===== المبيعات =====

  /**
   * يسجل البيع ويحدث المخزون وحالة الهواتف في معاملة Firestore واحدة.
   * لا تترك المعاملة بيعاً بلا مخزون أو مخزوناً ناقصاً بلا فاتورة.
   */
  async recordSaleAtomically(saleData, cartItems) {
    const items = Array.isArray(cartItems) ? cartItems : [];
    if (!items.length) throw new Error('لا توجد منتجات لإتمام البيع');

    const accessoryQuantities = new Map();
    const phoneIds = new Set();
    for (const item of items) {
      const id = String(item && item.id || '').trim();
      if (!id) throw new Error('منتج البيع بلا معرّف');
      const quantity = Number(item.quantity);
      if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('كمية المنتج غير صالحة');
      if (item.type === 'phone') {
        if (quantity !== 1 || phoneIds.has(id)) throw new Error('لا يمكن بيع نفس الهاتف أكثر من مرة');
        phoneIds.add(id);
      } else if (item.type === 'accessory') {
        accessoryQuantities.set(id, (accessoryQuantities.get(id) || 0) + quantity);
      } else throw new Error('نوع منتج البيع غير صالح');
    }

    const saleRef = saleData.operation_id
      ? doc(this.db, 'sales', saleData.operation_id) : doc(collection(this.db, 'sales'));
    const committed = await runTransaction(this.db, async (transaction) => {
      const previous = await transaction.get(saleRef);
      if (previous.exists()) {
        if (JSON.stringify(previous.data().items) !== JSON.stringify(items)) throw new Error('المحاولة مرتبطة بفاتورة محفوظة؛ أعد تحميل الصفحة');
        return { saleId: saleRef.id, reused: true };
      }
      const accessoryRefs = [...accessoryQuantities.keys()].map(id => doc(this.db, 'accessories', id));
      const phoneRefs = [...phoneIds].map(id => doc(this.db, 'phones', id));
      const snapshots = await Promise.all([...accessoryRefs, ...phoneRefs].map(ref => transaction.get(ref)));
      const accessoryUpdates = [];

      accessoryRefs.forEach((ref, index) => {
        const snap = snapshots[index];
        const quantity = accessoryQuantities.get(ref.id);
        if (!snap.exists()) throw new Error('الأكسسوار لم يعد موجوداً');
        const current = Number(snap.data().quantity_in_stock ?? snap.data().quantity ?? 0);
        if (!Number.isFinite(current) || current < 0 || current < quantity) {
          throw new Error('الكمية المطلوبة غير متاحة');
        }
        const next = current - quantity;
        transaction.update(ref, { quantity_in_stock: next, quantity: next, updatedAt: serverTimestamp() });
        accessoryUpdates.push({ id: ref.id, quantity: next });
      });

      phoneRefs.forEach((ref, index) => {
        const snap = snapshots[accessoryRefs.length + index];
        if (!snap.exists()) throw new Error('الهاتف لم يعد موجوداً');
        if (snap.data().sold === true) throw new Error('هذا الهاتف تم بيعه مسبقاً');
        transaction.update(ref, { sold: true, last_sale_id: saleRef.id, updatedAt: serverTimestamp() });
      });

      transaction.set(saleRef, { ...saleData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      return { saleId: saleRef.id, accessoryUpdates, phoneIds: [...phoneIds] };
    });

    if (committed.reused) return committed.saleId;
    await this._patchAddRow('sales', { id: committed.saleId, ...saleData, createdAt: new Date(), updatedAt: new Date() });
    for (const update of committed.accessoryUpdates) {
      await this._patchUpdateRow('accessories', update.id, {
        quantity_in_stock: update.quantity, quantity: update.quantity, updatedAt: new Date()
      });
    }
    await this._patchRowsWhere('phones', (row) => committed.phoneIds.includes(String(row.id)),
      () => ({ sold: true, updatedAt: new Date() }));
    return committed.saleId;
  }

  async returnSaleAtomically(saleId) {
    const original = await this.getSale(saleId);
    if (!original) throw new Error('الفاتورة غير موجودة');
    if (original.returned === true || original.status === 'مسترجعة') return false;
    const items = original.items || [];
    const normalizedItems = items.map(item => ({ ...item, type: item.type || item.product_type }));
    if (normalizedItems.some(item => !['phone', 'accessory'].includes(item.type))) throw new Error('نوع منتج الفاتورة غير صالح');
    const phoneItems = normalizedItems.filter(item => item.type === 'phone');
    const accessoryItems = normalizedItems.filter(item => item.type === 'accessory');
    const phones = await this.getPhonesByRefs(phoneItems.map(item => item.id ?? item.phone_id));
    const accessories = await this.getAccessoriesByIds(accessoryItems.map(item => item.id));
    for (const item of accessoryItems) {
      const key = String(item.id || '');
      if (!accessories[key]) {
        const snap = await this._getDocs('accessories:bySku', query(collection(this.db, 'accessories'), where('sku', '==', key)));
        if (snap.size === 1) accessories[key] = { ...snap.docs[0].data(), id: snap.docs[0].id };
      }
    }
    const phoneIds = [...new Set(phoneItems.map(item => {
      const phone = phones[String(item.id ?? item.phone_id)];
      if (!phone) throw new Error('تعذر العثور على هاتف الفاتورة');
      return phone.id;
    }))];
    const quantities = new Map();
    for (const item of accessoryItems) {
      const accessory = accessories[String(item.id)];
      const quantity = Number(item.quantity);
      if (!accessory || !Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('بيانات أكسسوار الفاتورة غير صالحة');
      quantities.set(accessory.id, (quantities.get(accessory.id) || 0) + quantity);
    }
    const saleRef = doc(this.db, 'sales', saleId);
    const result = await runTransaction(this.db, async (transaction) => {
      const sale = await transaction.get(saleRef);
      if (!sale.exists()) throw new Error('الفاتورة غير موجودة');
      if (sale.data().returned === true || sale.data().status === 'مسترجعة') return null;
      if (JSON.stringify(sale.data().items || []) !== JSON.stringify(items)) throw new Error('تغيرت الفاتورة؛ أعد تحميل الصفحة');
      const accessoryRefs = [...quantities.keys()].map(id => doc(this.db, 'accessories', id));
      const phoneRefs = phoneIds.map(id => doc(this.db, 'phones', id));
      const snaps = await Promise.all([...accessoryRefs, ...phoneRefs].map(ref => transaction.get(ref)));
      if (snaps.some(snap => !snap.exists())) throw new Error('أحد منتجات الفاتورة لم يعد موجوداً');
      const reservations = [];
      for (const snap of snaps.slice(accessoryRefs.length)) {
        if (snap.data().last_sale_id && snap.data().last_sale_id !== saleId) throw new Error('الهاتف مرتبط بفاتورة بيع أحدث');
        reservations.push(...await this._reservePhoneKeys(transaction, snap.id, { ...snap.data(), sold: false }));
      }
      const owners = new Map();
      for (const lock of reservations) {
        const previous = owners.get(lock.ref.id);
        if (previous && previous !== lock.phoneIds[lock.phoneIds.length - 1]) throw new Error('الفاتورة تحتوي أجهزة متعارضة في الرقم التسلسلي');
        owners.set(lock.ref.id, lock.phoneIds[lock.phoneIds.length - 1]);
      }
      const updates = accessoryRefs.map((ref, index) => {
        const current = Number(snaps[index].data().quantity_in_stock ?? snaps[index].data().quantity ?? 0);
        if (!Number.isFinite(current) || current < 0) throw new Error('مخزون الأكسسوار غير صالح');
        return { id: ref.id, quantity: current + quantities.get(ref.id) };
      });
      updates.forEach((update, index) => transaction.update(accessoryRefs[index], {
        quantity: update.quantity, quantity_in_stock: update.quantity, updatedAt: serverTimestamp()
      }));
      phoneRefs.forEach(ref => transaction.update(ref, { sold: false, updatedAt: serverTimestamp() }));
      reservations.forEach(lock => transaction.set(lock.ref, { phoneIds: lock.phoneIds }));
      transaction.update(saleRef, { returned: true, status: 'مسترجعة', returned_at: serverTimestamp(), updatedAt: serverTimestamp() });
      return updates;
    });
    if (result === null) return false;
    await this._patchUpdateRow('sales', saleId, { returned: true, status: 'مسترجعة', returned_at: new Date() });
    for (const update of result) await this._patchUpdateRow('accessories', update.id, { quantity: update.quantity, quantity_in_stock: update.quantity });
    await this._patchRowsWhere('phones', row => phoneIds.includes(row.id), () => ({ sold: false }));
    return true;
  }

  async getSales() {
    try {
      const sales = await this._getCollectionCached('sales');
      // ترتيب تنازلي حسب تاريخ الإنشاء (يدعم Timestamp وISO بعد دورة الكاش)
      const saleDate = sale => this._asDate(sale.date_created) || this._asDate(sale.date_added) ||
        this._asDate(sale.created_at) || this._asDate(sale.createdAt);
      sales.sort((a, b) => (saleDate(b) || 0) - (saleDate(a) || 0));
      console.log('💰 Retrieved sales:', sales.length);
      return sales;
    } catch (error) {
      console.error('❌ Error getting sales:', error);
      throw error;
    }
  }

  /** قراءة مستند بيع واحد بدل المجموعة كاملة */
  async getSale(saleId) {
    try {
      const saleDoc = await this._getDoc('sales:byId', doc(this.db, 'sales', saleId));
      return saleDoc.exists() ? { ...saleDoc.data(), id: saleDoc.id } : null;
    } catch (error) {
      console.error('❌ Error getting sale:', error);
      throw error;
    }
  }

  async updateSale(saleId, saleData) {
    try {
      await updateDoc(doc(this.db, 'sales', saleId), {
        ...saleData,
        updatedAt: serverTimestamp()
      });
      await this._patchUpdateRow('sales', saleId, { ...saleData, updatedAt: new Date() });
      console.log('✅ Sale updated:', saleId);
    } catch (error) {
      console.error('❌ Error updating sale:', error);
      throw error;
    }
  }

  /** مبيعات نطاق زمني متوافق مع createdAt وأسماء التاريخ التاريخية. */
  async getSalesInRange(from, to) {
    try {
      const df = this._normFilterDate(from);
      const dt = this._normFilterDate(to);
      if (!df) throw new Error('تاريخ بداية المبيعات غير صالح');

      // لا يمكن لاستعلام createdAt وحده إرجاع السجلات التاريخية التي تستخدم
      // date_created/date_added/created_at. نقرأ اللقطة الموحدة المخزنة مؤقتاً
      // ثم نطبّق نطاقاً متوافقاً مع جميع صيغ البيانات القديمة.
      const allSales = await this.getSales();
      const saleDate = (sale) => this._asDate(sale.date_created) ||
        this._asDate(sale.date_added) || this._asDate(sale.created_at) ||
        this._asDate(sale.createdAt);
      const rows = allSales.filter((sale) => {
        const d = saleDate(sale);
        return d && d >= df && (!dt || d <= dt);
      });
      console.log('💰 Sales in range loaded:', rows.length);
      return rows;
    } catch (error) {
      console.error('❌ Error getting sales in range:', error);
      throw error;
    }
  }

  // ===== الصيانة: المندوبون =====

  async addRep(repData) {
    try {
      const docRef = await addDoc(collection(this.db, 'reps'), {
        ...repData,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await this._patchAddRow('reps', {
        id: docRef.id, ...repData, active: true,
        createdAt: new Date(), updatedAt: new Date()
      });
      console.log('✅ Rep added with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error adding rep:', error);
      throw error;
    }
  }

  async getReps() {
    try {
      const reps = await this._getCollectionCached('reps');
      console.log('✅ Reps loaded:', reps.length);
      return reps;
    } catch (error) {
      console.error('❌ Error getting reps:', error);
      throw error;
    }
  }

  async updateRep(repId, repData) {
    try {
      await updateDoc(doc(this.db, 'reps', repId), { ...repData, updatedAt: serverTimestamp() });
      await this._patchUpdateRow('reps', repId, { ...repData, updatedAt: new Date() });
      console.log('✅ Rep updated:', repId);
    } catch (error) {
      console.error('❌ Error updating rep:', error);
      throw error;
    }
  }

  async deleteRep(repId) {
    try {
      await deleteDoc(doc(this.db, 'reps', repId));
      await this._patchRemoveRow('reps', repId);
      console.log('✅ Rep deleted:', repId);
    } catch (error) {
      console.error('❌ Error deleting rep:', error);
      throw error;
    }
  }

  // ===== الصيانة: الفنيون =====

  async addTechnician(techData) {
    try {
      const defaultCommissionPercent = Number(techData.defaultCommissionPercent ?? 0.5);
      if (!Number.isFinite(defaultCommissionPercent) || defaultCommissionPercent < 0 || defaultCommissionPercent > 1) {
        throw new Error('نسبة عمولة الفني غير صالحة');
      }
      const docRef = await addDoc(collection(this.db, 'technicians'), {
        ...techData,
        active: true,
        defaultCommissionPercent,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await this._patchAddRow('technicians', {
        id: docRef.id, ...techData, active: true,
        defaultCommissionPercent,
        createdAt: new Date(), updatedAt: new Date()
      });
      console.log('✅ Technician added with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error adding technician:', error);
      throw error;
    }
  }

  async getTechnicians() {
    try {
      const technicians = await this._getCollectionCached('technicians');
      console.log('✅ Technicians loaded:', technicians.length);
      return technicians;
    } catch (error) {
      console.error('❌ Error getting technicians:', error);
      throw error;
    }
  }

  async updateTechnician(techId, techData) {
    try {
      await updateDoc(doc(this.db, 'technicians', techId), { ...techData, updatedAt: serverTimestamp() });
      await this._patchUpdateRow('technicians', techId, { ...techData, updatedAt: new Date() });
      console.log('✅ Technician updated:', techId);
    } catch (error) {
      console.error('❌ Error updating technician:', error);
      throw error;
    }
  }

  async deleteTechnician(techId) {
    try {
      await deleteDoc(doc(this.db, 'technicians', techId));
      await this._patchRemoveRow('technicians', techId);
      console.log('✅ Technician deleted:', techId);
    } catch (error) {
      console.error('❌ Error deleting technician:', error);
      throw error;
    }
  }

  // ===== الصيانة: الأعمال =====

  /**
   * ضيّق النطاق على الخادم متى توفر فلتر (نطاق زمني على visitDate، أو حالة
   * واحدة) — فهارس أحادية بلا فهارس مركّبة. بقية الفلاتر داخل الذاكرة فوق
   * النتيجة المخزنة: techId, repId, وأي فلتر زمني/حالة لم يُطبّق على الخادم.
   */
  async getMaintenanceJobs(filters = {}) {
    try {
      const df = this._normFilterDate(filters.dateFrom);
      const dt = this._normFilterDate(filters.dateTo);
      let jobs;

      if (df || dt) {
        const key = DERIVED_PREFIX('maintenanceJobs') +
          `q_d${df ? df.getTime() : ''}_${dt ? dt.getTime() : ''}`;
        jobs = await this._derivedQueryCached(
          key,
          'maintenanceJobs:range',
          () => {
            const constraints = [];
            if (df) constraints.push(where('visitDate', '>=', df));
            if (dt) constraints.push(where('visitDate', '<=', dt));
            return query(collection(this.db, 'maintenanceJobs'), ...constraints);
          },
          (d) => ({ ...d.data(), id: d.id })
        );
        // الاستعلام الخادمي لا يرى السجلات التاريخية التي خُزن visitDate فيها كنص.
        // ادمجها من اللقطة العامة ثم طبّق الفلتر الموحد أدناه.
        const legacyRows = await this._getCollectionCached('maintenanceJobs');
        const byId = new Map(jobs.map(job => [String(job.id), job]));
        legacyRows.forEach(job => { if (!byId.has(String(job.id))) byId.set(String(job.id), job); });
        jobs = [...byId.values()];
      } else if (filters.status) {
        const key = DERIVED_PREFIX('maintenanceJobs') + `q_s_${filters.status}`;
        jobs = await this._derivedQueryCached(
          key,
          'maintenanceJobs:status',
          () => query(collection(this.db, 'maintenanceJobs'),
                      where('status', '==', filters.status)),
          (d) => ({ ...d.data(), id: d.id })
        );
      } else {
        jobs = await this._getCollectionCached('maintenanceJobs');
      }

      // الفلاتر المركّبة دائماً في الذاكرة (آمنة حتى لو طُبّق جزء منها خادمياً)
      if (filters.status) jobs = jobs.filter(j => j.status === filters.status);
      if (filters.techId) jobs = jobs.filter(j => j.techId === filters.techId);

      const jobDate = (job) => this._asDate(job.visitDate);
      if (filters.dateFrom) {
        const dateFrom = df;
        jobs = jobs.filter(job => { const d = jobDate(job); return d && d >= dateFrom; });
      }
      if (filters.dateTo) {
        const dateTo = dt;
        jobs = jobs.filter(job => { const d = jobDate(job); return d && d <= dateTo; });
      }

      if (filters.repId) {
        jobs = jobs.filter(job => {
          if (job.parts && Array.isArray(job.parts) && job.parts.length > 0) {
            return job.parts.some(part => part.repId === filters.repId);
          }
          return job.repId === filters.repId;
        });
      }

      jobs = jobs.slice().sort((a, b) => (jobDate(b) || 0) - (jobDate(a) || 0));
      console.log('✅ Maintenance jobs loaded:', jobs.length);
      return jobs;
    } catch (error) {
      console.error('❌ Error getting maintenance jobs:', error);
      throw error;
    }
  }

  /** قراءة عمل صيانة واحد بمعرّفه */
  async getMaintenanceJob(jobId) {
    try {
      const snap = await this._getDoc('maintenanceJobs:byId', doc(this.db, 'maintenanceJobs', jobId));
      if (snap.exists()) return { ...snap.data(), id: snap.id };
      throw new Error('Job not found');
    } catch (error) {
      console.error('❌ Error getting maintenance job:', error);
      throw error;
    }
  }

  async addMaintenanceJob(jobData) {
    try {
      const basePartCost = jobData.totalPartCost !== undefined ? jobData.totalPartCost : jobData.partCost;
      const { profit, techCommission, shopProfit } = this.computeDerived(
        basePartCost,
        jobData.amountCharged,
        jobData.techPercent !== undefined ? jobData.techPercent : 0
      );
      const docRef = await addDoc(collection(this.db, 'maintenanceJobs'), {
        ...jobData,
        profit,
        techCommission,
        shopProfit,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await this._patchAddRow('maintenanceJobs', {
        id: docRef.id, ...jobData,
        profit, techCommission, shopProfit, status: 'pending',
        createdAt: new Date(), updatedAt: new Date()
      });
      console.log('✅ Maintenance job added with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error adding maintenance job:', error);
      throw error;
    }
  }

  async updateMaintenanceJob(jobId, jobData) {
    try {
      // إعادة حساب الأرباح المشتقة إذا تغيرت القيم.
      // إن اكتملت قيم التسعير في jobData نحسب مباشرة بلا قراءة للمستند؛
      // نقرأ الحالي فقط عند نقص قيمة (تعديل جزئي).
      if (jobData.totalPartCost !== undefined || jobData.partCost !== undefined || jobData.amountCharged !== undefined || jobData.techPercent !== undefined) {
        const pricingComplete =
          (jobData.totalPartCost !== undefined || jobData.partCost !== undefined) &&
          jobData.amountCharged !== undefined &&
          jobData.techPercent !== undefined;

        let partCost, amountCharged, techPercent;
        if (pricingComplete) {
          partCost = jobData.totalPartCost !== undefined ? jobData.totalPartCost : jobData.partCost;
          amountCharged = jobData.amountCharged;
          techPercent = jobData.techPercent;
        } else {
          const currentJob = await this.getMaintenanceJob(jobId);
          partCost =
            jobData.totalPartCost !== undefined ? jobData.totalPartCost
            : currentJob.totalPartCost !== undefined ? currentJob.totalPartCost
            : jobData.partCost !== undefined ? jobData.partCost
            : currentJob.partCost;
          amountCharged = jobData.amountCharged !== undefined ? jobData.amountCharged : currentJob.amountCharged;
          techPercent = jobData.techPercent !== undefined ? jobData.techPercent : currentJob.techPercent;
        }

        const { profit, techCommission, shopProfit } = this.computeDerived(partCost, amountCharged, techPercent);
        jobData.profit = profit;
        jobData.techCommission = techCommission;
        jobData.shopProfit = shopProfit;
      }

      await updateDoc(doc(this.db, 'maintenanceJobs', jobId), { ...jobData, updatedAt: serverTimestamp() });
      await this._patchUpdateRow('maintenanceJobs', jobId, { ...jobData, updatedAt: new Date() });
      console.log('✅ Maintenance job updated:', jobId);
    } catch (error) {
      console.error('❌ Error updating maintenance job:', error);
      throw error;
    }
  }

  async deleteMaintenanceJob(jobId) {
    try {
      await deleteDoc(doc(this.db, 'maintenanceJobs', jobId));
      await this._patchRemoveRow('maintenanceJobs', jobId);
      console.log('✅ Maintenance job deleted:', jobId);
    } catch (error) {
      console.error('❌ Error deleting maintenance job:', error);
      throw error;
    }
  }

  // ===== الصيانة: المدفوعات =====

  /**
   * ضيّق على الخادم بنطاق paymentDate إن توفر (فهرس أحادي)، والباقي في
   * الذاكرة: entityType, entityId وأي فلتر زمني لم يُطبّق خادمياً.
   */
  async getPayments(filters = {}) {
    try {
      const df = this._normFilterDate(filters.dateFrom);
      const dt = this._normFilterDate(filters.dateTo);
      let payments;

      if (df || dt) {
        const key = DERIVED_PREFIX('payments') +
          `q_d${df ? df.getTime() : ''}_${dt ? dt.getTime() : ''}`;
        payments = await this._derivedQueryCached(
          key,
          'payments:range',
          () => {
            const constraints = [];
            if (df) constraints.push(where('paymentDate', '>=', df));
            if (dt) constraints.push(where('paymentDate', '<=', dt));
            return query(collection(this.db, 'payments'), ...constraints);
          },
          (d) => ({ ...d.data(), id: d.id })
        );
        const legacyRows = await this._getCollectionCached('payments');
        const byId = new Map(payments.map(payment => [String(payment.id), payment]));
        legacyRows.forEach(payment => { if (!byId.has(String(payment.id))) byId.set(String(payment.id), payment); });
        payments = [...byId.values()];
      } else {
        payments = await this._getCollectionCached('payments');
      }

      const payDate = (p) => this._asDate(p.paymentDate);
      if (filters.dateFrom) {
        payments = payments.filter(p => { const d = payDate(p); return d && df && d >= df; });
      }
      if (filters.dateTo) {
        payments = payments.filter(p => { const d = payDate(p); return d && dt && d <= dt; });
      }
      if (filters.entityType) payments = payments.filter(p => p.entityType === filters.entityType);
      if (filters.entityId) payments = payments.filter(p => p.entityId === filters.entityId);

      payments = payments.slice().sort((a, b) => (payDate(b) || 0) - (payDate(a) || 0));
      console.log('✅ Payments loaded:', payments.length);
      return payments;
    } catch (error) {
      console.error('❌ Error getting payments:', error);
      throw error;
    }
  }

  async addPayment(paymentData) {
    try {
      const docRef = await addDoc(collection(this.db, 'payments'), {
        ...paymentData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await this._patchAddRow('payments', {
        id: docRef.id, ...paymentData,
        createdAt: new Date(), updatedAt: new Date()
      });
      console.log('✅ Payment added with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error adding payment:', error);
      throw error;
    }
  }

  async deletePayment(paymentId) {
    try {
      await deleteDoc(doc(this.db, 'payments', paymentId));
      await this._patchRemoveRow('payments', paymentId);
      console.log('✅ Payment deleted:', paymentId);
    } catch (error) {
      console.error('❌ Error deleting payment:', error);
      throw error;
    }
  }

  // ===== دوال الحساب والتسويات =====

  /** حساب موحّد للقيم المشتقة: الربح، عمولة الفني، ربح المحل */
  computeDerived(partCost, amountCharged, techPercent) {
    const pc = Number(partCost) || 0;
    const ac = Number(amountCharged) || 0;
    const tp = Number(techPercent) || 0;
    const profit = ac - pc;
    const techCommission = Math.max(0, profit * tp);
    const shopProfit = profit - techCommission;
    return { profit, techCommission, shopProfit };
  }

  /** تسويات المندوبين — تقبل أعمالاً محمّلة مسبقاً لتجنب إعادة القراءة */
  async getRepSettlements(dateFrom, dateTo, preloadedJobs = null) {
    try {
      const jobs = preloadedJobs || await this.getMaintenanceJobs({ status: 'done', dateFrom, dateTo });
      const repTotals = {};

      jobs.forEach(job => {
        const totalPartCost = job.totalPartCost !== undefined ? Number(job.totalPartCost) :
                             (job.parts && Array.isArray(job.parts) && job.parts.length > 0) ?
                             job.parts.reduce((sum, part) => sum + (Number(part.partCost) || 0), 0) :
                             Number(job.partCost) || 0;
        const amountCharged = Number(job.amountCharged) || 0;
        const techPercent = Number(job.techPercent) || 0;
        const { profit, techCommission, shopProfit } = this.computeDerived(totalPartCost, amountCharged, techPercent);

        if (job.parts && Array.isArray(job.parts) && job.parts.length > 0) {
          const costsByRep = new Map();
          job.parts.forEach(part => {
            if (!part.repId) return;
            if (!repTotals[part.repId]) {
              repTotals[part.repId] = {
                repId: part.repId,
                repName: part.repName || 'غير محدد',
                jobsCount: 0, partCostSum: 0, profitSum: 0,
                techCommissionSum: 0, shopProfitSum: 0, revenueSum: 0
              };
            }
            const partCost = Number(part.partCost) || 0;
            repTotals[part.repId].partCostSum += partCost;
            costsByRep.set(part.repId, (costsByRep.get(part.repId) || 0) + partCost);
          });

          const repIds = [...costsByRep.keys()];
          const representedCost = [...costsByRep.values()].reduce((sum, cost) => sum + cost, 0);
          repIds.forEach(repId => {
            const share = representedCost > 0 ? costsByRep.get(repId) / representedCost : 1 / repIds.length;
            repTotals[repId].jobsCount++;
            repTotals[repId].profitSum += profit * share;
            repTotals[repId].techCommissionSum += techCommission * share;
            repTotals[repId].shopProfitSum += shopProfit * share;
            repTotals[repId].revenueSum += amountCharged * share;
          });
        } else if (job.repId) {
          if (!repTotals[job.repId]) {
            repTotals[job.repId] = {
              repId: job.repId,
              repName: job.repName || 'غير محدد',
              jobsCount: 0, partCostSum: 0, profitSum: 0,
              techCommissionSum: 0, shopProfitSum: 0, revenueSum: 0
            };
          }
          repTotals[job.repId].jobsCount++;
          repTotals[job.repId].partCostSum += totalPartCost;
          repTotals[job.repId].profitSum += profit;
          repTotals[job.repId].techCommissionSum += techCommission;
          repTotals[job.repId].shopProfitSum += shopProfit;
          repTotals[job.repId].revenueSum += amountCharged;
        }
      });

      const result = Object.values(repTotals);
      console.log('✅ Rep settlements calculated:', result.length);
      return result;
    } catch (error) {
      console.error('❌ Error getting rep settlements:', error);
      throw error;
    }
  }

  /** تسويات الفنيين — تقبل أعمالاً محمّلة مسبقاً لتجنب إعادة القراءة */
  async getTechSettlements(dateFrom, dateTo, preloadedJobs = null) {
    try {
      const jobs = preloadedJobs || await this.getMaintenanceJobs({ status: 'done', dateFrom, dateTo });
      const techTotals = {};

      jobs.forEach(job => {
        if (!job.techId) return;
        const totalPartCost = job.totalPartCost !== undefined ? Number(job.totalPartCost) :
                             (job.parts && Array.isArray(job.parts) && job.parts.length > 0) ?
                             job.parts.reduce((sum, part) => sum + (Number(part.partCost) || 0), 0) :
                             Number(job.partCost) || 0;
        const amountCharged = Number(job.amountCharged) || 0;
        const techPercent = Number(job.techPercent) || 0;
        const { profit, techCommission, shopProfit } = this.computeDerived(totalPartCost, amountCharged, techPercent);

        if (!techTotals[job.techId]) {
          techTotals[job.techId] = {
            techId: job.techId,
            techName: job.techName || 'غير محدد',
            jobsCount: 0, partCostSum: 0, profitSum: 0,
            techCommissionSum: 0, shopProfitSum: 0, revenueSum: 0
          };
        }
        techTotals[job.techId].jobsCount++;
        techTotals[job.techId].partCostSum += totalPartCost;
        techTotals[job.techId].profitSum += profit;
        techTotals[job.techId].techCommissionSum += techCommission;
        techTotals[job.techId].shopProfitSum += shopProfit;
        techTotals[job.techId].revenueSum += amountCharged;
      });

      const result = Object.values(techTotals);
      console.log('✅ Tech settlements calculated:', result.length);
      return result;
    } catch (error) {
      console.error('❌ Error getting tech settlements:', error);
      throw error;
    }
  }
}

// إنشاء instance واحد للاستخدام في جميع أنحاء التطبيق
window.firebaseDatabase = new FirebaseDatabase();

console.log('🔥 Firebase Database Manager initialized successfully!');
