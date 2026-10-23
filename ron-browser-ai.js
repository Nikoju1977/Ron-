/* RON Browser AI — no API key, local-only inference.
   Chrome native, WebLLM (GPU), or Transformers.js/ONNX Runtime (CPU/WebAssembly).
   No model download, background generation, or paid API during startup. */
(function(root){
'use strict';
const ENDPOINT='browser://local';
const NATIVE='chrome-native';
const QWEN='Qwen2.5-0.5B-Instruct-q4f16_1-MLC';
const SMOL='SmolLM2-360M-Instruct-q4f32_1-MLC';
const CPU='smollm2-135m-cpu';
const MODEL_IDS=new Set([NATIVE,QWEN,SMOL,CPU]);
const LANGUAGE_OPTIONS={expectedInputs:[{type:'text',languages:['fr','en']}],expectedOutputs:[{type:'text',languages:['fr']}]};
const MODULE_URL='https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/+esm';
let engine=null,loadedModel='',loading=null,failedLargeModel=false,failedGPU=false;
const bounded=(promise,ms)=>Promise.race([Promise.resolve(promise).catch(()=>null),new Promise(resolve=>setTimeout(()=>resolve(null),ms))]);
function textMessage(messages){
 return messages.slice(-12).map(m=>(m.role==='system'?'Consignes':m.role==='assistant'?'RON':'Utilisateur')+': '+String(m.content||'').slice(0,2900)).join('\n\n').slice(-12000)+'\n\nRON:';
}
async function detect(env=root){
 const modelAPI=env.LanguageModel;
 if(modelAPI && typeof modelAPI.availability==='function'){
  const available=await bounded(modelAPI.availability(LANGUAGE_OPTIONS),1700);
  if(available==='available')return {kind:'native',model:NATIVE,ready:true};
  // Native AI may be installable after a user gesture; never download on page boot.
  if(available==='downloadable'||available==='downloading')
   return {kind:'native',model:NATIVE,ready:false,download:true};
 }
 const nav=env.navigator;
 if(!env.isSecureContext)return null;
 const wasmOK=!!env.WebAssembly && typeof env.WebAssembly.instantiate==='function';
 // Mobile WebGPU adapters can be present but not support generation (Android GPU/driver).
 // Prefer a much smaller CPU model rather than downloading two unusable GPU models.
 const mobile=/Android|iPhone|iPad|iPod/i.test(String(nav?.userAgent||''));
 if(mobile&&wasmOK)return {kind:'cpu',model:CPU,ready:false,download:true};
 if(!nav?.gpu||typeof nav.gpu.requestAdapter!=='function')
  return wasmOK?{kind:'cpu',model:CPU,ready:false,download:true}:null;
 const adapter=await bounded(nav.gpu.requestAdapter({powerPreference:'low-power'}),1900);
 if(!adapter)return wasmOK?{kind:'cpu',model:CPU,ready:false,download:true}:null;
 const memory=Number(nav.deviceMemory)||0;
 if(memory && memory<2)return wasmOK?{kind:'cpu',model:CPU,ready:false,download:true}:null;
 // Qwen's q4f16 GPU shader requires shader-f16, which is absent on some phones.
 // Unknown RAM -> start with the smaller ~580 MB VRAM model.
 const f16=!!adapter.features?.has?.('shader-f16');
 const model=memory>=4 && f16 ? QWEN : SMOL;
 return {kind:'webgpu',model,ready:false,download:true};
}
function progress(message,update){
 if(typeof update==='function')update(message);
}
async function getEngine(model,update){
 if(engine&&(loadedModel===model||(model===QWEN&&failedLargeModel&&loadedModel===SMOL)))return engine;
 if(loading)return loading;
 loading=(async()=>{
  if(!root.navigator?.gpu)throw Error('WebGPU indisponible : impossible de calculer ce modèle sur cet appareil.');
  progress('Préparation du moteur IA dans ce navigateur…',update);
  let lib;
  try{lib=await import(MODULE_URL);}catch(error){throw Error('Impossible de télécharger le moteur libre WebLLM. Connexion Internet nécessaire pour le premier chargement.');}
  if(!lib.prebuiltAppConfig?.model_list?.some(x=>x.model_id===model))throw Error('Le modèle choisi n’est pas fourni par cette version de WebLLM.');
  progress('Téléchargement initial du modèle sur cet appareil (plusieurs centaines de Mo, puis mise en cache)…',update);
  const build=async chosen=>{
   const e=await lib.CreateMLCEngine(chosen,{initProgressCallback:r=>{
    if(r?.text)progress('IA locale : '+String(r.text).slice(0,145),update);
   }},{context_window_size:2048});
   engine=e;loadedModel=chosen;return e;
  };
  try{return await build(model===QWEN&&failedLargeModel?SMOL:model);}
  catch(error){
   if(model===QWEN && lib.prebuiltAppConfig.model_list.some(x=>x.model_id===SMOL)){
    failedLargeModel=true;
    progress('Le modèle principal a échoué. RON essaie un modèle plus léger, toujours sans clé…',update);
    try{return await build(SMOL);}catch(other){error=other;}
   }
   throw Error('Le modèle local n’a pas pu démarrer (mémoire GPU, stockage ou téléchargement insuffisants). '+String(error.message||error).slice(0,160));
  }
 })().finally(()=>{loading=null;});
 return loading;
}
/* CPU inference runs off the UI thread: even ONNX/WASM initialization can
   block Android Chrome's event loop when executed in the page. */
let cpuWorker=null,cpuPending=null,cpuSequence=0;
const CPU_PREP_TIMEOUT_MS=210000,CPU_GENERATE_TIMEOUT_MS=90000;
function cancelCPU(){
 const running=cpuPending;cpuPending=null;
 if(cpuWorker){cpuWorker.terminate();cpuWorker=null;}
 if(running){clearTimeout(running.timeout);clearInterval(running.pulse);running.reject(Error('abort'));}
}
function runCPUWorker(messages,update){
 if(typeof root.Worker!=='function')
  return Promise.reject(Error('Ce navigateur ne peut pas lancer l’IA CPU en tâche séparée. Mets Chrome à jour.'));
 if(cpuPending)cancelCPU();
 const id=++cpuSequence;
 let worker;
 try{worker=cpuWorker||new root.Worker(new URL('./ron-cpu-worker.js',root.location.href),{type:'module'});cpuWorker=worker;}
 catch(error){return Promise.reject(Error('Impossible de lancer le calcul CPU séparé : '+String(error.message||error).slice(0,100)));}
 return new Promise((resolve,reject)=>{
  let stage='loading',since=Date.now();
  const pending={reject,timeout:null,pulse:null};
  cpuPending=pending;
  const finish=(error,answer)=>{
   if(cpuPending!==pending)return;
   cpuPending=null;clearTimeout(pending.timeout);clearInterval(pending.pulse);
   if(error){if(cpuWorker===worker){worker.terminate();cpuWorker=null;}reject(error);}
   else resolve(answer);
  };
  const arm=ms=>{
   clearTimeout(pending.timeout);
   pending.timeout=setTimeout(()=>{
    finish(Error(stage==='generating'
     ? 'Calcul CPU trop long sur ce téléphone. RON a arrêté le modèle. Ton message est conservé.'
     : 'Chargement du modèle CPU trop long (ou mémoire insuffisante). RON a interrompu le calcul. Ton message est conservé.'));
   },ms);
  };
  arm(CPU_PREP_TIMEOUT_MS);
  pending.pulse=setInterval(()=>{
   const secs=Math.round((Date.now()-since)/1000);
   progress(stage==='generating'
    ? 'IA CPU en cours depuis '+secs+' s. Le modèle est lent ; Arrêter reste disponible.'
    : 'IA CPU : préparation en cours ('+secs+' s). L’interface reste utilisable ; tu peux arrêter.',update);
  },15000);
  worker.onmessage=e=>{
   const data=e.data||{};if(cpuPending!==pending||data.id!==id)return;
   if(data.type==='progress'){
    if(data.phase==='generating'&&stage!=='generating'){stage='generating';since=Date.now();arm(CPU_GENERATE_TIMEOUT_MS);}
    progress(String(data.text||'IA CPU en cours…').slice(0,200),update);
   }else if(data.type==='done'){finish(null,String(data.answer||''));}
   else if(data.type==='error'){finish(Error('IA CPU indisponible : '+String(data.message||'erreur inconnue').slice(0,220)));}
  };
  worker.onerror=e=>{e.preventDefault?.();finish(Error('Le moteur CPU a rencontré une erreur dans sa tâche séparée. Vérifie Chrome, le stockage et la mémoire.'));};
  worker.onmessageerror=()=>finish(Error('Le moteur CPU n’a pas pu transmettre sa réponse.'));
  progress('RON lance une IA sur le processeur, sans bloquer l’écran…',update);
  try{worker.postMessage({id,messages});}
  catch(error){finish(Error('Impossible de transmettre ta question au moteur CPU.'));}
 });
}
async function generateCPU(messages,update,loader){
 if(!loader)return runCPUWorker(messages,update);
 // Injectable in tests only; real use never executes ONNX on the UI thread.
 const pipe=await loader();
 const compact=messages.slice(-5).map(m=>({role:m.role,content:String(m.content||'').slice(0,m.role==='system'?650:900)}));
 const output=await pipe(compact,{max_new_tokens:48,do_sample:false});
 const value=output?.[0]?.generated_text;
 const answer=Array.isArray(value)?value.slice().reverse().find(m=>m.role==='assistant')?.content
   :typeof value==='string'?value:'';
 if(!String(answer||'').trim())throw Error('Le petit modèle CPU n’a pas produit de réponse. Réessaie avec une question courte.');
 return String(answer).trim();
}
async function generate(messages,model,update,testing={}){
 if(!MODEL_IDS.has(model))throw Error('Modèle de navigateur non autorisé.');
 if(model===CPU)return generateCPU(messages,update,testing.loadCPU);
 if(failedGPU&&model!==NATIVE)return generateCPU(messages,update,testing.loadCPU);
 if(model===NATIVE){
  if(typeof root.LanguageModel?.create!=='function')throw Error('IA intégrée au navigateur indisponible.');
  let availability;
  try{availability=await root.LanguageModel.availability(LANGUAGE_OPTIONS);}catch(e){availability='unavailable';}
  if(!['available','downloadable','downloading'].includes(availability))
   throw Error('L’IA native Chrome est indisponible sur cet appareil.');
  if(availability!=='available')progress('Chrome prépare son modèle local après ton message (téléchargement possible)…',update);
  else progress('RON réfléchit dans le navigateur…',update);
  const session=await root.LanguageModel.create({
   ...LANGUAGE_OPTIONS,
   monitor:availability==='available'?undefined:m=>{m.addEventListener?.('downloadprogress',e=>{
    progress('Téléchargement IA Chrome : '+Math.round((e.loaded||0)*100)+' %',update);
   });}
  });
  try{
   const response=await session.prompt(textMessage(messages));
   if(!String(response||'').trim())throw Error('Le navigateur a produit une réponse vide.');
   return String(response).trim();
  }finally{try{session.destroy?.();}catch(e){}}
 }
 try{
  const e=testing.loadGPU?await testing.loadGPU():await getEngine(model,update);
  progress('RON calcule sa réponse sur cet appareil…',update);
  const limited=messages.slice(-9).map(m=>({role:m.role,content:String(m.content||'').slice(0,1900)}));
  const result=await e.chat.completions.create({messages:limited,max_tokens:420,temperature:0.5,stream:false});
  const value=result?.choices?.[0]?.message?.content;
  if(!String(value||'').trim())throw Error('Le modèle GPU n’a pas renvoyé de réponse.');
  return String(value).trim();
 }catch(gpuError){
  failedGPU=true;
  if(typeof root.WebAssembly?.instantiate!=='function')
   throw Error('Ce navigateur ne peut utiliser ni le GPU ni le calcul CPU WebAssembly. Ouvre RON dans Chrome à jour.');
  progress('GPU incompatible. RON passe au modèle CPU sans GPU et sans clé (téléchargement initial)…',update);
  try{return await generateCPU(messages,update,testing.loadCPU);}
  catch(cpuError){throw Error('GPU incompatible et secours CPU indisponible. '+String(cpuError?.message||cpuError).slice(0,170));}
 }
}
root.RONBrowserAI={ENDPOINT,NATIVE,QWEN,SMOL,CPU,MODEL_IDS,detect,generate,cancel:cancelCPU};
})(window);
