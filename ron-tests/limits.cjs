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
E("cfg.provider='mistral';cfg.endpoint='https://api.mistral.ai/v1';cfg.key='simulation';cfg.agentMode='direct';RATE_PROFILES.eco.minGap=0;");
assert(E('retryAfterMs({get:()=>null})')>=65000);
assert.equal(E("accountLimit({error:{code:'insufficient_quota'}})"),true);
let count=0;const response=(status,payload,after)=>({status,ok:status===200,headers:{get:n=>n==='retry-after'?after:null},json:async()=>payload});
w.fetch=async()=>{count++;return response(429,{message:'Rate limit'},null)};
await assert.rejects(E('chatOnce([])'),/protection/);assert.equal(count,1);
await assert.rejects(E('chatOnce([])'),/encore active/);assert.equal(count,1);
assert.equal(d.getElementById('rateNotice').hidden,false);
const untilTime=E('rateRuntime.cooldownUntil');E('rememberCooldown();rateRuntime.cooldownUntil=0;restoreCooldown()');assert.equal(E('rateRuntime.cooldownUntil'),untilTime);
E("cfg.provider='groq';cfg.endpoint='https://api.groq.com/openai/v1';restoreCooldown()");assert.equal(E('rateRuntime.cooldownUntil'),0);
E("cfg.provider='mistral';cfg.endpoint='https://api.mistral.ai/v1';restoreCooldown()");assert.equal(E('rateRuntime.cooldownUntil'),untilTime);
E('rateRuntime.cooldownUntil=0');count=0;
w.fetch=async()=>{count++;return response(429,{error:{code:'insufficient_quota'}},'1')};
await assert.rejects(E('chatOnce([])'),/Quota ou crédit/);assert.equal(count,1);assert(E('rateRuntime.cooldownUntil-Date.now()')>899000);
E('rateRuntime.cooldownUntil=0');count=0;
w.fetch=async()=>{count++;return response(429,{message:'Rate limit'},'0.5')};
await assert.rejects(E('chatOnce([])'),/protection/);assert.equal(count,2);
E('rateRuntime.cooldownUntil=0');count=0;
await assert.rejects(E("chatOnce([],0.2,100,{role:'dots'})"),/protection/);assert.equal(count,1);
E('rateRuntime.cooldownUntil=0');count=0;
w.fetch=async()=>{count++;return count===1?response(429,{message:'Rate limit'},'0.5'):response(200,{choices:[{message:{content:'Reprise OK'}}]})};
assert.equal(await E('chatOnce([])'),'Reprise OK');assert.equal(count,2);
// Stream path also stops after one retry, and cancellation interrupts the waiting slot.
let requests=0;
w.XMLHttpRequest=class{open(){}setRequestHeader(){}getResponseHeader(n){return n==='retry-after'?'0.5':null}send(){requests++;this.status=429;this.responseText='{}';setTimeout(()=>this.onload(),1)}abort(){this.onabort?.()}};
E('rateRuntime.cooldownUntil=0');await assert.rejects(E("chatStream([],()=>{},{role:'final'})"),/protection/);assert.equal(requests,2);
E('rateRuntime.cooldownUntil=Date.now()+2000');const pending=E('acquireRateSlot({turn:turnId})');E('stopAll()');await assert.rejects(pending,/abort/);
assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,suite:'limits',realApiCalls:0}));w.close();
})().catch(e=>{console.error(e);w.close();process.exit(1)});
