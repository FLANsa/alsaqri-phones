// Firebase Storage Manager - إدارة التخزين المختلط
// يعمل مع Firebase Firestore أو LocalStorage كبديل

// Configuration constants
const CONFIG = {
  STORAGE_KEYS: {
    PHONES: 'phones',
    ACCESSORIES: 'accessories',
    SALES: 'sales',
    PHONE_TYPES: 'phone_types',
    ACCESSORY_CATEGORIES: 'accessory_categories',
    CURRENT_USER: 'current_user'
  }
};

// Default data
const DEFAULT_PHONE_TYPES = {
  "Apple": ["iPhone 13", "iPhone 14", "iPhone 15"],
  "Samsung": ["S22", "S23", "S24"],
  "Xiaomi": ["Redmi Note 12", "Mi 11"]
};

const DEFAULT_ACCESSORY_CATEGORIES = [
  { name: 'accessory', arabic_name: 'إكسسوار', description: 'إكسسوارات عامة' },
  { name: 'charger', arabic_name: 'شاحن', description: 'شواحن الهواتف' },
  { name: 'case', arabic_name: 'غلاف', description: 'أغلفة الهواتف' },
  { name: 'screen_protector', arabic_name: 'حماية الشاشة', description: 'حماية شاشة الهاتف' },
  { name: 'cable', arabic_name: 'كابل', description: 'كابلات البيانات والشحن' },
  { name: 'headphone', arabic_name: 'سماعات', description: 'سماعات الهواتف' },
  { name: 'other', arabic_name: 'أخرى', description: 'فئات أخرى' }
];

class FirebaseStorageManager {
  constructor() {
    this.firebaseDB = window.firebaseDatabase;
    this.isFirebaseAvailable = !!(this.firebaseDB && this.firebaseDB.db);
    
    if (this.isFirebaseAvailable) {
      // ملاحظة: لم يعد يُقرأ عداد الأجهزة عند تحميل الصفحات — تُؤجّل القراءة إلى
      // لحظة حفظ هاتف جديد في صفحات الإضافة (انظر primePhoneCounterBase)
    } else {
      this.initializeLocalStorage();
    }
  }

  /**
   * يقرأ قيمة counters/phones.lastPhoneNumber مرة واحدة عند بدء الجلسة ويخزّنها
   * في localStorage كقاعدة موثوقة للفولباك عند نفاد حصة Firestore.
   */
  async primePhoneCounterBase() {
    try {
      if (!this.firebaseDB || typeof this.firebaseDB.primePhoneCounterBase !== 'function') return;
      await this.firebaseDB.primePhoneCounterBase();
    } catch (e) {
      console.warn('⚠️ primePhoneCounterBase failed', e && e.code);
    }
  }

  /**
   * Initialize localStorage fallback
   */
  initializeLocalStorage() {
    const defaults = {
      [CONFIG.STORAGE_KEYS.PHONE_TYPES]: DEFAULT_PHONE_TYPES,
      [CONFIG.STORAGE_KEYS.ACCESSORY_CATEGORIES]: DEFAULT_ACCESSORY_CATEGORIES,
      [CONFIG.STORAGE_KEYS.PHONES]: [],
      [CONFIG.STORAGE_KEYS.ACCESSORIES]: [],
      [CONFIG.STORAGE_KEYS.SALES]: []
    };
    for (const [key, value] of Object.entries(defaults)) {
      if (this.getItem(key) == null) this.setItem(key, value);
    }
  }

