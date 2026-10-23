'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM,VirtualConsole}=require('jsdom');
const {indexedDB}=require('fake-indexeddb');
const browser=fs.readFileSync('ron-browser-ai.js','utf8');
const autoconfig=fs.readFileSync('ron-auto-config.js','utf8');
const html=fs.readFileSync('ron-presence.html','utf8')
 .replace('<script src="./ron-auto-config.js"></script>','<script>'+autoconfig+'</script>')
 .replace('<script src="./ron-browser-ai.js"></script>','<script>'+browser+'</script>');
const wait=ms=>new Promise(done=>setTimeout(done,ms));
async function until(check,limit=4500){const since=Date.now();while(Date.now()-since<limit){if(check())return;await wait(25);}throw Error('No-key browser startup did not complete.');}
async function main(){
 const exceptions=[],calls=[];let prompts=0,destroyed=0;
 const vc=new VirtualConsole();vc.on('jsdomError',error=>exceptions.push(error.message));
 const dom=new JSDOM(html,{url:'https://nikoju1977.github.io/Ron-/ron-presence.html',
 runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.indexedDB=indexedDB;w.matchMedia=()=>({matches:false});
  w.isSecureContext=true;w.AudioContext=undefined;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.SpeechRecognition=class{start(){}stop(){}abort(){}};
  w.navigator.mediaDevices={getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})};
  w.navigator.permissions={query:async()=>({state:'prompt'})};
  w.SpeechSynthesisUtterance=class{constructor(s){this.text=s;}};
  w.speechSynthesis={getVoices:()=>[],speak:s=>setTimeout(()=>s.onend?.(),1),cancel(){}};
  w.LanguageModel={availability:async opts=>{
   assert(opts.expectedOutputs[0].languages.includes('fr'));return 'available';},
   create:async()=>({prompt:async text=>{prompts++;assert(text.includes('Bonjour RON'));return 'Bonjour, bienvenue !';},destroy(){destroyed++;}})
  };
  w.fetch=(url,options)=>{calls.push(String(url));return Promise.reject(Error('No localhost model'));};
 }});
 const d=dom.window.document;
 await until(()=>d.getElementById('autoEngineStatus').dataset.ready==='true'&&dom.window.eval("cfg.provider==='browser'"));
 assert.equal(dom.window.eval('cfg.model'),'chrome-native');
 assert.equal(dom.window.eval('cfg.key'),'');
 assert.equal(dom.window.eval('cfg.noPaid'),true);
 assert.equal(dom.window.eval('cfg.agentMode'),'direct');
 assert.equal(d.getElementById('providerSel').value,'browser');
 assert.equal(d.getElementById('keyIn').disabled,true);
 assert.equal(calls.length,3,'Only loopback probing allowed, never paid cloud endpoints');
 d.getElementById('textIn').value='Bonjour RON';
 d.getElementById('sendBtn').click();
 await until(()=>d.getElementById('ronLine').textContent.includes('Bonjour, bienvenue !'));
 assert.equal(prompts,1);
 assert.equal(destroyed,1);
 assert.deepEqual(exceptions,[]);
 // The detector must reject unsupported browsers without GPU or native API.
 const mock={navigator:{},isSecureContext:true};
 assert.equal(await dom.window.RONBrowserAI.detect(mock),null);
 const gpuMock={navigator:{gpu:{requestAdapter:async()=>({features:new Set(['shader-f16'])})},deviceMemory:4},isSecureContext:true};
 const detected=await dom.window.RONBrowserAI.detect(gpuMock);
 assert.equal(detected.kind,'webgpu');
 assert.equal(detected.model,dom.window.RONBrowserAI.QWEN);
 assert.equal(detected.ready,false,'Model download is not falsely advertised as ready');
 const missingF16={navigator:{gpu:{requestAdapter:async()=>({features:new Set()})},deviceMemory:8},isSecureContext:true};
 assert.equal((await dom.window.RONBrowserAI.detect(missingF16)).model,dom.window.RONBrowserAI.SMOL,
  'Do not choose f16 WebGPU model without shader-f16 support');
 const unknownMemory={navigator:{gpu:{requestAdapter:async()=>({features:new Set(['shader-f16'])})}},isSecureContext:true};
 assert.equal((await dom.window.RONBrowserAI.detect(unknownMemory)).model,dom.window.RONBrowserAI.SMOL,
  'Conservative model for browsers that do not report memory');
 const downloadableNative={LanguageModel:{availability:async()=> 'downloadable'},navigator:{},isSecureContext:true};
 const nativeCandidate=await dom.window.RONBrowserAI.detect(downloadableNative);
 assert.equal(nativeCandidate.kind,'native');
 assert.equal(nativeCandidate.ready,false);
 assert.equal(nativeCandidate.download,true);
 // Android exposes WASM even if it lacks any usable GPU. Prefer the CPU model.
 const mobileNoGPU={
  navigator:{userAgent:'Mozilla/5.0 (Linux; Android 14; Samsung)',deviceMemory:8},
  WebAssembly:{instantiate(){}},isSecureContext:true
 };
 const cpuChoice=await dom.window.RONBrowserAI.detect(mobileNoGPU);
 assert.equal(cpuChoice.kind,'cpu');
 assert.equal(cpuChoice.model,dom.window.RONBrowserAI.CPU);
 assert.equal(cpuChoice.ready,false,'CPU weights are not downloaded before first question');
 const androidHasGPU={
  ...mobileNoGPU,navigator:{...mobileNoGPU.navigator,gpu:{requestAdapter:async()=>({features:new Set(['shader-f16'])})}}
 };
 assert.equal((await dom.window.RONBrowserAI.detect(androidHasGPU)).model,dom.window.RONBrowserAI.CPU,
  'Do not use misleading Android GPU adapter presence to choose heavy WebLLM model');
 const fakeCPU=async()=>async (messages,options)=>{
  assert.equal(options.do_sample,false);
  assert.equal(messages.at(-1).content,'Bonjour');
  return [{generated_text:[...messages,{role:'assistant',content:'Bonjour ! Réponse sur processeur.'}]}];
 };
 const prompt=[{role:'system',content:'Réponds en français.'},{role:'user',content:'Bonjour'}];
 const cpuAnswer=await dom.window.RONBrowserAI.generate(prompt,dom.window.RONBrowserAI.CPU,()=>{}, {loadCPU:fakeCPU});
 assert.equal(cpuAnswer,'Bonjour ! Réponse sur processeur.');
 const log=[];
 const afterGPU=await dom.window.RONBrowserAI.generate(prompt,dom.window.RONBrowserAI.SMOL,msg=>log.push(msg),{
  loadGPU:async()=>{throw Error('Unable to find a compatible GPU.');},
  loadCPU:fakeCPU
 });
 assert.equal(afterGPU,'Bonjour ! Réponse sur processeur.');
 assert(log.some(x=>/GPU incompatible/i.test(x)),'Show a human-friendly CPU fallback progress');
 assert.deepEqual(exceptions,[]);
 dom.window.close();
 console.log(JSON.stringify({passed:true,suite:'browser-ai',nativePrompts:prompts,paidRequests:0,checks:29}));
}
main().catch(e=>{console.error(e);process.exit(1)});
