'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom');
const {indexedDB}=require('fake-indexeddb');
const lib=fs.readFileSync('ron-auto-config.js','utf8');
const html=fs.readFileSync('ron-presence.html','utf8').replace('<script src="./ron-auto-config.js"></script>','<script>'+lib+'</script>');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){
 for(let i=0;i<170;i++){if(fn())return;await wait(15);}
 throw Error('Timed out waiting for automatic engine configuration');
}
function build(fetcher){
 const errors=[],urls=[];
 const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(html,{url:'https://nikoju1977.github.io/Ron-/ron-presence.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.indexedDB=indexedDB;w.matchMedia=()=>({matches:false});
  w.isSecureContext=true;w.AudioContext=undefined;w.navigator.deviceMemory=4;w.navigator.hardwareConcurrency=4;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.SpeechRecognition=class{start(){}stop(){}abort(){}};
  w.navigator.mediaDevices={getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})};
  w.navigator.permissions={query:async()=>({state:'granted'})};
  w.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
  w.speechSynthesis={getVoices:()=>[],speak:u=>setTimeout(()=>u.onend?.(),1),cancel(){}};
  w.fetch=(url,options)=>{urls.push({url:String(url),options});return fetcher(String(url),options);};
 }});
 return {dom,window:dom.window,urls,errors};
}
const reply=(data)=>({ok:true,status:200,json:async()=>({data})});
async function main(){
 {
  const x=build(async url=>{
   if(url==='http://localhost:11434/v1/models')return reply([{id:'nomic-embed-text'},{id:'qwen3.5:4b'},{id:'qwen3.5:2b'}]);
   if(url==='http://localhost:1234/v1/models')return reply([{id:'local-model'}]);
   throw Error('unavailable');
  });
  const {window:w,dom,urls,errors}=x,E=s=>w.eval(s),$=id=>w.document.getElementById(id);
  await until(()=>E("cfg.model==='qwen3.5:2b'")&&$('autoEngineStatus').dataset.ready==='true');
  assert.equal(E('cfg.provider'),'ollama');
  assert.equal(E('cfg.agentMode'),'agentic');
  assert.equal(E('cfg.noPaid'),true);
  assert.equal(E('cfg.autoEngine'),true);
  assert.equal($('modelIn').value,'qwen3.5:2b','4 GB device hint chooses smaller installed model');
  assert.match($('autoEngineStatus').textContent,/aucune dépense API/);
  assert.equal(urls.length,3);
  assert(urls.every(x=>x.url.startsWith('http://localhost:')&&x.url.endsWith('/v1/models')));
  assert(urls.every(x=>x.options.credentials==='omit'&&!x.options.headers));
  assert.equal(E("RONAutoEngine.rankModels(['qwen3.5:2b','qwen3.5:4b'],{memory:8})[0]"),'qwen3.5:4b');
  assert.equal(E("RONAutoEngine.rankModels(['nomic-embed-text','qwen3.5:2b'],{memory:4}).length"),1);
  assert.equal(E("RONAutoEngine.loopback('https://api.mistral.ai/v1')"),false);
  assert.deepEqual(errors,[]);
  dom.window.close();
 }
 {
  const x=build(async url=>url.includes(':11434')?reply([{id:'nomic-embed-text'}]):Promise.reject(Error('missing')));
  const {window:w,dom,errors}=x;
  await until(()=>w.document.getElementById('autoEngineStatus').textContent.includes('aucun modèle conversationnel'));
  assert.equal(w.eval('cfg.provider'),'ollama','No invalid server automatically selected');
  assert.equal(w.document.getElementById('autoEngineStatus').dataset.ready,'false');
  assert.equal(w.document.getElementById('autoEngineChk').checked,true);
  assert.deepEqual(errors,[]);
  dom.window.close();
 }
 {
  let release;
  const blocked=new Promise(resolve=>release=resolve);
  const x=build(async url=>{await blocked;return reply([{id:'qwen3.5:4b'}]);});
  const {window:w,dom}=x,$=id=>w.document.getElementById(id);
  await until(()=>w.document.getElementById('state').textContent!=='Initialisation…');
  $('providerSel').value='groq';
  await w.eval('switchEngineDraft()');
  release();
  await wait(90);
  assert.equal($('providerSel').value,'groq','User manual choice must win over outdated scan');
  dom.window.close();
 }
 console.log(JSON.stringify({passed:true,suite:'auto-config',scenarios:3,checks:19,noPaidCloudCalls:true}));
}
main().catch(error=>{console.error(error);process.exit(1)});
