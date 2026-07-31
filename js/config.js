/**
 * Configuration and Constants
 * الصقري للاتصالات - Phone Store Management System
 */

// VAT Configuration for Saudi Arabia
const CONFIG = {
    VAT_RATE: 0.15, // 15% VAT rate
    COMPANY_INFO: {
        name: "الصقري للاتصالات",
        vatNumber: "310105614500003",
        address: "القصيم بريده الصفراء - اسواق النافوره",
        phone: "0505663222"
    },
    STORAGE_KEYS: {
        PHONES: 'phone_store_phones',
        ACCESSORIES: 'phone_store_accessories',
        SALES: 'phone_store_sales',
        PHONE_TYPES: 'phone_store_phone_types',
        ACCESSORY_CATEGORIES: 'phone_store_accessory_categories',
        CURRENT_USER: 'phone_store_current_user',
        SETTINGS: 'phone_store_settings'
    },
    PHONE_CONDITIONS: {
        excellent: "ممتازة",
        very_good: "جيدة جداً", 
        good: "جيدة",
        fair: "متوسطة"
    },
    PAYMENT_METHODS: [
        "نقدي",
        "بطاقة ائتمان",
        "تحويل بنكي",
        "شيك",
        "تابي",
        "تمارا"
    ],
    PHONE_COLORS: [
        "أسود", "أبيض", "أزرق", "أحمر", "أخضر", 
        "أصفر", "رمادي", "ذهبي", "فضي", "وردي", 
        "بنفسجي", "برتقالي", "أخرى"
    ],
    PHONE_MEMORY: [
        "32GB", "64GB", "128GB", "256GB", "512GB", "1TB", "أخرى"
    ]
};

// Default phone types data
const DEFAULT_PHONE_TYPES = {
    "Apple": [
        // Latest 2025 models - iPhone 17 series
        "iPhone 17 Pro Max", "iPhone 17 Pro", "iPhone 17 Air", "iPhone 17",
        // 2024 models - iPhone 16 series
        "iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16 Plus", "iPhone 16",
        "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15 Plus", "iPhone 15",
        "iPhone 14 Pro Max", "iPhone 14 Pro", "iPhone 14 Plus", "iPhone 14",
        "iPhone 13 Pro Max", "iPhone 13 Pro", "iPhone 13",
        "iPhone 12 Pro Max", "iPhone 12 Pro", "iPhone 12",
        "iPhone 11 Pro Max", "iPhone 11 Pro", "iPhone 11",
        "iPhone XS Max", "iPhone XS", "iPhone XR", "iPhone X",
        "iPhone 8 Plus", "iPhone 8"
    ],
    "Samsung": [
        // New 2024-2025 models
        "Galaxy S25 Ultra", "Galaxy S25+", "Galaxy S25",
        "Galaxy S24 Ultra", "Galaxy S24+", "Galaxy S24",
        "Galaxy S23 Ultra", "Galaxy S23+", "Galaxy S23",
        "Galaxy S22 Ultra", "Galaxy S22+", "Galaxy S22",
        "Galaxy S21 Ultra", "Galaxy S21+", "Galaxy S21",
        "Galaxy S20 Ultra", "Galaxy S20+", "Galaxy S20",
        "Galaxy Note 20 Ultra", "Galaxy Note 20",
        "Galaxy Note 10+", "Galaxy Note 10",
        "Galaxy A55", "Galaxy A54", "Galaxy A34", "Galaxy A24", "Galaxy A14"
    ],
    "Huawei": [
        "P60 Pro", "P60", "P50 Pro", "P50",
        "P40 Pro+", "P40 Pro", "P40",
        "Mate 60 Pro", "Mate 50 Pro", "Mate 40 Pro",
        "Nova 11", "Nova 10"
    ],
    "Xiaomi": [
        "15 Ultra", "15 Pro", "15",
        "14 Ultra", "14 Pro", "14",
        "13 Ultra", "13 Pro", "13", "13T Pro", "13T",
        "12S Ultra", "12 Pro", "12",
        "Redmi Note 14 Pro+", "Redmi Note 14 Pro", "Redmi Note 14",
        "Redmi Note 13 Pro+", "Redmi Note 13 Pro", "Redmi Note 13",
        "Redmi Note 12 Pro+", "Redmi Note 12 Pro", "Redmi Note 12"
    ],
    "OnePlus": [
        "12", "11", "10 Pro", "10", "9 Pro", "9", "8 Pro", "8",
        "Nord 3", "Nord 2T", "Nord 2"
    ],
    "Google": [
        "Pixel 8 Pro", "Pixel 8", "Pixel 7 Pro", "Pixel 7",
        "Pixel 6 Pro", "Pixel 6", "Pixel 5",
        "Pixel 4 XL", "Pixel 4", "Pixel 3 XL", "Pixel 3"
    ],
    "Oppo": [
        "Find X7 Ultra", "Find X6 Pro", "Find X6",
        "Find X5 Pro", "Find X5", "Find X3 Pro", "Find X3",
        "Reno 11 Pro", "Reno 11", "Reno 10 Pro+", "Reno 10 Pro", "Reno 10"
    ],
    "Vivo": [
        "X100 Pro", "X100", "X90 Pro+", "X90 Pro", "X90",
        "V29 Pro", "V29", "V27 Pro", "V27"
    ],
    "Realme": [
        "GT 5 Pro", "GT 5", "GT Neo 5", "GT Neo 4", "GT Neo 3",
        "Number Series", "C Series"
    ],
    "Honor": [
        "Magic 6 Pro", "Magic 6", "Magic 5 Pro", "Magic 5",
        "Magic V3", "Magic V2",
        "X9b", "X9a", "X8b", "X8a",
        "90 Pro", "90", "70 Pro", "70",
        "50 Lite", "50", "Play 8T", "Play 7T"
    ],
    "Infinix": [
        "Zero 30", "Zero 30 Pro",
        "Note 40 Pro", "Note 40", "Note 30 Pro", "Note 30",
        "Hot 40 Pro", "Hot 40", "Hot 30", "Hot 20",
        "Smart 8", "Smart 7"
    ],
    "Tecno": [
        "Phantom X2 Pro", "Phantom X2",
        "Camon 30 Pro", "Camon 30", "Camon 20 Pro", "Camon 20",
        "Spark 20 Pro", "Spark 20", "Spark 10 Pro", "Spark 10",
        "Pova 6 Pro", "Pova 6", "Pova 5 Pro", "Pova 5"
    ],
    "Nothing": [
        "Phone 2a Plus", "Phone 2a", "Phone 2", "Phone 1"
    ]
};

// Default accessory categories
const DEFAULT_ACCESSORY_CATEGORIES = [
    { name: 'accessory', arabic_name: 'إكسسوار', description: 'إكسسوارات عامة' },
    { name: 'charger', arabic_name: 'شاحن', description: 'شواحن الهواتف' },
    { name: 'case', arabic_name: 'غلاف', description: 'أغلفة الهواتف' },
    { name: 'screen_protector', arabic_name: 'حماية الشاشة', description: 'حماية شاشة الهاتف' },
    { name: 'cable', arabic_name: 'كابل', description: 'كابلات البيانات والشحن' },
    { name: 'headphone', arabic_name: 'سماعات', description: 'سماعات الهواتف' },
    { name: 'other', arabic_name: 'أخرى', description: 'فئات أخرى' }
];

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG, DEFAULT_PHONE_TYPES, DEFAULT_ACCESSORY_CATEGORIES };
}
