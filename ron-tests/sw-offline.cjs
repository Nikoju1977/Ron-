'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');

const source=fs.readFileSync('ron-presence-sw.js','utf8');
const BASE='https://nikoju1977.github.io/Ron-/';
const CACHE='ron-presence-shell-development';

function harness(fail=[],nonOk=[]){
 const events={},stores=new Map(),requests=[];
 const skipped={count:0},claimed={count:0};
 let offline=false;
 const caches={
  open:async name=>{
   if(!stores.has(name))stores.set(name,new Map());
   return {
    put:async(url,response)=>stores.get(name).set(url,response),
    match:async url=>stores.get(name).get(url)
   };
  },
  keys:async()=>[...stores.keys()],
  delete:async name=>stores.delete(name)
 };
 const self={
  location:{href:BASE+'ron-presence-sw.js'},
  addEventListener:(event,fn)=>{events[event]=fn;},
  skipWaiting:async()=>{skipped.count++;},
  clients:{claim:async()=>{claimed.count++;}}
 };
 const fetch=async input=>{
  const url=typeof input==='string'?input:input.url;
  requests.push(url);
  const name=url.slice(url.lastIndexOf('/')+1);
  if(offline||fail.includes(name))throw Error('network down');
  const ok=!nonOk.includes(name);
  return {ok,status:ok?200:404,body:url,type:'basic',redirected:false,clone(){return this;}};
 };
 const Response=class{
  constructor(body,options){this.body=body;this.status=options.status;}
 };
 vm.runInNewContext(source,{self,caches,fetch,URL,AbortController,Response,setTimeout,clearTimeout},{filename:'ron-presence-sw.js'});
 async function fire(type,request){
  let task;
  const event={
   request,waitUntil:p=>{task=p;},respondWith:p=>{task=p;}
  };
  events[type](event);
  return task;
 }
 return {fire,caches,stores,requests,skipped,claimed,setOffline:v=>{offline=v;}};
}
async function main(){
 const ready=harness();
 await ready.fire('install');
 assert.equal(ready.skipped.count,1,'Complete shell may activate');
 const cache=ready.stores.get(CACHE);
 assert(cache.has(BASE+'ron-presence.html'));
 assert(cache.has(BASE+'ron-presence.webmanifest'));
 assert(cache.has(BASE+'ron-cpu-worker.js'));
 assert.equal(ready.requests.length,18,'All public shell assets are downloaded once');

 const old=new Map([['previous','usable']]);
 ready.stores.set('ron-presence-shell-older',old);
 await ready.fire('activate');
 assert.equal(ready.claimed.count,1);
 assert(!ready.stores.has('ron-presence-shell-older'),'Remove old release only on activate');
 assert(ready.stores.has(CACHE));

 ready.setOffline(true);
 const before=ready.requests.length;
 const cached=await ready.fire('fetch',{method:'GET',url:BASE+'ron-presence.html'});
 assert.equal(cached.status,200,'Offline requests reuse the complete shell');
 assert.equal(ready.requests.length,before,'Cached shell never requires the network');
 assert.equal(await ready.fire('fetch',{method:'GET',url:BASE+'api/private'}),undefined,'Never intercept private API calls');
 assert.equal(await ready.fire('fetch',{method:'POST',url:BASE+'ron-presence.html'}),undefined,'Never intercept mutations');
 assert.equal(await ready.fire('fetch',{method:'GET',url:BASE+'ron-presence.html?token=private'}),undefined,'Never cache query-bearing requests');
 assert.equal(cache.size,18,'Private data and query variants never enter the shell cache');

 const partial=harness(['ron-presence.html']);
 partial.stores.set('ron-presence-shell-older',old);
 await assert.rejects(partial.fire('install'),/ressources essentielles manquantes/);
 assert.equal(partial.skipped.count,0,'A partial shell must not activate');
 assert(!partial.stores.has(CACHE),'Discard partial cache after failed install');
 assert.strictEqual(partial.stores.get('ron-presence-shell-older'),old,'Preserve old offline release');

 const missing=harness([],['ron-vendor/marked.js']);
 await assert.rejects(missing.fire('install'),/ressources essentielles manquantes/,'HTTP 404 must fail installation');
 assert.equal(missing.skipped.count,0);

 const optional=harness(['ron-cpu-worker.js']);
 await optional.fire('install');
 assert.equal(optional.skipped.count,1,'Optional worker outage must not break install');
 assert(!optional.stores.get(CACHE).has(BASE+'ron-cpu-worker.js'));

 console.log(JSON.stringify({passed:true,suite:'sw-offline',checks:16,requiredAssets:17,optionalAssets:1}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
