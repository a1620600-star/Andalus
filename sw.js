// ثانوية الأندلس بترقش — Service Worker v8 (minimal)
// لا يعترض أي طلب — كل الطلبات تذهب للشبكة مباشرة
// يحذف جميع الكاشات القديمة عند التفعيل

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// لا يوجد fetch handler — المتصفح يتعامل مع الطلبات مباشرة
