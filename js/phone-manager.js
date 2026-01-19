/**
 * Phone Management Module
 * عبدالملك للاتصالات - Phone Store Management System
 */

class PhoneManager {
    constructor() {
        this.storage = storage;
        this.barcodeGenerator = barcodeGenerator;
    }

    /**
     * Add new phone
     * @param {Object} phoneData - Phone data
     * @returns {Promise<Object>} Result object
     */
    async addPhone(phoneData) {
        try {
            // Validate required fields
            const validation = this.validatePhoneData(phoneData);
            if (!validation.valid) {
                return { success: false, error: validation.error };
            }

            // Check for existing serial number
            if (this.storage.getPhoneBySerial(phoneData.serial_number)) {
                return { success: false, error: 'الرقم التسلسلي موجود بالفعل في النظام' };
            }

            // Generate or validate phone number
            let phoneNumber;
            if (phoneData.barcode_input) {
                phoneNumber = ValidationUtils.processBarcodeInput(phoneData.barcode_input);
                if (!phoneNumber) {
                    return { success: false, error: 'باركود غير صحيح' };
                }
                if (this.storage.getPhoneByNumber(phoneNumber)) {
                    return { success: false, error: `الهاتف برقم ${phoneNumber} موجود بالفعل في النظام` };
                }
            } else {
                try {
                    phoneNumber = IDUtils.generateUniquePhoneNumber(this.storage.getPhones());
                } catch (error) {
                    return { success: false, error: error.message };
                }
            }

            // Calculate VAT prices
            const purchasePriceWithVAT = VATUtils.calculatePriceWithVAT(phoneData.purchase_price);
            const sellingPriceWithVAT = VATUtils.calculatePriceWithVAT(phoneData.selling_price);

            // Create phone object
            const phone = {
                brand: phoneData.brand,
                model: phoneData.model,
                condition: phoneData.condition || 'new',
                purchase_price: parseFloat(phoneData.purchase_price),
                selling_price: parseFloat(phoneData.selling_price),
                purchase_price_with_vat: purchasePriceWithVAT,
                selling_price_with_vat: sellingPriceWithVAT,
                serial_number: phoneData.serial_number,
                phone_number: phoneNumber,
                description: phoneData.description || '',
                warranty: phoneData.warranty ? parseInt(phoneData.warranty) : null,
                phone_condition: phoneData.phone_condition || null,
                age: phoneData.age ? parseInt(phoneData.age) : null,
                battery_level: phoneData.battery_level || null,
                customer_name: phoneData.customer_name || '',
                customer_id: phoneData.customer_id || '',
                phone_color: phoneData.phone_color || '',
                phone_memory: phoneData.phone_memory || '',
                buyer_name: phoneData.buyer_name || ''
            };

            // Save phone to storage
            const saved = this.storage.addPhone(phone);
            if (!saved) {
                return { success: false, error: 'فشل في حفظ الهاتف' };
            }

            // Generate barcode
            this.generateBarcodeForPhone(phone);

            return { 
                success: true, 
                phone: phone,
                message: `تمت إضافة الهاتف ${phone.condition === 'new' ? 'الجديد' : 'المستعمل'} بنجاح`
            };

        } catch (error) {
            console.error('Error adding phone:', error);
            return { success: false, error: 'حدث خطأ غير متوقع' };
        }
    }

    /**
     * Update existing phone
     * @param {string} phoneId - Phone ID
     * @param {Object} phoneData - Updated phone data
     * @returns {Promise<Object>} Result object
     */
    async updatePhone(phoneId, phoneData) {
        try {
            const existingPhone = this.storage.getPhones().find(p => p.id === phoneId);
            if (!existingPhone) {
                return { success: false, error: 'الهاتف غير موجود' };
            }

            // Validate data
            const validation = this.validatePhoneData(phoneData);
            if (!validation.valid) {
                return { success: false, error: validation.error };
            }

            // Check serial number uniqueness (excluding current phone)
            const phoneWithSerial = this.storage.getPhoneBySerial(phoneData.serial_number);
            if (phoneWithSerial && phoneWithSerial.id !== phoneId) {
                return { success: false, error: 'الرقم التسلسلي موجود بالفعل في النظام' };
            }

            // Calculate VAT prices
            const purchasePriceWithVAT = VATUtils.calculatePriceWithVAT(phoneData.purchase_price);
            const sellingPriceWithVAT = VATUtils.calculatePriceWithVAT(phoneData.selling_price);

            // Update phone data
            const updatedData = {
                brand: phoneData.brand,
                model: phoneData.model,
                purchase_price: parseFloat(phoneData.purchase_price),
                selling_price: parseFloat(phoneData.selling_price),
                purchase_price_with_vat: purchasePriceWithVAT,
                selling_price_with_vat: sellingPriceWithVAT,
                serial_number: phoneData.serial_number,
                description: phoneData.description || '',
                warranty: phoneData.warranty ? parseInt(phoneData.warranty) : null,
                phone_condition: phoneData.phone_condition || null,
                age: phoneData.age ? parseInt(phoneData.age) : null,
                battery_level: phoneData.battery_level || (phoneData.age ? String(phoneData.age) : null),
                customer_name: phoneData.customer_name || '',
                customer_id: phoneData.customer_id || '',
                phone_color: phoneData.phone_color || '',
                phone_memory: phoneData.phone_memory || '',
                buyer_name: phoneData.buyer_name || ''
            };

            const updated = this.storage.updatePhone(phoneId, updatedData);
            if (!updated) {
                return { success: false, error: 'فشل في تحديث الهاتف' };
            }

            return { success: true, message: 'تم تحديث الهاتف بنجاح' };

        } catch (error) {
            console.error('Error updating phone:', error);
            return { success: false, error: 'حدث خطأ غير متوقع' };
        }
    }

