'use strict';
// Source and failure-mode tests: all network/LLM results are mocked.
// Deliberately does not claim live-provider or physical-device verification.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root={navigator:{onLine:true},fetch:async()=>{throw Error('Unexpected real network request');}};
const sandbox={window:root,URL,URLSearchParams,AbortController,setTimeout,clearTimeout,console};
for(const file of ['ron-net.js','ron-agent-hub.js'])
 vm.runInNewContext(fs.readFileSync(file,'utf8'),sandbox,{filename:file});
const net=root.RONNet,hub=root.RONAgentHub;
const checks=[];
async function check(label,fn){
 try{await fn();checks.push({id:label,status:'passed'});}
 catch(error){checks.push({id:label,status:'failed',reason:String(error.message||error).slice(0,180)});}
}
const fakeResponse=(status,body={})=>({ok:status>=200&&status<300,status,json:async()=>body});
async function main(){
 const wiki=net.parse('Qui est Marie Curie ?');
 await check('no-api-credentials',async()=>{
  let called=0;
  await assert.rejects(net.answer(wiki,{fetcher:async(url,opts)=>{
   called++;assert.equal(opts.method,'GET');
   assert.equal(opts.credentials,'omit');
   assert.equal(opts.redirect,'error');
   assert.equal(opts.cache,'no-store');
   return fakeResponse(503);
  }}),/HTTP 503/);
  assert.equal(called,1);
 });
 await check('rate-limit-429-abstains',async()=>{
  await assert.rejects(net.answer(wiki,{fetcher:async()=>fakeResponse(429)}),/HTTP 429/);
 });
 await check('empty-api-data-abstains',async()=>{
  await assert.rejects(net.answer(wiki,{fetcher:async()=>fakeResponse(200,{query:{pages:{}}})}),/Aucun résultat/);
 });
 await check('invalid-json-is-not-fabricated',async()=>{
  await assert.rejects(net.answer(wiki,{fetcher:async()=>({ok:true,status:200,json:async()=>{throw Error('invalid json');}})}),/invalid json/);
 });
 await check('offline-stays-local',async()=>{
  root.navigator.onLine=false;
  try{await assert.rejects(net.answer(wiki),/hors connexion/);}finally{root.navigator.onLine=true;}
 });
 await check('unsupported-live-never-queries-the-web',async()=>{
  const request=net.parse('Quelles sont les dernières nouvelles ?');
  let called=0;
  const r=await net.answer(request,{fetcher:async()=>{called++;throw Error('No');}});
  assert.equal(called,0);
  assert.match(r.text,/non vérifiée/);
  assert.equal(r.sources.length,0);
 });
 await check('aborted-queries-do-not-call-network',async()=>{
  const controller=new AbortController();controller.abort();
  let called=0;
  await assert.rejects(net.answer(wiki,{signal:controller.signal,fetcher:async()=>{called++;}}),/annulée/);
  assert.equal(called,0);
 });
 await check('host-lookalike-is-rejected',async()=>{
  assert.throws(()=>hub.verify({kind:'wiki'},{kind:'wiki',text:'Fait',sources:['https://fr.wikipedia.org.evil.invalid/wiki/Fake']}),/source publique/);
 });
 await check('mismatched-domain-is-rejected',async()=>{
  assert.throws(()=>hub.verify({kind:'science'},{kind:'science',text:'Étude',sources:['https://github.com/team/repo']}),/source publique/);
 });
 await check('token-in-citation-is-rejected',async()=>{
  assert.throws(()=>hub.verify({kind:'wiki'},{kind:'wiki',text:'Fait',sources:['https://fr.wikipedia.org/wiki/Test?token=leak']}),/source publique/);
 });
 await check('silent-failed-connector-is-not-a-valid-answer',async()=>{
  const source={parse:()=>({kind:'wiki',query:'x'}),answer:async()=>({kind:'wiki',text:'Fait non confirmé',sources:[]})};
  await assert.rejects(hub.run('Question',{net:source}),/source publique/);
 });
 await check('failure-of-one-agent-does-not-affect-local-chat',async()=>{
  const source={parse:text=>text==='privé'?null:{kind:'wiki',query:text},answer:async()=>{throw Error('API indisponible');}};
  await assert.rejects(hub.run('public',{net:source}),/API indisponible/);
  assert.equal(await hub.run('privé',{net:source}),null);
 });
 await check('llm-failure-falls-back-to-cited-source',async()=>{
  const source={parse:()=>({kind:'wiki',query:'science',synthesize:true}),
   answer:async()=>({kind:'wiki',text:'Extrait encyclopédique.',sources:['https://fr.wikipedia.org/wiki/Science']}),
   evidence:()=>({content:'Extrait non fiable'})};
  const r=await hub.run('Synthèse',{net:source,allowSynthesis:true,summarize:async()=>{throw Error('LLM 500');}});
  assert.equal(r.text,'Extrait encyclopédique.');
  assert.equal(r.sources.length,1);
 });
 await check('invented-llm-reference-does-not-appear',async()=>{
  const source={parse:()=>({kind:'wiki',query:'science',synthesize:true}),
   answer:async()=>({kind:'wiki',text:'Extrait encyclopédique.',sources:['https://fr.wikipedia.org/wiki/Science']}),
   evidence:()=>({content:'Extrait public'})};
  const r=await hub.run('Synthèse',{net:source,allowSynthesis:true,
   summarize:async()=> 'Selon une source imaginaire, c’est scientifiquement prouvé. https://evil.invalid/fausse-source'});
  assert.equal(r.text,'Extrait encyclopédique.');
  assert(!r.text.includes('evil.invalid'));
 });
 await check('math-is-local-and-rejects-division-by-zero',async()=>{
  let called=0;
  await assert.rejects(net.answer({kind:'math',expression:'12/(3-3)'},{fetcher:async()=>{called++;}}),/Division par zéro/);
  assert.equal(called,0);
 });
 const passed=checks.filter(x=>x.status==='passed').length;
 const report={schema_version:1,timestamp:new Date().toISOString(),mode:'mocked_failure_modes',
  total:checks.length,passed,failed:checks.length-passed,external_api_calls:0,
  actual_model_calls:0,device_tests:'not_tested',checks};
 fs.mkdirSync('ron-tests/reports',{recursive:true});
 fs.writeFileSync('ron-tests/reports/resilience-report.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({suite:'agent-resilience',passed,failed:report.failed,report:'ron-tests/reports/resilience-report.json'}));
 for(const item of checks.filter(x=>x.status==='failed'))console.error(JSON.stringify(item));
 if(report.failed)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
