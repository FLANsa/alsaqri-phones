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
  setDoc,
  query,
  where,
  orderBy,
  limit,
  documentId,
  serverTimestamp,
  increment,
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
const CACHE_TTL_MS = 5 * 60 * 1000;
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

  async _cacheSet(key, data, t = Date.now()) {
    await idbSet(key, { t, data });
  }

  /** مسح كاش مجموعة كاملة — فقط للمسارات النادرة التي تعيد كتابة كل الصفوف */
  _dropCollectionCache(name) {
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
    await idbClearAll();
    console.log('🗑️ تم مسح كاش Firestore المحلي بالكامل');
  }

  /**
   * يطبّق كتابة على المجموعة: يمسح نتائج استعلاماتها المشتقة دائماً،
   * ويُرقّع اللقطة الكاملة المخزنة عبر mutator إن وُجدت.
   * mutator يستقبل نسخة الصفوف ويعيد النسخة الجديدة، أو null للإبقاء عليها.
   */
  _applyWrite(name, mutateFull) {
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

  // قراءة مجموعة كاملة عبر الكاش — قراءة واحدة كل 5 دقائق مهما تعددت الاستدعاءات
  async _getCollectionCached(name) {
    const entry = await this._cacheEntryGet(FULL_KEY(name));
    if (entry) return entry.data;
    const snap = await this._getDocs(FULL_KEY(name), collection(this.db, name));
    const rows = [];
    snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
    // لا نخزّن النتيجة الفارغة: سباق إقلاع الاتصال قد يرجع قائمة فارغة رغم وجود
    // البيانات، وتخزينها يجمّد الأصفار لمدة 5 دقائق. المجموعة الفارغة أصلاً
    // قراءتها مجانية (0 مستند محسوب) فإعادة محاولة جلبها لا تكلف شيئاً
    if (rows.length > 0) await this._cacheSet(FULL_KEY(name), rows);
    return rows;
  }

  /** قراءة نتيجة استعلام مشتقة عبر الكاش مع مفتاح قياسي، أو جلبها من Firestore */
  async _derivedQueryCached(cacheKey, label, buildQuery, mapRow) {
    const entry = await this._cacheEntryGet(cacheKey);
    if (entry) return entry.data;
    const snap = await this._getDocs(label, buildQuery());
    const rows = [];
    snap.forEach((d) => rows.push(mapRow(d)));
    if (rows.length > 0) await this._cacheSet(cacheKey, rows);
    return rows;
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
   * الرقم التالي الفريد (phone_number). عدّاد مركزي بـ increment ذرّي،
   * وعند نفاد الحصة يتحول لعدّاد محلي في المتصفح.
   * @returns {Promise<string>} بصيغة 000001، 000002، ...
   */
  async getNextPhoneNumber() {
    const LOCAL_KEY = 'localDeviceCounter';
    const BASE_KEY = 'serverPhoneCounterBase';

    const readLocalNext = () => {
      const base = parseInt(localStorage.getItem(BASE_KEY) || '0', 10) || 0;
      const local = parseInt(localStorage.getItem(LOCAL_KEY) || '0', 10) || 0;
      return Math.max(base, local) + 1;
    };

    const fallbackLocal = async () => {
      try {
        const next = readLocalNext();
        localStorage.setItem(LOCAL_KEY, String(next));
        console.log('🔢 رقم الباركود التالي (من القاعدة المحلية):', next);
        return String(next).padStart(6, '0');
      } catch (e) {
        console.warn('⚠️ fallback local counter failed, using timestamp-based value.', e);
        return Date.now().toString().slice(-6).padStart(6, '0');
      }
    };

    if (isQuotaCooling()) {
      console.warn('⛔ قاطع دائرة Firestore مفعل — استخدام العداد المحلي مباشرة.');
      return await fallbackLocal();
    }

    const counterRef = doc(this.db, 'counters', 'phones');
    try {
      await setDoc(counterRef, { lastPhoneNumber: increment(1) }, { merge: true });
      const snap = await this._getDoc('counter', counterRef);
      const result = Number(snap.data() && snap.data().lastPhoneNumber) || 0;
      if (result > 0) {
        try {
          localStorage.setItem(BASE_KEY, String(result));
          localStorage.setItem(LOCAL_KEY, String(result));
        } catch (_) {}
        clearQuotaCooling();
        return String(result).padStart(6, '0');
      }
      throw new Error('invalid counter value after increment');
    } catch (error) {
      if (isQuotaError(error)) {
        console.warn('⚠️ Firestore quota reached — تفعيل قاطع الدائرة 5 دقائق.', error && error.code);
        markQuotaExhausted();
        return await fallbackLocal();
      }
      console.error('❌ Error in getNextPhoneNumber, falling back to local counter.', error);
      return await fallbackLocal();
    }
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

  /** فحص تكرار رقم الباركود — استعلام موجّه */
  async hasPhoneWithNumber(phoneNumber) {
    const normalized = String(phoneNumber || '').trim();
    if (!normalized) return false;
    if (isQuotaCooling()) {
      console.warn('⛔ hasPhoneWithNumber: تجاوز الفحص بسبب قاطع دائرة Firestore.');
      return false;
    }
    try {
      const snap = await this._getDocs('phones:dupCheck',
        query(collection(this.db, 'phones'), where('phone_number', '==', normalized))
      );
      return !snap.empty;
    } catch (error) {
      if (isQuotaError(error)) {
        markQuotaExhausted();
        console.warn('⚠️ hasPhoneWithNumber: تعذر الفحص، سنتجاوز فحص التكرار.');
        return false;
      }
      throw error;
    }
  }

  /**
   * مزامنة العداد مع أقصى رقم موجود فعلاً — يقرأ أعلى 3 مستندات فقط
   * (الأرقام مسبوكة بصيغة 6 أرقام فالترتيب النصي = الرقمي) بدل المجموعة كاملة
   */
  async syncPhoneCounterToMax() {
    if (isQuotaCooling()) {
      const localRaw = parseInt(localStorage.getItem('localDeviceCounter') || '0', 10) || 0;
      const baseRaw = parseInt(localStorage.getItem('serverPhoneCounterBase') || '0', 10) || 0;
      return Math.max(localRaw, baseRaw);
    }
    try {
      const topSnap = await this._getDocs('phones:top3',
        query(collection(this.db, 'phones'), orderBy('phone_number', 'desc'), limit(3))
      );
      let max = 0;
      topSnap.forEach((d) => {
        const n = parseInt(String(d.data()?.phone_number || '0').replace(/\D/g, ''), 10);
        if (!isNaN(n) && n > max) max = n;
      });
      try {
        if (max > 0) await setDoc(doc(this.db, 'counters', 'phones'), { lastPhoneNumber: max }, { merge: true });
      } catch (e) {
        if (isQuotaError(e)) markQuotaExhausted();
        console.warn('⚠️ syncPhoneCounterToMax: تعذر تحديث العداد، سنكتفي بالمحلي.', e && e.code);
      }
      try {
        const localRaw = parseInt(localStorage.getItem('localDeviceCounter') || '0', 10) || 0;
        if (max > localRaw) localStorage.setItem('localDeviceCounter', String(max));
        const baseRaw = parseInt(localStorage.getItem('serverPhoneCounterBase') || '0', 10) || 0;
        if (max > baseRaw) localStorage.setItem('serverPhoneCounterBase', String(max));
      } catch (_) {}
      console.log('🔄 تمت مزامنة عداد الأجهزة مع أقصى رقم:', max);
      return max;
    } catch (error) {
      if (isQuotaError(error)) markQuotaExhausted();
      console.warn('⚠️ فشل في مزامنة عداد الأجهزة:', error && error.code);
      return 0;
    }
  }

  // ===== الهواتف =====

  async addPhone(phoneData, options = {}) {
    const { autoRenumberOnConflict = true } = options;
    try {
      let phoneNumber = phoneData.phone_number != null ? String(phoneData.phone_number).trim() : '';
      if (!phoneNumber) throw new Error('رقم الباركود (phone_number) مطلوب');

      let exists = await this.hasPhoneWithNumber(phoneNumber);
      if (exists) {
        if (!autoRenumberOnConflict) {
          throw new Error('رقم الباركود مستخدم مسبقاً. يرجى عدم إعادة استخدام نفس الرقم.');
        }
        // العداد غير متزامن: نصحح ونعيد المحاولة (محاولات قليلة تكفي)
        console.warn('⚠️ رقم الباركود مكرر، جاري مزامنة العداد وإعادة التوليد...', phoneNumber);
        await this.syncPhoneCounterToMax();
        const maxAttempts = 3;
        let attempt = 0;
        while (exists && attempt < maxAttempts) {
          phoneNumber = await this.getNextPhoneNumber();
          exists = await this.hasPhoneWithNumber(phoneNumber);
          attempt++;
        }
        if (exists) throw new Error('تعذّر توليد رقم باركود فريد بعد عدة محاولات. يرجى المحاولة لاحقاً.');
        console.log('✅ تم توليد رقم باركود جديد بعد المزامنة:', phoneNumber);
      }
      phoneData.phone_number = phoneNumber;
      const docRef = await addDoc(collection(this.db, 'phones'), {
        ...phoneData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      // ترقيع الكاش محلياً بدل مسح المجموعة (تواريخ محلية مؤقتة حتى أول جلب)
      await this._patchAddRow('phones', {
        id: docRef.id, ...phoneData,
        createdAt: new Date(), updatedAt: new Date()
      });
      console.log('✅ Phone added with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error adding phone:', error);
      throw error;
    }
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
    try {
      await updateDoc(doc(this.db, 'phones', phoneId), {
        ...phoneData,
        updatedAt: serverTimestamp()
      });
      await this._patchUpdateRow('phones', phoneId, { ...phoneData, updatedAt: new Date() });
      console.log('✅ Phone updated:', phoneId);
    } catch (error) {
      console.error('❌ Error updating phone:', error);
      throw error;
    }
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
      snap.forEach((d) => { if (!found) found = { id: d.id, ...d.data() }; });
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
      const idLike = unique.filter(r => r.length > 10);
      const numberLike = unique.filter(r => r.length <= 10);
      const fetchBy = async (field, values) => {
        for (let i = 0; i < values.length; i += 10) {
          const chunk = values.slice(i, i + 10);
          const constraint = field === '__docId'
            ? where(documentId(), 'in', chunk)
            : where(field, 'in', chunk);
          const snap = await this._getDocs('phones:byRefs', query(collection(this.db, 'phones'), constraint));
          snap.forEach((d) => {
            const phone = { id: d.id, ...d.data() };
            map[phone.id] = phone;
            if (phone.phone_number != null) map[String(phone.phone_number)] = phone;
          });
        }
      };
      await fetchBy('__docId', idLike);
      await fetchBy('phone_number', numberLike);
      return map;
    } catch (error) {
      console.error('❌ Error getting phones by refs:', error);
      throw error;
    }
  }

  /** وسم عدة هواتف sold دفعة كتابة واحدة (حد 400 عملية للدفعة) */
  async setPhonesSold(phoneIds, sold) {
    const ids = [...new Set((phoneIds || []).map(id => id != null ? String(id) : '').filter(Boolean))];
    if (ids.length === 0) return 0;
    let batch = writeBatch(this.db), ops = 0;
    for (const id of ids) {
      batch.update(doc(this.db, 'phones', id), { sold: !!sold, updatedAt: serverTimestamp() });
      if (++ops === 400) { await batch.commit(); batch = writeBatch(this.db); ops = 0; }
    }
    if (ops > 0) await batch.commit();
    await this._patchRowsWhere(
      'phones',
      (r) => ids.includes(String(r.id)),
      () => ({ sold: !!sold, updatedAt: new Date() })
    );
    console.log('✅ setPhonesSold:', ids.length, '→', !!sold);
    return ids.length;
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
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
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
        snap.forEach((d) => { if (!found) found = { id: d.id, ...d.data() }; });
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
          const acc = { id: d.id, ...d.data() };
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

  /** تحديث عدة أكسسوارات دفعة كتابة واحدة: [{id, data}] */
  async batchUpdateAccessories(updates) {
    const list = (updates || []).filter(u => u && u.id != null && u.data);
    if (list.length === 0) return 0;
    let batch = writeBatch(this.db), ops = 0;
    for (const u of list) {
      batch.update(doc(this.db, 'accessories', String(u.id)), {
        ...u.data,
        updatedAt: serverTimestamp()
      });
      if (++ops === 400) { await batch.commit(); batch = writeBatch(this.db); ops = 0; }
    }
    if (ops > 0) await batch.commit();
    await this._patchRowsWhere(
      'accessories',
      (r) => list.some(u => String(u.id) === String(r.id)),
      (r) => ({ ...list.find(u => String(u.id) === String(r.id)).data, updatedAt: new Date() })
    );
    console.log('✅ batchUpdateAccessories:', list.length);
    return list.length;
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

  async addSale(saleData) {
    try {
      const docRef = await addDoc(collection(this.db, 'sales'), {
        ...saleData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await this._patchAddRow('sales', {
        id: docRef.id, ...saleData,
        createdAt: new Date(), updatedAt: new Date()
      });
      console.log('✅ Sale added with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error adding sale:', error);
      throw error;
    }
  }

  async getSales() {
    try {
      const sales = await this._getCollectionCached('sales');
      // ترتيب تنازلي حسب تاريخ الإنشاء (يدعم Timestamp وISO بعد دورة الكاش)
      sales.sort((a, b) => (this._asDate(b.createdAt) || this._asDate(b.date_created) || 0) -
                           (this._asDate(a.createdAt) || this._asDate(a.date_created) || 0));
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
      return saleDoc.exists() ? { id: saleDoc.id, ...saleDoc.data() } : null;
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

  /** مبيعات نطاق زمني فقط (createdAt بين تاريخين) — لإحصاءات الفترة.
   *  الاستعلام موجّه على الخادم (فهرس أحادي) ونتيجته مخزنة كاستعلام مشتق. */
  async getSalesInRange(from, to) {
    try {
      const fMs = this._normFilterDate(from)?.getTime() || '';
      const tMs = this._normFilterDate(to)?.getTime() || '';
      const cacheKey = DERIVED_PREFIX('sales') + `range_${fMs}_${tMs}`;
      const rows = await this._derivedQueryCached(
        cacheKey,
        'sales:range',
        () => to
          ? query(collection(this.db, 'sales'),
              where('createdAt', '>=', from), where('createdAt', '<=', to),
              orderBy('createdAt', 'desc'))
          : query(collection(this.db, 'sales'),
              where('createdAt', '>=', from),
              orderBy('createdAt', 'desc')),
        (d) => ({ id: d.id, ...d.data() })
      );
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
      const docRef = await addDoc(collection(this.db, 'technicians'), {
        ...techData,
        active: true,
        defaultCommissionPercent: techData.defaultCommissionPercent || 0.5,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await this._patchAddRow('technicians', {
        id: docRef.id, ...techData, active: true,
        defaultCommissionPercent: techData.defaultCommissionPercent || 0.5,
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
          (d) => ({ id: d.id, ...d.data() })
        );
      } else if (filters.status) {
        const key = DERIVED_PREFIX('maintenanceJobs') + `q_s_${filters.status}`;
        jobs = await this._derivedQueryCached(
          key,
          'maintenanceJobs:status',
          () => query(collection(this.db, 'maintenanceJobs'),
                      where('status', '==', filters.status)),
          (d) => ({ id: d.id, ...d.data() })
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
      if (snap.exists()) return { id: snap.id, ...snap.data() };
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
      if (jobData.partCost !== undefined || jobData.amountCharged !== undefined || jobData.techPercent !== undefined) {
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
          (d) => ({ id: d.id, ...d.data() })
        );
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
    const tp = (typeof techPercent === 'number' && !isNaN(techPercent)) ? techPercent : 0;
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
        const techPercent = (typeof job.techPercent === 'number' && !isNaN(job.techPercent)) ? job.techPercent : 0;
        const { profit, techCommission, shopProfit } = this.computeDerived(totalPartCost, amountCharged, techPercent);

        if (job.parts && Array.isArray(job.parts) && job.parts.length > 0) {
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
            repTotals[part.repId].partCostSum += (Number(part.partCost) || 0);
          });

          const firstRepId = job.parts[0]?.repId;
          if (firstRepId && repTotals[firstRepId]) {
            repTotals[firstRepId].jobsCount++;
            repTotals[firstRepId].profitSum += profit;
            repTotals[firstRepId].techCommissionSum += techCommission;
            repTotals[firstRepId].shopProfitSum += shopProfit;
            repTotals[firstRepId].revenueSum += amountCharged;
          }
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
        const techPercent = (typeof job.techPercent === 'number' && !isNaN(job.techPercent)) ? job.techPercent : 0;
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
