/* RON release updater — same-origin, read-only manifest.
   Automatically installs published, CI-built app updates, not third-party code.
   Never reloads while a draft, active session, or conversation is present. */
(function(root){
'use strict';
const INTERVAL=30*60*1000;
const VERSION_RE=/^[0-9a-f]{40}$/i;
let current='',pending='',running=false,started=false,reloadInFlight=false;
let autoSafe=()=>false;
const get=id=>root.document?.getElementById(id);
function validRelease(value){return VERSION_RE.test(String(value||''));}
function show(){
 const banner=get('updateBanner');
 if(!banner)return;
 banner.hidden=!pending;
 const label=get('updateText');
 if(label&&pending)label.textContent='Correctif RON publié et vérifié. Une mise à jour est disponible ('+pending.slice(0,7)+').';
}
async function check(fetcher){
 if(running || !validRelease(current)||!root.navigator?.onLine)return false;
 if(!/^https?:$/.test(root.location?.protocol||''))return false;
 running=true;
 try{
  // Same-origin release manifest, only minted by the GitHub Pages build.
  const u=new URL('./ron-version.json',root.location.href);
  if(u.origin!==root.location.origin)throw Error('Origine de mise à jour invalide');
  u.searchParams.set('check',String(Date.now()));
  const res=await (fetcher||root.fetch.bind(root))(u.href,{method:'GET',cache:'no-store',credentials:'same-origin',redirect:'error'});
  if(!res?.ok)return false;
  const release=(await res.json())?.version;
  if(!validRelease(release) || release===current)return false;
  pending=release;
  show();
  // Ask the PWA to install the reviewed update; no eval/import of the manifest.
  await root.navigator.serviceWorker?.getRegistration?.('./ron-presence.html')
   .then(reg=>reg?.update?.()).catch(()=>{});
  if(autoSafe() && !root.document?.hidden)void apply(true);
  return true;
 }catch(error){
  // Network failure is not an app failure; keep existing local files intact.
  return false;
 }finally{running=false;}
}
async function apply(automatic=false){
 if(!validRelease(pending)||reloadInFlight)return false;
 if(automatic&&!autoSafe())return false;
 // If a newer script is served before its Pages release is live, never force
 // an active conversation to reload. Manual choice may explicitly interrupt.
 reloadInFlight=true;
 const button=get('updateApplyBtn');
 if(button)button.disabled=true;
 try{
  const marker='ron-applied-'+pending;
  try{
   if(root.sessionStorage?.getItem(marker)==='1'){reloadInFlight=false;return false;}
   root.sessionStorage?.setItem(marker,'1');
  }catch(e){}
  try{const reg=await root.navigator.serviceWorker?.getRegistration?.('./ron-presence.html');await reg?.update?.();}catch(e){}
  root.location.reload();
  return true;
 }catch(e){
  reloadInFlight=false;
  if(button)button.disabled=false;
  return false;
 }
}
function start(options={}){
 if(started)return;
 started=true;
 current=get('ronRelease')?.content || root.document?.querySelector?.('meta[name="ron-release"]')?.content || '';
 autoSafe=typeof options.canReload==='function'?options.canReload:()=>false;
 get('updateApplyBtn')?.addEventListener('click',()=>{void apply(false);});
 get('updateLaterBtn')?.addEventListener('click',()=>{
  // Don't throw away an update; re-offer it on the next new visit.
  pending='';show();
 });
 if(!validRelease(current)||!root.navigator?.serviceWorker)return;
 root.addEventListener?.('online',()=>{void check();});
 root.document?.addEventListener?.('visibilitychange',()=>{
  if(!root.document.hidden)void check();
 });
 root.navigator.serviceWorker.addEventListener?.('controllerchange',()=>{void check();});
 root.setTimeout?.(()=>{void check();},2000);
 root.setInterval?.(()=>{void check();},INTERVAL);
}
root.RONUpdater={start,check,apply,getState:()=>({current,pending,running}),validRelease};
})(window);
