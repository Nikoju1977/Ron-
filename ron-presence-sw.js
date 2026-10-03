'use strict';
const CACHE='ron-presence-shell-v1';
const shell=['ron-presence.html','ron-presence.webmanifest','ron-icon-192.png','ron-icon-512.png'].map(p=>new URL(p,self.location.href).href);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(shell))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ron-presence-shell-')&&k!==CACHE).map(k=>caches.delete(k))))));
// Exact public shell allowlist only: no API, conversation, audio or health-data caching.
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);url.search='';url.hash='';
 if(event.request.method!=='GET'||!shell.includes(url.href))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
  try{
   const response=await fetch(event.request,{signal:controller.signal});
   if(response.ok){await cache.put(url.href,response.clone());return response;}
   return await cache.match(url.href)||response;
  }catch(error){return await cache.match(url.href)||new Response('RON est indisponible hors connexion. Ouvre-le une première fois en ligne.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}
  finally{clearTimeout(timer);}
 })());
});
