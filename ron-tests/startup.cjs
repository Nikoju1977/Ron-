'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom');
const {indexedDB}=require('fake-indexeddb');
const html=fs.readFileSync('ron-presence.html','utf8');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){
 for(let n=0;n<100;n++){if(fn())return;await pause(20);}
 throw Error('RON startup did not become interactive in time');
}
async function main(){
 assert(!html.includes('<script src="./ron-vendor/three.min.js"></script>'),
  'Heavy Three.js must no longer block HTML startup parsing');
 assert(!html.includes('fonts.googleapis.com/css2'), 'Startup cannot require remote fonts');
 const errors=[];
 const vc=new VirtualConsole();vc.on('jsdomError',error=>errors.push(error.message));
 let libraryStarted=0;
 const dom=new JSDOM(html,{url:'https://nikoju1977.github.io/Ron-/ron-presence.html',
  runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
   w.indexedDB=indexedDB;
   w.matchMedia=()=>({matches:false});
   w.isSecureContext=true;w.AudioContext=undefined;
   w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
   w.HTMLDialogElement.prototype.close=function(){this.open=false;};
   w.SpeechRecognition=class{start(){}stop(){}abort(){}};
   w.navigator.mediaDevices={getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})};
   // Browser permission UI may be slow, reject or never resolve.
   w.navigator.permissions={query:()=>new Promise(()=>{})};
   w.RONKnowledge={init:()=>{libraryStarted++;return new Promise(()=>{});}};
   w.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
   w.speechSynthesis={getVoices:()=>[],speak:u=>setTimeout(()=>u.onend?.(),1),cancel(){}};
  }});
 const d=dom.window.document;
 await until(()=>d.getElementById('state').textContent!=='Initialisation…');
 await until(()=>libraryStarted===1);
 assert.equal(libraryStarted,1,'Slow knowledge initialization started without blocking the interface');
 assert.equal(d.getElementById('state').textContent!=='Initialisation…',true);
 assert.equal(d.querySelector('script[src="./ron-vendor/three.min.js"]'),null,
  '3D runtime loads after the interface becomes responsive');
 d.getElementById('settingsBtn').click();
 assert(d.getElementById('panel').classList.contains('open'),
  'Settings are operable before background initialization finishes');
 assert.equal(dom.window.eval('cfg.noPaid'),true,'Zero-spend guard stays active');
 assert.deepEqual(errors,[]);
 dom.window.close();
 console.log(JSON.stringify({passed:true,suite:'fast-startup',checks:7}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
