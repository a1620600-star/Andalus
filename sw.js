// ثانوية الأندلس بترقش — Service Worker v6
// رُفع الإصدار لإجبار Chrome/Edge/Safari على مسح الكاش القديم
const CACHE_NAME = 'andalus-v6';
const BASE = self.registration.scope;

const CACHE_URLS = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'icons/icon-192.png',
  BASE + 'icons/icon-512.png'
];

// التثبيت — كل ملف يُخزَّن بشكل مستقل لتجنب فشل التثبيت بسبب ملف واحد
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // cache كل ملف بشكل مستقل — إذا فشل واحد لا يؤثر على الباقي
      return Promise.allSettled(
        CACHE_URLS.map(url =>
          fetch(url, { cache: 'no-store' })
            .then(response => {
              if (response && response.status === 200) {
                return cache.put(url, response);
              }
            })
            .catch(() => {}) // تجاهل أخطاء الشبكة لملفات الأيقونات
        )
      );
    }).then(() => self.skipWaiting()) // تفعيل فوري
  );
});

// التفعيل — حذف جميع النسخ القديمة (v1 إلى v5)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => {
        return self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
        });
      })
  );
});

// الاعتراض — network-first لـ HTML دائماً، كاش للباقي
self.addEventListener('fetch', event => {
  // تجاهل طلبات خارج نطاق الموقع (Firebase, CDN, إلخ)
  if (!event.request.url.startsWith(self.location.origin)) return;
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isHTML = url.pathname === '/' ||
                 url.pathname.endsWith('.html') ||
                 url.pathname.endsWith('/') ||
                 url.pathname === '/Andalus' ||
                 url.pathname === '/Andalus/';

  if (isHTML) {
    // index.html: شبكة أولاً دائماً لضمان أحدث نسخة في كل المتصفحات
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(BASE + 'index.html')
                      .then(cached => cached || caches.match(BASE))
        )
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
