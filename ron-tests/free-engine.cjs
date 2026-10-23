'use strict';
const {JSDOM,VirtualConsole}=require('jsdom');
const {indexedDB}=require('fake-indexeddb');
const fs=require('node:fs'),assert=require('node:assert/strict');
const errors=[],calls=[];
const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(fs.readFileSync('ron-presence.html','utf8'),{
 url:'http://localhost/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,
 beforeParse(w){
  w.indexedDB=indexedDB;w.matchMedia=()=>({matches:false});w.isSecureContext=true;w.AudioContext=undefined;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
  w.HTMLDialogElement.prototype.close=function(){this.open=false};
  w.SpeechRecognition=class{start(){}stop(){}abort(){}};
  w.navigator.mediaDevices={getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})};
  w.navigator.permissions={query:async()=>({state:'granted'})};
  w.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
  w.speechSynthesis={getVoices:()=>[],speak:u=>setTimeout(()=>u.onend?.(),1),cancel(){}};
 }
});
const w=dom.window,d=w.document,E=s=>w.eval(s),wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await wait(20);}throw Error('Timed out');}
async function main(){
 await until(()=>d.getElementById('state').textContent!=='Initialisation…');
 assert.equal(E('cfg.provider'),'ollama','New installation defaults to no-fee local inference');
 assert.equal(E('cfg.model'),'qwen3.5:4b');
 assert.equal(E('cfg.agentMode'),'agentic');
 assert.equal(E('cfg.noPaid'),true);
 assert.equal(d.getElementById('noPaidChk').checked,true);
 assert.equal(E('requestBody([],false).model'),'qwen3.5:4b');
 assert.throws(()=>E("enforceNoPaid('mistral','https://api.mistral.ai/v1','mistral-large-latest')"),/zéro euro/);
 assert.throws(()=>E("enforceNoPaid('openrouter','https://openrouter.ai/api/v1','paid-model')"),/zéro euro/);
 assert.doesNotThrow(()=>E("enforceNoPaid('openrouter','https://openrouter.ai/api/v1','openrouter/free')"));
 assert.doesNotThrow(()=>E("enforceNoPaid('openrouter','https://openrouter.ai/api/v1','qwen/example:free')"));
 assert.throws(()=>E("enforceNoPaid('custom','https://example.net/v1','some-model')"),/zéro euro/);
 // Unsaved UI edits must never change active request cost protection.
 d.getElementById('noPaidChk').checked=false;
 E("cfg.provider='mistral';cfg.endpoint='https://api.mistral.ai/v1';cfg.model='mistral-large-latest'");
 assert.throws(()=>E('requestBody([],false)'),/zéro euro/);
 d.getElementById('noPaidChk').checked=true;
 w.fetch=async(url,options)=>{
  calls.push({url:String(url),options});
  if(String(url).endsWith('/models'))return {status:200,ok:true,headers:{get:()=>null},json:async()=>({data:[{id:'qwen3.5:2b'},{id:'qwen3.5:4b'},{id:'other-model'}]})};
  if(String(url).endsWith('/chat/completions'))return {status:200,ok:true,headers:{get:()=>null},json:async()=>({choices:[{message:{content:'PLAN EXPERT OK'}}]})};
  throw Error('Unexpected URL '+url);
 };
 await E('activateFreeOllama()');
 assert.equal(d.getElementById('providerSel').value,'ollama');
 assert.equal(d.getElementById('modelIn').value,'qwen3.5:4b');
 assert.equal(d.getElementById('agentSel').value,'agentic');
 assert.equal(d.getElementById('keyIn').value,'');
 assert.equal(d.getElementById('rememberChk').checked,false);
 assert.match(d.getElementById('freeEngineStatus').textContent,/Ollama détecté/);
 assert(calls.every(x=>x.url.startsWith('http://localhost:11434/v1')),'Ollama probe only uses local API');
 // Agent chain: planner, expert and adversarial reviewer on complex requests.
 E("cfg.provider='ollama';cfg.endpoint='http://localhost:11434/v1';cfg.model='qwen3.5:4b';cfg.agentMode='agentic';RATE_PROFILES.eco.minGap=0;");
 const before=calls.length;
 const context=await E("buildAgentContext('Analyse approfondie de ce projet de cinéma et identifie les erreurs de conception',turnId)");
 assert.match(context.extra,/PLAN:/);
 assert.match(context.extra,/BROUILLON EXPERT:/);
 assert.match(context.extra,/AUDIT DU VÉRIFICATEUR:/);
 assert.equal(calls.length-before,3,'Planner, expert and verifier are distinct completion calls');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,suite:'free-engine',checks:17,simulatedLocalCalls:calls.length}));
 w.close();
}
main().catch(error=>{console.error(error);w.close();process.exit(1)});
