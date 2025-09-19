# رفع المشروع على Render

## 🚀 خطوات رفع المشروع على Render

### 1. إنشاء حساب على Render
- اذهب إلى [render.com](https://render.com)
- سجل حساب جديد أو سجل دخول
- اربط حسابك مع GitHub

### 2. إنشاء مشروع جديد
- اضغط على "New +" في لوحة التحكم
- اختر "Web Service"
- اربط المستودع: `FLANsa/alsaqri-phones`

### 3. إعدادات المشروع
```
Name: alsaqri-phones
Environment: Python 3
Build Command: echo "No build required"
Start Command: python3 -m http.server $PORT
```

### 4. متغيرات البيئة
```
PORT: 8000 (سيتم تعيينه تلقائياً)
```

### 5. إعدادات متقدمة
- **Auto-Deploy**: Yes (للرفع التلقائي عند التحديث)
- **Branch**: main
- **Root Directory**: / (افتراضي)

### 6. الرفع
- اضغط "Create Web Service"
- انتظر حتى يكتمل البناء (2-3 دقائق)
- ستحصل على رابط المشروع

## 🔗 الرابط المتوقع
```
https://alsaqri-phones.onrender.com
```

## 📋 الملفات المطلوبة للرفع
- ✅ `package.json` - معلومات المشروع
- ✅ `render.yaml` - إعدادات Render
- ✅ `Procfile` - أوامر التشغيل
- ✅ `requirements.txt` - متطلبات Python
- ✅ `runtime.txt` - إصدار Python
- ✅ `start.sh` - سكريبت التشغيل
- ✅ `_redirects` - إعادة التوجيه

## 🛠️ استكشاف الأخطاء

### إذا فشل الرفع:
1. تحقق من أن جميع الملفات موجودة
2. تأكد من أن `start.sh` قابل للتنفيذ
3. تحقق من إعدادات Python في `runtime.txt`

### إذا لم يعمل الموقع:
1. تحقق من logs في Render Dashboard
2. تأكد من أن PORT متغير البيئة صحيح
3. تحقق من أن جميع الملفات HTML موجودة

## 📞 الدعم
- [Render Documentation](https://render.com/docs)
- [Render Community](https://community.render.com)

---
**الصقري للاتصالات** - نظام إدارة متجر الهواتف الذكية 🇸🇦
