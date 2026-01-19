/**
 * Sales Management Module
 * عبدالملك للاتصالات - Phone Store Management System
 */

class SalesManager {
    constructor() {
        this.storage = storage;
        this.phoneManager = phoneManager;
        this.accessoryManager = accessoryManager;
    }

    /**
     * Create new sale
     * @param {Object} saleData - Sale data
     * @returns {Promise<Object>} Result object
     */
    async createSale(saleData) {
        try {
            // Validate sale data
            const validation = this.validateSaleData(saleData);
            if (!validation.valid) {
                return { success: false, error: validation.error };
            }

            // Calculate totals
            let subtotal = 0;
            const processedItems = [];

            for (const item of saleData.items) {
                const itemTotal = item.unitPrice * item.quantity;
                subtotal += itemTotal;

                processedItems.push({
                    product_type: item.type,
                    product_name: item.name,
                    product_description: item.description || '',
                    serial_number: item.serial_number || '',
                    barcode: item.barcode || '',
                    unit_price: item.unitPrice,
                    quantity: item.quantity,
                    total_price: itemTotal,
                    battery_level: item.battery_level || null,
                    condition: item.condition || null,
                    phone_type: item.phone_type || null,
                    notes: item.notes || ''
                });

                // Update inventory
                await this.updateInventoryForSale(item);
            }

            const vatAmount = subtotal * CONFIG.VAT_RATE;
            const totalAmount = subtotal + vatAmount;

            // Create sale object
            const sale = {
                sale_number: IDUtils.generateSaleNumber(),
                company_name: CONFIG.COMPANY_INFO.name,
                company_vat_number: CONFIG.COMPANY_INFO.vatNumber,
                company_address: CONFIG.COMPANY_INFO.address,
                company_phone: CONFIG.COMPANY_INFO.phone,
                customer_name: saleData.customer_name || 'عميل نقدي',
                customer_phone: saleData.customer_phone || '',
                customer_email: saleData.customer_email || '',
                customer_address: saleData.customer_address || '',
                subtotal: subtotal,
                vat_amount: vatAmount,
                total_amount: totalAmount,
                payment_method: saleData.payment_method || 'نقدي',
                notes: saleData.notes || '',
                status: 'مكتمل',
                items: processedItems
            };

            // Save sale to storage
            const saved = this.storage.addSale(sale);
            if (!saved) {
                return { success: false, error: 'فشل في حفظ عملية البيع' };
            }

            return { 
                success: true, 
                sale: sale,
                message: 'تمت عملية البيع بنجاح'
            };

        } catch (error) {
            console.error('Error creating sale:', error);
            return { success: false, error: 'حدث خطأ غير متوقع' };
        }
    }

    /**
     * Update inventory after sale
     * @param {Object} item - Sale item
     * @returns {Promise<void>}
     */
    async updateInventoryForSale(item) {
        if (item.type === 'phone') {
            // Remove phone from inventory
            const phones = this.phoneManager.getAllPhones();
            const phone = phones.find(p => p.id === item.id);
            if (phone) {
                await this.phoneManager.deletePhone(phone.id);
            }
        } else if (['accessory', 'charger', 'case', 'screen_protector'].includes(item.type)) {
            // Update accessory stock
            const accessory = this.accessoryManager.getAccessoryById(item.id);
            if (accessory) {
                await this.accessoryManager.updateStock(item.id, -item.quantity);
            }
        }
    }

    /**
     * Update existing sale
     * @param {string} saleId - Sale ID
     * @param {Object} saleData - Updated sale data
     * @returns {Promise<Object>} Result object
     */
    async updateSale(saleId, saleData) {
        try {
            const existingSale = this.storage.getSaleById(saleId);
            if (!existingSale) {
                return { success: false, error: 'عملية البيع غير موجودة' };
            }

            // For now, only allow updating customer info and status
            const allowedUpdates = {
                customer_name: saleData.customer_name,
                customer_phone: saleData.customer_phone,
                customer_email: saleData.customer_email,
                customer_address: saleData.customer_address,
                payment_method: saleData.payment_method,
                notes: saleData.notes,
                status: saleData.status
            };

            const updated = this.storage.updateSale(saleId, allowedUpdates);
            if (!updated) {
                return { success: false, error: 'فشل في تحديث عملية البيع' };
            }

            return { success: true, message: 'تم تحديث عملية البيع بنجاح' };

        } catch (error) {
            console.error('Error updating sale:', error);
            return { success: false, error: 'حدث خطأ غير متوقع' };
        }
    }

