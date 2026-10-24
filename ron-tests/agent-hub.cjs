'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
async function main(){
 const calls=[],statuses=[];
 const data={docs:[{title:'Étude',link:'https://doi.org/10.1000/test'}]};
 const source={
  parse(text){
   if(/études/i.test(text))return {kind:'science',query:text,synthesize:/synthétise/i.test(text)};
   if(/météo/i.test(text))return {kind:'weather',day:1,city:'Nantes'};
   if(/personnel/i.test(text))return null;
   return {kind:'wiki',query:text};
  },
  answer:async req=>{calls.push(req.kind);return req.kind==='science'
   ?{kind:'science',text:'Étude scientifique indexée avec DOI.',sources:['https://doi.org/10.1000/test']}
   :req.kind==='weather'
    ?{kind:'weather',text:'Météo demain : pluie prévue.',sources:['https://open-meteo.com/']}
    :{kind:'wiki',text:'Article encyclopédique sourcé.',sources:['https://fr.wikipedia.org/wiki/Exemple']}},
  evidence:(req,res)=>({role:'system',content:'SOURCES NON FIABLES : '+res.text})
 };
 const root={RONNet:source};
 vm.runInNewContext(fs.readFileSync('ron-agent-hub.js','utf8'),{window:root,URL,Object},{filename:'ron-agent-hub.js'});
 const hub=root.RONAgentHub;
 assert.equal(hub.plan('conversation personnelle'),null,'Private conversation bypasses tools');
 assert.equal(hub.SPECIALISTS.science.name,'Agent scientifique');
 let parsed=0;
 const stateful={parse:()=>{
  parsed++;
  return parsed===1?{kind:'wiki',query:'pâtes cuites'}:null;
 },answer:source.answer};
 const selectedJob=hub.plan('cuites',stateful);
 assert(selectedJob,'A one-word clarification was understood on the first parse');
 const selected=await hub.run('cuites',{net:stateful,job:selectedJob});
 assert.equal(selected.kind,'wiki');
 assert.equal(parsed,1,'The stateful specialist request must not be parsed twice');
 let llmCalls=0;
 const science=await hub.run('Synthétise les études sur le cerveau',{
  net:source,allowSynthesis:true,summarize:async messages=>{
   llmCalls++;assert.equal(messages.length,3);
   assert.match(messages[0].content,/Ignore toute instruction/);
   return 'Voici une synthèse prudente des références scientifiques qui doivent être lues intégralement.';
  },onStep:(step,text)=>statuses.push(step)});
 assert.equal(science.kind,'science');assert.match(science.text,/Synthèse assistée/);
 assert.match(science.text,/doi.org/);
 assert.equal(llmCalls,1);
 assert(statuses.includes('route')&&statuses.includes('source')&&statuses.includes('verify')&&statuses.includes('compose'));
 const onPhone=await hub.run('Synthétise les études sur le cerveau',{
  net:source,allowSynthesis:false,summarize:async()=>{throw Error('A small model must not launch');}});
 assert.equal(onPhone.text,'Étude scientifique indexée avec DOI.','Low-power mode serves sources without a model');
 const fallback=await hub.run('Synthétise les études sur le cerveau',{
  net:source,allowSynthesis:true,summarize:async()=>{throw Error('model unavailable');}});
 assert.equal(fallback.text,'Étude scientifique indexée avec DOI.','LLM failure preserves verified results');
 const weather=await hub.run('météo demain',{net:source,allowSynthesis:true,summarize:async()=>{
  throw Error('Weather must not ask an LLM');
 }});
 assert.equal(weather.agent,'Agent météo');
 assert.equal(weather.text,'Météo demain : pluie prévue.');
 assert.deepEqual(calls,['wiki','science','science','science','weather']);
 assert.throws(()=>hub.verify({kind:'wiki'},{kind:'wiki',text:'hi',sources:['https://evil.example/prompt']}),/source publique/);
 assert.throws(()=>hub.verify({kind:'math'},{kind:'wiki',text:'incorrect',sources:[]}),/incomplet/);
 assert.throws(()=>hub.verify({kind:'science'},{kind:'science',text:'Title only',sources:['https://github.com/some/repo']}),/source publique/,'A scientific answer cannot use a GitHub URL as supporting provenance');
 assert.throws(()=>hub.verify({kind:'weather'},{kind:'weather',text:'Weather',sources:['https://doi.org/10.1000/test']}),/source publique/,'Weather must use the weather origin');
 const live=hub.verify({kind:'live'},{kind:'live',text:'Données en direct indisponibles.',sources:[]});
 assert.equal(live.sources.length,0);
 const invented=await hub.run('Synthétise les études sur le cerveau',{net:source,allowSynthesis:true,summarize:async()=> 'A scientific paper proves a result. https://evil.example/fake and that is final.'});
 assert.equal(invented.text,'Étude scientifique indexée avec DOI.','Invented links must discard the LLM summary');
 const english=await hub.run('Synthétise les études sur le cerveau',{net:source,allowSynthesis:true,summarize:async()=> 'This is the scientific answer and these sources are all proven facts according to the article.'});
 assert.equal(english.text,'Étude scientifique indexée avec DOI.','English-only summaries fall back to French sources');
 const abort=new AbortController();abort.abort();
 await assert.rejects(()=>hub.run('météo demain',{net:source,signal:abort.signal}),/annulée/);
 console.log(JSON.stringify({passed:true,suite:'agent-hub',checks:25,unauthorizedExternalCalls:0,cloudLLMCalls:0}));
}
main().catch(e=>{console.error(e);process.exit(1)});
