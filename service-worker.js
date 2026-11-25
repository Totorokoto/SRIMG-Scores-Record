const CACHE_NAME='sri-master-guide-v7-offline-announcements';
const SDK='https://www.gstatic.com/firebasejs/11.10.0/';
const FILES=['./','./index.html','./style.css','./script.js','./cloud-integration.js','./manifest.json','./club-logo.png','./icon-192.png','./icon-512.png',...['firebase-app.js','firebase-auth.js','firebase-firestore.js'].map(x=>SDK+x)];
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE_NAME);await cache.addAll(FILES.map(x=>new Request(new URL(x,self.registration.scope),{cache:'reload'})));await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 await Promise.all((await caches.keys()).filter(k=>k.startsWith('sri-master-guide-')&&k!==CACHE_NAME).map(k=>caches.delete(k)));await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);if(req.method!=='GET')return;
 const sdk=url.href.startsWith(SDK)&&url.pathname.endsWith('.js');
 const local=url.origin===self.location.origin&&url.href.startsWith(self.registration.scope);
 if(!sdk&&!local)return;
 event.respondWith((async()=>{
 const cache=await caches.open(CACHE_NAME);
 if(sdk){const saved=await cache.match(req);if(saved)return saved;const response=await fetch(req);if(response.ok)await cache.put(req,response.clone());return response;}
 try{const response=await fetch(req);if(response.ok&&FILES.some(x=>new URL(x,self.registration.scope).href===url.href))await cache.put(req,response.clone());return response;}
 catch(e){const saved=await cache.match(req);if(saved)return saved;if(req.mode==='navigate'){const page=await cache.match(new URL('index.html',self.registration.scope));if(page)return page;}return Response.error();}
 })());
});
