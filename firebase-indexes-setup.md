# إعداد فهارس Firebase Firestore

## المشكلة
يظهر خطأ: "The query requires an index" عند تحميل البيانات في صفحة الحسابات.

## الحل
يجب إنشاء فهارس (indexes) في Firebase Console لاستعلامات معقدة.

## خطوات إنشاء الفهارس

### 1. افتح Firebase Console
- اذهب إلى: https://console.firebase.google.com/
- اختر المشروع: `phone-store-demo`

### 2. انتقل إلى Firestore Database
- من القائمة الجانبية، اختر "Firestore Database"
- اختر تبويب "Indexes"

### 3. إنشاء الفهارس المطلوبة

#### فهرس 1: maintenanceJobs - status + visitDate
```
Collection: maintenanceJobs
Fields:
- status: Ascending
- visitDate: Descending
```

#### فهرس 2: maintenanceJobs - repId + visitDate
```
Collection: maintenanceJobs
Fields:
- repId: Ascending
- visitDate: Descending
```

#### فهرس 3: maintenanceJobs - techId + visitDate
```
Collection: maintenanceJobs
Fields:
- techId: Ascending
- visitDate: Descending
```

#### فهرس 4: maintenanceJobs - status + repId + visitDate
```
Collection: maintenanceJobs
Fields:
- status: Ascending
- repId: Ascending
- visitDate: Descending
```

#### فهرس 5: maintenanceJobs - status + techId + visitDate
```
Collection: maintenanceJobs
Fields:
- status: Ascending
- techId: Ascending
- visitDate: Descending
```

#### فهرس 6: payments - paymentDate
```
Collection: payments
Fields:
- paymentDate: Descending
```

#### فهرس 7: payments - entityType + paymentDate
```
Collection: payments
Fields:
- entityType: Ascending
- paymentDate: Descending
```

#### فهرس 8: payments - entityId + paymentDate
```
Collection: payments
Fields:
- entityId: Ascending
- paymentDate: Descending
```

#### فهرس 9: reps - active + name
```
Collection: reps
Fields:
- active: Ascending
- name: Ascending
```

#### فهرس 10: technicians - active + name
```
Collection: technicians
Fields:
- active: Ascending
- name: Ascending
```

## طريقة سريعة (استخدام Firebase CLI)

إذا كان لديك Firebase CLI مثبت:

```bash
# تأكد من أنك في مجلد المشروع
cd /path/to/phone-store-demo

# سجل دخول إلى Firebase
firebase login

# استخدم المشروع الصحيح
firebase use phone-store-demo

# نشر الفهارس
firebase deploy --only firestore:indexes
```

## ملاحظات مهمة

1. **وقت الإنشاء**: قد يستغرق إنشاء الفهارس عدة دقائق
2. **الترتيب مهم**: يجب أن تكون الحقول بنفس الترتيب المحدد
3. **الاختبار**: بعد إنشاء الفهارس، اختبر صفحة الحسابات مرة أخرى
4. **المراقبة**: راقب استخدام الفهارس في تبويب "Usage" في Firebase Console

## التحقق من نجاح الإعداد

بعد إنشاء الفهارس:
1. افتح صفحة الحسابات
2. تأكد من عدم ظهور رسالة الخطأ
3. تحقق من تحميل البيانات بنجاح
4. راقب console.log للتأكد من عدم وجود أخطاء

## استكشاف الأخطاء

إذا استمر الخطأ:
1. تأكد من أن الفهارس تم إنشاؤها بنجاح
2. تحقق من أن أسماء المجموعات صحيحة
3. تأكد من أن أسماء الحقول مطابقة تماماً
4. انتظر بضع دقائق بعد إنشاء الفهارس
