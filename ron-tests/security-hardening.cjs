'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const base={navigator:{onLine:true},fetch:async()=>{throw Error('Unexpected outbound request');}};
vm.runInNewContext(fs.readFileSync('ron-net.js','utf8'),{
 window:base,URL,URLSearchParams,AbortController,TextDecoder,TextEncoder,setTimeout,clearTimeout,console
},{filename:'ron-net.js'});
vm.runInNewContext(fs.readFileSync('ron-agent-hub.js','utf8'),{
 window:base,URL,Object,AbortController,console
},{filename:'ron-agent-hub.js'});
const checks=[];
const run=async(label,fn)=>{try{await fn();checks.push({label,status:'passed'});}
 catch(error){checks.push({label,status:'failed',error:String(error.message||error).slice(0,200)});}};
const wiki=base.RONNet.parse('Qui est Marie Curie ?');
function streamResponse(chunks,headers={}){
 let i=0,cancelled=false;
 return {
  ok:true,status:200,
  headers:{get:key=>headers[key.toLowerCase()]??null},
  body:{getReader:()=>({
   read:async()=>i<chunks.length?{done:false,value:chunks[i++]}:{done:true},
   cancel:async()=>{cancelled=true;},
   releaseLock:()=>{}
  })},
  get cancelled(){return cancelled;}
 };
}
function validWiki(){
 return {query:{pages:{1:{title:'Marie Curie',extract:'Physicienne et chimiste.',index:0}}}};
}
async function main(){
 const source=JSON.stringify(validWiki());
 await run('valid-streamed-JSON',async()=>{
  const bytes=new TextEncoder().encode(source);
  const response=streamResponse([bytes.slice(0,8),bytes.slice(8)]);
  const result=await base.RONNet.answer(wiki,{fetcher:async(url,opts)=>{
   assert.equal(opts.credentials,'omit');
   assert.equal(opts.redirect,'error');
   assert.equal(opts.cache,'no-store');
   return response;
  }});
  assert.equal(result.kind,'wiki');
  assert(result.sources[0].includes('Marie_Curie'));
 });
 await run('oversized-content-length-rejected-before-reading',async()=>{
  const response=streamResponse([new TextEncoder().encode(source)],{'content-length':String(3*1024*1024)});
  let reads=0;
  response.body.getReader=()=>{reads++;throw Error('Must not read body');};
  await assert.rejects(base.RONNet.answer(wiki,{fetcher:async()=>response}),/trop volumineuse/);
  assert.equal(reads,0);
 });
 await run('oversized-stream-is-cancelled',async()=>{
  const chunk=new Uint8Array(1024*1024+1);
  const response=streamResponse([chunk,chunk]);
  await assert.rejects(base.RONNet.answer(wiki,{fetcher:async()=>response}),/trop volumineuse/);
  assert.equal(response.cancelled,true);
 });
 await run('invalid-streamed-JSON-fails-closed',async()=>{
  await assert.rejects(base.RONNet.answer(wiki,{fetcher:async()=>streamResponse([new TextEncoder().encode('{not json')])}),/JSON/);
 });
 await run('aborted-public-request-does-not-contact-API',async()=>{
  const ctrl=new AbortController();ctrl.abort();let calls=0;
  await assert.rejects(base.RONNet.answer(wiki,{signal:ctrl.signal,fetcher:async()=>{calls++;}}),/annulée/);
  assert.equal(calls,0);
 });
 await run('caller-abort-signal-cannot-be-replaced',async()=>{
  const caller=new AbortController(),ignored=new AbortController();
  const network={
   parse:()=>({kind:'wiki',query:'Marie Curie'}),
   answer:async(request,opts)=>{
    assert.strictEqual(opts.signal,caller.signal);
    return {kind:'wiki',text:'Article.',sources:['https://fr.wikipedia.org/wiki/Marie_Curie']};
   }
  };
  const result=await base.RONAgentHub.run('public',{net:network,signal:caller.signal,connectorOptions:{signal:ignored.signal}});
  assert.equal(result.kind,'wiki');
 });
 await run('abort-during-synthesis-never-delivers-stale-result',async()=>{
  const caller=new AbortController();
  const net={
   parse:()=>({kind:'wiki',query:'Marie Curie',synthesize:true}),
   answer:async()=>({kind:'wiki',text:'Extrait public.',sources:['https://fr.wikipedia.org/wiki/Marie_Curie']}),
   evidence:()=>({content:'Données non fiables en lecture seule'})
  };
  await assert.rejects(base.RONAgentHub.run('public',{
   net,signal:caller.signal,allowSynthesis:true,
   summarize:async()=>{caller.abort();return 'Résumé interrompu, ne doit pas apparaître.';}
  }),/annulée/);
 });
 await run('no-network-for-private-routing',async()=>{
  assert.equal(base.RONNet.parse('Température de mon enfant'),null);
  assert.equal(base.RONNet.parse('Météo pour mes résultats médicaux'),null);
 });
 await run('domain-lookalike-cannot-cite-source',async()=>{
  assert.throws(()=>base.RONAgentHub.verify({kind:'wiki'},{
   kind:'wiki',text:'Fait',sources:['https://fr.wikipedia.org.attacker.invalid/wiki/X']
  }),/source publique/);
 });
 const passed=checks.filter(x=>x.status==='passed').length;
 const report={schema_version:1,kind:'mocked_security_regression',timestamp:new Date().toISOString(),
  passed,failed:checks.length-passed,total:checks.length,real_api_tests:false,device_tests:false,checks};
 fs.mkdirSync('ron-tests/reports',{recursive:true});
 fs.writeFileSync('ron-tests/reports/security-hardening.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({suite:'security-hardening',passed,failed:report.failed,total:report.total}));
 for(const c of checks.filter(x=>x.status==='failed'))console.error(JSON.stringify(c));
 if(report.failed)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