    /**
     * Cancel sale
     * @param {string} saleId - Sale ID
     * @returns {Promise<Object>} Result object
     */
    async cancelSale(saleId) {
        try {
            const sale = this.storage.getSaleById(saleId);
            if (!sale) {
                return { success: false, error: 'عملية البيع غير موجودة' };
            }

            if (sale.status === 'ملغي') {
                return { success: false, error: 'عملية البيع ملغية بالفعل' };
            }

            // Update status to cancelled
            const updated = this.storage.updateSale(saleId, { status: 'ملغي' });
            if (!updated) {
                return { success: false, error: 'فشل في إلغاء عملية البيع' };
            }

            // TODO: Restore inventory if needed

            return { success: true, message: 'تم إلغاء عملية البيع بنجاح' };

        } catch (error) {
            console.error('Error cancelling sale:', error);
            return { success: false, error: 'حدث خطأ غير متوقع' };
        }
    }

    /**
     * Delete sale
     * @param {string} saleId - Sale ID
     * @returns {Promise<Object>} Result object
     */
    async deleteSale(saleId) {
        try {
            const deleted = this.storage.deleteSale(saleId);
            if (!deleted) {
                return { success: false, error: 'فشل في حذف عملية البيع' };
            }

            return { success: true, message: 'تم حذف عملية البيع بنجاح' };

        } catch (error) {
            console.error('Error deleting sale:', error);
            return { success: false, error: 'حدث خطأ غير متوقع' };
        }
    }

    /**
     * Get all sales
     * @returns {Array} Array of sales
     */
    getAllSales() {
        return this.storage.getSales().sort((a, b) => 
            new Date(b.date_created) - new Date(a.date_created)
        );
    }

    /**
     * Get sale by ID
     * @param {string} saleId - Sale ID
     * @returns {Object|null} Sale object or null
     */
    getSaleById(saleId) {
        return this.storage.getSaleById(saleId);
    }

    /**
     * Filter sales by criteria
     * @param {Object} filters - Filter criteria
     * @returns {Array} Filtered sales
     */
    filterSales(filters = {}) {
        const sales = this.getAllSales();
        
        if (!filters.filter_type || filters.filter_type === 'all') {
            return sales;
        }

        return sales.filter(sale => {
            const saleDate = new Date(sale.date_created);
            
            if (filters.filter_type === 'day' && filters.filter_date) {
                const filterDate = new Date(filters.filter_date);
                return DateUtils.isSameDay(sale.date_created, 
                    filterDate.getFullYear(), 
                    filterDate.getMonth() + 1, 
                    filterDate.getDate()
                );
            }
            
            if (filters.filter_type === 'month' && filters.filter_month_year && filters.filter_month_month) {
                return DateUtils.isSameMonth(sale.date_created, 
                    parseInt(filters.filter_month_year), 
                    parseInt(filters.filter_month_month)
                );
            }
            
            if (filters.filter_type === 'year' && filters.filter_year) {
                return DateUtils.isSameYear(sale.date_created, 
                    parseInt(filters.filter_year)
                );
            }
            
            return true;
        });
    }

    /**
     * Get sales statistics
     * @param {Array} sales - Sales array (optional, uses all sales if not provided)
     * @returns {Object} Statistics object
     */
    getSalesStatistics(sales = null) {
        if (!sales) {
            sales = this.getAllSales();
        }

        const stats = {
            total_sales_count: sales.length,
            total_sales_amount: 0,
            total_sales_subtotal: 0,
            total_vat_amount: 0,
            total_actual_profit: 0,
            completed_sales: 0,
            cancelled_sales: 0,
            pending_sales: 0,
            payment_methods: {},
            daily_sales: {},
            monthly_sales: {},
            top_products: {}
        };

        sales.forEach(sale => {
            // Basic totals
            stats.total_sales_amount += sale.total_amount || 0;
            stats.total_sales_subtotal += sale.subtotal || 0;
            stats.total_vat_amount += sale.vat_amount || 0;

            // Status counts
            if (sale.status === 'مكتمل') {
                stats.completed_sales++;
            } else if (sale.status === 'ملغي') {
                stats.cancelled_sales++;
            } else {
                stats.pending_sales++;
            }

            // Payment methods
            const paymentMethod = sale.payment_method || 'غير محدد';
            stats.payment_methods[paymentMethod] = (stats.payment_methods[paymentMethod] || 0) + 1;

            // Daily sales
            const saleDate = FormatUtils.formatDate(sale.date_created);
            if (!stats.daily_sales[saleDate]) {
                stats.daily_sales[saleDate] = {
                    count: 0,
                    total: 0
                };
            }
            stats.daily_sales[saleDate].count++;
            stats.daily_sales[saleDate].total += sale.total_amount || 0;

            // Monthly sales
            const saleMonth = new Date(sale.date_created);
            const monthKey = `${saleMonth.getFullYear()}-${String(saleMonth.getMonth() + 1).padStart(2, '0')}`;
            if (!stats.monthly_sales[monthKey]) {
                stats.monthly_sales[monthKey] = {
                    count: 0,
                    total: 0
                };
            }
            stats.monthly_sales[monthKey].count++;
            stats.monthly_sales[monthKey].total += sale.total_amount || 0;

            // Top products
            if (sale.items) {
                sale.items.forEach(item => {
                    const productKey = `${item.product_name} (${item.product_type})`;
                    if (!stats.top_products[productKey]) {
                        stats.top_products[productKey] = {
                            name: item.product_name,
                            type: item.product_type,
                            quantity: 0,
                            total_value: 0
                        };
                    }
                    stats.top_products[productKey].quantity += item.quantity || 0;
                    stats.top_products[productKey].total_value += item.total_price || 0;
                });
            }
        });

        // Calculate profit ratio
        stats.profit_ratio = stats.total_sales_subtotal > 0 ? 
            ((stats.total_actual_profit / stats.total_sales_subtotal) * 100) : 0;

        return stats;
    }

