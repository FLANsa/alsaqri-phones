/**
 * Barcode Generation and Management
 * عبدالملك للاتصالات - Phone Store Management System
 */

class BarcodeGenerator {
    constructor() {
        this.barcodeCache = new Map();
    }

    /**
     * Generate SVG barcode for phone number
     * @param {string} phoneNumber - Phone number to encode
     * @param {Object} options - Barcode options
     * @returns {string} SVG barcode string
     */
    generateSVGBarcode(phoneNumber, options = {}) {
        const defaultOptions = {
            width: 360,
            height: 120,
            barWidth: 2,
            barHeight: 80,
            fontSize: 16,
            fontFamily: 'monospace',
            showText: true,
            textMargin: 10
        };

        const opts = { ...defaultOptions, ...options };
        
        // Check cache first
        const cacheKey = `${phoneNumber}-${JSON.stringify(opts)}`;
        if (this.barcodeCache.has(cacheKey)) {
            return this.barcodeCache.get(cacheKey);
        }

        // Generate barcode pattern
        const pattern = this.generateBarcodePattern(phoneNumber);
        const bars = this.patternToBars(pattern, opts);
        
        // Create SVG
        const svg = this.createSVG(phoneNumber, bars, opts);
        
        // Cache the result
        this.barcodeCache.set(cacheKey, svg);
        
        return svg;
    }

    /**
     * Generate barcode pattern from phone number
     * @param {string} phoneNumber - Phone number to encode
     * @returns {string} Binary pattern
     */
    generateBarcodePattern(phoneNumber) {
        // Simple pattern generation for internal use
        const digits = phoneNumber.padEnd(12, '0').slice(0, 12).split('').map(d => parseInt(d, 10));
        let pattern = '11010010'; // Start pattern
        
        // Encode each digit as a simple pattern
        const digitPatterns = {
            0: '0001101', 1: '0011001', 2: '0010011', 3: '0111101',
            4: '0100011', 5: '0110001', 6: '0101111', 7: '0111011',
            8: '0110111', 9: '0001011'
        };

        digits.forEach(digit => {
            pattern += digitPatterns[digit] || '0001101';
        });

        pattern += '01010'; // Middle pattern
        
        // Add second half (inverted)
        digits.forEach(digit => {
            const originalPattern = digitPatterns[digit] || '0001101';
            const invertedPattern = originalPattern.split('').map(bit => bit === '0' ? '1' : '0').join('');
            pattern += invertedPattern;
        });

        pattern += '1010100'; // End pattern
        
        return pattern;
    }

    /**
     * Convert pattern to bar coordinates
     * @param {string} pattern - Binary pattern
     * @param {Object} options - Barcode options
     * @returns {Array} Array of bar objects
     */
    patternToBars(pattern, options) {
        const bars = [];
        const totalBars = pattern.length;
        const availableWidth = options.width - 40; // Leave margins
        const barWidth = availableWidth / totalBars;
        
        let currentX = 20; // Start margin
        
        for (let i = 0; i < pattern.length; i++) {
            if (pattern[i] === '1') {
                bars.push({
                    x: currentX,
                    y: 10,
                    width: barWidth,
                    height: options.barHeight
                });
            }
            currentX += barWidth;
        }
        
        return bars;
    }

    /**
     * Create SVG element
     * @param {string} phoneNumber - Phone number for text
     * @param {Array} bars - Array of bar objects
     * @param {Object} options - SVG options
     * @returns {string} SVG string
     */
    createSVG(phoneNumber, bars, options) {
        const barsHTML = bars.map(bar => 
            `<rect x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}" fill="#000" />`
        ).join('');

        const textY = options.barHeight + 20 + options.textMargin;
        const textElement = options.showText ? 
            `<text x="50%" y="${textY}" text-anchor="middle" font-family="${options.fontFamily}" font-size="${options.fontSize}" fill="#000">${phoneNumber}</text>` : '';

        return `
            <svg xmlns="http://www.w3.org/2000/svg" width="${options.width}" height="${options.height}" viewBox="0 0 ${options.width} ${options.height}" role="img" aria-label="Barcode for ${phoneNumber}">
                <rect width="${options.width}" height="${options.height}" fill="#fff"/>
                ${barsHTML}
                ${textElement}
            </svg>
        `;
    }

