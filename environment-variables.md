# AbdulMalik - Environment Variables
# متغيرات البيئة لنظام إدارة متجر الجوالات
# تم التحديث: 2026-01-19

# Firebase Configuration (Project: abdulmalik-690c1)
FIREBASE_API_KEY=AIzaSyDmJqsMxCyfSUCWEUzeWWS4e7yT-e5FWKY
FIREBASE_AUTH_DOMAIN=abdulmalik-690c1.firebaseapp.com
FIREBASE_PROJECT_ID=abdulmalik-690c1
FIREBASE_STORAGE_BUCKET=abdulmalik-690c1.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=487683552497
FIREBASE_APP_ID=1:487683552497:web:fd150711491f06a410e550
FIREBASE_MEASUREMENT_ID=G-1BV2E5QQN1

# Application Settings
NODE_ENV=production
APP_NAME=AbdulMalik
APP_VERSION=2.0.0
APP_DESCRIPTION=نظام إدارة متجر الجوالات

# Company Information
COMPANY_NAME=عبدالملك للاتصالات
COMPANY_NAME_EN=Abdulmalik Telecom
COMPANY_ADDRESS=الرياض، المملكة العربية السعودية
COMPANY_PHONE=0591813149
COMPANY_EMAIL=support@abdulmalik.com
COMPANY_VAT_NUMBER=311362508900003
COMMERCIAL_REG_NUMBER=7030090570

# Database Settings
DATABASE_TYPE=firestore
DATABASE_COLLECTION_PHONES=phones
DATABASE_COLLECTION_ACCESSORIES=accessories
DATABASE_COLLECTION_SALES=sales
DATABASE_COLLECTION_PHONE_TYPES=phone_types

# Security Settings
JWT_SECRET=abdulmalik-secret-key-2026
SESSION_SECRET=abdulmalik-session-secret
ENCRYPTION_KEY=abdulmalik-encryption-key

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
SMTP_PASS=your-app-password

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