    /**
     * Delete phone
     * @param {string} phoneId - Phone ID
     * @returns {Promise<Object>} Result object
     */
    async deletePhone(phoneId) {
        try {
            const deleted = this.storage.deletePhone(phoneId);
            if (!deleted) {
                return { success: false, error: 'فشل في حذف الهاتف' };
            }

            return { success: true, message: 'تم حذف الهاتف بنجاح' };

        } catch (error) {
            console.error('Error deleting phone:', error);
            return { success: false, error: 'حدث خطأ غير متوقع' };
        }
    }

    /**
     * Get all phones
     * @returns {Array} Array of phones
     */
    getAllPhones() {
        return this.storage.getPhones();
    }

    /**
     * Get phone by ID
     * @param {string} phoneId - Phone ID
     * @returns {Object|null} Phone object or null
     */
    getPhoneById(phoneId) {
        const phones = this.storage.getPhones();
        return phones.find(p => p.id === phoneId) || null;
    }

    /**
     * Search phones
     * @param {string} searchTerm - Search term
     * @param {string} condition - Phone condition filter
     * @returns {Array} Filtered phones
     */
    searchPhones(searchTerm, condition = '') {
        const phones = this.getAllPhones();
        return SearchUtils.filterPhones(phones, searchTerm, condition);
    }

    /**
     * Get phone statistics
     * @returns {Object} Statistics object
     */
    getPhoneStatistics() {
        const phones = this.getAllPhones();
        const newPhones = phones.filter(p => p.condition === 'new');
        const usedPhones = phones.filter(p => p.condition === 'used');

        return {
            total_phones: phones.length,
            new_phones: newPhones.length,
            used_phones: usedPhones.length,
            total_purchase_value: phones.reduce((sum, p) => sum + (p.purchase_price || 0), 0),
            total_selling_value: phones.reduce((sum, p) => sum + (p.selling_price || 0), 0),
            new_phones_purchase_value: newPhones.reduce((sum, p) => sum + (p.purchase_price || 0), 0),
            new_phones_selling_value: newPhones.reduce((sum, p) => sum + (p.selling_price || 0), 0),
            used_phones_purchase_value: usedPhones.reduce((sum, p) => sum + (p.purchase_price || 0), 0),
            used_phones_selling_value: usedPhones.reduce((sum, p) => sum + (p.selling_price || 0), 0)
        };
    }

    /**
     * Get inventory summary by brand and model
     * @returns {Object} Inventory summary
     */
    getInventorySummary() {
        const phones = this.getAllPhones();
        
        // Group by condition
        const phoneTypesSummary = {};
        const newPhonesBrandSummary = {};
        const usedPhonesBrandSummary = {};

        phones.forEach(phone => {
            const condition = phone.condition;
            const brandModel = `${phone.brand} ${phone.model}`;
            
            // Phone types summary
            if (!phoneTypesSummary[condition]) {
                phoneTypesSummary[condition] = {
                    total_phones: 0,
                    total_purchase_value: 0,
                    total_selling_value: 0
                };
            }
            
            phoneTypesSummary[condition].total_phones++;
            phoneTypesSummary[condition].total_purchase_value += phone.purchase_price || 0;
            phoneTypesSummary[condition].total_selling_value += phone.selling_price || 0;

            // Brand summary
            const targetSummary = condition === 'new' ? newPhonesBrandSummary : usedPhonesBrandSummary;
            
            if (!targetSummary[brandModel]) {
                targetSummary[brandModel] = {
                    brand: phone.brand,
                    model: phone.model,
                    total_phones: 0,
                    total_purchase_value: 0,
                    total_selling_value: 0
                };
            }
            
            targetSummary[brandModel].total_phones++;
            targetSummary[brandModel].total_purchase_value += phone.purchase_price || 0;
            targetSummary[brandModel].total_selling_value += phone.selling_price || 0;
        });

        // Calculate averages
        Object.values(phoneTypesSummary).forEach(summary => {
            summary.average_price = summary.total_phones > 0 ? 
                summary.total_selling_value / summary.total_phones : 0;
        });

        [newPhonesBrandSummary, usedPhonesBrandSummary].forEach(summary => {
            Object.values(summary).forEach(brandSummary => {
                brandSummary.average_price = brandSummary.total_phones > 0 ? 
                    brandSummary.total_selling_value / brandSummary.total_phones : 0;
            });
        });

        return {
            phone_type_summary: Object.entries(phoneTypesSummary).map(([condition, data]) => ({
                condition,
                ...data
            })),
            new_phones_brand_summary: Object.values(newPhonesBrandSummary),
            used_phones_brand_summary: Object.values(usedPhonesBrandSummary)
        };
    }

