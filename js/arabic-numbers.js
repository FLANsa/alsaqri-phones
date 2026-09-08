/**
 * Arabic Numbers Support - دعم الأرقام العربية
 * ملف مركزي لدعم الأرقام العربية في جميع أنحاء النظام
 */

// تحويل الأرقام العربية إلى إنجليزية
function convertArabicToEnglishNumbers(str) {
    if (str == null) return '';
    const map = {
        '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
        '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
    };
    return str.toString().replace(/[٠-٩]/g, m => map[m] || m);
}

// تحويل الأرقام الإنجليزية إلى عربية
function convertEnglishToArabicNumbers(str) {
    if (str == null) return '';
    const map = {
        '0': '٠', '1': '١', '2': '٢', '3': '٣', '4': '٤',
        '5': '٥', '6': '٦', '7': '٧', '8': '٨', '9': '٩'
    };
    return str.toString().replace(/[0-9]/g, m => map[m] || m);
}

// تحليل رقم عربي إلى رقم إنجليزي قابل للاستخدام في الحسابات
function parseArabicNumber(value) {
    if (value == null || String(value).trim() === '') return 0;
    const converted = convertArabicToEnglishNumbers(value.toString());
    const num = parseFloat(converted);
    return isNaN(num) ? 0 : num;
}

// إعداد دعم الأرقام العربية لجميع حقول الإدخال الرقمية
function setupArabicNumberSupport() {
    // تطبيق التحويل على جميع حقول الإدخال الرقمية
    const selectors = [
        'input[type="number"]',
        '.arabic-number-field',
        'input[name*="price"]',
        'input[name*="cost"]',
        'input[name*="amount"]',
        'input[name*="quantity"]',
        'input[name*="percent"]',
        'input[name*="commission"]'
    ];
    
    selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(field => {
            // تجنب إضافة مستمعين متعددين
            if (field.hasAttribute('data-arabic-support')) return;
            field.setAttribute('data-arabic-support', 'true');
            
            field.addEventListener('input', function() {
                const pos = this.selectionStart;
                const cv = convertArabicToEnglishNumbers(this.value);
                if (cv !== this.value) {
                    this.value = cv;
                    if (pos !== null) this.setSelectionRange(pos, pos);
                }
                
                // تشغيل دوال إضافية إذا كانت موجودة
                if (typeof calculateProfit === 'function') calculateProfit();
                if (typeof updateVATCalculations === 'function') updateVATCalculations();
                if (typeof calculateVAT === 'function') calculateVAT();
            });
        });
    });
    
    console.log('✅ تم تفعيل دعم الأرقام العربية');
}

// تشغيل تلقائي عند تحميل الصفحة
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
        setupArabicNumberSupport();
        
        // إعادة تشغيل عند تحديث المحتوى الديناميكي
        if (document.body) {
            let scheduled = null;
            const observer = new MutationObserver(function(mutations) {
                if (!mutations.some(mutation => mutation.addedNodes.length)) return;
                clearTimeout(scheduled);
                scheduled = setTimeout(setupArabicNumberSupport, 100);
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    });
}
