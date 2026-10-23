/* RON CPU inference worker. Local user text stays on device; only public runtime
   and model weights are downloaded. Blocking ONNX work never runs on the UI thread. */
'use strict';
const MODULE='https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/+esm';
const MODEL='onnx-community/SmolLM2-135M-Instruct-ONNX-GQA';
let pipelineInstance=null, loading=null;
function progress(id,text,phase='loading'){
 self.postMessage({id,type:'progress',phase,text});
}
async function getPipeline(id){
 if(pipelineInstance)return pipelineInstance;
 if(loading)return loading;
 loading=(async()=>{
  progress(id,'Chargement du moteur CPU (WebAssembly), sans GPU…');
  const lib=await import(MODULE);
  if(typeof lib.pipeline!=='function')throw Error('Le moteur CPU téléchargé est incomplet.');
  if(lib.env?.backends?.onnx?.wasm)lib.env.backends.onnx.wasm.numThreads=1;
  progress(id,'Préparation du modèle local sur le processeur (peut prendre du temps)…');
  const candidate=await lib.pipeline('text-generation',MODEL,{
   device:'wasm',dtype:'q8',
   progress_callback:event=>{
    if(event?.status==='progress'&&Number.isFinite(event.progress)){
     const pct=Math.min(100,Math.max(0,Math.floor(event.progress)));
     progress(id,pct>=100
      ? 'Fichier du modèle reçu à 100 %. Préparation en mémoire en cours…'
      : 'Téléchargement IA CPU : '+pct+' %');
    }else if(event?.status==='initiate'){
     progress(id,'IA CPU : récupération ou préparation des fichiers du modèle…');
    }else if(event?.status==='done'){
     progress(id,'IA CPU : fichier reçu, initialisation du moteur…');
    }
   }
  });
  pipelineInstance=candidate;return candidate;
 })().finally(()=>{loading=null});
 return loading;
}
self.addEventListener('message',async e=>{
 const {id,messages}=e.data||{};
 if(!Number.isSafeInteger(id)||!Array.isArray(messages))return;
 try{
  const pipe=await getPipeline(id);
  progress(id,'Modèle chargé. RON calcule une réponse courte sur le processeur…','generating');
  const compact=messages.slice(-4).map(m=>({
   role:['system','user','assistant'].includes(m.role)?m.role:'user',
   content:String(m.content||'').slice(0,m.role==='system'?260:520)
  }));
  const result=await pipe(compact,{max_new_tokens:48,do_sample:false});
  const value=result?.[0]?.generated_text;
  const answer=Array.isArray(value)?value.slice().reverse().find(m=>m?.role==='assistant')?.content
   :typeof value==='string'?value:'';
  if(!String(answer||'').trim())throw Error('Le modèle CPU n’a pas généré de réponse. Essaie une question courte.');
  self.postMessage({id,type:'done',answer:String(answer).trim().slice(0,2500)});
 }catch(error){
  self.postMessage({id,type:'error',message:String(error?.message||error||'Échec du moteur CPU').slice(0,240)});
 }
});