    /**
     * Generate barcode with battery age encoding for used phones
     * @param {string} phoneNumber - Phone number
     * @param {number} batteryAge - Battery age in months
     * @param {Object} options - Barcode options
     * @returns {string} SVG barcode with encoded battery age
     */
    generateUsedPhoneBarcode(phoneNumber, batteryAge, options = {}) {
        // Encode battery age into the phone number pattern
        const encodedNumber = phoneNumber + batteryAge.toString().padStart(2, '0');
        return this.generateSVGBarcode(encodedNumber, options);
    }

    /**
     * Render barcode to DOM element
     * @param {string} elementId - Target element ID
     * @param {string} phoneNumber - Phone number
     * @param {Object} options - Barcode options
     */
    renderBarcode(elementId, phoneNumber, options = {}) {
        const element = document.getElementById(elementId);
        if (!element) {
            console.error(`Element with ID '${elementId}' not found`);
            return;
        }

        const svg = this.generateSVGBarcode(phoneNumber, options);
        element.innerHTML = svg;
    }

    /**
     * Download barcode as image
     * @param {string} phoneNumber - Phone number
     * @param {string} filename - Download filename
     * @param {Object} options - Barcode options
     */
    downloadBarcode(phoneNumber, filename, options = {}) {
        const svg = this.generateSVGBarcode(phoneNumber, options);
        
        // Create canvas to convert SVG to PNG
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        canvas.width = options.width || 360;
        canvas.height = options.height || 120;
        
        img.onload = function() {
            ctx.drawImage(img, 0, 0);
            
            // Create download link
            canvas.toBlob(function(blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename || `barcode-${phoneNumber}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });
        };
        
        img.src = 'data:image/svg+xml;base64,' + btoa(svg);
    }

    /**
     * Validate barcode format
     * @param {string} barcode - Barcode to validate
     * @returns {boolean} Is valid barcode
     */
    validateBarcode(barcode) {
        // Simple validation for our 6-digit format
        return /^\d{6}$/.test(barcode);
    }

    /**
     * Process scanned barcode
     * @param {string} scannedCode - Scanned barcode data
     * @returns {Object} Processed barcode info
     */
    processScannedBarcode(scannedCode) {
        const cleanCode = ValidationUtils.processBarcodeInput(scannedCode);
        
        if (!cleanCode) {
            return { valid: false, error: 'باركود غير صحيح' };
        }

        // Check if it's our internal format
        if (this.validateBarcode(cleanCode)) {
            return {
                valid: true,
                phoneNumber: cleanCode,
                type: 'internal'
            };
        }

        // Handle other barcode formats if needed
        return {
            valid: true,
            phoneNumber: cleanCode,
            type: 'external'
        };
    }

    /**
     * Clear barcode cache
     */
    clearCache() {
        this.barcodeCache.clear();
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache stats
     */
    getCacheStats() {
        return {
            size: this.barcodeCache.size,
            keys: Array.from(this.barcodeCache.keys())
        };
    }
}

// Barcode utilities
const BarcodeUtils = {
    /**
     * Create printable barcode page
     * @param {Object} phone - Phone object
     * @param {Object} companyInfo - Company information
     * @returns {string} Printable HTML
     */
    createPrintablePage(phone, companyInfo = CONFIG.COMPANY_INFO) {
        const barcode = new BarcodeGenerator();
        const barcodeOptions = { width: 300, height: 100 };
        
        let svgBarcode;
        if (phone.condition === 'used' && phone.age) {
            svgBarcode = barcode.generateUsedPhoneBarcode(phone.phone_number, phone.age, barcodeOptions);
        } else {
            svgBarcode = barcode.generateSVGBarcode(phone.phone_number, barcodeOptions);
        }

        return `
            <!DOCTYPE html>
            <html dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>طباعة باركود - ${phone.phone_number}</title>
                <style>
                    body { font-family: 'Cairo', Arial, sans-serif; text-align: center; padding: 20px; }
                    .barcode-container { border: 2px solid #000; padding: 15px; margin: 20px auto; width: fit-content; }
                    .phone-info { margin: 15px 0; }
                    .phone-info p { margin: 5px 0; font-size: 14px; }
                    @media print { 
                        body { margin: 0; padding: 10px; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="barcode-container">
                    <h3>${companyInfo.name}</h3>
                    <div class="barcode">${svgBarcode}</div>
                    <div class="phone-info">
                        <p><strong>الشركة:</strong> ${phone.brand}</p>
                        <p><strong>الموديل:</strong> ${phone.model}</p>
                        <p><strong>الرقم التسلسلي:</strong> ${phone.serial_number}</p>
                        ${phone.condition === 'used' && phone.age ? 
                            `<p><strong>عمر البطارية:</strong> ${phone.age} شهر</p>` : ''}
                    </div>
                </div>
                <div class="no-print">
                    <button onclick="window.print()">طباعة</button>
                    <button onclick="window.close()">إغلاق</button>
                </div>
            </body>
            </html>
        `;
    },

    /**
     * Print barcode for phone
     * @param {Object} phone - Phone object
     */
    printBarcode(phone) {
        const printWindow = window.open('', '_blank');
        const printContent = this.createPrintablePage(phone);
        
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        
        // Auto-print after content loads
        printWindow.onload = function() {
            printWindow.print();
        };
    },

    /**
     * Create printable barcode page for accessories
     * @param {Object} accessory - Accessory object
     * @param {Object} companyInfo - Company information
     * @returns {string} Printable HTML
     */
    createAccessoryPrintablePage(accessory, companyInfo = CONFIG.COMPANY_INFO) {
        const barcode = new BarcodeGenerator();
        const barcodeOptions = { width: 300, height: 100 };
        
        const svgBarcode = barcode.generateSVGBarcode(accessory.barcode, barcodeOptions);

        return `
            <!DOCTYPE html>
            <html dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>طباعة باركود - ${accessory.barcode}</title>
                <style>
                    body { font-family: 'Cairo', Arial, sans-serif; text-align: center; padding: 20px; }
                    .barcode-container { border: 2px solid #000; padding: 15px; margin: 20px auto; width: fit-content; }
                    .accessory-info { margin: 15px 0; }
                    .accessory-info p { margin: 5px 0; font-size: 14px; }
                    .barcode { margin: 10px 0; }
                    @media print { 
                        body { margin: 0; padding: 10px; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="barcode-container">
                    <h3>${companyInfo.name}</h3>
                    <div class="barcode">${svgBarcode}</div>
                    <div class="accessory-info">
                        <p><strong>الاسم:</strong> ${accessory.name}</p>
                        <p><strong>الفئة:</strong> ${accessory.category}</p>
                        <p><strong>الباركود:</strong> ${accessory.barcode}</p>
                        <p><strong>سعر البيع:</strong> ${accessory.selling_price} ريال</p>
                        <p><strong>الكمية:</strong> ${accessory.quantity_in_stock || accessory.quantity}</p>
                        ${accessory.supplier ? `<p><strong>المورد:</strong> ${accessory.supplier}</p>` : ''}
                    </div>
                </div>
                <div class="no-print">
                    <button onclick="window.print()">طباعة</button>
                    <button onclick="window.close()">إغلاق</button>
                </div>
            </body>
            </html>
        `;
    },

    /**
     * Print barcode for accessory
     * @param {Object} accessory - Accessory object
     */
    printAccessoryBarcode(accessory) {
        const printWindow = window.open('', '_blank');
        const printContent = this.createAccessoryPrintablePage(accessory);
        
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        
        // Auto-print after content loads
        printWindow.onload = function() {
            printWindow.print();
        };
    }
};

// Create global instance
const barcodeGenerator = new BarcodeGenerator();

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.BarcodeGenerator = BarcodeGenerator;
    window.barcodeGenerator = barcodeGenerator;
    window.BarcodeUtils = BarcodeUtils;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BarcodeGenerator, BarcodeUtils, barcodeGenerator };
}
