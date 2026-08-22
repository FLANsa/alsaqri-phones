// Firebase Database Manager for Phone Store Demo - CDN Version
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
  documentId,
  serverTimestamp,
  increment,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// قاطع دائرة لحصة Firestore — يمنع ضرب BatchGetDocuments مرات متعددة خلال فترة الاستنزاف
const QUOTA_COOLDOWN_MS = 5 * 60 * 1000; // 5 دقائق
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

// مدة صلاحية الكاش المحلي (لتقليل قراءات Firestore عند التنقل بين الصفحات)
// ملاحظة: الكاش والإبطال عند الكتابة يعملان لكل جهاز/متصفح على حدة —
// التعديلات من جهاز آخر قد تتأخر في الظهور حتى 5 دقائق على هذا الجهاز
// (الكتابة من هذا الجهاز تمسح الكاش فورًا)
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 دقائق
const CACHE_PREFIX = 'fs_cache_';

class FirebaseDatabase {
  constructor() {
    this.db = window.firebaseDB;
    this.auth = window.firebaseAuth;
  }

  // ===== كاش محلي قصير المدى =====
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
      // تجاوز حد التخزين: أزل هذا المفتاح فقط وتابع بدون كاش له،
      // ولا تمس كاشات المجموعات الأخرى الصالحة
      console.warn('⚠️ Cache skipped for', key, '- storage quota exceeded');
      this._cacheClear(key);
    }
  }

  _cacheClear(key) {
    try {
      localStorage.removeItem(CACHE_PREFIX + key);
    } catch (e) { /* تجاهل */ }
  }

  // ===== إدارة الهواتف =====
  /**
   * توليد الرقم التالي الفريد لرقم الباركود (phone_number).
   * يحاول أولاً استخدام عداد مركزي في Firestore، وإذا تم الوصول لحد الحصة (resource-exhausted)
   * يستخدم عداداً محلياً في المتصفح لتفادي تعطل النظام.
   * @returns {Promise<string>} رقم بصيغة 000001، 000002، ...
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
        const ts = Date.now().toString().slice(-6);
        return ts.padStart(6, '0');
      }
    };

    // قاطع الدائرة: إذا كنا في فترة تبريد بعد نفاد حصة سابقة، لا نضرب Firestore أصلاً
    if (isQuotaCooling()) {
      console.warn('⛔ قاطع دائرة Firestore مفعل — استخدام العداد المحلي مباشرة بدون ضرب Firestore.');
      return await fallbackLocal();
    }

    const counterRef = doc(this.db, 'counters', 'phones');

    // الطريقة المفضّلة: increment ذرّي بدون runTransaction (يتجنّب BatchGetDocuments تماماً)
    try {
      await setDoc(counterRef, { lastPhoneNumber: increment(1) }, { merge: true });
      const snap = await getDoc(counterRef);
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
        console.warn('⚠️ Firestore quota reached — تفعيل قاطع الدائرة لمدة 5 دقائق والاعتماد على العداد المحلي.', error && error.code);
        markQuotaExhausted();
        return await fallbackLocal();
      }
      console.error('❌ Error in getNextPhoneNumber (increment path), falling back to local counter.', error);
      return await fallbackLocal();
    }
  }

  /**
   * التحقق من عدم وجود هاتف بنفس phone_number (مقارنة كنص)
   */
  /**
   * قراءة عداد الأجهزة مرة واحدة عند التهيئة باستخدام getDoc (RPC أخف من المعاملة)
   * وتخزينه محلياً كقاعدة آمنة للفولباك.
   */
  async primePhoneCounterBase() {
    if (isQuotaCooling()) {
      console.log('⛔ primePhoneCounterBase: تم تجاوز القراءة بسبب قاطع دائرة Firestore.');
      return;
    }
    try {
      const counterRef = doc(this.db, 'counters', 'phones');
      const snap = await getDoc(counterRef);
      if (snap.exists() && snap.data().lastPhoneNumber != null) {
        const serverVal = Number(snap.data().lastPhoneNumber);
        if (!isNaN(serverVal) && serverVal > 0) {
          const prev = parseInt(localStorage.getItem('serverPhoneCounterBase') || '0', 10) || 0;
          if (serverVal > prev) {
            localStorage.setItem('serverPhoneCounterBase', String(serverVal));
          }
          const localCurr = parseInt(localStorage.getItem('localDeviceCounter') || '0', 10) || 0;
          if (serverVal > localCurr) {
            localStorage.setItem('localDeviceCounter', String(serverVal));
          }
          console.log('✅ primePhoneCounterBase: عداد الأجهزة محفوظ محلياً عند', serverVal);
        }
      }
      clearQuotaCooling();
    } catch (e) {
      if (isQuotaError(e)) markQuotaExhausted();
      console.warn('⚠️ primePhoneCounterBase: تعذر قراءة العداد من Firestore', e && e.code);
    }
  }

  async hasPhoneWithNumber(phoneNumber) {
    const normalized = String(phoneNumber || '').trim();
    if (!normalized) return false;
    // قاطع الدائرة: لا نضرب Firestore عند نفاد الحصة
    if (isQuotaCooling()) {
      console.warn('⛔ hasPhoneWithNumber: تجاوز الفحص بسبب قاطع دائرة Firestore.');
      return false;
    }
    try {
      const q = query(
        collection(this.db, 'phones'),
        where('phone_number', '==', normalized)
      );
      const snap = await getDocs(q);
      return !snap.empty;
    } catch (error) {
      if (isQuotaError(error)) {
        markQuotaExhausted();
        console.warn('⚠️ hasPhoneWithNumber: تعذر الفحص بسبب حصة Firestore، سنتجاوز فحص التكرار.');
        return false;
      }
      throw error;
    }
  }

  // ===== قراءات موجّه (بدائل قراءة مجموعة كاملة لإيجاد سجل واحد) =====

  /**
   * جلب هاتف واحد برقم الباركود (phone_number) عبر استعلام where بدل قراءة المجموعة كاملة
   */
  async getPhoneByNumberQuery(phoneNumber) {
    const normalized = String(phoneNumber || '').trim();
    if (!normalized) return null;
    try {
      const snap = await getDocs(
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
   * جلب أكسسوار واحد بمعرّف المستند
   */
  async getAccessoryById(accessoryId) {
    try {
      const snap = await getDoc(doc(this.db, 'accessories', accessoryId));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    } catch (error) {
      console.error('❌ Error getting accessory by id:', error);
      throw error;
    }
  }

  /**
   * جلب أكسسوار واحد بباركوده (barcode ثم barcode_id)
   */
  async getAccessoryByBarcode(barcode) {
    const normalized = String(barcode || '').trim();
    if (!normalized) return null;
    try {
      for (const field of ['barcode', 'barcode_id']) {
        const snap = await getDocs(
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

  /**
   * جلب عدة هواتف بمراجعها (معرّف مستند أو رقم باركود) دفعة واحدة.
   * تفصل المراجع إلى: شبيهة بمعرّف مستند (طويلة) تُجلب بـ documentId in،
   * وشبيهة برقم باركود (أرقام قصيرة) تُجلب بـ phone_number in.
   * تعيد خريطة { المرجع الأصلي: الهاتف }.
   */
  async getPhonesByRefs(refs) {
    const unique = [...new Set((refs || []).map(r => String(r || '').trim()).filter(Boolean))];
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
          const snap = await getDocs(query(collection(this.db, 'phones'), constraint));
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

  /**
   * مزامنة عداد الأجهزة في Firestore مع أقصى رقم phone_number موجود فعلاً
   * في مجموعة phones. يُستخدم عند اكتشاف تكرار لتصحيح انحراف العداد.
   * @returns {Promise<number>} أقصى رقم تم العثور عليه
   */
  async syncPhoneCounterToMax() {
    if (isQuotaCooling()) {
      const localRaw = parseInt(localStorage.getItem('localDeviceCounter') || '0', 10) || 0;
      const baseRaw = parseInt(localStorage.getItem('serverPhoneCounterBase') || '0', 10) || 0;
      const max = Math.max(localRaw, baseRaw);
      console.warn('⛔ syncPhoneCounterToMax: تخطي Firestore (قاطع دائرة)، الاكتفاء بالعداد المحلي =', max);
      return max;
    }
    try {
      const phonesSnap = await getDocs(collection(this.db, 'phones'));
      let max = 0;
      phonesSnap.forEach((d) => {
        const raw = d.data() && d.data().phone_number;
        const n = parseInt(String(raw || '0').replace(/\D/g, ''), 10);
        if (!isNaN(n) && n > max) max = n;
      });
      try {
        const counterRef = doc(this.db, 'counters', 'phones');
        // setDoc + merge بدل runTransaction لتفادي BatchGetDocuments
        if (max > 0) {
          await setDoc(counterRef, { lastPhoneNumber: max }, { merge: true });
        }
      } catch (e) {
        if (isQuotaError(e)) markQuotaExhausted();
        console.warn('⚠️ syncPhoneCounterToMax: تعذر تحديث العداد في Firestore، سنكتفي بالمحلي.', e && e.code);
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

  async addPhone(phoneData, options = {}) {
    const { autoRenumberOnConflict = true } = options;
    try {
      let phoneNumber = phoneData.phone_number != null ? String(phoneData.phone_number).trim() : '';
      if (!phoneNumber) {
        throw new Error('رقم الباركود (phone_number) مطلوب');
      }
      let exists = await this.hasPhoneWithNumber(phoneNumber);
      if (exists) {
        if (!autoRenumberOnConflict) {
          throw new Error('رقم الباركود مستخدم مسبقاً. يرجى عدم إعادة استخدام نفس الرقم.');
        }
        // العداد غير متزامن: نصحح ونعيد المحاولة تلقائياً
        console.warn('⚠️ رقم الباركود مكرر، جاري مزامنة العداد وإعادة التوليد...', phoneNumber);
        await this.syncPhoneCounterToMax();
        const maxAttempts = 10;
        let attempt = 0;
        while (exists && attempt < maxAttempts) {
          phoneNumber = await this.getNextPhoneNumber();
          exists = await this.hasPhoneWithNumber(phoneNumber);
          attempt++;
        }
        if (exists) {
          throw new Error('تعذّر توليد رقم باركود فريد بعد عدة محاولات. يرجى المحاولة لاحقاً.');
        }
        console.log('✅ تم توليد رقم باركود جديد بعد المزامنة:', phoneNumber);
      }
      // تحديث كائن الاستدعاء ليعكس الرقم النهائي (للطباعة والتخزين المحلي)
      phoneData.phone_number = phoneNumber;
      const dataToSave = { ...phoneData, phone_number: phoneNumber };
      const docRef = await addDoc(collection(this.db, 'phones'), {
        ...dataToSave,
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
      const cached = this._cacheGet('phones');
      if (cached) {
        console.log('📱 Phones from cache:', cached.length);
        return cached;
      }
      const phonesSnapshot = await getDocs(collection(this.db, 'phones'));
      const phones = [];
      phonesSnapshot.forEach((doc) => {
        phones.push({ id: doc.id, ...doc.data() });
      });
      console.log('📱 Retrieved phones:', phones.length);
      this._cacheSet('phones', phones);
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

  // ===== إدارة الأكسسوارات =====
  async addAccessory(accessoryData) {
    try {
      console.log('🔥 Firebase: محاولة إضافة أكسسوار:', accessoryData);
      
      const docRef = await addDoc(collection(this.db, 'accessories'), {
        ...accessoryData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      this._cacheClear('accessories');
      console.log('✅ Firebase: تم إضافة الأكسسوار بنجاح! ID:', docRef.id);
      console.log('📂 Firebase: الفئة المحفوظة:', accessoryData.category);
      return docRef.id;
    } catch (error) {
      console.error('❌ Firebase: خطأ في إضافة الأكسسوار:', error);
      throw error;
    }
  }

  async getAccessories() {
    try {
      const cached = this._cacheGet('accessories');
      if (cached) {
        console.log('🛍️ Accessories from cache:', cached.length);
        return cached;
      }
      const accessoriesSnapshot = await getDocs(collection(this.db, 'accessories'));
      const accessories = [];
      accessoriesSnapshot.forEach((doc) => {
        accessories.push({ id: doc.id, ...doc.data() });
      });
      console.log('🛍️ Retrieved accessories:', accessories.length);
      this._cacheSet('accessories', accessories);
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

  // ===== إدارة المبيعات =====
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
      const cached = this._cacheGet('sales');
      if (cached) {
        console.log('💰 Sales from cache:', cached.length);
        return cached;
      }
      const salesSnapshot = await getDocs(
        query(collection(this.db, 'sales'), orderBy('createdAt', 'desc'))
      );
      const sales = [];
      salesSnapshot.forEach((doc) => {
        sales.push({ id: doc.id, ...doc.data() });
      });
      console.log('💰 Retrieved sales:', sales.length);
      this._cacheSet('sales', sales);
      return sales;
    } catch (error) {
      console.error('❌ Error getting sales:', error);
      throw error;
    }
  }

  async getSale(saleId) {
    try {
      const saleDoc = await getDoc(doc(this.db, 'sales', saleId));
      if (saleDoc.exists()) {
        return { id: saleDoc.id, ...saleDoc.data() };
      }
      return null;
    } catch (error) {
      console.error('❌ Error getting sale:', error);
      throw error;
    }
  }

  /**
   * جلب مبيعات نطاق زمني فقط (createdAt بين تاريخين) بدل قراءة المجموعة كاملة —
   * مناسب لإحصاءات "الفترة" في لوحة التحكم.
   * @param {Date} from  @param {Date} to
   */
  async getSalesInRange(from, to) {
    try {
      const q = to
        ? query(collection(this.db, 'sales'),
            where('createdAt', '>=', from), where('createdAt', '<=', to),
            orderBy('createdAt', 'desc'))
        : query(collection(this.db, 'sales'),
            where('createdAt', '>=', from),
            orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const sales = [];
      snap.forEach((d) => sales.push({ id: d.id, ...d.data() }));
      console.log('💰 Sales in range loaded:', sales.length);
      return sales;
    } catch (error) {
      console.error('❌ Error getting sales in range:', error);
      throw error;
    }
  }

  /**
   * ترحيل لمرة واحدة: يحسب علم sold لكل هاتف من المبيعات التاريخية
   * (بيع غير مسترجع يحتوي عنصر هاتف = sold:true) ويكتبه على مستندات phones.
   * شغّلها مرة واحدة من الكونسول: await window.firebaseDatabase.migrateSoldFlags()
   * بعد الترحيل، الصفحات تتوقف عن قراءة مجموعة sales كاملة لمعرفة المباع.
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
    let soldCount = 0, availCount = 0, batch = writeBatch(this.db), ops = 0;
    for (const phone of phones) {
      const key = String(phone.id != null ? phone.id : phone.phone_number);
      const alsoNumber = String(phone.phone_number != null ? phone.phone_number : '');
      const sold = soldKeys.has(key) || (alsoNumber && soldKeys.has(alsoNumber));
      sold ? soldCount++ : availCount++;
      batch.update(doc(this.db, 'phones', phone.id), { sold });
      if (++ops === 400) { await batch.commit(); batch = writeBatch(this.db); ops = 0; }
    }
    if (ops > 0) await batch.commit();
    this._cacheClear('phones');
    const summary = { phones: phones.length, sold: soldCount, available: availCount };
    console.log('✅ migrateSoldFlags:', summary);
    return summary;
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

  // ===== إدارة فئات الأكسسوارات =====
  async addAccessoryCategory(categoryData) {
    try {
      const docRef = await addDoc(collection(this.db, 'accessory_categories'), {
        ...categoryData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      this._cacheClear('accessory_categories');
      console.log('✅ Category added with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error adding category:', error);
      throw error;
    }
  }

  async getAccessoryCategories() {
    try {
      const cached = this._cacheGet('accessory_categories');
      if (cached) {
        console.log('📂 Categories from cache:', cached.length);
        return cached;
      }
      const categoriesSnapshot = await getDocs(collection(this.db, 'accessory_categories'));
      const categories = [];
      categoriesSnapshot.forEach((doc) => {
        categories.push({ id: doc.id, ...doc.data() });
      });
      console.log('📂 Retrieved categories:', categories.length);
      this._cacheSet('accessory_categories', categories);
      return categories;
    } catch (error) {
      console.error('❌ Error getting categories:', error);
      throw error;
    }
  }

  async deleteAccessoryCategory(categoryName) {
    try {
      const categoriesSnapshot = await getDocs(
        query(collection(this.db, 'accessory_categories'), 
              where('arabic_name', '==', categoryName))
      );
      
      const deletePromises = [];
      categoriesSnapshot.forEach((doc) => {
        deletePromises.push(deleteDoc(doc.ref));
      });
      
      await Promise.all(deletePromises);
      this._cacheClear('accessory_categories');
      console.log('✅ Accessory category deleted:', categoryName);
      return true;
    } catch (error) {
      console.error('❌ Error deleting accessory category:', error);
      throw error;
    }
  }

  // ===== إدارة أنواع الهواتف =====
  async addPhoneType(phoneTypeData) {
    try {
      const docRef = await addDoc(collection(this.db, 'phone_types'), {
        ...phoneTypeData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      this._cacheClear('phone_types');
      console.log('✅ Phone type added with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error adding phone type:', error);
      throw error;
    }
  }

  async getPhoneTypes() {
    try {
      const cached = this._cacheGet('phone_types');
      if (cached) {
        console.log('📱 Phone types from cache:', cached.length);
        return cached;
      }
      const phoneTypesSnapshot = await getDocs(collection(this.db, 'phone_types'));
      const phoneTypes = [];
      phoneTypesSnapshot.forEach((doc) => {
        phoneTypes.push({ id: doc.id, ...doc.data() });
      });
      console.log('📱 Retrieved phone types:', phoneTypes.length);
      this._cacheSet('phone_types', phoneTypes);
      return phoneTypes;
    } catch (error) {
      console.error('❌ Error getting phone types:', error);
      throw error;
    }
  }

  async deletePhoneType(brand, model) {
    try {
      const phoneTypesSnapshot = await getDocs(
        query(collection(this.db, 'phone_types'), 
              where('brand', '==', brand), 
              where('model', '==', model))
      );
      
      const deletePromises = [];
      phoneTypesSnapshot.forEach((doc) => {
        deletePromises.push(deleteDoc(doc.ref));
      });
      
      await Promise.all(deletePromises);
      this._cacheClear('phone_types');
      console.log('✅ Phone type deleted:', brand, model);
      return true;
    } catch (error) {
      console.error('❌ Error deleting phone type:', error);
      throw error;
    }
  }

  // ===== نظام الصيانة =====
  
  // ===== إدارة المندوبين =====
  async addRep(repData) {
    try {
      const docRef = await addDoc(collection(this.db, 'reps'), {
        ...repData,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
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
      const querySnapshot = await getDocs(collection(this.db, 'reps'));
      const reps = [];
      querySnapshot.forEach(doc => {
        reps.push({ id: doc.id, ...doc.data() });
      });
      console.log('✅ Reps loaded:', reps.length);
      return reps;
    } catch (error) {
      console.error('❌ Error getting reps:', error);
      throw error;
    }
  }

  async updateRep(repId, repData) {
    try {
      const repRef = doc(this.db, 'reps', repId);
      await updateDoc(repRef, {
        ...repData,
        updatedAt: serverTimestamp()
      });
      console.log('✅ Rep updated:', repId);
    } catch (error) {
      console.error('❌ Error updating rep:', error);
      throw error;
    }
  }

  async deleteRep(repId) {
    try {
      const repRef = doc(this.db, 'reps', repId);
      await deleteDoc(repRef);
      console.log('✅ Rep deleted:', repId);
    } catch (error) {
      console.error('❌ Error deleting rep:', error);
      throw error;
    }
  }

  // ===== إدارة الفنيين =====
  async addTechnician(techData) {
    try {
      const docRef = await addDoc(collection(this.db, 'technicians'), {
        ...techData,
        active: true,
        defaultCommissionPercent: techData.defaultCommissionPercent || 0.5,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
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
      const querySnapshot = await getDocs(collection(this.db, 'technicians'));
      const technicians = [];
      querySnapshot.forEach(doc => {
        technicians.push({ id: doc.id, ...doc.data() });
      });
      console.log('✅ Technicians loaded:', technicians.length);
      return technicians;
    } catch (error) {
      console.error('❌ Error getting technicians:', error);
      throw error;
    }
  }

  async updateTechnician(techId, techData) {
    try {
      const techRef = doc(this.db, 'technicians', techId);
      await updateDoc(techRef, {
        ...techData,
        updatedAt: serverTimestamp()
      });
      console.log('✅ Technician updated:', techId);
    } catch (error) {
      console.error('❌ Error updating technician:', error);
      throw error;
    }
  }

  async deleteTechnician(techId) {
    try {
      const techRef = doc(this.db, 'technicians', techId);
      await deleteDoc(techRef);
      console.log('✅ Technician deleted:', techId);
    } catch (error) {
      console.error('❌ Error deleting technician:', error);
      throw error;
    }
  }

  // ===== أعمال الصيانة =====
  async addMaintenanceJob(jobData) {
    try {
      // ✅ حساب الأرباح باستخدام الدالة الموحدة
      // نستخدم إجمالي تكلفة القطع إن وُجد، وإلا نرجع لـ partCost
      const basePartCost =
        jobData.totalPartCost !== undefined ? jobData.totalPartCost : jobData.partCost;
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
      console.log('✅ Maintenance job added with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error adding maintenance job:', error);
      throw error;
    }
  }

  async getMaintenanceJobs(filters = {}) {
    try {
      let q = collection(this.db, 'maintenanceJobs');
      
      // بناء الاستعلام الأساسي (بدون repId لأنه قد يكون في parts[])
      if (filters.status) {
        q = query(q, where('status', '==', filters.status));
      }
      
      // فلترة الفني يمكن عملها مباشرة (techId في المستوى الرئيسي)
      if (filters.techId) {
        q = query(q, where('techId', '==', filters.techId));
      }
      
      // محاولة فلترة التواريخ في الاستعلام
      try {
        if (filters.dateFrom) {
          q = query(q, where('visitDate', '>=', filters.dateFrom));
        }
        if (filters.dateTo) {
          q = query(q, where('visitDate', '<=', filters.dateTo));
        }
      } catch (indexError) {
        console.warn('⚠️ Date filtering requires index, will filter manually');
      }

      const querySnapshot = await getDocs(q);
      let jobs = [];
      querySnapshot.forEach(doc => {
        jobs.push({ id: doc.id, ...doc.data() });
      });
      
      // تصفية يدوياً حسب التاريخ إذا لزم الأمر
      if (filters.dateFrom) {
        const dateFrom = filters.dateFrom instanceof Date ? filters.dateFrom : new Date(filters.dateFrom);
        jobs = jobs.filter(job => {
          const jobDate = job.visitDate?.seconds ? new Date(job.visitDate.seconds * 1000) : new Date(job.visitDate);
          return jobDate >= dateFrom;
        });
      }
      
      if (filters.dateTo) {
        const dateTo = filters.dateTo instanceof Date ? filters.dateTo : new Date(filters.dateTo);
        jobs = jobs.filter(job => {
          const jobDate = job.visitDate?.seconds ? new Date(job.visitDate.seconds * 1000) : new Date(job.visitDate);
          return jobDate <= dateTo;
        });
      }
      
      // ✅ فلترة المندوب: تدعم البنية الجديدة (parts[]) والقديمة (repId مباشر)
      if (filters.repId) {
        jobs = jobs.filter(job => {
          // البنية الجديدة: البحث في parts[]
          if (job.parts && Array.isArray(job.parts) && job.parts.length > 0) {
            return job.parts.some(part => part.repId === filters.repId);
          }
          // البنية القديمة: repId مباشر
          return job.repId === filters.repId;
        });
      }
      
      // ترتيب النتائج يدوياً دائماً
      jobs.sort((a, b) => {
        const dateA = a.visitDate?.seconds ? new Date(a.visitDate.seconds * 1000) : new Date(a.visitDate);
        const dateB = b.visitDate?.seconds ? new Date(b.visitDate.seconds * 1000) : new Date(b.visitDate);
        return dateB - dateA; // ترتيب تنازلي
      });
      
      console.log('✅ Maintenance jobs loaded:', jobs.length);
      return jobs;
    } catch (error) {
      console.error('❌ Error getting maintenance jobs:', error);
      throw error;
    }
  }

  async updateMaintenanceJob(jobId, jobData) {
    try {
      // ✅ إعادة حساب الأرباح إذا تغيرت القيم باستخدام الدالة الموحدة
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

      const jobRef = doc(this.db, 'maintenanceJobs', jobId);
      await updateDoc(jobRef, {
        ...jobData,
        updatedAt: serverTimestamp()
      });
      console.log('✅ Maintenance job updated:', jobId);
    } catch (error) {
      console.error('❌ Error updating maintenance job:', error);
      throw error;
    }
  }

  async getMaintenanceJob(jobId) {
    try {
      const jobRef = doc(this.db, 'maintenanceJobs', jobId);
      const jobSnap = await getDoc(jobRef);
      if (jobSnap.exists()) {
        return { id: jobSnap.id, ...jobSnap.data() };
      } else {
        throw new Error('Job not found');
      }
    } catch (error) {
      console.error('❌ Error getting maintenance job:', error);
      throw error;
    }
  }

  async deleteMaintenanceJob(jobId) {
    try {
      const jobRef = doc(this.db, 'maintenanceJobs', jobId);
      await deleteDoc(jobRef);
      console.log('✅ Maintenance job deleted:', jobId);
    } catch (error) {
      console.error('❌ Error deleting maintenance job:', error);
      throw error;
    }
  }

  // ===== دوال الحساب =====
  // ✅ دالة موحّدة لحساب القيم المشتقة
  computeDerived(partCost, amountCharged, techPercent) {
    const pc = Number(partCost) || 0;
    const ac = Number(amountCharged) || 0;
    const tp = (typeof techPercent === 'number' && !isNaN(techPercent)) ? techPercent : 0; // افتراضي 0%
    const profit = ac - pc;                                // الربح الإجمالي
    const techCommission = Math.max(0, profit * tp);       // عمولة الفني
    const shopProfit = profit - techCommission;            // أرباح المحل
    return { profit, techCommission, shopProfit };
  }

  // ===== إدارة المدفوعات =====
  async addPayment(paymentData) {
    try {
      const docRef = await addDoc(collection(this.db, 'payments'), {
        ...paymentData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      console.log('✅ Payment added with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error adding payment:', error);
      throw error;
    }
  }

  async getPayments(filters = {}) {
    try {
      let q = collection(this.db, 'payments');
      
      if (filters.dateFrom) {
        q = query(q, where('paymentDate', '>=', filters.dateFrom));
      }
      
      if (filters.dateTo) {
        q = query(q, where('paymentDate', '<=', filters.dateTo));
      }
      
      if (filters.entityType) {
        q = query(q, where('entityType', '==', filters.entityType));
      }
      
      if (filters.entityId) {
        q = query(q, where('entityId', '==', filters.entityId));
      }
      
      q = query(q, orderBy('paymentDate', 'desc'));

      const querySnapshot = await getDocs(q);
      const payments = [];
      querySnapshot.forEach(doc => {
        payments.push({ id: doc.id, ...doc.data() });
      });
      
      console.log('✅ Payments loaded:', payments.length);
      return payments;
    } catch (error) {
      console.error('❌ Error getting payments:', error);
      throw error;
    }
  }

  async deletePayment(paymentId) {
    try {
      const paymentRef = doc(this.db, 'payments', paymentId);
      await deleteDoc(paymentRef);
      console.log('✅ Payment deleted:', paymentId);
    } catch (error) {
      console.error('❌ Error deleting payment:', error);
      throw error;
    }
  }

  // ===== تقارير التسويات =====
  async getRepSettlements(dateFrom, dateTo, preloadedJobs = null) {
    try {
      console.log('🔍 Getting rep settlements from', dateFrom, 'to', dateTo);

      // يسمح بتمرير الأعمال المحمّلة مسبقًا لتجنب إعادة قراءة نفس المجموعة
      // عند حساب تسويات المندوبين والفنيين في نفس الصفحة
      const jobs = preloadedJobs || await this.getMaintenanceJobs({
        status: 'done',
        dateFrom,
        dateTo
      });

      console.log('📊 Found jobs for rep settlements:', jobs.length);

      const repTotals = {};
      
      jobs.forEach(job => {
        // ✅ إعادة حساب القيم المشتقة من البيانات الصحيحة
        const totalPartCost = job.totalPartCost !== undefined ? Number(job.totalPartCost) : 
                             (job.parts && Array.isArray(job.parts) && job.parts.length > 0) ? 
                             job.parts.reduce((sum, part) => sum + (Number(part.partCost) || 0), 0) : 
                             Number(job.partCost) || 0;
        const amountCharged = Number(job.amountCharged) || 0;
        const techPercent = (typeof job.techPercent === 'number' && !isNaN(job.techPercent)) ? job.techPercent : 0;
        
        // ✅ إعادة حساب القيم المشتقة بشكل صحيح
        const { profit, techCommission, shopProfit } = this.computeDerived(totalPartCost, amountCharged, techPercent);
        
        // ✅ دعم البنية الجديدة (parts array) والقديمة (repId مباشر)
        if (job.parts && Array.isArray(job.parts) && job.parts.length > 0) {
          // البنية الجديدة: كل قطعة لها مندوب خاص
          job.parts.forEach(part => {
            if (!part.repId) return;
            
            if (!repTotals[part.repId]) {
              repTotals[part.repId] = {
                repId: part.repId,
                repName: part.repName || 'غير محدد',
                jobsCount: 0,
                partCostSum: 0,
                profitSum: 0,
                techCommissionSum: 0,
                shopProfitSum: 0,
                revenueSum: 0
              };
            }
            
            // نضيف تكلفة القطعة فقط (لأن كل قطعة لها مندوب)
            repTotals[part.repId].partCostSum += (Number(part.partCost) || 0);
          });
          
          // نحسب عدد الأعمال والإيرادات مرة واحدة لكل عمل
          // نستخدم أول مندوب في القائمة لتخصيص إحصائيات العمل
          const firstRepId = job.parts[0]?.repId;
          if (firstRepId && repTotals[firstRepId]) {
            repTotals[firstRepId].jobsCount++;
            repTotals[firstRepId].profitSum += profit; // ✅ استخدام القيمة المحسوبة بشكل صحيح
            repTotals[firstRepId].techCommissionSum += techCommission; // ✅ استخدام القيمة المحسوبة بشكل صحيح
            repTotals[firstRepId].shopProfitSum += shopProfit; // ✅ استخدام القيمة المحسوبة بشكل صحيح
            repTotals[firstRepId].revenueSum += amountCharged;
          }
        } else if (job.repId) {
          // البنية القديمة: مندوب واحد للعمل كامل
          if (!repTotals[job.repId]) {
            repTotals[job.repId] = {
              repId: job.repId,
              repName: job.repName || 'غير محدد',
              jobsCount: 0,
              partCostSum: 0,
              profitSum: 0,
              techCommissionSum: 0,
              shopProfitSum: 0,
              revenueSum: 0
            };
          }
          
          repTotals[job.repId].jobsCount++;
          repTotals[job.repId].partCostSum += totalPartCost; // ✅ استخدام totalPartCost
          repTotals[job.repId].profitSum += profit; // ✅ استخدام القيمة المحسوبة بشكل صحيح
          repTotals[job.repId].techCommissionSum += techCommission; // ✅ استخدام القيمة المحسوبة بشكل صحيح
          repTotals[job.repId].shopProfitSum += shopProfit; // ✅ استخدام القيمة المحسوبة بشكل صحيح
          repTotals[job.repId].revenueSum += amountCharged;
        } else {
          console.warn('⚠️ Job missing repId and parts:', job.id);
        }
      });

      const result = Object.values(repTotals);
      console.log('✅ Rep settlements calculated:', result);
      return result;
    } catch (error) {
      console.error('❌ Error getting rep settlements:', error);
      throw error;
    }
  }

  async getTechSettlements(dateFrom, dateTo, preloadedJobs = null) {
    try {
      console.log('🔍 Getting tech settlements from', dateFrom, 'to', dateTo);

      // يسمح بتمرير الأعمال المحمّلة مسبقًا لتجنب إعادة قراءة نفس المجموعة
      const jobs = preloadedJobs || await this.getMaintenanceJobs({
        status: 'done',
        dateFrom,
        dateTo
      });

      console.log('📊 Found jobs for tech settlements:', jobs.length);

      const techTotals = {};
      jobs.forEach(job => {
        if (!job.techId) {
          console.warn('⚠️ Job missing techId:', job);
          return;
        }
        
        // ✅ إعادة حساب القيم المشتقة من البيانات الصحيحة
        const totalPartCost = job.totalPartCost !== undefined ? Number(job.totalPartCost) : 
                             (job.parts && Array.isArray(job.parts) && job.parts.length > 0) ? 
                             job.parts.reduce((sum, part) => sum + (Number(part.partCost) || 0), 0) : 
                             Number(job.partCost) || 0;
        const amountCharged = Number(job.amountCharged) || 0;
        const techPercent = (typeof job.techPercent === 'number' && !isNaN(job.techPercent)) ? job.techPercent : 0;
        
        // ✅ إعادة حساب القيم المشتقة بشكل صحيح
        const { profit, techCommission, shopProfit } = this.computeDerived(totalPartCost, amountCharged, techPercent);
        
        if (!techTotals[job.techId]) {
          techTotals[job.techId] = {
            techId: job.techId,
            techName: job.techName || 'غير محدد',
            jobsCount: 0,
            partCostSum: 0,
            profitSum: 0,
            techCommissionSum: 0,
            shopProfitSum: 0,
            revenueSum: 0
          };
        }
        
        techTotals[job.techId].jobsCount++;
        techTotals[job.techId].partCostSum += totalPartCost; // ✅ استخدام totalPartCost
        techTotals[job.techId].profitSum += profit; // ✅ استخدام القيمة المحسوبة بشكل صحيح
        techTotals[job.techId].techCommissionSum += techCommission; // ✅ استخدام القيمة المحسوبة بشكل صحيح
        techTotals[job.techId].shopProfitSum += shopProfit; // ✅ استخدام القيمة المحسوبة بشكل صحيح
        techTotals[job.techId].revenueSum += amountCharged;
      });

      const result = Object.values(techTotals);
      console.log('✅ Tech settlements calculated:', result);
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
