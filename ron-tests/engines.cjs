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
E('RATE_PROFILES.eco.minGap=0');
assert.equal(E("normalizeEndpoint('mistral','https://api.mistral.ai/')"),'https://api.mistral.ai/v1');
assert.throws(()=>E("normalizeEndpoint('mistral','https://example.org/v1')"),/attendue/);
assert.throws(()=>E("normalizeEndpoint('custom','javascript:alert(1)')"));
assert.throws(()=>E("normalizeEndpoint('custom','http://public.example/v1')"));
assert.equal(E("normalizeEndpoint('ollama','http://localhost:11434/v1/')"),'http://localhost:11434/v1');
assert.equal(E("isFreePrice({prompt:null,completion:'0'})"),false);
assert.equal(E("isFreePrice({prompt:'0',completion:'0',request:'1'})"),false);
assert.equal(E("isFreePrice({prompt:'0',completion:'0'})"),true);
E("cfg.key='MISTRAL-TEST-KEY';$('keyIn').value=cfg.key;engineKeys.set(engineScope(cfg.provider,cfg.endpoint),cfg.key)");
d.getElementById('providerSel').value='openrouter';await E('switchEngineDraft()');
assert.equal(d.getElementById('keyIn').value,'');assert.equal(E('cfg.provider'),'mistral');
let reads=0;w.fetch=async(url,opts)=>{reads++;assert(!opts.headers.Authorization);return {ok:true,status:200,headers:{get:()=>null},json:async()=>({data:[
{id:'qwen/example:free',name:'Free <img src=x>',context_length:32768,pricing:{prompt:'0',completion:'0'},architecture:{output_modalities:['text']}},
{id:'paid-model',name:'Paid',pricing:{prompt:'0.1',completion:'0.2'}},
{id:'embedding-model',pricing:{prompt:'0',completion:'0'}},
{id:'missing-price',pricing:{}},
{id:'qwen/example:free',pricing:{prompt:'0',completion:'0'}}
]})}};
await E('refreshModels()');assert.equal(reads,1);assert.equal(d.getElementById('modelCatalogSel').options.length,2);assert.equal(d.querySelectorAll('#modelCatalogSel img').length,0);
d.getElementById('keyIn').value='ROUTER-TEST-KEY';d.getElementById('keyIn').dispatchEvent(new w.Event('input'));
d.getElementById('modelIn').value='paid-model';assert.throws(()=>E('readEngineDraft()'),/gratuit/);
d.getElementById('modelIn').value='qwen/example:free';assert.equal(E('readEngineDraft().key'),'ROUTER-TEST-KEY');
E("history.push({role:'user',content:'private prior conversation'})");
w.fetch=async()=>({ok:true,status:200,headers:{get:()=>null},json:async()=>({choices:[{message:{content:'OK'}}]})});
await E('saveSettings()');assert.equal(E('cfg.provider'),'openrouter');assert.equal(E('history.length'),0);assert.equal(E("requestBody([],false).provider.data_collection"),'deny');
assert.equal(await E("safeStorage.get('engineKeyV1:'+engineScope(cfg.provider,cfg.endpoint))"),undefined);
d.getElementById('rememberChk').checked=true;await E('saveSettings()');assert.equal(await E("safeStorage.get('engineKeyV1:'+engineScope(cfg.provider,cfg.endpoint))"),'ROUTER-TEST-KEY');
d.getElementById('providerSel').value='groq';await E('switchEngineDraft()');assert.equal(d.getElementById('keyIn').value,'');
d.getElementById('providerSel').value='openrouter';await E('switchEngineDraft()');assert.equal(d.getElementById('keyIn').value,'ROUTER-TEST-KEY');
d.getElementById('endpointIn').value='https://example.org/v1';d.getElementById('endpointIn').dispatchEvent(new w.Event('input'));assert.equal(d.getElementById('keyIn').value,'');
// Invalid settings leave the active engine and credential unchanged.
const saved=E('cfg.endpoint');await E('saveSettings()');assert.equal(E('cfg.endpoint'),saved);assert.equal(E('cfg.key'),'ROUTER-TEST-KEY');
d.getElementById('providerSel').value='openrouter';await E('switchEngineDraft()');await E('clearKey()');assert.equal(E('cfg.key'),'');assert.equal(await E("safeStorage.get('engineKeyV1:'+engineScope(cfg.provider,cfg.endpoint))"),undefined);
// Load real vendored libraries and exercise generated HTML sanitization.
w.eval(fs.readFileSync('ron-vendor/marked.js','utf8'));w.eval(fs.readFileSync('ron-vendor/purify.min.js','utf8'));
w.__md='**Bonjour**\n\n```js\nconst n = 3;\n```\n\n<img src="https://tracker.invalid/x" onerror="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">bad</a>\n\n[Source](https://example.org)';
E('renderRonAnswer(__md)');assert(d.querySelector('#ronLine strong'));assert(d.querySelector('#ronLine pre code'));
assert.equal(d.querySelectorAll('#ronLine img,#ronLine script,#ronLine [onerror]').length,0);
assert.equal(d.querySelectorAll('#ronLine a[href^="javascript:"]').length,0);assert.equal(d.querySelector('#ronLine a[href^="https:"]').rel,'noopener noreferrer');
assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,engineAssertions:29,realCompletionCalls:0}));w.close();
})().catch(e=>{console.error(e);w.close();process.exit(1)});
