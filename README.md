# Aldhahbi - نظام إدارة متجر الجوالات

نظام متكامل لإدارة متجر الهواتف المحمولة الجديدة والمستعملة باللغة العربية.

## 🌟 المميزات الرئيسية

### 📱 إدارة المخزون
- إضافة وإدارة الهواتف الجديدة والمستعملة
- إدارة الإكسسوارات والملحقات
- نظام باركود متقدم للمنتجات
- تتبع المخزون والتنبيهات

### 💰 نظام المبيعات
- إنشاء فواتير المبيعات
- إدارة العملاء والمبيعات
- تقارير مبيعات مفصلة
- خيارات دفع متعددة

### 🔍 البحث والفلترة
- بحث متقدم عن المنتجات
- فلترة حسب الفئة والسعر
- عرض تفصيلي للمنتجات

### 📊 التقارير والإحصائيات
- لوحة تحكم شاملة
- تقارير مبيعات يومية وشهرية
- إحصائيات المخزون
- تقارير الأداء

## 🚀 النشر على Render

### الطريقة الأولى: النشر التلقائي من GitHub

1. **اذهب إلى [Render Dashboard](https://dashboard.render.com)**
2. **اضغط على "New +" ثم "Static Site"**
3. **اتصل بـ GitHub:**
   - اختر "Build and deploy from a Git repository"
   - اختر مستودع `aldhahbi`
   - اختر الفرع `main`

4. **إعدادات النشر:**
   ```
   Name: aldhahbi
   Branch: main
   Root Directory: ./
   Build Command: (اتركه فارغ)
   Publish Directory: ./
   ```

5. **اضغط على "Create Static Site"**

### الطريقة الثانية: استخدام ملف render.yaml

المشروع يحتوي على ملف `render.yaml` جاهز للنشر:

```yaml
services:
  - type: static
    name: aldhahbi
    buildCommand: ""
    staticPublishPath: ./
    envVars:
      - key: NODE_ENV
        value: production
    headers:
      - path: /*
        name: X-Frame-Options
        value: DENY
      - path: /*
        name: X-Content-Type-Options
        value: nosniff
```

## 🔧 إعداد Firebase

### 1. إنشاء مشروع Firebase
- اذهب إلى [Firebase Console](https://console.firebase.google.com)
- أنشئ مشروع جديد باسم `aldhahbi`

### 2. تفعيل الخدمات المطلوبة
- **Firestore Database** - قاعدة البيانات
- **Authentication** - المصادقة
- **Storage** - تخزين الملفات
- **Analytics** - التحليلات

### 3. إعداد Firebase Config
- انسخ إعدادات Firebase من Console
- ضعها في ملف `js/firebase-config.js`

## 📱 الماركات والموديلات المدعومة

### Apple
- iPhone 17 Pro Max, iPhone 17 Pro, iPhone 17 Air, iPhone 17
- iPhone 16 Pro Max, iPhone 16 Pro, iPhone 16 Plus, iPhone 16
- iPhone 15, iPhone 14, iPhone 13, iPhone 12, iPhone 11

### Samsung
- Galaxy S25 Ultra, Galaxy S25+, Galaxy S25
- Galaxy S24 Ultra, Galaxy S24+, Galaxy S24
- Galaxy A55, Galaxy A54, Galaxy A34, Galaxy A24

### Xiaomi
- 15 Ultra, 15 Pro, 15
- 14 Ultra, 14 Pro, 14
- Redmi Note 14 Pro+, Redmi Note 14 Pro, Redmi Note 14

### Honor
- Magic 6 Pro, Magic 6, Magic 5 Pro, Magic 5
- Magic V3, Magic V2
- X9b, X9a, X8b, X8a

### Infinix
- Zero 30, Zero 30 Pro
- Note 40 Pro, Note 40, Note 30 Pro, Note 30
- Hot 40 Pro, Hot 40, Hot 30, Hot 20

### Tecno
- Phantom X2 Pro, Phantom X2
- Camon 30 Pro, Camon 30, Camon 20 Pro, Camon 20
- Spark 20 Pro, Spark 20, Spark 10 Pro, Spark 10

### Nothing
- Phone 2a Plus, Phone 2a, Phone 2, Phone 1

## 🛠️ التقنيات المستخدمة

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Storage**: Firebase Storage
- **Analytics**: Firebase Analytics
- **Deployment**: Render.com

## 📋 متطلبات التشغيل

- Python 3.7+ (للخادم المحلي)
- Node.js 14+ (اختياري)
- حساب Firebase
- متصفح حديث يدعم JavaScript ES6+

## 🚀 التشغيل المحلي

```bash
# استنساخ المشروع
git clone https://github.com/FLANsa/aldhahbi.git
cd aldhahbi

# تشغيل الخادم المحلي
python3 -m http.server 8000

# أو باستخدام Node.js
npx http-server -p 8000
```

## 📞 الدعم

للدعم التقني أو الاستفسارات:
- **GitHub Issues**: [إنشاء مشكلة](https://github.com/FLANsa/aldhahbi/issues)
- **Email**: support@blackfingerprint.com

## 📄 الترخيص

هذا المشروع مرخص تحت رخصة MIT - راجع ملف [LICENSE](LICENSE) للتفاصيل.

---

**Aldhahbi** - رؤيتنا هي تقديم أفضل حلول إدارة متاجر الجوالات في المملكة العربية السعودية.