# حل مشكلة فهارس Firestore

## المشكلة
عند فتح صفحة حسابات الصيانة (`maintenance-accounts.html`)، يظهر خطأ:
```
FirebaseError: The query requires an index
```

## السبب
الاستعلام يجمع بين:
- `where('status', '==', 'done')` - equality query
- `where('visitDate', '>=', dateFrom)` - range query
- `where('visitDate', '<=', dateTo)` - range query

هذا يتطلب فهرس مركب في Firestore.

## الحل المطبق

### 1. الفهرس موجود بالفعل
الفهرس المطلوب موجود في `firestore.indexes.json`:
```json
{
  "collectionGroup": "maintenanceJobs",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "visitDate", "order": "DESCENDING" },
    { "fieldPath": "__name__", "order": "ASCENDING" }
  ]
}
```

### 2. حل بديل في الكود
تم إضافة حل بديل في `getMaintenanceJobs`:
- إذا فشل الاستعلام بسبب عدم وجود فهرس، يتم استخدام حل بديل
- الحل البديل: جلب جميع الوظائف بالحالة المطلوبة ثم تصفية يدوياً حسب النطاق الزمني
- هذا يضمن عمل النظام حتى لو لم يكتمل الفهرس بعد

### 3. نشر الفهارس
لنشر الفهارس إلى Firebase:
```bash
firebase use aldhahbi-7a93b
firebase deploy --only firestore:indexes
```

## ملاحظات مهمة

1. **وقت الإنشاء**: قد يستغرق إنشاء الفهارس عدة دقائق
2. **الحل البديل**: الكود الآن يعمل حتى لو لم يكتمل الفهرس بعد
3. **الأداء**: الحل البديل يعمل بشكل جيد مع كمية معقولة من البيانات
4. **التحسين**: بعد اكتمال الفهرس، سيستخدم الكود الاستعلام الأسرع تلقائياً

## التحقق من الحل

1. افتح صفحة `maintenance-accounts.html`
2. تأكد من عدم ظهور رسالة الخطأ
3. تحقق من تحميل البيانات بنجاح
4. راقب console.log - إذا رأيت "Index not ready, using fallback query method"، فهذا يعني أن الحل البديل يعمل

## حالات الاستخدام

- ✅ **إذا كان الفهرس جاهزاً**: يستخدم الاستعلام الأمثل مع الفهرس
- ✅ **إذا لم يكتمل الفهرس بعد**: يستخدم الحل البديل تلقائياً
- ✅ **إذا لم يكن هناك date range**: يستخدم استعلام بسيط بدون فهرس معقد