    /**
     * Validate phone data
     * @param {Object} phoneData - Phone data to validate
     * @returns {Object} Validation result
     */
    validatePhoneData(phoneData) {
        if (!phoneData.brand || !phoneData.brand.trim()) {
            return { valid: false, error: 'يرجى إدخال الشركة المصنعة' };
        }

        if (!phoneData.model || !phoneData.model.trim()) {
            return { valid: false, error: 'يرجى إدخال الموديل' };
        }

        if (!phoneData.serial_number || !phoneData.serial_number.trim()) {
            return { valid: false, error: 'يرجى إدخال الرقم التسلسلي' };
        }

        if (!phoneData.purchase_price || isNaN(parseFloat(phoneData.purchase_price))) {
            return { valid: false, error: 'يرجى إدخال سعر الشراء صحيح' };
        }

        if (!phoneData.selling_price || isNaN(parseFloat(phoneData.selling_price))) {
            return { valid: false, error: 'يرجى إدخال سعر البيع صحيح' };
        }

        if (parseFloat(phoneData.purchase_price) < 0) {
            return { valid: false, error: 'سعر الشراء لا يمكن أن يكون سالباً' };
        }

        if (parseFloat(phoneData.selling_price) < 0) {
            return { valid: false, error: 'سعر البيع لا يمكن أن يكون سالباً' };
        }

        return { valid: true };
    }

    /**
     * Generate barcode for phone
     * @param {Object} phone - Phone object
     */
    generateBarcodeForPhone(phone) {
        try {
            if (phone.condition === 'used' && phone.age) {
                // Generate barcode with battery age encoding
                this.barcodeGenerator.generateUsedPhoneBarcode(phone.phone_number, phone.age);
            } else {
                // Generate standard barcode
                this.barcodeGenerator.generateSVGBarcode(phone.phone_number);
            }
        } catch (error) {
            console.error('Error generating barcode:', error);
        }
    }

    /**
     * Process scanned barcode
     * @param {string} scannedCode - Scanned barcode
     * @returns {Object} Processing result
     */
    processScannedBarcode(scannedCode) {
        return this.barcodeGenerator.processScannedBarcode(scannedCode);
    }

    /**
     * Phone type management
     */
    getPhoneTypes() {
        return this.storage.getPhoneTypes() || {};
    }

    addPhoneType(brand, model) {
        if (!brand || !model) {
            return { success: false, error: 'يرجى إدخال العلامة التجارية والموديل' };
        }

        const phoneTypes = this.getPhoneTypes();
        if (phoneTypes[brand] && phoneTypes[brand].includes(model)) {
            return { success: false, error: 'هذا الموديل موجود بالفعل' };
        }

        const success = this.storage.addPhoneType(brand, model);
        return success ? 
            { success: true, message: `تم إضافة ${brand} ${model} بنجاح` } :
            { success: false, error: 'فشل في إضافة الموديل' };
    }

    deletePhoneType(brand, model) {
        if (!brand || !model) {
            return { success: false, error: 'يرجى اختيار العلامة التجارية والموديل' };
        }

        // Check if any phones are using this type
        const phones = this.getAllPhones();
        const phonesUsingType = phones.filter(p => p.brand === brand && p.model === model);
        
        if (phonesUsingType.length > 0) {
            return { 
                success: false, 
                error: `لا يمكن حذف هذا الموديل لأنه مستخدم في ${phonesUsingType.length} هاتف` 
            };
        }

        const success = this.storage.deletePhoneType(brand, model);
        return success ? 
            { success: true, message: `تم حذف ${brand} ${model} بنجاح` } :
            { success: false, error: 'فشل في حذف الموديل' };
    }
}

// Create global instance
const phoneManager = new PhoneManager();

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.PhoneManager = PhoneManager;
    window.phoneManager = phoneManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PhoneManager, phoneManager };
}
