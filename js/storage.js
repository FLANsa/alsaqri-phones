/**
 * Local Storage Management
 * الصقري للاتصالات - Phone Store Management System
 */

class StorageManager {
    constructor() {
        this.initializeDefaultData();
    }

    /**
     * Initialize default data if not exists
     */
    initializeDefaultData() {
        // Initialize phone types
        if (!this.getPhoneTypes()) {
            this.setPhoneTypes(DEFAULT_PHONE_TYPES);
        }

        // Initialize accessory categories
        if (!this.getAccessoryCategories()) {
            this.setAccessoryCategories(DEFAULT_ACCESSORY_CATEGORIES);
        }

        // Initialize empty arrays for other data
        if (!this.getPhones()) {
            this.setPhones([]);
        }

        if (!this.getAccessories()) {
            this.setAccessories([]);
        }

        if (!this.getSales()) {
            this.setSales([]);
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
    getPhones() {
        return this.getItem(CONFIG.STORAGE_KEYS.PHONES, []);
    }

    setPhones(phones) {
        return this.setItem(CONFIG.STORAGE_KEYS.PHONES, phones);
    }

    addPhone(phone) {
        const phones = this.getPhones();
        phone.id = this.generateId();
        phone.date_added = new Date().toISOString();
        phones.push(phone);
        return this.setPhones(phones);
    }

    updatePhone(phoneId, updatedPhone) {
        const phones = this.getPhones();
        const index = phones.findIndex(p => p.id === phoneId);
        if (index !== -1) {
            phones[index] = { ...phones[index], ...updatedPhone };
            return this.setPhones(phones);
        }
        return false;
    }

    deletePhone(phoneId) {
        const phones = this.getPhones();
        const filteredPhones = phones.filter(p => p.id !== phoneId);
        return this.setPhones(filteredPhones);
    }

    getPhoneByNumber(phoneNumber) {
        const phones = this.getPhones();
        return phones.find(p => p.phone_number === phoneNumber);
    }

    getPhoneBySerial(serialNumber) {
        const phones = this.getPhones();
        return phones.find(p => p.serial_number === serialNumber);
    }

    /**
     * Accessory management
     */
    getAccessories() {
        return this.getItem(CONFIG.STORAGE_KEYS.ACCESSORIES, []);
    }

    setAccessories(accessories) {
        return this.setItem(CONFIG.STORAGE_KEYS.ACCESSORIES, accessories);
    }

    addAccessory(accessory) {
        const accessories = this.getAccessories();
        accessory.id = this.generateId();
        accessory.date_added = new Date().toISOString();
        accessories.push(accessory);
        return this.setAccessories(accessories);
    }

    updateAccessory(accessoryId, updatedAccessory) {
        const accessories = this.getAccessories();
        const index = accessories.findIndex(a => a.id === accessoryId);
        if (index !== -1) {
            accessories[index] = { ...accessories[index], ...updatedAccessory };
            return this.setAccessories(accessories);
        }
        return false;
    }

    deleteAccessory(accessoryId) {
        const accessories = this.getAccessories();
        const filteredAccessories = accessories.filter(a => a.id !== accessoryId);
        return this.setAccessories(filteredAccessories);
    }

    /**
     * Sales management
     */
    getSales() {
        return this.getItem(CONFIG.STORAGE_KEYS.SALES, []);
    }

    setSales(sales) {
        return this.setItem(CONFIG.STORAGE_KEYS.SALES, sales);
    }

    addSale(sale) {
        const sales = this.getSales();
        sale.id = this.generateId();
        sale.date_created = new Date().toISOString();
        sales.push(sale);
        return this.setSales(sales);
    }

    updateSale(saleId, updatedSale) {
        const sales = this.getSales();
        const index = sales.findIndex(s => s.id === saleId);
        if (index !== -1) {
            sales[index] = { ...sales[index], ...updatedSale };
            return this.setSales(sales);
        }
        return false;
    }

    deleteSale(saleId) {
        const sales = this.getSales();
        const filteredSales = sales.filter(s => s.id !== saleId);
        return this.setSales(filteredSales);
    }

    getSaleById(saleId) {
        const sales = this.getSales();
        return sales.find(s => s.id === saleId);
    }

    /**
     * Phone Types management
     */
    getPhoneTypes() {
        return this.getItem(CONFIG.STORAGE_KEYS.PHONE_TYPES);
    }

    setPhoneTypes(phoneTypes) {
        return this.setItem(CONFIG.STORAGE_KEYS.PHONE_TYPES, phoneTypes);
    }

    addPhoneType(brand, model) {
        const phoneTypes = this.getPhoneTypes() || {};
        if (!phoneTypes[brand]) {
            phoneTypes[brand] = [];
        }
        if (!phoneTypes[brand].includes(model)) {
            phoneTypes[brand].push(model);
            return this.setPhoneTypes(phoneTypes);
        }
        return false;
    }

    deletePhoneType(brand, model) {
        const phoneTypes = this.getPhoneTypes() || {};
        if (phoneTypes[brand]) {
            phoneTypes[brand] = phoneTypes[brand].filter(m => m !== model);
            if (phoneTypes[brand].length === 0) {
                delete phoneTypes[brand];
            }
            return this.setPhoneTypes(phoneTypes);
        }
        return false;
    }

    /**
     * Accessory Categories management
     */
    getAccessoryCategories() {
        return this.getItem(CONFIG.STORAGE_KEYS.ACCESSORY_CATEGORIES);
    }

    setAccessoryCategories(categories) {
        return this.setItem(CONFIG.STORAGE_KEYS.ACCESSORY_CATEGORIES, categories);
    }

    addAccessoryCategory(category) {
        const categories = this.getAccessoryCategories() || [];
        const exists = categories.find(c => c.name === category.name || c.arabic_name === category.arabic_name);
        if (!exists) {
            categories.push(category);
            return this.setAccessoryCategories(categories);
        }
        return false;
    }

    deleteAccessoryCategory(categoryName) {
        const categories = this.getAccessoryCategories() || [];
        const filteredCategories = categories.filter(c => c.arabic_name !== categoryName);
        return this.setAccessoryCategories(filteredCategories);
    }

    /**
     * User management
     */
    getCurrentUser() {
        return this.getItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
    }

    setCurrentUser(user) {
        return this.setItem(CONFIG.STORAGE_KEYS.CURRENT_USER, user);
    }

    logout() {
        return this.removeItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
    }

    isLoggedIn() {
        return !!this.getCurrentUser();
    }

    /**
     * Settings management
     */
    getSettings() {
        return this.getItem(CONFIG.STORAGE_KEYS.SETTINGS, {});
    }

    setSettings(settings) {
        return this.setItem(CONFIG.STORAGE_KEYS.SETTINGS, settings);
    }

    getSetting(key, defaultValue = null) {
        const settings = this.getSettings();
        return settings[key] !== undefined ? settings[key] : defaultValue;
    }

    setSetting(key, value) {
        const settings = this.getSettings();
        settings[key] = value;
        return this.setSettings(settings);
    }

    /**
     * Utility methods
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Export/Import functionality
     */
    exportData() {
        const data = {
            phones: this.getPhones(),
            accessories: this.getAccessories(),
            sales: this.getSales(),
            phoneTypes: this.getPhoneTypes(),
            accessoryCategories: this.getAccessoryCategories(),
            settings: this.getSettings(),
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        return JSON.stringify(data, null, 2);
    }

    importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            
            if (data.phones) this.setPhones(data.phones);
            if (data.accessories) this.setAccessories(data.accessories);
            if (data.sales) this.setSales(data.sales);
            if (data.phoneTypes) this.setPhoneTypes(data.phoneTypes);
            if (data.accessoryCategories) this.setAccessoryCategories(data.accessoryCategories);
            if (data.settings) this.setSettings(data.settings);
            
            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            return false;
        }
    }

    /**
     * Clear all data (for testing/reset)
     */
    clearAllData() {
        Object.values(CONFIG.STORAGE_KEYS).forEach(key => {
            this.removeItem(key);
        });
        this.initializeDefaultData();
    }

    /**
     * Get storage statistics
     */
    getStorageStats() {
        return {
            phones: this.getPhones().length,
            accessories: this.getAccessories().length,
            sales: this.getSales().length,
            phoneTypes: Object.keys(this.getPhoneTypes() || {}).length,
            accessoryCategories: (this.getAccessoryCategories() || []).length
        };
    }
}

// Create global instance
const storage = new StorageManager();

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.storage = storage;
    window.StorageManager = StorageManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StorageManager, storage };
}
