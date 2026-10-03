const {JSDOM,VirtualConsole}=require('jsdom');
const {indexedDB}=require('fake-indexeddb');
const fs=require('fs'),assert=require('node:assert/strict');
const calls=[],errors=[]; let delay=5;
const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(fs.readFileSync('ron-presence.html','utf8'),{url:'http://localhost/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
 w.indexedDB=indexedDB;w.matchMedia=()=>({matches:false});w.isSecureContext=true;w.AudioContext=undefined;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.__rec=[];w.SpeechRecognition=class{constructor(){w.__rec.push(this)}start(){this.started=true}stop(){this.onend?.()}abort(){this.started=false}};
 w.navigator.mediaDevices={getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})};w.navigator.permissions={query:async()=>({state:'granted'})};
 w.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
 w.speechSynthesis={getVoices:()=>[],speak:u=>setTimeout(()=>u.onend?.(),1),cancel(){}};
 w.XMLHttpRequest=class{
 open(){}setRequestHeader(){}getResponseHeader(){return null}
 send(body){calls.push(JSON.parse(body));const d=delay;this.timer=setTimeout(()=>{this.status=200;this.responseText='data: '+JSON.stringify({choices:[{delta:{content:d>100?'Ancienne réponse.':'Je t’écoute, Niko. Qu’est-ce qui compte pour toi ?'}}]})+'\n\ndata: [DONE]\n\n';this.onprogress?.();this.onload?.()},d)}
 abort(){clearTimeout(this.timer);this.onabort?.()}
 };
}});
const w=dom.window,d=w.document,E=s=>w.eval(s),click=id=>d.getElementById(id).click();
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await wait(20)}throw Error('Timed out')}
const change=(id,value)=>{let e=d.getElementById(id);e.checked=value;e.dispatchEvent(new w.Event('change'))};
const msg=async text=>{await E(`handleUser(${JSON.stringify(text)})`);await until(()=>E("state==='idle'"))};
(async()=>{
await until(()=>d.getElementById('state').textContent!=='Initialisation…');
assert.equal(w.__rec.length,0);
click('commandBtn');d.getElementById('commandSearch').value='bien-être';d.getElementById('commandSearch').dispatchEvent(new w.Event('input'));
assert.equal(d.querySelectorAll('[data-command]:not([hidden])').length,1);
d.querySelector('[data-command=care]').click();assert(d.getElementById('careDialog').open);
for(const [id,value] of Object.entries({careEnergy:'4',carePain:'3',careSleep:'6.5',careMood:'Anxieux',careNote:'Test privé <img src=x onerror=alert(1)>'}))d.getElementById(id).value=value;
await d.getElementById('careForm').onsubmit({preventDefault(){}});
assert.equal(d.querySelectorAll('#careList p').length,1);assert.equal(d.querySelectorAll('#careList img').length,0);assert.equal(calls.length,0);
assert.equal(await E("safeStorage.get('careEntriesV1')"),undefined);
change('careRemember',true);await E('careWrites');assert.equal((await E("safeStorage.get('careEntriesV1')")).length,1);
change('careRemember',false);await E('careWrites');assert.equal(await E("safeStorage.get('careEntriesV1')"),undefined);
E("cfg.provider='custom';cfg.endpoint='http://localhost';cfg.model='mock';cfg.agentMode='direct';");
click('careShare');await until(()=>calls.length===1&&E("state==='idle'"));
assert(calls[0].messages.some(m=>m.content.includes('Test privé')));
await msg('Parlons cinéma');assert(!calls[1].messages.some(m=>m.content.includes('Test privé')));
d.querySelector('[data-mode=studio]').click();await msg('Une idée de cadre');assert(calls[2].messages[0].content.includes('Accompagne Niko dans son travail de réalisateur'));
click('micBtn');await until(()=>E("recMode==='ptt'"));let r=w.__rec.at(-1);let a=[{transcript:'Je prends mon temps'}];a.isFinal=true;r.onresult({resultIndex:0,results:[a]});
await wait(1000);assert.equal(calls.length,3);await wait(1800);await until(()=>E("state==='idle'"));assert.equal(calls.length,4);
click('micBtn');await until(()=>E("recMode==='ptt'"));click('pauseBtn');assert(E('rec===null&&wakePaused'));
// Canceled stream cannot overwrite a later answer.
delay=300;const old=E("handleUser('ancienne question')");await wait(20);E('stopAll()');delay=5;await msg('nouvelle question');await old;await wait(350);assert(!d.getElementById('ronLine').textContent.includes('Ancienne'));
// A permission resolution arriving after Stop must not reactivate the mic.
w.navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>setTimeout(()=>resolve({getTracks:()=>[{stop(){}}]}),100));
click('micBtn');click('pauseBtn');await wait(150);assert(E('rec===null'));
click('careBtn');await d.getElementById('careErase').onclick();assert(E('careEntries.length===0&&history.length===0'));assert.equal(await E("safeStorage.get('careEntriesV1')"),undefined);
await E("handleUser('Ron, mode analyse')");assert.equal(E('companionMode'),'analysis');
await E("handleUser('parle plus doucement')");assert.equal(E('gentleVoice'),true);
await E("handleUser('ouvre mon carnet')");assert(d.getElementById('careDialog').open);
assert.deepEqual(errors,[]);
console.log(JSON.stringify({passed:true,checks:19,apiCalls:calls.length,errors}));w.close();
})().catch(e=>{console.error(e);w.close();process.exit(1)});
