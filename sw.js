// 일잘러 노트 service worker: 앱 화면을 캐시해 두고, 항상 최신 버전을 먼저 시도해요.
const CACHE = 'iljalleo-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Supabase·구글 요청은 건드리지 않아요
  e.respondWith(fetch(e.request).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
});
// 서버(Supabase push-reminders)가 보낸 일정 알림: 앱을 닫아 둬도 떠요
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: e.data ? e.data.text() : '일정 알림' }; }
  e.waitUntil(self.registration.showNotification(d.title || '🔔 일정 알림', { body: d.body || '', tag: d.tag, icon: 'icon-192.png', badge: 'icon-192.png', requireInteraction: !!d.sticky, renotify: true, data: { date: d.date } }));
});
// 일정 알림을 누르면 열려 있는 일잘러 노트 창으로 돌아가요
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(cs => { const c = cs[0]; if(c) return c.focus(); return self.clients.openWindow('./#calendar'); }));
});
