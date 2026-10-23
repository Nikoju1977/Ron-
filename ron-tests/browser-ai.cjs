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
 const gpuMock={navigator:{gpu:{requestAdapter:async()=>({})},deviceMemory:4},isSecureContext:true};
 const detected=await dom.window.RONBrowserAI.detect(gpuMock);
 assert.equal(detected.kind,'webgpu');
 assert.equal(detected.model,dom.window.RONBrowserAI.QWEN);
 assert.equal(detected.ready,false,'Model download is not falsely advertised as ready');
 dom.window.close();
 console.log(JSON.stringify({passed:true,suite:'browser-ai',nativePrompts:prompts,paidRequests:0,checks:13}));
}
main().catch(e=>{console.error(e);process.exit(1)});