  /**
   * Generic storage methods
   */
  setItem(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      return false;
    }
  }

  getItem(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return defaultValue;
    }
  }

  removeItem(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Error removing from localStorage:', error);
      return false;
    }
  }

  /**
   * Phone management
   */
  async getPhones() {
    if (this.isFirebaseAvailable) {
      try {
        return await this.firebaseDB.getPhones();
      } catch (error) {
        console.error('Error getting phones from Firebase:', error);
        throw error;
      }
    }
    throw new Error('تعذر تهيئة قاعدة البيانات لقراءة الهواتف');
  }

  async setPhones(phones) {
    if (this.isFirebaseAvailable) {
      return true;
    }
    throw new Error('يلزم الاتصال بقاعدة البيانات لتعديل الهواتف');
  }

  async addPhone(phone) {
    if (this.isFirebaseAvailable) {
      try {
        phone.date_added = new Date();
        const phoneId = await this.firebaseDB.addPhone(phone);
        return phoneId;
      } catch (error) {
        console.error('Error adding phone to Firebase:', error);
        throw error;
      }
    }
    
    throw new Error('يلزم الاتصال بقاعدة البيانات لإضافة هاتف');
  }

  /** البحث عن جهاز متاح (غير مباع) بنفس الرقم التسلسلي — لمنع التسجيل المكرر */
  async findAvailablePhoneBySerial(serial, excludeId = null) {
    if (this.isFirebaseAvailable) {
      try {
        return await this.firebaseDB.findAvailablePhoneBySerial(serial, excludeId);
      } catch (error) {
        console.error('Error checking serial duplicate:', error);
        throw error;
      }
    }
    // LocalStorage fallback
    const phones = await this.getPhones();
    const arr = Array.isArray(phones) ? phones : [];
    return arr.find(p =>
      String(p.serial_number || '').trim() === String(serial || '').trim() &&
      p.sold !== true &&
      (excludeId == null ||
        (String(p.id || '') !== String(excludeId) && String(p.phone_number || '') !== String(excludeId)))
    ) || null;
  }

  async updatePhone(phoneId, updatedPhone) {
    if (this.isFirebaseAvailable) {
      try {
        await this.firebaseDB.updatePhone(phoneId, updatedPhone);
        return true;
      } catch (error) {
        console.error('Error updating phone in Firebase:', error);
        return false;
      }
    }

    throw new Error('يلزم الاتصال بقاعدة البيانات لتعديل هاتف');
  }

  async deletePhone(phoneId) {
    if (this.isFirebaseAvailable) {
      try {
        await this.firebaseDB.deletePhone(phoneId);
        return true;
      } catch (error) {
        console.error('Error deleting phone from Firebase:', error);
        return false;
      }
    }

    throw new Error('يلزم الاتصال بقاعدة البيانات لحذف هاتف');
  }

  async returnSaleAtomically(saleId) {
    if (!this.isFirebaseAvailable) throw new Error('يلزم الاتصال بقاعدة البيانات لاسترجاع الفاتورة');
    return this.firebaseDB.returnSaleAtomically(saleId);
  }

  async recordSaleAtomically(saleData, cartItems) {
    if (!this.isFirebaseAvailable || typeof this.firebaseDB.recordSaleAtomically !== 'function') {
      throw new Error('حفظ البيع الذرّي غير متاح');
    }
    return this.firebaseDB.recordSaleAtomically(saleData, cartItems);
  }

  /**
   * الحصول على الرقم التالي الفريد لرقم الباركود (phone_number).
   * مع Firebase: يستخدم عداداً في Firestore. مع localStorage: أقصى رقم موجود + 1.
   */
  async getNextPhoneNumber() {
    if (this.isFirebaseAvailable && typeof this.firebaseDB.getNextPhoneNumber === 'function') {
      return await this.firebaseDB.getNextPhoneNumber();
    }
    const phones = await this.getPhones();
    const arr = Array.isArray(phones) ? phones : [];
    const numbers = arr
      .map(p => parseInt(String(p.phone_number || '0').replace(/\D/g, ''), 10))
      .filter(n => !isNaN(n) && n > 0);
    const next = numbers.length ? Math.max(...numbers) + 1 : 1;
    return String(next).padStart(6, '0');
  }

  async getPhoneByNumber(phoneNumber) {
    // استعلام where موجّه بدل قراءة مجموعة الهواتف كاملة
    if (this.isFirebaseAvailable && typeof this.firebaseDB.getPhoneByNumberQuery === 'function') {
      try {
        return await this.firebaseDB.getPhoneByNumberQuery(phoneNumber);
      } catch (error) {
        console.error('Error getting phone by number from Firebase:', error);
        throw error;
      }
    }
    const phones = await this.getPhones();
    const s = String(phoneNumber || '');
    return phones.find(p => String(p.phone_number || '') === s);
  }

  async getPhonesByRefs(refs) {
    if (this.isFirebaseAvailable && typeof this.firebaseDB.getPhonesByRefs === 'function') {
      try {
        return await this.firebaseDB.getPhonesByRefs(refs);
      } catch (error) {
        console.error('Error getting phones by refs from Firebase:', error);
        throw error;
      }
    }
    const phones = await this.getPhones();
    const map = {};
    (phones || []).forEach(p => {
      if (p.id != null) map[String(p.id)] = p;
      if (p.phone_number != null) map[String(p.phone_number)] = p;
    });
    return map;
  }

  async getAccessoryById(accessoryId) {
    if (this.isFirebaseAvailable && typeof this.firebaseDB.getAccessoryById === 'function') {
      try {
        return await this.firebaseDB.getAccessoryById(accessoryId);
      } catch (error) {
        console.error('Error getting accessory by id from Firebase:', error);
        throw error;
      }
    }
    const accessories = await this.getAccessories();
    return (accessories || []).find(a => String(a.id) === String(accessoryId)) || null;
  }

  async getAccessoryByBarcode(barcode) {
    if (this.isFirebaseAvailable && typeof this.firebaseDB.getAccessoryByBarcode === 'function') {
      try {
        return await this.firebaseDB.getAccessoryByBarcode(barcode);
      } catch (error) {
        console.error('Error getting accessory by barcode from Firebase:', error);
        throw error;
      }
    }
    const accessories = await this.getAccessories();
    const s = String(barcode || '');
    return (accessories || []).find(a => String(a.barcode || '') === s || String(a.barcode_id || '') === s) || null;
  }

  /**
   * Accessory management
   */
  async getAccessories() {
    if (this.isFirebaseAvailable) {
      try {
        return await this.firebaseDB.getAccessories();
      } catch (error) {
        console.error('Error getting accessories from Firebase:', error);
        throw error;
      }
    }
    throw new Error('تعذر تهيئة قاعدة البيانات لقراءة الأكسسوارات');
  }

  async setAccessories(accessories) {
    if (this.isFirebaseAvailable) {
      return true;
    }
    throw new Error('يلزم الاتصال بقاعدة البيانات لتعديل الأكسسوارات');
  }

  async addAccessory(accessory) {
    if (this.isFirebaseAvailable) {
      try {
        accessory.date_added = new Date();
        const accessoryId = await this.firebaseDB.addAccessory(accessory);
        return accessoryId;
      } catch (error) {
        console.error('❌ Storage Manager: خطأ في إضافة الأكسسوار إلى Firebase:', error);
        return false;
      }
    }
    
    throw new Error('يلزم الاتصال بقاعدة البيانات لإضافة أكسسوار');
  }

  async updateAccessory(accessoryId, updatedAccessory) {
    if (this.isFirebaseAvailable) {
      try {
        await this.firebaseDB.updateAccessory(accessoryId, updatedAccessory);
        return true;
      } catch (error) {
        console.error('Error updating accessory in Firebase:', error);
        return false;
      }
    }

    throw new Error('يلزم الاتصال بقاعدة البيانات لتعديل أكسسوار');
  }

  async deleteAccessory(accessoryId) {
    if (this.isFirebaseAvailable) {
      try {
        await this.firebaseDB.deleteAccessory(accessoryId);
        return true;
      } catch (error) {
        console.error('Error deleting accessory from Firebase:', error);
        return false;
      }
    }

    throw new Error('يلزم الاتصال بقاعدة البيانات لحذف أكسسوار');
  }

  /**
   * Sales management
   */
  async getSales() {
    if (this.isFirebaseAvailable) {
      try {
        return await this.firebaseDB.getSales();
      } catch (error) {
        console.error('Error getting sales from Firebase:', error);
        throw error;
      }
    }
    throw new Error('تعذر تهيئة قاعدة البيانات لقراءة المبيعات');
  }

  async getSalesInRange(from, to) {
    if (this.isFirebaseAvailable && typeof this.firebaseDB.getSalesInRange === 'function') {
      try {
        return await this.firebaseDB.getSalesInRange(from, to);
      } catch (error) {
        console.error('Error getting sales in range from Firebase:', error);
        throw error;
      }
    }
    // LocalStorage fallback: فلترة محلية
    const sales = this.getItem(CONFIG.STORAGE_KEYS.SALES, []) || [];
    const fromDate = from instanceof Date ? from : (from ? new Date(from) : null);
    const toDate = to instanceof Date ? to : (to ? new Date(to) : null);
    return sales.filter(s => {
      const rawDate = s.createdAt ?? s.date_created ?? s.date_added ?? s.created_at;
      let d = null;
      if (rawDate && typeof rawDate.toDate === 'function') d = rawDate.toDate();
      else if (rawDate && typeof rawDate === 'object' && ('seconds' in rawDate || '_seconds' in rawDate)) {
        d = new Date(Number(rawDate.seconds ?? rawDate._seconds) * 1000);
      } else if (rawDate != null) d = new Date(rawDate);
      return d && !isNaN(d.getTime()) &&
        (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
    });
  }

  async setSales(sales) {
    if (this.isFirebaseAvailable) {
      return true;
    }
    throw new Error('يلزم الاتصال بقاعدة البيانات لتعديل المبيعات');
  }

  async updateSale(saleId, updatedSale) {
    if (this.isFirebaseAvailable) {
      try {
        await this.firebaseDB.updateSale(saleId, updatedSale);
        return true;
      } catch (error) {
        console.error('Error updating sale in Firebase:', error);
        return false;
      }
    }

    throw new Error('يلزم الاتصال بقاعدة البيانات لتعديل فاتورة');
  }

  /**
   * Phone Types management
   */
  async getPhoneTypes() {
    if (this.isFirebaseAvailable) {
      try {
        const phoneTypes = await this.firebaseDB.getPhoneTypes();
        
        // Convert array to object format for compatibility with existing code
        const phoneTypesObj = {};
        phoneTypes.forEach(type => {
          const manufacturer = type.manufacturer || type.brand; // Support both field names
          if (!phoneTypesObj[manufacturer]) {
            phoneTypesObj[manufacturer] = [];
          }
          phoneTypesObj[manufacturer].push(type.model);
        });
        return phoneTypesObj;
      } catch (error) {
        console.error('❌ Storage Manager: خطأ في تحميل أنواع الهواتف من Firebase:', error);
        throw error;
      }
    }
    return this.getItem(CONFIG.STORAGE_KEYS.PHONE_TYPES);
  }

  async setPhoneTypes(phoneTypes) {
    if (this.isFirebaseAvailable) {
      return true;
    }
    throw new Error('يلزم الاتصال بقاعدة البيانات لتعديل أنواع الهواتف');
  }

  async addPhoneType(brand, model) {
    if (this.isFirebaseAvailable) {
      try {
        await this.firebaseDB.addPhoneType({ brand, model });
        return true;
      } catch (error) {
        console.error('Error adding phone type to Firebase:', error);
        return false;
      }
    }
    
    throw new Error('يلزم الاتصال بقاعدة البيانات لإضافة نوع هاتف');
  }

  async deletePhoneType(brand, model) {
    if (this.isFirebaseAvailable) {
      try {
        await this.firebaseDB.deletePhoneType(brand, model);
        return true;
      } catch (error) {
        console.error('Error deleting phone type from Firebase:', error);
        return false;
      }
    }
    
    throw new Error('يلزم الاتصال بقاعدة البيانات لحذف نوع هاتف');
  }

  /**
   * Accessory Categories management
   */
  async getAccessoryCategories() {
    if (this.isFirebaseAvailable) {
      try {
        return await this.firebaseDB.getAccessoryCategories();
      } catch (error) {
        console.error('Error getting accessory categories from Firebase:', error);
        throw error;
      }
    }
    return this.getItem(CONFIG.STORAGE_KEYS.ACCESSORY_CATEGORIES);
  }

  async setAccessoryCategories(categories) {
    if (this.isFirebaseAvailable) {
      return true;
    }
    throw new Error('يلزم الاتصال بقاعدة البيانات لتعديل فئات الأكسسوارات');
  }

  async addAccessoryCategory(category) {
    if (this.isFirebaseAvailable) {
      try {
        await this.firebaseDB.addAccessoryCategory(category);
        return true;
      } catch (error) {
        console.error('Error adding accessory category to Firebase:', error);
        return false;
      }
    }
    
    throw new Error('يلزم الاتصال بقاعدة البيانات لإضافة فئة أكسسوار');
  }

  async deleteAccessoryCategory(categoryName) {
    if (this.isFirebaseAvailable) {
      try {
        await this.firebaseDB.deleteAccessoryCategory(categoryName);
        return true;
      } catch (error) {
        console.error('Error deleting accessory category from Firebase:', error);
        return false;
      }
    }
    
    throw new Error('يلزم الاتصال بقاعدة البيانات لحذف فئة أكسسوار');
  }

  /**
   * Utility methods
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

// إنشاء instance واحد للاستخدام في جميع أنحاء التطبيق
const storage = new FirebaseStorageManager();

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.storage = storage;
}
