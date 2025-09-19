# الصقري للاتصالات - نظام إدارة متجر الهواتف

نظام متكامل لإدارة متجر الهواتف المحمولة الجديدة والمستعملة، مبني بالكامل باستخدام HTML, CSS, JavaScript.

## المميزات

### 📱 إدارة الهواتف
- إضافة هواتف جديدة ومستعملة
- إدارة المخزون والباركود
- دعم الأرقام العربية في جميع الحقول
- حساب الضريبة تلقائياً (15% ضريبة القيمة المضافة)

### 🛍️ إدارة الأكسسوارات
- إضافة وتعديل الأكسسوارات
- تصنيف الأكسسوارات
- تتبع المخزون
- حساب الأرباح

### 💰 نظام المبيعات
- نقطة بيع متكاملة (POS)
- إنشاء فواتير
- حساب الضريبة تلقائياً
- تتبع المبيعات

### 🔍 البحث والتصفية
- بحث متقدم في المخزون
- تصفية حسب النوع والحالة
- تقارير مفصلة

### 👤 نظام المستخدمين
- تسجيل دخول آمن
- إدارة الصلاحيات
- تتبع العمليات

## التقنيات المستخدمة

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **UI Framework**: Bootstrap 5
- **Icons**: Font Awesome
- **Storage**: LocalStorage + Firebase Firestore
- **Authentication**: Firebase Auth
- **Database**: Firebase Firestore (NoSQL)
- **Fonts**: Cairo (عربي)
- **Real-time**: Firebase Realtime Database

## التثبيت والتشغيل

### 🚀 التشغيل السريع (LocalStorage)
1. **استنساخ المشروع**:
   ```bash
   git clone https://github.com/[username]/alsaqri-phones.git
   cd alsaqri-phones
   ```

2. **تشغيل المشروع**:
   - افتح `index.html` في المتصفح مباشرة
   - أو استخدم خادم محلي:
   ```bash
   python3 -m http.server 8000
   ```

3. **تسجيل الدخول**:
   - **المدير**: `admin` / `admin123`
   - **الموظف**: `user` / `user123`

### 🔥 ربط Firebase (اختياري)
للاستخدام مع قاعدة بيانات حقيقية:

1. **إعداد Firebase**:
   - افتح `firebase-setup.html` في المتصفح
   - اتبع الخطوات التفصيلية لإعداد Firebase
   - أو اتبع الدليل أدناه

2. **إنشاء مشروع Firebase**:
   - اذهب إلى [Firebase Console](https://console.firebase.google.com)
   - أنشئ مشروع جديد باسم `alsaqri-phones`
   - فعّل Firestore Database و Authentication

3. **تحديث الإعدادات**:
   - انسخ إعدادات Firebase من لوحة التحكم
   - حدث ملف `js/firebase-config.js` بالإعدادات الصحيحة

4. **تفعيل الخدمات**:
   - **Firestore Database**: لحفظ البيانات
   - **Authentication**: للمصادقة
   - **قواعد الأمان**: كما هو موضح في `firebase-setup.html`

5. **إنشاء المستخدمين**:
   - `admin@alsaqri.com` / `admin123`
   - `user@alsaqri.com` / `user123`

## هيكل المشروع

```
alsaqri-phones/
├── index.html                      # الصفحة الرئيسية
├── login.html                      # تسجيل الدخول
├── dashboard.html                  # لوحة التحكم
├── add_new_phone.html              # إضافة هاتف جديد
├── add_used_phone.html             # إضافة هاتف مستعمل
├── add_accessory.html              # إضافة أكسسوار
├── create_sale.html                # إنشاء عملية بيع
├── list_sales.html                 # قائمة المبيعات
├── inventory_summary.html          # ملخص المخزون
├── search.html                     # البحث في المخزون
├── list_accessories_simple.html    # قائمة الأكسسوارات
├── firebase-setup.html             # إعداد Firebase
├── js/                             # ملفات JavaScript
│   ├── config.js                   # إعدادات النظام
│   ├── utils.js                    # أدوات مساعدة
│   ├── storage.js                  # إدارة التخزين المحلي
│   ├── auth.js                     # نظام المصادقة
│   ├── barcode.js                  # إدارة الباركود
│   ├── phone-manager.js            # إدارة الهواتف
│   ├── accessory-manager.js        # إدارة الأكسسوارات
│   ├── sales-manager.js            # إدارة المبيعات
│   ├── main.js                     # الملف الرئيسي
│   ├── firebase-config.js          # إعدادات Firebase
│   ├── firebase-storage.js         # إدارة Firebase Storage
│   ├── firebase-auth.js            # مصادقة Firebase
│   └── firebase-storage-manager.js # مدير التخزين المختلط
└── README.md
```

## المميزات التقنية

### 🌐 دعم الأرقام العربية
- تحويل تلقائي للأرقام العربية (٠-٩) إلى إنجليزية
- دعم في جميع حقول الإدخال الرقمية
- حسابات دقيقة مع الأرقام العربية

### 💼 نظام الضريبة السعودي
- ضريبة القيمة المضافة 15%
- حساب تلقائي للضريبة
- عرض الأسعار مع وبدون الضريبة

### 💾 تخزين البيانات
- **LocalStorage**: تخزين محلي سريع (افتراضي)
- **Firebase Firestore**: قاعدة بيانات سحابية حقيقية (اختياري)
- **نظام مختلط**: يعمل مع Firebase أو LocalStorage
- **نسخ احتياطي تلقائي** مع Firebase
- **مزامنة في الوقت الفعلي** مع Firebase

### 🔥 Firebase Integration
- **Firebase Authentication**: مصادقة آمنة ومتقدمة
- **Firestore Database**: قاعدة بيانات NoSQL سحابية
- **Real-time Updates**: تحديثات فورية للبيانات
- **Offline Support**: يعمل بدون إنترنت مع Firebase
- **Scalable**: قابل للتوسع حسب الحاجة

### 📱 تصميم متجاوب
- متوافق مع جميع الأجهزة
- واجهة مستخدم عربية
- تصميم عصري وسهل الاستخدام

## المساهمة

نرحب بالمساهمات! يرجى:

1. عمل Fork للمشروع
2. إنشاء branch جديد للميزة
3. عمل Commit للتغييرات
4. عمل Push للـ branch
5. إنشاء Pull Request

## الترخيص

هذا المشروع مرخص تحت رخصة MIT - انظر ملف [LICENSE](LICENSE) للتفاصيل.

## الدعم

للدعم والاستفسارات، يرجى فتح issue في GitHub أو التواصل معنا.

---

**الصقري للاتصالات** - نظام إدارة متجر الهواتف الذكية 🇸🇦
