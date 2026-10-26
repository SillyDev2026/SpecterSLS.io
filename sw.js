/* Offline shell only. Model downloads require a connection. */
const CACHE="spectersls-v2.5.1-shell";
const ASSETS=["./","./index.html","./styles.css","./spiritbox.css","./responsive.css","./figure.css","./dotengine.js","./figureengine.js","./app.js","./spiritbox.js","./depth.html","./depth.js","./manifest.webmanifest","./icon.svg","./icon-192.png"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener("fetch",event=>{const req=event.request;if(req.method!=="GET")return;const url=new URL(req.url);if(url.origin!==location.origin)return;event.respondWith(fetch(req).then(response=>{if(response.ok&&/\.(?:js|css|svg|png|webmanifest|html)$/.test(url.pathname)){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(req,copy)).catch(()=>{});}return response;}).catch(()=>caches.match(req).then(cached=>cached||caches.match("./index.html"))));});
