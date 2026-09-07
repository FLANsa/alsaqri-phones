# Al Saqri - Environment Variables (قالب فقط — بلا أسرار)
# متغيرات البيئة لنظام إدارة متجر الجوالات
# تم التحديث: 2026-09-07
#
# ⚠️ تحذير: نسخ سابقة من هذا الملف كانت تحتوي أسراراً حقيقية (JWT/SESSION/ENCRYPTION)
# ولا تزال في تاريخ git. هذه الأسرار غير مستخدمة في أي كود حالياً (لا يوجد خادم يقرأها)،
# لكن إن عُمد استخدامها يوماً يجب توليد قيم جديدة — القيم القديمة معروضة في التاريخ العام.
# لإزالتها من التاريخ: git filter-repo أو BFG Repo-Cleaner (يتطلب إعادة كتابة التاريخ).

# Firebase Configuration (Project: alsaqri-dc3ca)
# ملاحظة: مفاتيح Firebase Web علنية بطبيعتها (موجودة في حزمة المتصفح)،
# والحماية الفعلية تأتي من firestore.rules و storage.rules
FIREBASE_API_KEY=<موجود في js/firebase-config-cdn.js>
FIREBASE_AUTH_DOMAIN=alsaqri-dc3ca.firebaseapp.com
FIREBASE_PROJECT_ID=alsaqri-dc3ca
FIREBASE_STORAGE_BUCKET=alsaqri-dc3ca.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=325709838350
FIREBASE_APP_ID=<موجود في js/firebase-config-cdn.js>
FIREBASE_MEASUREMENT_ID=G-Q8E93ZR4FZ

# Application Settings
NODE_ENV=production
APP_NAME=AL SAQRI TELECOM
APP_VERSION=2.0.0
APP_DESCRIPTION=نظام إدارة متجر الجوالات

# Company Information
COMPANY_NAME=الصقري للاتصالات
COMPANY_NAME_EN=AL SAQRI TELECOM
COMPANY_ADDRESS=القصيم بريده الصفراء - اسواق النافوره
COMPANY_PHONE=0505663222
COMPANY_EMAIL=support@alsaqri.com
COMPANY_VAT_NUMBER=108250001385335
COMMERCIAL_REG_NUMBER=7050488852

# Database Settings
DATABASE_TYPE=firestore
DATABASE_COLLECTION_PHONES=phones
DATABASE_COLLECTION_ACCESSORIES=accessories
DATABASE_COLLECTION_SALES=sales
DATABASE_COLLECTION_PHONE_TYPES=phone_types

# Security Settings (غير مستخدمة حالياً — لا يوجد خادم يقرأها)
JWT_SECRET=<بدّل قبل أي استخدام حقيقي>
SESSION_SECRET=<بدّل قبل أي استخدام حقيقي>
ENCRYPTION_KEY=<بدّل قبل أي استخدام حقيقي>

# VAT Settings (Saudi Arabia)
VAT_RATE=0.15
VAT_RATE_PERCENTAGE=15

# File Upload Settings
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=jpg,jpeg,png,gif,pdf
UPLOAD_PATH=uploads/

# Email Settings (if needed)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=<بدّل قبل أي استخدام حقيقي>

# Logging Settings
LOG_LEVEL=info
LOG_FILE=logs/app.log

# Cache Settings
CACHE_TTL=3600
CACHE_MAX_SIZE=100

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=100

# Development Settings
DEBUG=false
HOT_RELOAD=false
