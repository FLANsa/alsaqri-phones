// ============================================================
// طبقة بيانات Firestore — الصقري للاتصالات (نسخة معاد بناؤها)
//
// مبادئ التصميم:
// 1. كاش موحّد 5 دقائق لكل المجموعات، وكل كتابة تمسح كاش مجموعتها فوراً
//    (الكاش لكل جهاز/متصفح؛ التعديل من جهاز آخر يظهر خلال 5 دقائق)
// 2. قراءة موجّهة لسجل واحد (where/getDoc) بدل قراءة المجموعة كاملة
// 3. الفلاتر المركّبة (الحالة/الفني/التاريخ/المندوب) تجري داخل الذاكرة
//    فوق القراءة المخزنة — لا استعلامات متكررة ولا فهارس مركّبة
// 4. الكتابات المتعددة تمر عبر writeBatch (حد 400 عملية للدفعة)
// 5. قاطع دائرة 5 دقائق عند نفاد حصة Firestore (resource-exhausted)
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

// ---------- الكاش المحلي ----------
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_PREFIX = 'fs_cache_';

class FirebaseDatabase {
  constructor() {
    this.db = window.firebaseDB;
    this.auth = window.firebaseAuth;
    // عدّاد قراءات Firestore للمراقبة — يُصفَّر مع كل تحميل صفحة
    // اقرأه من الكونسول: window.firebaseDatabase._reads
    this._reads = { rpcs: 0, docs: 0, full: {} };
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
  _cacheGet(key) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      const { t, data } = JSON.parse(raw);
      if (Date.now() - t > CACHE_TTL_MS) {
        localStorage.removeItem(CACHE_PREFIX + key);
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  _cacheSet(key, data) {
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), data }));
    } catch (e) {
      // تجاوز حد التخزين: أزل هذا المفتاح فقط وتابع بلا كاش له
      console.warn('⚠️ Cache skipped for', key, '- storage quota exceeded');
      this._cacheClear(key);
    }
  }

  _cacheClear(key) {
    try { localStorage.removeItem(CACHE_PREFIX + key); } catch (e) { /* تجاهل */ }
  }

  // قراءة مجموعة كاملة عبر الكاش — قراءة واحدة كل 5 دقائق مهما تعددت الاستدعاءات
  async _getCollectionCached(name) {
    const cached = this._cacheGet(name);
    if (cached) return cached;
    const snap = await this._getDocs('full:' + name, collection(this.db, name));
    const rows = [];
    snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
    // لا نخزّن النتيجة الفارغة: سباق إقلاع الاتصال قد يرجع قائمة فارغة رغم وجود
    // البيانات، وتخزينها يجمّد الأصفار لمدة 5 دقائق. المجموعة الفارغة أصلاً
    // قراءتها مجانية (0 مستند محسوب) فإعادة محاولة جلبها لا تكلف شيئاً
    if (rows.length > 0) this._cacheSet(name, rows);
    return rows;
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
      this._cacheClear('phones');
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
      this._cacheClear('phones');
      console.log('✅ Phone updated:', phoneId);
    } catch (error) {
      console.error('❌ Error updating phone:', error);
      throw error;
    }
  }

  async deletePhone(phoneId) {
    try {
      await deleteDoc(doc(this.db, 'phones', phoneId));
      this._cacheClear('phones');
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
    this._cacheClear('phones');
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
    this._cacheClear('phones');
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
      this._cacheClear('accessories');
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
      this._cacheClear('accessories');
      console.log('✅ Accessory updated:', accessoryId);
    } catch (error) {
      console.error('❌ Error updating accessory:', error);
      throw error;
    }
  }

  async deleteAccessory(accessoryId) {
    try {
      await deleteDoc(doc(this.db, 'accessories', accessoryId));
      this._cacheClear('accessories');
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
    this._cacheClear('accessories');
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
      this._cacheClear('accessory_categories');
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
      this._cacheClear('accessory_categories');
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
      this._cacheClear('phone_types');
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
      this._cacheClear('phone_types');
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
      this._cacheClear('sales');
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
      this._cacheClear('sales');
      console.log('✅ Sale updated:', saleId);
    } catch (error) {
      console.error('❌ Error updating sale:', error);
      throw error;
    }
  }

  /** مبيعات نطاق زمني فقط (createdAt بين تاريخين) — لإحصاءات الفترة */
  async getSalesInRange(from, to) {
    try {
      const q = to
        ? query(collection(this.db, 'sales'),
            where('createdAt', '>=', from), where('createdAt', '<=', to),
            orderBy('createdAt', 'desc'))
        : query(collection(this.db, 'sales'),
            where('createdAt', '>=', from),
            orderBy('createdAt', 'desc'));
      const snap = await this._getDocs('sales:range', q);
      const sales = [];
      snap.forEach((d) => sales.push({ id: d.id, ...d.data() }));
      console.log('💰 Sales in range loaded:', sales.length);
      return sales;
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
      this._cacheClear('reps');
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
      this._cacheClear('reps');
      console.log('✅ Rep updated:', repId);
    } catch (error) {
      console.error('❌ Error updating rep:', error);
      throw error;
    }
  }

  async deleteRep(repId) {
    try {
      await deleteDoc(doc(this.db, 'reps', repId));
      this._cacheClear('reps');
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
      this._cacheClear('technicians');
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
      this._cacheClear('technicians');
      console.log('✅ Technician updated:', techId);
    } catch (error) {
      console.error('❌ Error updating technician:', error);
      throw error;
    }
  }

  async deleteTechnician(techId) {
    try {
      await deleteDoc(doc(this.db, 'technicians', techId));
      this._cacheClear('technicians');
      console.log('✅ Technician deleted:', techId);
    } catch (error) {
      console.error('❌ Error deleting technician:', error);
      throw error;
    }
  }

  // ===== الصيانة: الأعمال =====

  /**
   * قراءة واحدة كاملة عبر الكاش ثم فلترة داخل الذاكرة —
   * كل الفلاتر مجانية بلا استعلامات إضافية ولا فهارس مركّبة.
   * الفلاتر: status, techId, repId (parts[] أو repId مباشر), dateFrom, dateTo
   */
  async getMaintenanceJobs(filters = {}) {
    try {
      const all = await this._getCollectionCached('maintenanceJobs');
      let jobs = all;

      if (filters.status) jobs = jobs.filter(j => j.status === filters.status);
      if (filters.techId) jobs = jobs.filter(j => j.techId === filters.techId);

      const jobDate = (job) => this._asDate(job.visitDate);
      if (filters.dateFrom) {
        const dateFrom = filters.dateFrom instanceof Date ? filters.dateFrom : new Date(filters.dateFrom);
        jobs = jobs.filter(job => { const d = jobDate(job); return d && d >= dateFrom; });
      }
      if (filters.dateTo) {
        const dateTo = filters.dateTo instanceof Date ? filters.dateTo : new Date(filters.dateTo);
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
      console.log('✅ Maintenance jobs loaded:', jobs.length, '(cache of', all.length + ')');
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
      this._cacheClear('maintenanceJobs');
      console.log('✅ Maintenance job added with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error adding maintenance job:', error);
      throw error;
    }
  }

  async updateMaintenanceJob(jobId, jobData) {
    try {
      // إعادة حساب الأرباح المشتقة إذا تغيرت القيم
      if (jobData.partCost !== undefined || jobData.amountCharged !== undefined || jobData.techPercent !== undefined) {
        const currentJob = await this.getMaintenanceJob(jobId);
        const partCost =
          jobData.totalPartCost !== undefined ? jobData.totalPartCost
          : currentJob.totalPartCost !== undefined ? currentJob.totalPartCost
          : jobData.partCost !== undefined ? jobData.partCost
          : currentJob.partCost;
        const amountCharged = jobData.amountCharged !== undefined ? jobData.amountCharged : currentJob.amountCharged;
        const techPercent = jobData.techPercent !== undefined ? jobData.techPercent : currentJob.techPercent;

        const { profit, techCommission, shopProfit } = this.computeDerived(partCost, amountCharged, techPercent);
        jobData.profit = profit;
        jobData.techCommission = techCommission;
        jobData.shopProfit = shopProfit;
      }

      await updateDoc(doc(this.db, 'maintenanceJobs', jobId), { ...jobData, updatedAt: serverTimestamp() });
      this._cacheClear('maintenanceJobs');
      console.log('✅ Maintenance job updated:', jobId);
    } catch (error) {
      console.error('❌ Error updating maintenance job:', error);
      throw error;
    }
  }

  async deleteMaintenanceJob(jobId) {
    try {
      await deleteDoc(doc(this.db, 'maintenanceJobs', jobId));
      this._cacheClear('maintenanceJobs');
      console.log('✅ Maintenance job deleted:', jobId);
    } catch (error) {
      console.error('❌ Error deleting maintenance job:', error);
      throw error;
    }
  }

  // ===== الصيانة: المدفوعات =====

  /** قراءة مخزنة + فلترة داخل الذاكرة (dateFrom/dateTo/entityType/entityId) */
  async getPayments(filters = {}) {
    try {
      const all = await this._getCollectionCached('payments');
      let payments = all;

      const payDate = (p) => this._asDate(p.paymentDate);
      if (filters.dateFrom) {
        const dateFrom = this._asDate(filters.dateFrom);
        payments = payments.filter(p => { const d = payDate(p); return d && dateFrom && d >= dateFrom; });
      }
      if (filters.dateTo) {
        const dateTo = this._asDate(filters.dateTo);
        payments = payments.filter(p => { const d = payDate(p); return d && dateTo && d <= dateTo; });
      }
      if (filters.entityType) payments = payments.filter(p => p.entityType === filters.entityType);
      if (filters.entityId) payments = payments.filter(p => p.entityId === filters.entityId);

      payments = payments.slice().sort((a, b) => (payDate(b) || 0) - (payDate(a) || 0));
      console.log('✅ Payments loaded:', payments.length, '(cache of', all.length + ')');
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
      this._cacheClear('payments');
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
      this._cacheClear('payments');
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
