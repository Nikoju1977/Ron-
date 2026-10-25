'use strict';
const {JSDOM,VirtualConsole}=require('jsdom');
const {indexedDB}=require('fake-indexeddb');
const fs=require('node:fs'),assert=require('node:assert/strict');
const errors=[],requests=[],spoken=[],exportedFiles=[];
let format='sse',delay=5,answer='Une réponse **lisible**.\n\nDeuxième paragraphe.',copied='',aborts=0;
const vc=new VirtualConsole();vc.on('jsdomError',error=>errors.push(error.message));
let html=fs.readFileSync('ron-presence.html','utf8');
for(const name of ['marked.js','purify.min.js'])
 html=html.replace('<script src="./ron-vendor/'+name+'" defer></script>',()=>'<script>'+fs.readFileSync('ron-vendor/'+name,'utf8')+'</script>');
const dom=new JSDOM(html,{url:'http://localhost/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
 w.indexedDB=indexedDB;w.matchMedia=()=>({matches:false});w.isSecureContext=true;
 w.AudioContext=undefined;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;this.setAttribute('open','');};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 w.navigator.permissions={query:async()=>({state:'prompt'})};
 w.navigator.mediaDevices={getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})};
 w.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
 w.speechSynthesis={getVoices:()=>[],speak(u){if(u.volume!==0)spoken.push(u.text);setTimeout(()=>u.onend?.(),1);},cancel(){}};
 Object.defineProperty(w.navigator,'clipboard',{configurable:true,value:{writeText:async text=>{copied=text;}}});
 w.URL.createObjectURL=blob=>{exportedFiles.push(blob);return 'blob:ron-export';};w.URL.revokeObjectURL=()=>{};
 w.HTMLAnchorElement.prototype.click=function(){w.__download=this.download;};
 w.XMLHttpRequest=class{
  open(){}setRequestHeader(){}getResponseHeader(){return null;}
  send(body){
   requests.push(JSON.parse(body));const text=answer,kind=format;
   this.timer=setTimeout(()=>{
    this.status=200;
    if(kind==='json')this.responseText=JSON.stringify({choices:[{message:{content:[{type:'text',text}]}}]});
    else if(kind==='broken')this.responseText='data: {invalid}\n\n';
    else this.responseText='data: '+JSON.stringify({choices:[{delta:{content:text}}]}); // No trailing newline
    this.onprogress?.();this.onload?.();
   },delay);
  }
  abort(){aborts++;clearTimeout(this.timer);this.onabort?.();}
 };
}});
const w=dom.window,d=w.document,E=code=>w.eval(code),$=id=>d.getElementById(id);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let i=0;i<200;i++){if(fn())return;await wait(10);}throw Error('Timed out');}
async function message(text){E('rateRuntime.nextAt=0');await E('handleUser('+JSON.stringify(text)+')');await until(()=>E("state==='idle'||state==='error'"));}
async function main(){
 await until(()=>E('bootReady'));
 E("cfg.provider='custom';cfg.endpoint='http://localhost/v1';cfg.model='mock';cfg.agentMode='direct';cfg.autoEngine=false;localEngineReady=true;");
 $('conversationBtn').click();assert($('conversationDialog').open);assert($('conversationExport').disabled);
 assert.equal(requests.length,0,'Reading an empty conversation never calls an API');
 $('conversationClose').click();
 $('muteBtn').click();assert.equal($('muteBtn').getAttribute('aria-pressed'),'true');
 await message('Une idée de scène');
 assert.equal(spoken.length,0,'Silent mode keeps completed text but never queues spoken sentences');
 assert.equal(await E("safeStorage.get('voiceMuted')"),true);
 assert.equal(E('history.length'),2);
 $('conversationBtn').click();
 assert.equal(d.querySelectorAll('.conversation-entry').length,2);
 assert.equal(d.querySelector('.conversation-content strong').textContent,'lisible','History uses sanitized Markdown');
 d.querySelector('.conversation-copy').click();await until(()=>copied===answer && $('conversationStatus').textContent==='Réponse copiée.');
 assert.equal($('conversationStatus').textContent,'Réponse copiée.');
 // Clipboard denial must fall back to an ordinary selected-text copy, without throwing.
 w.navigator.clipboard.writeText=async()=>{throw Error('Denied');};
 d.querySelector('.conversation-copy').click();await until(()=>$('conversationStatus').textContent.includes('sélectionné'));
 assert(w.getSelection().toString().includes('Deuxième paragraphe'));
 $('conversationExport').click();assert.equal(exportedFiles.length,1);assert.match(w.__download,/^ron-conversation-\d{4}-\d{2}-\d{2}\.txt$/);
 const file=await new Promise((resolve,reject)=>{const r=new w.FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsText(exportedFiles[0]);});
 assert(file.includes('Une idée de scène'));assert(file.includes(answer));assert(!file.includes('http://localhost/v1'));
 // Closing a reader does not cancel inference; unfinished answers are not exported.
 delay=150;E('rateRuntime.nextAt=0');const pending=E("handleUser('question en cours')");
 await until(()=>requests.length===2);E('renderConversation()');
 assert.equal(d.querySelectorAll('.conversation-entry').length,2);
 const turn=E('turnId');w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));assert.equal(E('turnId'),turn);
 await pending;await until(()=>E("state==='idle'"));assert.equal(d.querySelectorAll('.conversation-entry').length,4,'Open history refreshes when a response finishes');
 $('conversationClose').click();assert.equal($('conversationList').children.length,0,'Closing the reader releases rendered private text');
 // Stop actually aborts and must not promote a partial user turn to history.
 E('rateRuntime.nextAt=0');const stopped=E("handleUser('à interrompre')");await until(()=>requests.length===3);
 E('stopAll()');await stopped;assert.equal(E('completedConversation().length'),4);assert(aborts>0);
 format='json';delay=5;answer='Réponse JSON compatible.';await message('Bonjour en JSON');
 assert.equal($('ronLine').textContent.trim(),answer);assert.equal(E('history.at(-1).content'),answer);
 // A stream parse error must not be mistaken for a successful JSON fallback.
 format='broken';const count=E('history.length');await message('Réponse cassée');
 assert.equal(E('history.length'),count);assert.match($('ronLine').textContent,/illisible/);
 format='sse';answer='<img src=x onerror="window.pwned=true">\n\n[piège](javascript:alert(1))';
 await message('<img src=x onerror="window.pwned=true">');$('conversationBtn').click();
 assert.equal(d.querySelectorAll('#conversationList img,#conversationList script').length,0);
 assert.equal(d.querySelectorAll('#conversationList a[href^="javascript:"]').length,0);assert.equal(w.pwned,undefined);
 const before=requests.length;E("careEntries=[{note:'jamais partagé'}];cfg.key='private-test-key';");
 $('conversationExport').click();
 const privateFile=await new Promise(resolve=>{const r=new w.FileReader();r.onload=()=>resolve(r.result);r.readAsText(exportedFiles.at(-1));});
 assert(!privateFile.includes('jamais partagé'));assert(!privateFile.includes('private-test-key'));assert.equal(requests.length,before);
 $('conversationClear').click();assert.equal(E('history.length'),0);assert.equal(E('careEntries.length'),1);assert($('conversationExport').disabled);
 $('conversationClose').click();$('muteBtn').click();answer='La voix est revenue. ';await message('Après le silence');
 assert(spoken.some(text=>text.includes('La voix est revenue')));
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,suite:'conversation-tools',exportPrivacy:true,silentMode:true,jsonAndSse:true}));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>w.close());
