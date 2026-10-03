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
E("cfg.provider='mistral';cfg.endpoint='https://api.mistral.ai/v1';cfg.key='simulation';cfg.agentMode='direct';RATE_PROFILES.eco.minGap=0;RATE_PROFILES.eco.max429Retries=1;");
E("rateRuntime.cooldownUntil=0;absorbRateHeaders({get:()=>null})");assert.equal(E('rateRuntime.cooldownUntil'),0);
E("absorbRateHeaders({get:()=>''})");assert.equal(E('rateRuntime.cooldownUntil'),0);
assert.equal(E("retryAfterMs({get:()=> '120'})"),120000);
assert(E("retryAfterMs({get:()=>new Date(Date.now()+90000).toUTCString()})")>88000);
const response=(status,payload,header=null)=>({status,ok:status===200,headers:{get:()=>header},json:async()=>payload});
w.fetch=async()=>response(200,{choices:[]});let result=await E('testConnection()');assert.notEqual(result.code,200);
w.fetch=async()=>response(200,{choices:[{message:{content:'OK'}}]});result=await E('testConnection()');assert.equal(result.code,200);
for(const code of [401,402,403,422]){let n=0;w.fetch=async()=>{n++;return response(code,{message:'bad input'})};result=await E('testConnection()');assert.equal(result.code,code);assert.equal(n,1);}
let n=0;w.fetch=async()=>{n++;return response(400,{message:'context length exceeded'})};result=await E('testConnection()');assert.equal(n,1);
n=0;w.fetch=async()=>++n===1?response(400,{message:'Invalid model'}):response(200,{choices:[{message:{content:'OK'}}]});result=await E('testConnection()');assert.equal(result.code,200);assert.equal(n,2);
n=0;w.fetch=async()=>{n++;return response(429,{message:'Rate limit'},'120')};result=await E('testConnection()');assert.equal(result.code,429);assert.equal(n,1);assert(E('rateRuntime.cooldownUntil-Date.now()')>118000);
E('rateRuntime.cooldownUntil=0');
let streamed='',requests=0;w.__delta=x=>streamed+=x;
const script=[{status:200,body:'data: '+JSON.stringify({choices:[{delta:{content:'Fin sans retour ligne'}}]})}];
w.XMLHttpRequest=class{open(){}setRequestHeader(){}getResponseHeader(){return null}send(){requests++;const r=script.shift();this.status=r.status;this.responseText=r.body;setTimeout(()=>this.onload(),1)}abort(){this.onabort?.()}};
assert.equal(await E("chatStream([{role:'user',content:'x'}],__delta,{role:'final'})"),'Fin sans retour ligne');assert.equal(streamed,'Fin sans retour ligne');
script.push({status:200,body:'data: [DONE]'});await assert.rejects(E("chatStream([],()=>{},{role:'final'})"),/vide/);
script.push({status:403,body:'{}'});await assert.rejects(E("chatStream([],()=>{},{role:'final'})"),/Accès refusé/);
const before=requests;script.push({status:400,body:JSON.stringify({message:'context length exceeded'})});await assert.rejects(E("chatStream([],()=>{},{role:'final'})"),/Requête refusée/);assert.equal(requests,before+1);
w.XMLHttpRequest=class{open(){}setRequestHeader(){}send(){setTimeout(()=>this.ontimeout(),1)}abort(){this.onabort?.()}};
await assert.rejects(E("chatStream([],()=>{},{role:'final'})"),/45 secondes/);
// JSON request cancellation after Stop rejects and releases its timers.
w.fetch=(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('cancelled'))));
const pending=E("fetchLLMJson('https://api.mistral.ai/v1/chat/completions',{}, {turn:turnId})");E('stopAll()');await assert.rejects(pending,/abort/);
assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,mistralChecks:17,realApiCalls:0}));w.close();
})().catch(e=>{console.error(e);w.close();process.exit(1)});
