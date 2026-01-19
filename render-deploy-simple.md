# Render Deployment - Simple Setup

## المشكلة الحالية
Render يحاول استخدام commit قديم (353dab6) بدلاً من أحدث commit (32f77da).

## الحلول المقترحة

### 1. إعدادات Render المبسطة

**Name:** `phone-store-demo`
**Branch:** `main`
**Root Directory:** اتركه فارغ
**Build Command:** اتركه فارغ
**Publish Directory:** `./`

### 2. إعدادات متقدمة

**Node Version:** `18.x`
**Environment:** `Production`

### 3. خطوات النشر

1. **اذهب إلى Render Dashboard**
2. **احذف الموقع الحالي** (إذا كان موجود)
3. **أنشئ موقع جديد** مع الإعدادات أعلاه
4. **تأكد من اختيار Branch: main**
5. **اترك Build Command فارغ**
6. **اترك Publish Directory: ./**

### 4. ملفات مهمة

- `index.html` - الصفحة الرئيسية
- `_redirects` - للتعامل مع SPA routing
- `package.json` - تبعيات npm
- `js/firebase-config.js` - إعدادات Firebase

### 5. استكشاف الأخطاء

إذا استمرت المشكلة:

1. **تحقق من GitHub Repository**
   - تأكد من أن المستودع عام
   - تأكد من أن Branch main موجود

2. **تحقق من Render Settings**
   - تأكد من اختيار Branch الصحيح
   - تأكد من عدم وجود Build Command

3. **تحقق من الملفات**
   - تأكد من وجود `index.html` في الجذر
   - تأكد من وجود `_redirects`

## روابط مفيدة

- **المستودع:** https://github.com/FLANsa/phone-store-demo
- **Render Dashboard:** https://dashboard.render.com
- **Firebase Console:** https://console.firebase.google.com

---

**ملاحظة:** إذا استمرت المشكلة، جرب إنشاء موقع جديد بدلاً من تحديث الموجود.
