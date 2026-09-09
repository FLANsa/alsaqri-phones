// طبقة البيانات الجديدة: الصفحات تتعامل معها بدل معرفة تفاصيل Firestore.
// المسار V2 لا يُفعّل للبيانات القديمة إلا بعد تشغيل أداة الترحيل الإدارية.
(function () {
  'use strict';
  const unavailable = () => { throw new Error('طبقة البيانات غير مهيأة'); };
  const repo = (page, one) => ({
    getPage: options => window.firebaseDatabase ? window.firebaseDatabase[page](options) : unavailable(),
    getById: id => window.firebaseDatabase ? window.firebaseDatabase[one](id) : unavailable()
  });
  window.dataRepositories = {
    phonesRepository: {
      ...repo('getPhonesPage', 'getPhoneByNumberQuery'),
      findByBarcode: value => window.firebaseDatabase?.getPhoneByNumberQuery(value) || unavailable()
    },
    accessoriesRepository: {
      ...repo('getAccessoriesPage', 'getAccessoryById'),
      findByBarcode: value => window.firebaseDatabase?.getAccessoryByBarcode(value) || unavailable()
    },
    salesRepository: {
      ...repo('getSalesPage', 'getSale'),
      getByDateRange: (from, to) => window.firebaseDatabase?.getSalesInRange(from, to) || unavailable()
    },
    maintenanceRepository: repo('getMaintenanceJobsPage', 'getMaintenanceJob'),
    reportsRepository: {
      getDailySummary: day => window.firebaseDatabase?.getSummary('daily_summaries', day) || unavailable(),
      getMonthlySummary: month => window.firebaseDatabase?.getSummary('monthly_summaries', month) || unavailable()
    }
  };
})();
