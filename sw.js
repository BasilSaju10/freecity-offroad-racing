self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(url.origin===self.location.origin&&url.searchParams.has('v')&&(url.pathname.includes('/assets/')||url.pathname.endsWith('/app.bundle.js')))event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request)));});
