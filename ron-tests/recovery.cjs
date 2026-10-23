'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const html=fs.readFileSync('ron-presence.html','utf8');
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
 await until(()=>d.getElementById('state').textContent!=='Initialisation…');
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
