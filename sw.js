// ثانوية الأندلس بترقش — Service Worker
const CACHE_NAME = 'andalus-v4';
const BASE = self.registration.scope;

const CACHE_URLS = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'icons/icon-192.png',
  BASE + 'icons/icon-512.png'
];

// التثبيت — تخزين الملفات وتفعيل فوري
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting()) // تفعيل فوري دون انتظار إغلاق التابات القديمة
  );
});

// التفعيل — حذف الكاش القديم، السيطرة على جميع التابات، إخطارها بالتحديث
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim()) // استلام السيطرة على جميع التابات فوراً
      .then(() => {
        // إخطار جميع التابات المفتوحة بأن نسخة جديدة جاهزة
        return self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
        });
      })
  );
});

// الاعتراض — network-first لـ index.html دائماً، كاش للباقي
self.addEventListener('fetch', event => {
  if (!event.request.url.startsWith(self.location.origin)) return;
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isHTML = url.pathname === '/' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');

  if (isHTML) {
    // index.html: شبكة أولاً دائماً لضمان أحدث نسخة
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match(BASE)))
    );
  } else {
    // الملفات الأخرى: كاش أولاً مع تحديث في الخلفية
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => null);
        return cached || fetchPromise;
      })
    );
  }
});