    /**
     * Get available products for sale
     * @returns {Object} Available products
     */
    getAvailableProducts() {
        const phones = this.phoneManager.getAllPhones().map(phone => ({
            id: phone.id,
            type: 'phone',
            name: `${phone.brand} ${phone.model}`,
            description: phone.description || '',
            serial_number: phone.serial_number,
            selling_price: phone.selling_price,
            quantity: 1,
            available: true
        }));

        const accessories = this.accessoryManager.getAllAccessories()
            .filter(accessory => accessory.quantity_in_stock > 0)
            .map(accessory => ({
                id: accessory.id,
                type: accessory.category,
                name: accessory.name,
                description: accessory.description || '',
                selling_price: accessory.selling_price,
                quantity_available: accessory.quantity_in_stock,
                available: true
            }));

        return {
            phones: phones,
            accessories: accessories
        };
    }

    /**
     * Validate sale data
     * @param {Object} saleData - Sale data to validate
     * @returns {Object} Validation result
     */
    validateSaleData(saleData) {
        if (!saleData.items || !Array.isArray(saleData.items) || saleData.items.length === 0) {
            return { valid: false, error: 'يجب إضافة منتج واحد على الأقل' };
        }

        // Validate each item
        for (const item of saleData.items) {
            if (!item.name || !item.name.trim()) {
                return { valid: false, error: 'اسم المنتج مطلوب' };
            }

            if (!item.unitPrice || isNaN(parseFloat(item.unitPrice)) || parseFloat(item.unitPrice) <= 0) {
                return { valid: false, error: 'سعر المنتج يجب أن يكون أكبر من صفر' };
            }

            if (!item.quantity || isNaN(parseInt(item.quantity)) || parseInt(item.quantity) <= 0) {
                return { valid: false, error: 'كمية المنتج يجب أن تكون أكبر من صفر' };
            }

            // Check inventory availability
            if (item.type === 'phone') {
                const phone = this.phoneManager.getPhoneById(item.id);
                if (!phone) {
                    return { valid: false, error: `الهاتف ${item.name} غير متوفر` };
                }
            } else if (['accessory', 'charger', 'case', 'screen_protector'].includes(item.type)) {
                const accessory = this.accessoryManager.getAccessoryById(item.id);
                if (!accessory || accessory.quantity_in_stock < item.quantity) {
                    return { valid: false, error: `الكمية المطلوبة من ${item.name} غير متوفرة` };
                }
            }
        }

        // Validate customer info if provided
        if (saleData.customer_email && !ValidationUtils.isValidEmail(saleData.customer_email)) {
            return { valid: false, error: 'البريد الإلكتروني غير صحيح' };
        }

        if (saleData.customer_phone && !ValidationUtils.isValidPhone(saleData.customer_phone)) {
            return { valid: false, error: 'رقم الهاتف غير صحيح' };
        }

        return { valid: true };
    }

