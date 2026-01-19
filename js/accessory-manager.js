/**
 * Accessory Management Module
 * الصقري للاتصالات - Phone Store Management System
 */

class AccessoryManager {
    constructor() {
        this.storage = storage;
    }

    /**
     * Add new accessory
     * @param {Object} accessoryData - Accessory data
     * @returns {Promise<Object>} Result object
     */
    async addAccessory(accessoryData) {
        try {
            // Validate required fields
            const validation = this.validateAccessoryData(accessoryData);
            if (!validation.valid) {
                return { success: false, error: validation.error };
            }

            // Calculate VAT prices
            const purchasePriceWithVAT = VATUtils.calculatePriceWithVAT(accessoryData.purchase_price);
            const sellingPriceWithVAT = VATUtils.calculatePriceWithVAT(accessoryData.selling_price);

            // Create accessory object
            const accessory = {
                name: accessoryData.name.trim(),
                category: accessoryData.category,
                description: accessoryData.description ? accessoryData.description.trim() : '',
                purchase_price: parseFloat(accessoryData.purchase_price),
                selling_price: parseFloat(accessoryData.selling_price),
                purchase_price_with_vat: purchasePriceWithVAT,
                selling_price_with_vat: sellingPriceWithVAT,
                quantity_in_stock: parseInt(accessoryData.quantity) || 0,
                min_quantity: parseInt(accessoryData.min_quantity) || 5,
                supplier: accessoryData.supplier ? accessoryData.supplier.trim() : '',
                notes: accessoryData.notes ? accessoryData.notes.trim() : ''
            };

            // Save accessory to storage
            const saved = this.storage.addAccessory(accessory);
            if (!saved) {
                return { success: false, error: 'فشل في حفظ الأكسسوار' };
            }

            return { 
                success: true, 
                accessory: accessory,
                message: 'تمت إضافة الأكسسوار بنجاح'
            };

        } catch (error) {
            console.error('Error adding accessory:', error);
            return { success: false, error: 'حدث خطأ غير متوقع' };
        }
    }

    /**
     * Update existing accessory
     * @param {string} accessoryId - Accessory ID
     * @param {Object} accessoryData - Updated accessory data
     * @returns {Promise<Object>} Result object
     */
    async updateAccessory(accessoryId, accessoryData) {
        try {
            const existingAccessory = this.storage.getAccessories().find(a => a.id === accessoryId);
            if (!existingAccessory) {
                return { success: false, error: 'الأكسسوار غير موجود' };
            }

            // Validate data
            const validation = this.validateAccessoryData(accessoryData);
            if (!validation.valid) {
                return { success: false, error: validation.error };
            }

            // Calculate VAT prices
            const purchasePriceWithVAT = VATUtils.calculatePriceWithVAT(accessoryData.purchase_price);
            const sellingPriceWithVAT = VATUtils.calculatePriceWithVAT(accessoryData.selling_price);

            // Update accessory data
            const updatedData = {
                name: accessoryData.name.trim(),
                category: accessoryData.category,
                description: accessoryData.description ? accessoryData.description.trim() : '',
                purchase_price: parseFloat(accessoryData.purchase_price),
                selling_price: parseFloat(accessoryData.selling_price),
                purchase_price_with_vat: purchasePriceWithVAT,
                selling_price_with_vat: sellingPriceWithVAT,
                quantity_in_stock: parseInt(accessoryData.quantity) || 0,
                min_quantity: parseInt(accessoryData.min_quantity) || 5,
                supplier: accessoryData.supplier ? accessoryData.supplier.trim() : '',
                notes: accessoryData.notes ? accessoryData.notes.trim() : ''
            };

            const updated = this.storage.updateAccessory(accessoryId, updatedData);
            if (!updated) {
                return { success: false, error: 'فشل في تحديث الأكسسوار' };
            }

            return { success: true, message: 'تم تحديث الأكسسوار بنجاح' };

        } catch (error) {
            console.error('Error updating accessory:', error);
            return { success: false, error: 'حدث خطأ غير متوقع' };
        }
    }

    /**
     * Delete accessory
     * @param {string} accessoryId - Accessory ID
     * @returns {Promise<Object>} Result object
     */
    async deleteAccessory(accessoryId) {
        try {
            const deleted = this.storage.deleteAccessory(accessoryId);
            if (!deleted) {
                return { success: false, error: 'فشل في حذف الأكسسوار' };
            }

            return { success: true, message: 'تم حذف الأكسسوار بنجاح' };

        } catch (error) {
            console.error('Error deleting accessory:', error);
            return { success: false, error: 'حدث خطأ غير متوقع' };
        }
    }

