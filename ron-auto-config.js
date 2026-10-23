/* RON Auto — zero-cost local engine discovery and deterministic model selection.
   Scans loopback only, never cloud providers or remote-network hosts. */
(function(root){
'use strict';
const ENGINES=[
 {provider:'ollama',endpoint:'http://localhost:11434/v1',priority:0},
 {provider:'lmstudio',endpoint:'http://localhost:1234/v1',priority:1},
 {provider:'vllm',endpoint:'http://localhost:8000/v1',priority:2}
];
const BAD_MODEL=/(?:embed|embedding|rerank|whisper|transcrib|moderation|speech|audio|tts|ocr|vision-encoder)/i;
const MODEL_ID=/^[\w./:+-]{1,180}$/;
function modelSize(id){
 const m=String(id||'').match(/(?:^|[^\d])(\d+(?:\.\d+)?)b(?:[^a-z]|$)/i);
 return m?Number(m[1]):null;
}
function modelPreference(id,hints={}){
 const n=String(id||'').toLowerCase();
 const size=modelSize(n);
 const ram=Number(hints.memory);
 const cores=Number(hints.cores);
 const max=Number.isFinite(ram)&&ram>0?(ram<=4?2.5:ram<=8?5:ram<=16?9:16):Number.isFinite(cores)&&cores>0&&cores<=4?3:5;
 let score=0;
 if(/qwen3[.]5/.test(n))score+=100;
 else if(/qwen3/.test(n))score+=88;
 else if(/gemma3/.test(n))score+=77;
 else if(/llama3[.]?[23]/.test(n))score+=70;
 else if(/phi[34]/.test(n))score+=64;
 else if(/mistral/.test(n))score+=60;
 else score+=42;
 if(size!==null){
  score+=Math.min(size,9)*3;
  if(size>max)score-=35+Math.min(90,(size-max)*8);
  else if(size>=2)score+=16;
  if(size<1)score-=16;
 }
 if(/:latest$/.test(n))score-=5;
 if(/instruct|chat/.test(n))score+=3;
 return score;
}
function rankModels(raw,hints={}){
 const ids=new Set();
 const models=(Array.isArray(raw)?raw:[]).map(m=>typeof m==='string'?m:m&&m.id)
  .filter(id=>typeof id==='string'&&MODEL_ID.test(id)&&!BAD_MODEL.test(id)&&!ids.has(id)&&!!ids.add(id));
 return models.sort((a,b)=>modelPreference(b,hints)-modelPreference(a,hints)||a.localeCompare(b));
}
function loopback(url){
 try{const u=new URL(url);
 return u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)&&!u.username&&!u.password&&!u.search&&!u.hash;
 }catch(e){return false;}
}
async function probeOne(engine,fetcher,timeoutMs=2200,hints={}){
 const endpoint=engine.endpoint.replace(/\/+$/,'');
 if(!loopback(endpoint))throw new Error('RON refuse la recherche automatique hors localhost.');
 const controller=new AbortController();
 const t=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const r=await fetcher(endpoint+'/models',{method:'GET',credentials:'omit',cache:'no-store',signal:controller.signal});
  if(!r.ok)return {engine:engine.provider,endpoint,status:'unreachable',models:[]};
  const data=await r.json();
  const models=rankModels(data&&data.data,hints);
  return {engine:engine.provider,endpoint,status:models.length?'ready':'empty',models};
 }catch(e){return {engine:engine.provider,endpoint,status:'unreachable',models:[]};}
 finally{clearTimeout(t);}
}
async function discover(opts={}){
 const fetcher=opts.fetcher||root.fetch.bind(root);
 const engines=opts.engines||ENGINES;
 const hints=opts.hints||{};
 // No cloud, private LAN discovery, API keys, or remote services.
 const approved=engines.filter(x=>loopback(x.endpoint));
 const checked=await Promise.all(approved.map(e=>probeOne(e,fetcher,opts.timeoutMs||2200,hints)));
 const usable=checked.filter(x=>x.status==='ready');
 const selected=usable.length?(usable.find(x=>x.engine==='ollama')||usable[0]):null;
 return {status:selected?'ready':checked.some(x=>x.status==='empty')?'no-model':'unavailable',
  checked,selected:selected?{provider:selected.engine,endpoint:selected.endpoint,model:selected.models[0],
    reason:'Modèle local téléchargé et annoncé par le serveur (test de génération non effectué).'}:null};
}
root.RONAutoEngine={ENGINES,modelSize,modelPreference,rankModels,loopback,probeOne,discover};
})(window);
