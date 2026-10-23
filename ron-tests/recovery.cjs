'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const html=fs.readFileSync('ron-presence.html','utf8').replace('<script src="./ron-auto-config.js"></script>','<script>'+fs.readFileSync('ron-auto-config.js','utf8')+'</script>');
async function until(fn,limit=3200){
 const start=Date.now();while(Date.now()-start<limit){if(fn())return;await wait(40);}
 throw Error('RON remains stuck on Initialisation…');
}
async function main(){
 const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(html,{
  url:'https://nikoju1977.github.io/Ron-/ron-presence.html',
  runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,
  beforeParse(w){
   w.indexedDB={open(){return {};}}; // browser storage open never succeeds, fails, nor unblocks
   w.fetch=async()=>({ok:true,status:200,json:async()=>({data:[]})}); // ready local server without conversation models
   w.matchMedia=()=>({matches:false});w.isSecureContext=true;
   Object.defineProperty(w.navigator,'deviceMemory',{configurable:true,value:2});
   w.AudioContext=undefined;
   w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
   w.HTMLDialogElement.prototype.close=function(){this.open=false;};
   w.SpeechRecognition=class{start(){}stop(){}abort(){}};
   w.navigator.mediaDevices={getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})};
   w.navigator.permissions={query:async()=>({state:'prompt'})};
   w.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
   w.speechSynthesis={getVoices:()=>[],speak:u=>setTimeout(()=>u.onend?.(),1),cancel(){}};
  }
 });
 const d=dom.window.document,E=code=>dom.window.eval(code);
 try{await until(()=>d.getElementById('state').textContent!=='Initialisation…',4800);}
 catch(error){throw Error('RON startup failed with storage blocked. Browser errors: '+JSON.stringify(errors)+'; readyState='+d.readyState+'; state='+d.getElementById('state').textContent+'; '+error.message);}
 assert(!d.getElementById('state').textContent.includes('Initialisation'),'Immediate recovery controls must appear');
 assert.equal(E('cfg.noPaid'),true,'No-spend mode must stay enabled after storage failure');
 d.getElementById('settingsBtn').click();
 assert(d.getElementById('panel').classList.contains('open'),
  'Settings button must work even when IndexedDB never opens');
 await until(()=>E('localEngineReady===false'),3000);
 d.getElementById('panelClose').click();
 d.getElementById('textIn').value='Bonjour';
 d.getElementById('sendBtn').click();
 await until(()=>d.getElementById('ronLine').textContent.includes('aucun moteur IA local'),2000);
 assert.equal(d.getElementById('textIn').value,'Bonjour','Unsent prompt is preserved');
 assert(d.getElementById('connectionHint').textContent.includes('IA non connectée'));
 assert.equal(E('cfg.noPaid'),true);
 assert.deepEqual(errors,[],'No uncaught script errors');
 dom.window.close();
 console.log(JSON.stringify({passed:true,suite:'recovery',checks:7,blockedIndexedDB:true,missingEngine:true}));
}
main().catch(e=>{console.error(e);process.exit(1);});