    /**
     * Get all accessories
     * @returns {Array} Array of accessories
     */
    getAllAccessories() {
        return this.storage.getAccessories();
    }

    /**
     * Get accessory by ID
     * @param {string} accessoryId - Accessory ID
     * @returns {Object|null} Accessory object or null
     */
    getAccessoryById(accessoryId) {
        const accessories = this.storage.getAccessories();
        return accessories.find(a => a.id === accessoryId) || null;
    }

    /**
     * Search accessories
     * @param {string} searchTerm - Search term
     * @returns {Array} Filtered accessories
     */
    searchAccessories(searchTerm) {
        const accessories = this.getAllAccessories();
        return SearchUtils.filterAccessories(accessories, searchTerm);
    }

    /**
     * Get accessories by category
     * @param {string} category - Category name
     * @returns {Array} Filtered accessories
     */
    getAccessoriesByCategory(category) {
        const accessories = this.getAllAccessories();
        return accessories.filter(a => a.category === category);
    }

    /**
     * Get low stock accessories
     * @returns {Array} Accessories with low stock
     */
    getLowStockAccessories() {
        const accessories = this.getAllAccessories();
        return accessories.filter(a => a.quantity_in_stock <= (a.min_quantity || 5));
    }

    /**
     * Update accessory stock
     * @param {string} accessoryId - Accessory ID
     * @param {number} quantityChange - Quantity change (positive for add, negative for subtract)
     * @returns {Object} Result object
     */
    updateStock(accessoryId, quantityChange) {
        try {
            const accessory = this.getAccessoryById(accessoryId);
            if (!accessory) {
                return { success: false, error: 'الأكسسوار غير موجود' };
            }

            const newQuantity = Math.max(0, accessory.quantity_in_stock + quantityChange);
            const updated = this.storage.updateAccessory(accessoryId, { 
                quantity_in_stock: newQuantity 
            });

            if (!updated) {
                return { success: false, error: 'فشل في تحديث المخزون' };
            }

            return { 
                success: true, 
                message: 'تم تحديث المخزون بنجاح',
                newQuantity: newQuantity
            };

        } catch (error) {
            console.error('Error updating stock:', error);
            return { success: false, error: 'حدث خطأ غير متوقع' };
        }
    }

    /**
     * Get accessory statistics
     * @returns {Object} Statistics object
     */
    getAccessoryStatistics() {
        const accessories = this.getAllAccessories();

        const stats = {
            total_accessories: accessories.length,
            total_quantity: accessories.reduce((sum, a) => sum + (a.quantity_in_stock || 0), 0),
            total_purchase_value: accessories.reduce((sum, a) => 
                sum + ((a.purchase_price || 0) * (a.quantity_in_stock || 0)), 0),
            total_selling_value: accessories.reduce((sum, a) => 
                sum + ((a.selling_price || 0) * (a.quantity_in_stock || 0)), 0),
            low_stock_count: this.getLowStockAccessories().length,
            categories: {}
        };

        // Calculate statistics by category
        accessories.forEach(accessory => {
            const category = accessory.category || 'غير محدد';
            if (!stats.categories[category]) {
                stats.categories[category] = {
                    count: 0,
                    total_quantity: 0,
                    total_value: 0
                };
            }

            stats.categories[category].count++;
            stats.categories[category].total_quantity += accessory.quantity_in_stock || 0;
            stats.categories[category].total_value += 
                (accessory.selling_price || 0) * (accessory.quantity_in_stock || 0);
        });

        stats.total_expected_profit = stats.total_selling_value - stats.total_purchase_value;

        return stats;
    }

    /**
     * Validate accessory data
     * @param {Object} accessoryData - Accessory data to validate
     * @returns {Object} Validation result
     */
    validateAccessoryData(accessoryData) {
        if (!accessoryData.name || !accessoryData.name.trim()) {
            return { valid: false, error: 'يرجى إدخال اسم الأكسسوار' };
        }

        if (!accessoryData.category || !accessoryData.category.trim()) {
            return { valid: false, error: 'يرجى اختيار الفئة' };
        }

        if (!accessoryData.purchase_price || isNaN(parseFloat(accessoryData.purchase_price))) {
            return { valid: false, error: 'يرجى إدخال سعر الشراء صحيح' };
        }

        if (!accessoryData.selling_price || isNaN(parseFloat(accessoryData.selling_price))) {
            return { valid: false, error: 'يرجى إدخال سعر البيع صحيح' };
        }

        if (parseFloat(accessoryData.purchase_price) < 0) {
            return { valid: false, error: 'سعر الشراء لا يمكن أن يكون سالباً' };
        }

        if (parseFloat(accessoryData.selling_price) < 0) {
            return { valid: false, error: 'سعر البيع لا يمكن أن يكون سالباً' };
        }

        if (accessoryData.quantity && (isNaN(parseInt(accessoryData.quantity)) || parseInt(accessoryData.quantity) < 0)) {
            return { valid: false, error: 'الكمية يجب أن تكون رقماً موجباً' };
        }

        return { valid: true };
    }

