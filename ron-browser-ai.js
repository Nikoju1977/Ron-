/* RON Browser AI — on-device, no account or API key.
   Chrome Prompt API (when preinstalled) or WebLLM via WebGPU.
   Model libraries/weights are fetched only after an explicit user question. */
(function(root){
'use strict';
const ENDPOINT='browser://local';
const NATIVE='chrome-native';
const QWEN='Qwen2.5-0.5B-Instruct-q4f16_1-MLC';
const SMOL='SmolLM2-360M-Instruct-q4f32_1-MLC';
const MODEL_IDS=new Set([NATIVE,QWEN,SMOL]);
const LANGUAGE_OPTIONS={expectedInputs:[{type:'text',languages:['fr','en']}],expectedOutputs:[{type:'text',languages:['fr']}]};
const MODULE_URL='https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/+esm';
let engine=null,loadedModel='',loading=null;
const bounded=(promise,ms)=>Promise.race([Promise.resolve(promise).catch(()=>null),new Promise(resolve=>setTimeout(()=>resolve(null),ms))]);
function textMessage(messages){
 return messages.slice(-12).map(m=>(m.role==='system'?'Consignes':m.role==='assistant'?'RON':'Utilisateur')+': '+String(m.content||'').slice(0,2900)).join('\n\n').slice(-12000)+'\n\nRON:';
}
async function detect(env=root){
 const modelAPI=env.LanguageModel;
 if(modelAPI && typeof modelAPI.availability==='function'){
  const available=await bounded(modelAPI.availability(LANGUAGE_OPTIONS),1700);
  if(available==='available')return {kind:'native',model:NATIVE,ready:true};
 }
 const nav=env.navigator;
 if(!nav?.gpu||typeof nav.gpu.requestAdapter!=='function'||!env.isSecureContext)return null;
 const adapter=await bounded(nav.gpu.requestAdapter({powerPreference:'low-power'}),1900);
 if(!adapter)return null;
 const memory=Number(nav.deviceMemory)||0;
 if(memory && memory<2)return null;
 const model=memory>=4 ? QWEN : SMOL;
 return {kind:'webgpu',model,ready:false,download:true};
}
function progress(message,update){
 if(typeof update==='function')update(message);
}
async function getEngine(model,update){
 if(engine&&loadedModel===model)return engine;
 if(loading)return loading;
 loading=(async()=>{
  if(!root.navigator?.gpu)throw Error('WebGPU indisponible : impossible de calculer ce modèle sur cet appareil.');
  progress('Préparation du moteur IA dans ce navigateur…',update);
  let lib;
  try{lib=await import(MODULE_URL);}catch(error){throw Error('Impossible de télécharger le moteur libre WebLLM. Connexion Internet nécessaire pour le premier chargement.');}
  if(!lib.prebuiltAppConfig?.model_list?.some(x=>x.model_id===model))throw Error('Le modèle choisi n’est pas fourni par cette version de WebLLM.');
  progress('Téléchargement initial du modèle sur cet appareil (plusieurs centaines de Mo, puis mise en cache)…',update);
  try{
   const e=await lib.CreateMLCEngine(model,{initProgressCallback:r=>{
    if(r?.text)progress('IA locale : '+String(r.text).slice(0,145),update);
   }},{context_window_size:2048});
   engine=e;loadedModel=model;return e;
  }catch(error){throw Error('Le modèle local n’a pas pu démarrer (mémoire GPU, stockage ou téléchargement insuffisants). '+String(error.message||error).slice(0,160));}
 })().finally(()=>{loading=null;});
 return loading;
}
async function generate(messages,model,update){
 if(!MODEL_IDS.has(model))throw Error('Modèle de navigateur non autorisé.');
 if(model===NATIVE){
  if(typeof root.LanguageModel?.create!=='function')throw Error('IA intégrée au navigateur indisponible.');
  let availability;
  try{availability=await root.LanguageModel.availability(LANGUAGE_OPTIONS);}catch(e){availability='unavailable';}
  if(availability!=='available')throw Error('Modèle intégré non téléchargé : Chrome peut demander une activation ou un téléchargement initial.');
  progress('RON réfléchit dans le navigateur…',update);
  const session=await root.LanguageModel.create(LANGUAGE_OPTIONS);
  try{
   const response=await session.prompt(textMessage(messages));
   if(!String(response||'').trim())throw Error('Le navigateur a produit une réponse vide.');
   return String(response).trim();
  }finally{try{session.destroy?.();}catch(e){}}
 }
 const e=await getEngine(model,update);
 progress('RON calcule sa réponse sur cet appareil…',update);
 const limited=messages.slice(-9).map(m=>({role:m.role,content:String(m.content||'').slice(0,1900)}));
 const result=await e.chat.completions.create({messages:limited,max_tokens:420,temperature:0.5,stream:false});
 const value=result?.choices?.[0]?.message?.content;
 if(!String(value||'').trim())throw Error('Le modèle local a renvoyé une réponse vide.');
 return String(value).trim();
}
root.RONBrowserAI={ENDPOINT,NATIVE,QWEN,SMOL,MODEL_IDS,detect,generate};
})(window);
