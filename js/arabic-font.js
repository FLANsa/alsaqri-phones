// Arabic Font Support for jsPDF
// This file provides proper Arabic text rendering using Canvas

// Function to render Arabic text to canvas and return as image data
function renderArabicTextToCanvas(text, fontSize = 12, width = 200, height = 30) {
    try {
        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = width;
        canvas.height = height;
        
        // Set font
        ctx.font = `${fontSize}px Arial, Tahoma, sans-serif`;
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Enable RTL
        ctx.direction = 'rtl';
        
        // Draw text
        ctx.fillText(text, width / 2, height / 2);
        
        // Return as data URL
        return canvas.toDataURL('image/png');
    } catch (error) {
        console.error('❌ فشل في رسم النص العربي:', error);
        return null;
    }
}

// Function to add Arabic text as image to PDF
function addArabicTextAsImage(doc, text, x, y, fontSize = 12, width = 200, height = 30) {
    try {
        const imageData = renderArabicTextToCanvas(text, fontSize, width, height);
        if (imageData) {
            doc.addImage(imageData, 'PNG', x, y, width / 4, height / 4); // Scale down for PDF
            return true;
        }
        return false;
    } catch (error) {
        console.error('❌ فشل في إضافة النص العربي كصورة:', error);
        return false;
    }
}

// Function to convert Arabic text to English for PDF
function convertArabicToEnglish(text) {
    const translations = {
        'عبدالملك للاتصالات': 'Abdulmalik Telecom',
        'اختبار الخط العربي': 'Arabic Font Test',
        'رقم الجهاز': 'Device Number',
        'نسبة البطارية': 'Battery Level',
        'الذاكرة': 'Memory',
        'المعرف': 'ID',
        'البطارية': 'Battery',
        'الذاكرة': 'Memory',
        'جهاز': 'Device'
    };
    
    // Replace Arabic text with English
    let englishText = text;
    for (const [arabic, english] of Object.entries(translations)) {
        englishText = englishText.replace(new RegExp(arabic, 'g'), english);
    }
    
    return englishText;
}

// Function to set up Arabic font for PDF (using Canvas method)
async function addArabicFontToPDF(doc) {
    try {
        // Set default font for non-Arabic text
        doc.setFont('helvetica', 'normal');
        console.log('✅ تم إعداد الخط للـ PDF (سيتم استخدام Canvas للنص العربي)');
        return 'arabic-canvas';
    } catch (error) {
        console.error('❌ فشل في إعداد الخط:', error);
        doc.setFont('helvetica', 'normal');
        return 'helvetica-fallback';
    }
}

// Function to check if Arabic text rendering is available
function isArabicTextAvailable() {
    try {
        // Check if Canvas is available
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        return ctx !== null;
    } catch (error) {
        console.error('❌ Canvas غير متاح:', error);
        return false;
    }
}

// Export functions for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        addArabicFontToPDF,
        isArabicTextAvailable,
        convertArabicToEnglish,
        addArabicTextAsImage,
        renderArabicTextToCanvas
    };
} else {
    // Make functions available globally
    window.addArabicFontToPDF = addArabicFontToPDF;
    window.isArabicTextAvailable = isArabicTextAvailable;
    window.convertArabicToEnglish = convertArabicToEnglish;
    window.addArabicTextAsImage = addArabicTextAsImage;
    window.renderArabicTextToCanvas = renderArabicTextToCanvas;
}
