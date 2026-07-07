// Firebase Database Manager for Phone Store Demo
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
  onSnapshot,
  serverTimestamp,
  increment,
  runTransaction
} from 'firebase/firestore';

// قاطع دائرة لحصة Firestore
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

class FirebaseDatabase {
  constructor() {
    this.db = window.firebaseDB;
    this.auth = window.firebaseAuth;
  }

  // ===== إدارة الهواتف =====
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
        const ts = Date.now().toString().slice(-6);
        return ts.padStart(6, '0');
      }
    };

    if (isQuotaCooling()) {
      console.warn('⛔ قاطع دائرة Firestore مفعل — استخدام العداد المحلي مباشرة.');
      return await fallbackLocal();
    }

    const counterRef = doc(this.db, 'counters', 'phones');
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
        markQuotaExhausted();
        console.warn('⚠️ Firestore quota reached — تفعيل قاطع الدائرة.', error && error.code);
        return await fallbackLocal();
      }
      console.error('❌ Error in getNextPhoneNumber, falling back to local counter.', error);
      return await fallbackLocal();
    }
  }

  /**
   * قراءة عداد الأجهزة مرة واحدة عند التهيئة.
   */
  async primePhoneCounterBase() {
    if (isQuotaCooling()) return;
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
      console.log('✅ Phone added with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error adding phone:', error);
      throw error;
    }
  }

  async getPhones() {
    try {
      const phonesSnapshot = await getDocs(collection(this.db, 'phones'));
      const phones = [];
      phonesSnapshot.forEach((doc) => {
        phones.push({ id: doc.id, ...doc.data() });
      });
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
      console.log('✅ Phone updated:', phoneId);
    } catch (error) {
      console.error('❌ Error updating phone:', error);
      throw error;
    }
  }

  async deletePhone(phoneId) {
    try {
      await deleteDoc(doc(this.db, 'phones', phoneId));
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
      const accessoriesSnapshot = await getDocs(collection(this.db, 'accessories'));
      const accessories = [];
      accessoriesSnapshot.forEach((doc) => {
        accessories.push({ id: doc.id, ...doc.data() });
      });
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
      console.log('✅ Accessory updated:', accessoryId);
    } catch (error) {
      console.error('❌ Error updating accessory:', error);
      throw error;
    }
  }

  async deleteAccessory(accessoryId) {
    try {
      await deleteDoc(doc(this.db, 'accessories', accessoryId));
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
      console.log('✅ Sale added with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error adding sale:', error);
      throw error;
    }
  }

  async getSales() {
    try {
      const salesSnapshot = await getDocs(
        query(collection(this.db, 'sales'), orderBy('createdAt', 'desc'))
      );
      const sales = [];
      salesSnapshot.forEach((doc) => {
        sales.push({ id: doc.id, ...doc.data() });
      });
      console.log('💰 Retrieved sales:', sales.length);
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

  async updateSale(saleId, saleData) {
    try {
      await updateDoc(doc(this.db, 'sales', saleId), {
        ...saleData,
        updatedAt: serverTimestamp()
      });
      console.log('✅ Sale updated:', saleId);
    } catch (error) {
      console.error('❌ Error updating sale:', error);
      throw error;
    }
  }

  async deleteSale(saleId) {
    try {
      await deleteDoc(doc(this.db, 'sales', saleId));
      console.log('✅ Sale deleted:', saleId);
    } catch (error) {
      console.error('❌ Error deleting sale:', error);
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
      console.log('✅ Category added with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error adding category:', error);
      throw error;
    }
  }

  async getAccessoryCategories() {
    try {
      const categoriesSnapshot = await getDocs(collection(this.db, 'accessory_categories'));
      const categories = [];
      categoriesSnapshot.forEach((doc) => {
        categories.push({ id: doc.id, ...doc.data() });
      });
      console.log('📂 Retrieved categories:', categories.length);
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
      console.log('✅ Phone type added with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error adding phone type:', error);
      throw error;
    }
  }

  async getPhoneTypes() {
    try {
      const phoneTypesSnapshot = await getDocs(collection(this.db, 'phone_types'));
      const phoneTypes = [];
      phoneTypesSnapshot.forEach((doc) => {
        phoneTypes.push({ id: doc.id, ...doc.data() });
      });
      console.log('📱 Retrieved phone types:', phoneTypes.length);
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
      console.log('✅ Phone type deleted:', brand, model);
      return true;
    } catch (error) {
      console.error('❌ Error deleting phone type:', error);
      throw error;
    }
  }

  // ===== تهيئة أشهر أنواع الهواتف (خصوصاً الآيفون) إن كانت القائمة فارغة =====
  // seedCommonPhoneTypesIfEmpty removed per request

  // نفس القائمة لكن مع دمج تجنّب التكرار وإمكانية الإضافة القسرية
  // buildCommonPhoneTypesList removed per request

  /**
   * يضيف أشهر الأنواع مع تجنّب التكرار. إذا كان force=true سيتم محاولة دمج القائمة حتى لو كانت موجودة.
   */
  // seedCommonPhoneTypes removed per request

  // ===== البحث =====
  async searchPhones(searchTerm) {
    try {
      const phones = await this.getPhones();
      const filteredPhones = phones.filter(phone => {
        const searchFields = [
          phone.phone_number,
          phone.serial_number,
          phone.brand,
          phone.model,
          phone.phone_color,
          phone.phone_memory,
          phone.description,
          phone.customer_name,
          phone.customer_id
        ];
        
        return searchFields.some(field => 
          field && field.toString().toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
      console.log('🔍 Search results for phones:', filteredPhones.length);
      return filteredPhones;
    } catch (error) {
      console.error('❌ Error searching phones:', error);
      throw error;
    }
  }

  async searchAccessories(searchTerm) {
    try {
      const accessories = await this.getAccessories();
      const filteredAccessories = accessories.filter(accessory => {
        const searchFields = [
          accessory.name,
          accessory.category,
          accessory.description,
          accessory.supplier,
          accessory.notes
        ];
        
        return searchFields.some(field => 
          field && field.toString().toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
      console.log('🔍 Search results for accessories:', filteredAccessories.length);
      return filteredAccessories;
    } catch (error) {
      console.error('❌ Error searching accessories:', error);
      throw error;
    }
  }

  // ===== الاستماع للتغييرات في الوقت الفعلي =====
  onPhonesChange(callback) {
    return onSnapshot(collection(this.db, 'phones'), (snapshot) => {
      const phones = [];
      snapshot.forEach((doc) => {
        phones.push({ id: doc.id, ...doc.data() });
      });
      callback(phones);
    });
  }

  onAccessoriesChange(callback) {
    return onSnapshot(collection(this.db, 'accessories'), (snapshot) => {
      const accessories = [];
      snapshot.forEach((doc) => {
        accessories.push({ id: doc.id, ...doc.data() });
      });
      callback(accessories);
    });
  }

  onSalesChange(callback) {
    return onSnapshot(
      query(collection(this.db, 'sales'), orderBy('createdAt', 'desc')), 
      (snapshot) => {
        const sales = [];
        snapshot.forEach((doc) => {
          sales.push({ id: doc.id, ...doc.data() });
        });
        callback(sales);
      }
    );
  }

  // ===== تهيئة البيانات الافتراضية =====
  async initializeDefaultData() {
    try {
      // لا نضيف أنواع هواتف افتراضية - يجب إضافتها يدوياً من قاعدة البيانات
      console.log('ℹ️ لا توجد أنواع هواتف افتراضية - يجب إضافتها يدوياً من قاعدة البيانات');

      // تهيئة فئات الأكسسوارات
      const defaultCategories = [
        { name: 'accessory', arabic_name: 'إكسسوار', description: 'إكسسوارات عامة' },
        { name: 'charger', arabic_name: 'شاحن', description: 'شواحن الهواتف' },
        { name: 'case', arabic_name: 'غلاف', description: 'أغلفة الهواتف' },
        { name: 'screen_protector', arabic_name: 'حماية الشاشة', description: 'حماية شاشة الهاتف' },
        { name: 'cable', arabic_name: 'كابل', description: 'كابلات البيانات والشحن' },
        { name: 'headphone', arabic_name: 'سماعات', description: 'سماعات الهواتف' },
        { name: 'other', arabic_name: 'أخرى', description: 'فئات أخرى' }
      ];

      // التحقق من وجود فئات الأكسسوارات
      const existingCategories = await this.getAccessoryCategories();
      if (existingCategories.length === 0) {
        for (const category of defaultCategories) {
          await this.addAccessoryCategory(category);
        }
        console.log('✅ تم إضافة فئات الأكسسوارات الافتراضية');
      }

      console.log('✅ Default data initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing default data:', error);
    }
  }
}

// إنشاء instance واحد للاستخدام في جميع أنحاء التطبيق
window.firebaseDatabase = new FirebaseDatabase();

// ملاحظة: هذا الملف قديم وغير مُحمّل من أي صفحة حالياً (الصفحات تستخدم firebase-database-cdn.js).
// أُزيل الاستدعاء التلقائي لـ initializeDefaultData() — كان يقرأ مجموعة الفئات كاملة
// عند كل تحميل وتسبب سباقه في تضاعف بيانات البذور. عند الحاجة استدعِها يدوياً.
console.log('🔥 Firebase Database Manager initialized successfully!');
