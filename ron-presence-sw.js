'use strict';
const RELEASE='development';
const CACHE='ron-presence-shell-'+RELEASE;
const shell=['ron-presence.html','ron-angel.svg','ron-presence.webmanifest','ron-icon-192.png','ron-icon-512.png','ron-vendor/marked.js','ron-vendor/purify.min.js','ron-vendor/fuse.basic.min.js','ron-knowledge.js','ron-auto-config.js','ron-browser-ai.js','ron-cpu-worker.js','ron-net.js','ron-updater.js','ron-knowledge.css'].map(p=>new URL(p,self.location.href).href);
// An optional resource failure should not prevent the app from installing.
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 const results=await Promise.allSettled(shell.map(async url=>{
  const response=await fetch(url,{cache:'reload',credentials:'omit'});
  if(response.ok)await cache.put(url,response);
 }));
 if(results.every(x=>x.status==='rejected'))
  throw Error('RON cache installation impossible');
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ron-presence-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
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
