'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const source=fs.readFileSync('ron-updater.js','utf8');
const oldSha='1'.repeat(40),nextSha='2'.repeat(40);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(canReload,version=nextSha){
 const attrs=new Map(),handlers=new Map(),calls=[];
 for(const id of ['ronRelease','updateBanner','updateText','updateApplyBtn','updateLaterBtn'])
  attrs.set(id,{content:id==='ronRelease'?oldSha:'',textContent:'',hidden:true,disabled:false,
   addEventListener(event,fn){handlers.set(id+':'+event,fn);}});
 const document={
  hidden:false,getElementById:id=>attrs.get(id),
  querySelector:()=>attrs.get('ronRelease'),
  addEventListener:(event,fn)=>handlers.set('doc:'+event,fn)
 };
 const store=new Map();
 const serviceWorker={
  getRegistration:async scope=>{
   assert.equal(scope,'./ron-presence.html');
   return {update:async()=>{calls.push('sw.update')}};
  },
  addEventListener:(event,fn)=>handlers.set('sw:'+event,fn)
 };
 const root={
  document,navigator:{onLine:true,serviceWorker},
  location:{href:'https://nikoju1977.github.io/Ron-/ron-presence.html',
   origin:'https://nikoju1977.github.io',protocol:'https:',
   reload:()=>calls.push('reload')},
  sessionStorage:{getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)},
  fetch:async(url,opts)=>{
   calls.push('fetch');
   const u=new URL(url);
   assert.equal(u.origin,root.location.origin,'Updater is same-origin only');
   assert.equal(u.pathname,'/Ron-/ron-version.json');
   assert.equal(opts.method,'GET');
   assert.equal(opts.cache,'no-store');
   assert.equal(opts.credentials,'same-origin');
   return {ok:true,json:async()=>({version})};
  },
  addEventListener:(event,fn)=>handlers.set('window:'+event,fn),
  setTimeout:()=>0,setInterval:()=>0
 };
 vm.runInNewContext(source,{window:root,URL,Date,console},{filename:'ron-updater.js'});
 root.RONUpdater.start({canReload});
 return {root,attrs,handlers,calls,store};
}
async function main(){
 const busy=setup(()=>false);
 const found=await busy.root.RONUpdater.check();
 assert.equal(found,true);
 assert.equal(busy.attrs.get('updateBanner').hidden,false,'Update banner appears');
 assert.equal(busy.calls.includes('reload'),false,'Active conversation must never auto reload');
 assert(busy.calls.includes('sw.update'),'Updates must go through the reviewed same-origin service worker');
 await busy.root.RONUpdater.apply(false);
 assert.equal(busy.calls.filter(x=>x==='reload').length,1,'User can choose to update');
 await busy.root.RONUpdater.apply(false);
 assert.equal(busy.calls.filter(x=>x==='reload').length,1,'No duplicate reload');
 const idle=setup(()=>true);
 assert.equal(await idle.root.RONUpdater.check(),true);
 await tick();
 assert.equal(idle.calls.includes('reload'),true,'Safe idle session automatically installs new release');
 const invalid=setup(()=>true,'not-a-valid-release');
 assert.equal(await invalid.root.RONUpdater.check(),false);
 assert.equal(invalid.calls.includes('reload'),false,'Reject malformed or unsigned release identifier');
 const current=setup(()=>true,oldSha);
 assert.equal(await current.root.RONUpdater.check(),false,'Do not update when already current');
 const offline=setup(()=>true);
 offline.root.navigator.onLine=false;
 assert.equal(await offline.root.RONUpdater.check(),false);
 assert.equal(offline.calls.includes('fetch'),false,'No network fetch while offline');
 const draft=setup(()=>false);
 await draft.root.RONUpdater.check();
 assert.equal(draft.attrs.get('updateBanner').hidden,false);
 draft.handlers.get('updateLaterBtn:click')();
 assert.equal(draft.attrs.get('updateBanner').hidden,true,'Defer update without losing drafts');
 assert.equal(draft.calls.includes('reload'),false);
 console.log(JSON.stringify({passed:true,suite:'updater',checks:18,sameOriginOnly:true,uninterruptedConversation:true}));
}
main().catch(e=>{console.error(e);process.exit(1)});
