'use strict';
const RELEASE='development';
const CACHE='ron-presence-shell-'+RELEASE;
// A release is ready for offline use only when its essential assets are cached.
// Optional capabilities must not make an otherwise complete PWA unusable.
const requiredPaths=[
 'ron-presence.html','ron-angel.svg','ron-presence.webmanifest',
 'ron-icon-192.png','ron-icon-512.png',
 'ron-vendor/marked.js','ron-vendor/purify.min.js','ron-vendor/fuse.basic.min.js',
 'ron-knowledge.js','ron-auto-config.js','ron-browser-ai.js','ron-net.js',
 'ron-food.js','ron-agent-hub.js','ron-autonomy.js','ron-updater.js',
 'ron-knowledge.css'
];
const optionalPaths=['ron-cpu-worker.js'];
const urlFor=path=>new URL(path,self.location.href).href;
const required=requiredPaths.map(urlFor),optional=optionalPaths.map(urlFor);
const shell=[...required,...optional];

async function prefetch(cache,url){
 const response=await fetch(url,{cache:'reload',credentials:'omit'});
 if(!response.ok||response.type==='opaque'||response.redirected)
  throw Error('Asset RON indisponible : '+new URL(url).pathname);
 await cache.put(url,response);
}

self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 // Wait for every write to settle before removing an incomplete release.
 const results=await Promise.allSettled(required.map(url=>prefetch(cache,url)));
 if(results.some(result=>result.status!=='fulfilled')){
  await caches.delete(CACHE);
  throw Error('RON : installation annulée, ressources essentielles manquantes');
 }
 await Promise.allSettled(optional.map(url=>prefetch(cache,url)));
 // Only activate after the new offline shell has been fully validated.
 await self.skipWaiting();
})()));

self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const keys=await caches.keys();
 await Promise.all(keys.filter(key=>key.startsWith('ron-presence-shell-')&&key!==CACHE).map(key=>caches.delete(key)));
 await self.clients.claim();
})()));

// Cache only exact, public, same-origin static assets. Never cache API responses,
// chat history, model credentials, audio, health records or query-string variants.
// Cache-first keeps a released shell consistent even during a new deployment.
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.search||url.hash||!shell.includes(url.href))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const cached=await cache.match(url.href);
  if(cached)return cached;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
  try{
   const response=await fetch(event.request,{signal:controller.signal});
   if(response.ok&&!response.redirected&&response.type!=='opaque')
    await cache.put(url.href,response.clone());
   return response;
  }catch(error){
   return new Response('RON est indisponible hors connexion. Ouvre-le une première fois en ligne.',
    {status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  }finally{clearTimeout(timer);}
 })());
});
