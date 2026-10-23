'use strict';
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
async function main(){
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{
  let p;
  try{p=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,'');}
  catch(e){res.writeHead(400).end();return;}
  if(!p)p='ron-presence.html';
  const file=path.resolve(root,p);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,contents)=>{
   if(err){res.writeHead(404).end();return;}
   res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
   res.writeHead(200);res.end(contents);
  });
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 let browser;
 try{
  browser=await chromium.launch({headless:true,channel:process.env.CI?'chrome':undefined,args:['--disable-gpu','--disable-dev-shm-usage']});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage(),exceptions=[];
  page.on('pageerror',error=>exceptions.push(error.message));
  // This first scenario intentionally has no native, WebGPU or localhost AI.
  await page.addInitScript(()=>{
   Object.defineProperty(window,'LanguageModel',{configurable:true,value:undefined});
   Object.defineProperty(navigator,'gpu',{configurable:true,value:undefined});
   Object.defineProperty(window,'WebAssembly',{configurable:true,value:undefined}); // unsupported-platform test only
  });
  page.route('http://localhost:*/v1/models',route=>route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:'{"data":[]}'}));
  const start=Date.now();
  await page.goto('http://127.0.0.1:'+port+'/ron-presence.html',{waitUntil:'domcontentloaded',timeout:12000});
  try{await page.waitForFunction(()=>document.getElementById('state')?.textContent!=='Initialisation…',null,{timeout:8000});}
  catch(error){
   const debug=await page.evaluate(()=>({
    state:document.getElementById('state')?.textContent,
    readyState:document.readyState,
    scripts:[...document.scripts].map(s=>s.src||'inline'),
    hasBoot:typeof boot,
    hasConfig:typeof cfg,
    url:location.href
   })).catch(e=>({inspectFailed:e.message}));
   throw Error('RON timed out in real Chrome: '+JSON.stringify({debug,exceptions})+'; '+error.message);
  }
  const startupMs=Date.now()-start;
  await page.locator('#settingsBtn').click();
  assert(await page.locator('#panel').evaluate(e=>e.classList.contains('open')),'Settings button opens its panel');
  assert(await page.locator('#noPaidChk').isChecked(),'No-spend guard on in real browser');
  await page.locator('#panelClose').click();
  // Automatic discovery is asynchronous. Submit only after RON has explicitly
  // established that this browser has no local inference server.
  await page.waitForFunction(()=>/aucun modèle conversationnel|aucun moteur local joignable/i.test(document.getElementById('autoEngineStatus')?.textContent||''),null,{timeout:10000});
  await page.locator('#textIn').fill('Bonjour');
  await page.locator('#sendBtn').click();
  await page.waitForFunction(()=>document.getElementById('ronLine')?.textContent?.includes('aucun moteur IA local'),null,{timeout:8000});
  assert.equal(await page.locator('#textIn').inputValue(),'Bonjour','Prompt remains available when there is no AI engine');
  assert.deepEqual(exceptions,[],'No uncaught browser script exceptions');
  // Also prove the no-key Chrome Prompt API path works in a real browser.
  const nativePage=await context.newPage(),nativeErrors=[];
  nativePage.on('pageerror',e=>nativeErrors.push(e.message));
  await nativePage.addInitScript(()=>{
   Object.defineProperty(window,'LanguageModel',{configurable:true,value:{
    availability:async()=> 'available',
    create:async()=>({prompt:async()=> 'RON fonctionne sans clé API.',destroy(){}})
   }});
  });
  await nativePage.goto('http://127.0.0.1:'+port+'/ron-presence.html',{waitUntil:'domcontentloaded',timeout:12000});
  await nativePage.waitForFunction(()=>document.getElementById('autoEngineStatus')?.dataset.ready==='true'&&document.getElementById('providerSel')?.value==='browser',null,{timeout:10000});
  await nativePage.locator('#textIn').fill('Bonjour RON');
  await nativePage.locator('#sendBtn').click();
  await nativePage.waitForFunction(()=>document.getElementById('ronLine')?.textContent.includes('RON fonctionne sans clé API.'),null,{timeout:10000});
  assert(await nativePage.locator('#noPaidChk').isChecked(),'No-key native mode keeps the zero-spend guard');
  assert.deepEqual(nativeErrors,[],'No native browser integration script exceptions');
  // Real Android UA with GPU disabled must select CPU inference without fetching
  // the large model until the first user request.
  const cpuPage=await context.newPage(),cpuErrors=[];
  cpuPage.on('pageerror',e=>cpuErrors.push(e.message));
  await cpuPage.addInitScript(()=>{
   Object.defineProperty(window,'LanguageModel',{configurable:true,value:undefined});
   Object.defineProperty(navigator,'gpu',{configurable:true,value:undefined});
   Object.defineProperty(navigator,'userAgent',{configurable:true,value:'Mozilla/5.0 (Linux; Android 14; Samsung SM-S721B) AppleWebKit/537.36 Chrome/155 Mobile Safari/537.36'});
  });
  // Simulate the external WASM generator; integration test covers CDN import,
  // UI message routing and local CPU result without downloading 137 MB in CI.
  await context.route('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/+esm',route=>route.fulfill({
   status:200,contentType:'application/javascript',headers:{'Access-Control-Allow-Origin':'*'},
   body:"export const env={backends:{onnx:{wasm:{}}}};export async function pipeline(task,model,opts){if(task!=='text-generation'||opts.device!=='wasm'||opts.dtype!=='q8')throw Error('Wrong CPU mode');opts.progress_callback?.({status:'progress',progress:100});return async (chat)=>{if(chat.at(-1).content.includes('bloque')){const until=Date.now()+15000;while(Date.now()<until){} }return [{generated_text:[...chat,{role:'assistant',content:'Bonjour du CPU sans GPU.'}]}]};}"
  }));
  await cpuPage.goto('http://127.0.0.1:'+port+'/ron-presence.html',{waitUntil:'domcontentloaded',timeout:12000});
  await cpuPage.waitForFunction(()=>document.getElementById('providerSel')?.value==='browser'&&
   document.getElementById('modelIn')?.value==='smollm2-135m-cpu',null,{timeout:11000});
  assert.match(await cpuPage.locator('#autoEngineStatus').innerText(),/processeur|CPU/i);
  assert(await cpuPage.locator('#noPaidChk').isChecked(),'CPU mode never enables a paid API');
  await cpuPage.locator('#textIn').fill('Bonjour RON');
  await cpuPage.locator('#sendBtn').click();
  await cpuPage.waitForFunction(()=>document.getElementById('ronLine')?.textContent?.includes('Bonjour du CPU sans GPU.'),null,{timeout:10000});
  assert.deepEqual(cpuErrors,[],'Android CPU autodetection and a mocked response have no script errors');
  // A CPU engine that never yields must not freeze the DOM or the Stop button:
  // emulate 15s synchronous WASM work inside the dedicated worker.
  await cpuPage.locator('#textIn').fill('bloque');
  await cpuPage.locator('#sendBtn').click();
  await cpuPage.waitForFunction(()=>/calcule une réponse/.test(document.getElementById('connectionHint')?.textContent||''),null,{timeout:5000});
  const stopStarted=Date.now();
  await cpuPage.locator('#pauseBtn').click({timeout:2500});
  assert(Date.now()-stopStarted<2800,'Stop must stay responsive while CPU worker is busy');
  assert.equal(await cpuPage.locator('#textIn').inputValue(),'bloque','Stop preserves user text');
  assert.equal(await cpuPage.locator('#state').innerText(),'Touche le micro ou écris');
  assert.deepEqual(cpuErrors,[],'Stopping a blocked CPU worker causes no browser exceptions');
  console.log(JSON.stringify({passed:true,suite:'browser-smoke',mobileViewport:true,firstInteractiveMs:startupMs,noKeyNativePrompt:true,androidCpuSelected:true,exceptions}));
  await context.close();
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exit(1);});
