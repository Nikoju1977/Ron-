'use strict';
// Deterministic benchmark of RON's public-source router, not an LLM evaluation.
// Versioned fixtures; all outputs labelled simulated, no real API or private data.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {performance}=require('node:perf_hooks');
const root={navigator:{onLine:true},fetch:()=>{throw Error('Unexpected outbound request in deterministic benchmark');}};
const context={window:root,URL,URLSearchParams,AbortController,setTimeout,clearTimeout,console};
for(const file of ['ron-net.js','ron-agent-hub.js']){
 vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
}
const fixture=JSON.parse(fs.readFileSync('ron-tests/routing-cases.json','utf8'));
if(fixture.schema_version!==1||!Array.isArray(fixture.scenarios)||fixture.scenarios.length<30)
 throw Error('At least 30 versioned cases are required.');
const seen=new Set();
const results=[];
for(const test of fixture.scenarios){
 if(!test.id||seen.has(test.id)||typeof test.prompt!=='string')throw Error('Invalid/duplicate fixture '+test.id);
 seen.add(test.id);
 const start=performance.now();
 let actual=null,passed=true,detail='';
 try{
  const decision=root.RONAgentHub.plan(test.prompt);
  actual=decision?.request?.kind||null;
  if(actual!==test.expected){passed=false;detail='wrong_route';}
  else if(decision){
   for(const key of ['city','day','query','repo','synthesize']){
    if(Object.hasOwn(test,key)&&decision.request[key]!==test[key]){passed=false;detail='wrong_'+key;break;}
   }
  }
 }catch(error){passed=false;detail='parser_exception: '+String(error.message||error).slice(0,90);}
 results.push({
  id:test.id,expected:test.expected??'local',actual:actual??'local',
  status:passed?'passed':'failed',reason:passed?null:detail,
  latency_ms:Number((performance.now()-start).toFixed(3))
 });
}
const correct=results.filter(x=>x.status==='passed').length;
const local=results.filter(x=>x.expected==='local');
const privacy=local.filter(x=>x.id.startsWith('P'));
const localCorrect=privacy.filter(x=>x.actual==='local').length;
const groups={};
for(const item of results){
 const g=groups[item.expected]||{total:0,passed:0,failed:0};
 g.total++;
 item.status==='passed'?g.passed++:g.failed++;
 groups[item.expected]=g;
}
const report={
 schema_version:1,mode:'deterministic_router_fixture',
 description:'Rules, source selection, query extraction and privacy routing only. No live APIs, model outputs, or device tests.',
 timestamp:new Date().toISOString(),
 commit:/^[a-f0-9]{40}$/i.test(process.env.GITHUB_SHA||'')?process.env.GITHUB_SHA:'local-unknown',
 total:results.length,passed:correct,failed:results.length-correct,
 routing_accuracy:correct/results.length,
 local_cases:local.length,local_privacy_cases:privacy.length,local_preserved:localCorrect,
 external_api_calls:0,
 untested:['real API availability and factual accuracy','LLM answer quality and hallucinations','physical Android and iOS microphone/PWA behaviour'],
 breakdown:groups,results
};
const dest=path.resolve('ron-tests/reports/routing-report.json');
fs.mkdirSync(path.dirname(dest),{recursive:true});
fs.writeFileSync(dest,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({suite:'routing-eval',status:report.failed?'failed':'passed',total:report.total,passed:report.passed,failed:report.failed,routing_accuracy:report.routing_accuracy,local_preserved:report.local_preserved,privacy_total:report.local_privacy_cases,report:'ron-tests/reports/routing-report.json'}));
for(const bad of results.filter(x=>x.status==='failed'))console.error(JSON.stringify(bad));
if(report.failed)process.exitCode=1;
