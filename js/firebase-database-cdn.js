// Firebase Database Manager for Phone Store Demo - CDN Version
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
  onSnapshot,
  serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

class FirebaseDatabase {
  constructor() {
    this.db = window.firebaseDB;
    this.auth = window.firebaseAuth;
  }

  // ===== إدارة الهواتف =====
  async addPhone(phoneData) {
    try {
      const docRef = await addDoc(collection(this.db, 'phones'), {
        ...phoneData,
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
      // حساب الأرباح
      const profit = this.calcProfit(jobData.partCost, jobData.amountCharged);
      const techCommission = this.calcTechCommission(profit, jobData.techPercent);
      const shopProfit = this.calcShopProfit(profit, techCommission);

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
      let query = collection(this.db, 'maintenanceJobs');
      
      // تطبيق الفلاتر
      if (filters.status) {
        query = query(query, where('status', '==', filters.status));
      }
      
      if (filters.repId) {
        query = query(query, where('repId', '==', filters.repId));
      }
      
      if (filters.techId) {
        query = query(query, where('techId', '==', filters.techId));
      }
      
      if (filters.dateFrom) {
        query = query(query, where('visitDate', '>=', filters.dateFrom));
      }
      
      if (filters.dateTo) {
        query = query(query, where('visitDate', '<=', filters.dateTo));
      }

      const querySnapshot = await getDocs(query);
      const jobs = [];
      querySnapshot.forEach(doc => {
        jobs.push({ id: doc.id, ...doc.data() });
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
      // إعادة حساب الأرباح إذا تغيرت القيم
      if (jobData.partCost !== undefined || jobData.amountCharged !== undefined || jobData.techPercent !== undefined) {
        const currentJob = await this.getMaintenanceJob(jobId);
        const partCost = jobData.partCost !== undefined ? jobData.partCost : currentJob.partCost;
        const amountCharged = jobData.amountCharged !== undefined ? jobData.amountCharged : currentJob.amountCharged;
        const techPercent = jobData.techPercent !== undefined ? jobData.techPercent : currentJob.techPercent;
        
        const profit = this.calcProfit(partCost, amountCharged);
        const techCommission = this.calcTechCommission(profit, techPercent);
        const shopProfit = this.calcShopProfit(profit, techCommission);
        
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

  // ===== التسويات =====
  async createSettlement(settlementData) {
    try {
      const docRef = await addDoc(collection(this.db, 'settlements'), {
        ...settlementData,
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      console.log('✅ Settlement created with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating settlement:', error);
      throw error;
    }
  }

  async getSettlements(filters = {}) {
    try {
      let query = collection(this.db, 'settlements');
      
      if (filters.type) {
        query = query(query, where('type', '==', filters.type));
      }
      
      if (filters.status) {
        query = query(query, where('status', '==', filters.status));
      }

      const querySnapshot = await getDocs(query);
      const settlements = [];
      querySnapshot.forEach(doc => {
        settlements.push({ id: doc.id, ...doc.data() });
      });
      
      console.log('✅ Settlements loaded:', settlements.length);
      return settlements;
    } catch (error) {
      console.error('❌ Error getting settlements:', error);
      throw error;
    }
  }

  async markSettlementPaid(settlementId, notes = '') {
    try {
      const settlementRef = doc(this.db, 'settlements', settlementId);
      await updateDoc(settlementRef, {
        status: 'paid',
        paidAt: serverTimestamp(),
        notes,
        updatedAt: serverTimestamp()
      });
      console.log('✅ Settlement marked as paid:', settlementId);
    } catch (error) {
      console.error('❌ Error marking settlement as paid:', error);
      throw error;
    }
  }

  // ===== دوال الحساب =====
  calcProfit(partCost, amountCharged) {
    return Math.max(0, Number((amountCharged - partCost).toFixed(2)));
  }

  calcTechCommission(profit, percent) {
    return Number((profit * percent).toFixed(2));
  }

  calcShopProfit(profit, techCommission) {
    return Number((profit - techCommission).toFixed(2));
  }

  // ===== تقارير التسويات =====
  async getRepSettlements(dateFrom, dateTo) {
    try {
      const jobs = await this.getMaintenanceJobs({
        status: 'done',
        dateFrom,
        dateTo
      });

      const repTotals = {};
      jobs.forEach(job => {
        if (!repTotals[job.repId]) {
          repTotals[job.repId] = {
            repId: job.repId,
            repName: job.repName,
            jobsCount: 0,
            partCostSum: 0,
            profitSum: 0,
            techCommissionSum: 0,
            shopProfitSum: 0
          };
        }
        
        repTotals[job.repId].jobsCount++;
        repTotals[job.repId].partCostSum += job.partCost;
        repTotals[job.repId].profitSum += job.profit;
        repTotals[job.repId].techCommissionSum += job.techCommission;
        repTotals[job.repId].shopProfitSum += job.shopProfit;
      });

      return Object.values(repTotals);
    } catch (error) {
      console.error('❌ Error getting rep settlements:', error);
      throw error;
    }
  }

  async getTechSettlements(dateFrom, dateTo) {
    try {
      const jobs = await this.getMaintenanceJobs({
        status: 'done',
        dateFrom,
        dateTo
      });

      const techTotals = {};
      jobs.forEach(job => {
        if (!techTotals[job.techId]) {
          techTotals[job.techId] = {
            techId: job.techId,
            techName: job.techName,
            jobsCount: 0,
            partCostSum: 0,
            profitSum: 0,
            techCommissionSum: 0,
            shopProfitSum: 0
          };
        }
        
        techTotals[job.techId].jobsCount++;
        techTotals[job.techId].partCostSum += job.partCost;
        techTotals[job.techId].profitSum += job.profit;
        techTotals[job.techId].techCommissionSum += job.techCommission;
        techTotals[job.techId].shopProfitSum += job.shopProfit;
      });

      return Object.values(techTotals);
    } catch (error) {
      console.error('❌ Error getting tech settlements:', error);
      throw error;
    }
  }

  // ===== تهيئة البيانات الافتراضية =====
  async initializeDefaultData() {
    try {
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

// تهيئة البيانات الافتراضية عند تحميل Firebase
window.firebaseDatabase.initializeDefaultData()
  .then(() => {
    console.log('🔥 Firebase Database Manager initialized successfully!');
  })
  .catch(error => {
    console.error('❌ Error initializing Firebase Database:', error);
  });