    /**
     * Category management
     */
    getAccessoryCategories() {
        return this.storage.getAccessoryCategories() || [];
    }

    addAccessoryCategory(arabicName, englishName = null, description = '') {
        if (!arabicName || !arabicName.trim()) {
            return { success: false, error: 'يرجى إدخال اسم الفئة' };
        }

        // Generate English name if not provided
        if (!englishName) {
            englishName = this.generateEnglishCategoryName(arabicName);
        }

        const category = {
            name: englishName.toLowerCase().trim(),
            arabic_name: arabicName.trim(),
            description: description.trim(),
            is_active: true
        };

        const success = this.storage.addAccessoryCategory(category);
        return success ? 
            { success: true, message: `تم إضافة فئة ${arabicName} بنجاح` } :
            { success: false, error: 'هذه الفئة موجودة بالفعل' };
    }

    deleteAccessoryCategory(arabicName) {
        if (!arabicName || !arabicName.trim()) {
            return { success: false, error: 'يرجى اختيار الفئة' };
        }

        // Check if any accessories are using this category
        const categories = this.getAccessoryCategories();
        const category = categories.find(c => c.arabic_name === arabicName);
        
        if (category) {
            const accessories = this.getAllAccessories();
            const accessoriesUsingCategory = accessories.filter(a => a.category === category.name);
            
            if (accessoriesUsingCategory.length > 0) {
                return { 
                    success: false, 
                    error: `لا يمكن حذف هذه الفئة لأنها مستخدمة في ${accessoriesUsingCategory.length} أكسسوار` 
                };
            }
        }

        const success = this.storage.deleteAccessoryCategory(arabicName);
        return success ? 
            { success: true, message: `تم حذف فئة ${arabicName} بنجاح` } :
            { success: false, error: 'فشل في حذف الفئة' };
    }

    /**
     * Generate English category name from Arabic
     * @param {string} arabicName - Arabic name
     * @returns {string} English name
     */
    generateEnglishCategoryName(arabicName) {
        // Simple transliteration map
        const transliterationMap = {
            'أ': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h',
            'خ': 'kh', 'د': 'd', 'ذ': 'th', 'ر': 'r', 'ز': 'z', 'س': 's',
            'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a',
            'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm',
            'ن': 'n', 'ه': 'h', 'و': 'w', 'ي': 'y', 'ة': 'h', 'ى': 'a',
            'ئ': 'a', ' ': '_'
        };

        let englishName = '';
        for (const char of arabicName.toLowerCase()) {
            englishName += transliterationMap[char] || char;
        }

        return englishName.replace(/[^a-z0-9_]/g, '').replace(/_+/g, '_');
    }

    /**
     * Get category display name map
     * @returns {Object} Category map
     */
    getCategoryMap() {
        const categories = this.getAccessoryCategories();
        const categoryMap = {};
        
        categories.forEach(category => {
            categoryMap[category.name] = category.arabic_name;
        });

        return categoryMap;
    }

    /**
     * Bulk operations
     */
    
    /**
     * Import accessories from CSV or JSON
     * @param {Array} accessoriesData - Array of accessory data
     * @returns {Object} Import result
     */
    async bulkImportAccessories(accessoriesData) {
        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        for (const [index, accessoryData] of accessoriesData.entries()) {
            try {
                const result = await this.addAccessory(accessoryData);
                if (result.success) {
                    results.success++;
                } else {
                    results.failed++;
                    results.errors.push(`الصف ${index + 1}: ${result.error}`);
                }
            } catch (error) {
                results.failed++;
                results.errors.push(`الصف ${index + 1}: خطأ غير متوقع`);
            }
        }

        return results;
    }

    /**
     * Export accessories to JSON
     * @returns {string} JSON string
     */
    exportAccessories() {
        const accessories = this.getAllAccessories();
        const exportData = {
            accessories: accessories,
            categories: this.getAccessoryCategories(),
            exportDate: new Date().toISOString(),
            version: '1.0'
        };

        return JSON.stringify(exportData, null, 2);
    }
}

// Create global instance
const accessoryManager = new AccessoryManager();

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.AccessoryManager = AccessoryManager;
    window.accessoryManager = accessoryManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AccessoryManager, accessoryManager };
}