    /**
     * Generate receipt HTML
     * @param {Object} sale - Sale object
     * @returns {string} Receipt HTML
     */
    generateReceiptHTML(sale) {
        const itemsHTML = sale.items.map(item => `
            <tr>
                <td>${item.product_name}</td>
                <td>${FormatUtils.formatMoney(item.unit_price)}</td>
                <td>${item.quantity}</td>
                <td>${FormatUtils.formatMoney(item.total_price)}</td>
            </tr>
        `).join('');

        const showCustomer = (sale.customer_name && sale.customer_name !== 'عميل نقدي') || 
                           sale.customer_phone || sale.customer_address;

        const customerHTML = showCustomer ? `
            <div class="customer-info">
                <h3>معلومات العميل</h3>
                ${sale.customer_name && sale.customer_name !== 'عميل نقدي' ? 
                    `<p>الاسم: ${sale.customer_name}</p>` : ''}
                ${sale.customer_phone ? `<p>الهاتف: ${sale.customer_phone}</p>` : ''}
                ${sale.customer_address ? `<p>العنوان: ${sale.customer_address}</p>` : ''}
            </div>
        ` : '';

        return `
            <div class="receipt-template">
                <div class="receipt-header">
                    <div class="company-info">
                        <h1>${sale.company_name}</h1>
                        <p>${sale.company_address}</p>
                        <p>هاتف: ${sale.company_phone}</p>
                    </div>
                    
                    <div class="sale-info">
                        <h2>فاتورة مبيعات</h2>
                        <p>رقم العملية: ${sale.sale_number}</p>
                        <p>التاريخ: ${FormatUtils.formatDateTime(sale.date_created)}</p>
                        <p>طريقة الدفع: ${sale.payment_method}</p>
                    </div>
                    
                    ${customerHTML}
                </div>

                <div class="receipt-items">
                    <h3>المنتجات المباعة</h3>
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th>المنتج</th>
                                <th>السعر</th>
                                <th>الكمية</th>
                                <th>المجموع</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHTML}
                        </tbody>
                    </table>
                </div>

                <div class="receipt-summary">
                    <div class="summary-row">
                        <span>المجموع قبل الضريبة:</span>
                        <span>${FormatUtils.formatMoney(sale.subtotal)} ريال</span>
                    </div>
                    <div class="summary-row">
                        <span>الضريبة (15%):</span>
                        <span>${FormatUtils.formatMoney(sale.vat_amount)} ريال</span>
                    </div>
                    <div class="summary-row total">
                        <span>المبلغ الإجمالي:</span>
                        <span>${FormatUtils.formatMoney(sale.total_amount)} ريال</span>
                    </div>
                </div>

                <div class="receipt-footer">
                    <p>شكراً لزيارتكم</p>
                    <p>نتمنى لكم تجربة تسوق ممتعة</p>
                    <p>تاريخ الطباعة: ${new Date().toLocaleString('ar-SA')}</p>
                </div>
            </div>
        `;
    }

    /**
     * Print receipt
     * @param {Object} sale - Sale object
     */
    printReceipt(sale) {
        const receiptHTML = this.generateReceiptHTML(sale);
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>فاتورة - ${sale.sale_number}</title>
                <style>
                    body { font-family: 'Cairo', Arial, sans-serif; font-size: 12px; line-height: 1.2; color: #000; background: #fff; margin: 0; padding: 5mm; }
                    .receipt-template { width: 58mm; max-width: 58mm; margin: 0 auto; }
                    .receipt-header { text-align: center; margin-bottom: 20px; border-bottom: 1px dashed #000; padding-bottom: 15px; }
                    .company-info h1 { font-size: 18px; margin: 0 0 10px; font-weight: bold; }
                    .company-info p, .sale-info p, .customer-info p { margin: 3px 0; font-size: 11px; }
                    .sale-info h2 { font-size: 16px; margin: 15px 0 10px; font-weight: bold; }
                    .customer-info h3, .receipt-items h3 { font-size: 14px; margin: 15px 0 8px; font-weight: bold; text-align: center; }
                    .items-table { width: 100%; border-collapse: collapse; font-size: 10px; }
                    .items-table th { border-bottom: 1px solid #000; padding: 5px 2px; text-align: center; font-weight: bold; }
                    .items-table td { padding: 3px 2px; text-align: center; border-bottom: 1px dotted #ccc; }
                    .receipt-summary { margin: 20px 0; border-top: 1px dashed #000; padding-top: 15px; }
                    .summary-row { display: flex; justify-content: space-between; margin: 8px 0; font-size: 12px; }
                    .summary-row.total { font-weight: bold; font-size: 14px; border-top: 1px solid #000; padding-top: 8px; margin-top: 15px; }
                    .receipt-footer { text-align: center; margin-top: 25px; border-top: 1px dashed #000; padding-top: 15px; }
                    .receipt-footer p { margin: 5px 0; font-size: 11px; }
                    @page { size: 58mm auto; margin: 5mm; }
                    @media print { 
                        body { margin: 0; padding: 0; }
                        * { -webkit-print-color-adjust: exact; color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                ${receiptHTML}
            </body>
            </html>
        `);
        
        printWindow.document.close();
        printWindow.focus();
        
        // Auto-print after content loads
        printWindow.onload = function() {
            printWindow.print();
        };
    }
}

// Create global instance
const salesManager = new SalesManager();

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.SalesManager = SalesManager;
    window.salesManager = salesManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SalesManager, salesManager };
}
