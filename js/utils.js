/**
 * Utility Functions
 * عبدالملك للاتصالات - Phone Store Management System
 */

// VAT Calculation Functions
const VATUtils = {
    /**
     * Calculate VAT amount for a given price
     * @param {number} amount - Price without VAT
     * @returns {number} VAT amount
     */
    calculateVAT(amount) {
        return amount * CONFIG.VAT_RATE;
    },

    /**
     * Calculate price including VAT
     * @param {number} priceWithoutVAT - Price without VAT
     * @returns {number} Price with VAT
     */
    calculatePriceWithVAT(priceWithoutVAT) {
        return priceWithoutVAT * (1 + CONFIG.VAT_RATE);
    },

    /**
     * Calculate price excluding VAT
     * @param {number} priceWithVAT - Price with VAT
     * @returns {number} Price without VAT
     */
    calculatePriceWithoutVAT(priceWithVAT) {
        return priceWithVAT / (1 + CONFIG.VAT_RATE);
    }
};

// Formatting Utilities
const FormatUtils = {
    /**
     * Format money amount
     * @param {number} amount - Amount to format
     * @returns {string} Formatted amount
     */
    formatMoney(amount) {
        return (Number(amount) || 0).toFixed(2);
    },

    /**
     * Format date and time
     * @param {string|Date} date - Date to format
     * @returns {string} Formatted date
     */
    formatDateTime(date) {
        const d = new Date(date);
        const pad = x => String(x).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },

    /**
     * Format date only
     * @param {string|Date} date - Date to format
     * @returns {string} Formatted date
     */
    formatDate(date) {
        const d = new Date(date);
        const pad = x => String(x).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
};

// ID Generation Utilities
const IDUtils = {
    /**
     * Generate unique invoice number
     * @returns {string} Invoice number
     */
    generateInvoiceNumber() {
        const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
        const randomSuffix = Math.floor(Math.random() * 9000) + 1000;
        return `INV-${timestamp}-${randomSuffix}`;
    },

    /**
     * Generate unique phone number
     * @param {Array} existingPhones - Array of existing phones
     * @returns {string} Unique phone number
     */
    generateUniquePhoneNumber(existingPhones = []) {
        const existingNumbers = existingPhones.map(phone => parseInt(phone.phone_number || '0'));
        const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
        const nextNumber = maxNumber + 1;
        
        if (nextNumber > 100000) {
            throw new Error("تم الوصول للحد الأقصى من أرقام الهواتف (100000)");
        }
        
        return String(nextNumber).padStart(6, '0');
    },

    /**
     * Generate unique sale number
     * @returns {string} Sale number
     */
    generateSaleNumber() {
        const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
        const randomSuffix = Math.floor(Math.random() * 9000) + 1000;
        return `S-${timestamp}-${randomSuffix}`;
    }
};

// Validation Utilities
const ValidationUtils = {
    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {boolean} Is valid email
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    /**
     * Validate phone number
     * @param {string} phone - Phone number to validate
     * @returns {boolean} Is valid phone
     */
    isValidPhone(phone) {
        const phoneRegex = /^[0-9+\-\s()]+$/;
        return phoneRegex.test(phone) && phone.length >= 10;
    },

    /**
     * Validate Saudi ID/Iqama
     * @param {string} id - ID to validate
     * @returns {boolean} Is valid ID
     */
    isValidSaudiID(id) {
        const idRegex = /^[0-9]{10}$/;
        return idRegex.test(id);
    },

    /**
     * Process barcode input
     * @param {string} barcodeInput - Raw barcode input
     * @returns {string|null} Processed barcode or null if invalid
     */
    processBarcodeInput(barcodeInput) {
        if (!barcodeInput) return null;
        
        // Clean the barcode input (remove spaces, dashes, etc.)
        const cleanedBarcode = barcodeInput.replace(/[^0-9]/g, '');
        
        // Check if it's a valid 6-digit number (our internal format)
        if (cleanedBarcode.length === 6 && /^\d+$/.test(cleanedBarcode)) {
            return cleanedBarcode;
        }
        
        // If it's a different format but still numeric, return it
        if (/^\d+$/.test(cleanedBarcode)) {
            return cleanedBarcode;
        }
        
        return null;
    }
};

// Search Utilities
const SearchUtils = {
    /**
     * Check if text includes any of the search terms
     * @param {string} text - Text to search in
     * @param {Array} searchTerms - Array of search terms
     * @returns {boolean} Whether text includes any search term
     */
    includesAny(text, searchTerms) {
        const lowerText = (text || '').toString().toLowerCase();
        return searchTerms.some(term => 
            lowerText.includes((term || '').toString().toLowerCase())
        );
    },

    /**
     * Filter phones by search term
     * @param {Array} phones - Array of phones
     * @param {string} searchTerm - Search term
     * @param {string} condition - Phone condition filter
     * @returns {Array} Filtered phones
     */
    filterPhones(phones, searchTerm, condition = '') {
        if (!searchTerm && !condition) return phones;
        
        const tokens = searchTerm ? searchTerm.split(/\s+/) : [];
        
        return phones.filter(phone => {
            // Apply condition filter
            if (condition && phone.condition !== condition) {
                return false;
            }
            
            // Apply search term filter
            if (tokens.length > 0) {
                const searchableText = [
                    phone.phone_number,
                    phone.serial_number,
                    phone.brand,
                    phone.model,
                    phone.phone_color,
                    phone.phone_memory,
                    phone.description,
                    phone.customer_name,
                    phone.customer_id
                ].join(' ');
                
                return this.includesAny(searchableText, tokens);
            }
            
            return true;
        });
    },

    /**
     * Filter accessories by search term
     * @param {Array} accessories - Array of accessories
     * @param {string} searchTerm - Search term
     * @returns {Array} Filtered accessories
     */
    filterAccessories(accessories, searchTerm) {
        if (!searchTerm) return accessories;
        
        const tokens = searchTerm.split(/\s+/);
        
        return accessories.filter(accessory => {
            const searchableText = [
                accessory.name,
                accessory.category,
                accessory.description,
                accessory.supplier,
                accessory.notes
            ].join(' ');
            
            return this.includesAny(searchableText, tokens);
        });
    }
};

// Date Utilities
const DateUtils = {
    /**
     * Check if two dates are the same day
     * @param {string|Date} date1 - First date
     * @param {number} year - Year to compare
     * @param {number} month - Month to compare
     * @param {number} day - Day to compare
     * @returns {boolean} Are same day
     */
    isSameDay(date1, year, month, day) {
        const d = new Date(date1);
        return d.getFullYear() === year && 
               (d.getMonth() + 1) === month && 
               d.getDate() === day;
    },

    /**
     * Check if two dates are in the same month
     * @param {string|Date} date1 - First date
     * @param {number} year - Year to compare
     * @param {number} month - Month to compare
     * @returns {boolean} Are same month
     */
    isSameMonth(date1, year, month) {
        const d = new Date(date1);
        return d.getFullYear() === year && (d.getMonth() + 1) === month;
    },

    /**
     * Check if two dates are in the same year
     * @param {string|Date} date1 - First date
     * @param {number} year - Year to compare
     * @returns {boolean} Are same year
     */
    isSameYear(date1, year) {
        const d = new Date(date1);
        return d.getFullYear() === year;
    }
};

// UI Utilities
const UIUtils = {
    /**
     * Show alert message
     * @param {string} type - Alert type (success, error, warning, info)
     * @param {string} message - Alert message
     * @param {number} duration - Duration in milliseconds (default 5000)
     */
    showAlert(type, message, duration = 5000) {
        // Create alert element
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        // Find alerts container or create one
        let alertsContainer = document.getElementById('alerts');
        if (!alertsContainer) {
            alertsContainer = document.createElement('div');
            alertsContainer.id = 'alerts';
            alertsContainer.className = 'container mt-3';
            document.body.insertBefore(alertsContainer, document.body.firstChild);
        }
        
        // Add alert to container
        alertsContainer.appendChild(alertDiv);
        
        // Auto-remove after duration
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, duration);
    },

    /**
     * Show loading spinner
     * @param {string} elementId - Element ID to show spinner in
     */
    showLoading(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `
                <div class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">جاري التحميل...</span>
                    </div>
                    <p class="mt-2 text-muted">جاري التحميل...</p>
                </div>
            `;
        }
    },

    /**
     * Get badge HTML for status
     * @param {string} status - Status value
     * @returns {string} Badge HTML
     */
    getStatusBadge(status) {
        let badgeClass = 'bg-warning';
        if (status === 'مكتمل') badgeClass = 'bg-success';
        else if (status === 'ملغي') badgeClass = 'bg-danger';
        return `<span class="badge ${badgeClass}">${status}</span>`;
    },

    /**
     * Get condition badge for phone
     * @param {string} condition - Phone condition
     * @returns {string} Badge HTML
     */
    getConditionBadge(condition) {
        const badgeClass = condition === 'new' ? 'bg-success' : 'bg-warning';
        const text = condition === 'new' ? 'جديد' : 'مستعمل';
        return `<span class="badge ${badgeClass}">${text}</span>`;
    }
};

// Export utilities
if (typeof window !== 'undefined') {
    window.VATUtils = VATUtils;
    window.FormatUtils = FormatUtils;
    window.IDUtils = IDUtils;
    window.ValidationUtils = ValidationUtils;
    window.SearchUtils = SearchUtils;
    window.DateUtils = DateUtils;
    window.UIUtils = UIUtils;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        VATUtils,
        FormatUtils,
        IDUtils,
        ValidationUtils,
        SearchUtils,
        DateUtils,
        UIUtils
    };
}
