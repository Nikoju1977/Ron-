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
  // The no-engine warning intentionally opens Settings. Dismiss it to type a
  // later live Internet question like a real user would.
  if(await page.locator('#panel').evaluate(e=>e.classList.contains('open')))await page.locator('#panelClose').click();
  // DOTS must be a usable, accessible mobile panel, connected to the existing
  // settings and mission storage rather than a disconnected decorative drawer.
  await page.locator('#dotsBtn').click();
  assert(await page.locator('#dotsPanel').evaluate(e=>e.classList.contains('open')),'DOTS drawer opens');
  assert.equal(await page.locator('#dotsPanel').getAttribute('aria-hidden'),'false','DOTS dialog is announced when open');
  assert(await page.locator('#dotsBackdrop').isVisible(),'Opaque DOTS backdrop hides the rest of the interface');
  assert.equal(await page.locator('#dotsPanel').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(6, 21, 34)','DOTS surface is fully opaque');
  await page.locator('#dotsMissionIn').fill('Suivre les étapes du projet RON');
  await page.locator('#dotsAddBtn').click();
  assert((await page.locator('#dotsActivity').innerText()).includes('Suivre les étapes du projet RON'),'Mission appears in DOTS activity');
  await page.locator('#dotsQuickEnable').check();
  assert(await page.locator('#dotsEnabledChk').isChecked(),'DOTS toggle synchronizes with settings');
  await page.locator('#dotsPauseBtn').click();
  assert.equal((await page.locator('#dotsPauseBtn').innerText()).trim(),'Reprendre','Pause button shows the current action');
  await page.locator('#dotsPauseBtn').click();
  assert.equal((await page.locator('#dotsPauseBtn').innerText()).trim(),'Mettre en pause','Resume returns pause action');
  await page.locator('#dotsConfigureBtn').click();
  assert(await page.locator('#panel').evaluate(e=>e.classList.contains('open')),'DOTS connects to engine settings');
  assert.equal(await page.locator('#dotsPanel').getAttribute('aria-hidden'),'true','DOTS drawer closes on settings transition');
  await page.locator('#dotsEnabledChk').uncheck();
  await page.locator('#panelClose').click();
  await page.locator('#dotsBtn').click();
  assert.equal(await page.locator('#dotsQuickEnable').isChecked(),false,'Settings toggle synchronizes back to DOTS');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#dotsPanel').getAttribute('aria-hidden'),'true','Escape closes DOTS');
  assert.deepEqual(exceptions,[],'No uncaught browser script exceptions');
  // A live weather question must bypass unavailable local LLM and call only
  // Open-Meteo public APIs. Use deterministic fixtures, not live network in CI.
  await page.route('https://geocoding-api.open-meteo.com/**',route=>route.fulfill({
   status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},
   body:JSON.stringify({results:[{name:'Nantes',country:'France',latitude:47.22,longitude:-1.55}]})
  }));
  await page.route('https://api.open-meteo.com/**',route=>route.fulfill({
   status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},
   body:JSON.stringify({daily:{time:['2026-10-24','2026-10-25','2026-10-26'],
    weather_code:[3,61,0],temperature_2m_min:[8,9,10],temperature_2m_max:[13,16,18],
    precipitation_probability_max:[10,75,0],precipitation_sum:[0,4.2,0],wind_speed_10m_max:[14,29,9]}})
  }));
  await page.locator('#textIn').fill('Quel temps demain à Nantes ?');
  await page.locator('#sendBtn').click();
  await page.waitForFunction(()=>document.getElementById('ronLine')?.textContent?.includes('Prévision pour Nantes, France'),null,{timeout:7500});
  assert.match(await page.locator('#ronLine').innerText(),/9 °C à 16 °C/);
  assert.match(await page.locator('#ronLine').innerText(),/Open-Meteo/);
  assert.equal(await page.locator('#textIn').inputValue(),'','Weather question was consumed by live connector');
  await page.locator('#knowledgeBtn').click();
  assert(await page.locator('#knowledgeNetBtn').count(),'Internet search is available from Savoirs');
  await page.locator('#knowledgeNetSearch').fill('météo demain à Nantes');
  await page.locator('#knowledgeNetBtn').click();
  await page.waitForFunction(()=>document.getElementById('knowledgeNetResults')?.textContent?.includes('Prévision pour Nantes, France'),null,{timeout:7500});
  // Food Maps works without a model, and no personal medical details are sent
  // to the food service; verify real browser DOM and deterministic arithmetic.
  assert(await page.locator('#foodSearchBtn').count(),'Food Maps must be available in Savoirs');
  await page.locator('#foodGrams').fill('150');
  await page.locator('#foodCarbs100').fill('24,5');
  await page.locator('#foodSearchBtn').click();
  await page.waitForFunction(()=>document.getElementById('foodResults')?.textContent?.includes('36,8 g de glucides'),null,{timeout:6000});
  await page.route('https://world.openfoodfacts.org/**',route=>route.fulfill({
   status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},
   body:JSON.stringify({products:[{code:'3017620422003',product_name_fr:'Pâtes sèches',brands:'Marque test',nutriments:{carbohydrates_100g:70}},
    {code:'3245410000005',product_name_fr:'Pâtes cuites',brands:'Autre marque',nutriments:{carbohydrates_100g:23.5}}]})
  }));
  await page.locator('#foodCarbs100').fill('');
  await page.locator('#foodQuery').fill('pâtes cuites');
  await page.locator('#foodSearchBtn').click();
  await page.waitForFunction(()=>document.getElementById('foodResults')?.textContent?.includes('35,3 g de glucides'),null,{timeout:6000});
  await page.locator('#knowledgeClose').click();
  // Intercept OS speech synthesizer to verify an actual spoken, concise French
  // carb result (rather than only text on screen or a long product list).
  await page.evaluate(()=>{
   window.__foodSpeech=[];
   if(window.speechSynthesis){
    window.speechSynthesis.speak=u=>{
     window.__foodSpeech.push({text:u.text,lang:u.lang});
     setTimeout(()=>u.onend?.(),10);
    };
    window.speechSynthesis.cancel=()=>{};
   }
  });
  await page.locator('#textIn').fill('Ron, 150 grammes de pâtes, combien de glucides ?');
  await page.locator('#sendBtn').click();
  await page.waitForFunction(()=>document.getElementById('ronLine')?.textContent?.includes('crus ou cuits'),null,{timeout:6000});
  assert(!/105 g de glucides/.test(await page.locator('#ronLine').innerText()),'Must not invent cooked-vs-dry carbs');
  await page.locator('#textIn').fill('cuites');
  await page.locator('#sendBtn').click();
  await page.waitForFunction(()=>document.getElementById('ronLine')?.textContent?.includes('35,3 g de glucides'),null,{timeout:6000});
  await page.waitForFunction(()=>window.__foodSpeech?.some(v=>v.text.includes('35,3 grammes de glucides')),null,{timeout:6000});
  assert((await page.evaluate(()=>window.__foodSpeech.find(v=>v.text.includes('35,3 grammes de glucides'))?.lang))==='fr-FR',
   'The computed carb quantity must be spoken aloud in French');
  await page.locator('#textIn').fill('100 g de pâtes cuites et 50 g de pain, ça fait combien de glucides ?');
  await page.locator('#sendBtn').click();
  await page.waitForFunction(()=>document.getElementById('ronLine')?.textContent?.includes('Repas composé'),null,{timeout:6000});
  assert.match(await page.locator('#ronLine').innerText(),/glucides pour 100 grammes de chaque aliment/);
    await page.locator('#textIn').fill("Quelle dose d’insuline pour 30 g de glucides ?");
  await page.locator('#sendBtn').click();
  await page.waitForFunction(()=>document.getElementById('ronLine')?.textContent?.includes('ne prescris ni dose'),null,{timeout:6000});
  const specialist=await page.evaluate(()=>window.RONAgentHub?.plan('cherche des études scientifiques sur les mitochondries')?.specialist?.name);
  assert.equal(specialist,'Agent scientifique','Specialist router loaded in published Chrome app');
  assert.deepEqual(exceptions,[],'No browser exceptions from live no-key weather integration');
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
  // UI message routing and local CPU result without downloading several hundred MB in CI.
  await context.route('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/+esm',route=>route.fulfill({
   status:200,contentType:'application/javascript',headers:{'Access-Control-Allow-Origin':'*'},
   body:"export const env={backends:{onnx:{wasm:{},versions:{web:'1.31.0-dev.20260914'}}}};export async function pipeline(task,model,opts){const wasm=env.backends.onnx.wasm;if(wasm.numThreads!==1||!wasm.wasmPaths?.mjs?.includes('onnxruntime-web@1.31.0-dev.20260914/dist/ort-wasm-simd-threaded.mjs')||!wasm.wasmPaths?.wasm?.endsWith('ort-wasm-simd-threaded.wasm'))throw Error('Plain CPU WASM override missing or set after model loads');if(task!=='text-generation'||opts.device!=='wasm'||opts.dtype!=='q4f16'||model!=='onnx-community/gemma-3-270m-it-ONNX')throw Error('Wrong French CPU model');opts.progress_callback?.({status:'progress',progress:100});return async (chat)=>{if(!chat[0]?.content?.includes('français naturel'))throw Error('Missing French instruction');if(chat.at(-1).content.includes('malforme'))return [{generated_text:[...chat,{role:'assistant',content:'Ze chat répond comme une chaleur sans des mots de des'}]}];if(chat.at(-1).content.includes('bloque')){const until=Date.now()+15000;while(Date.now()<until){} }return [{generated_text:[...chat,{role:'assistant',content:'Bonjour du CPU sans GPU.'}]}]};}"
  }));
  await cpuPage.goto('http://127.0.0.1:'+port+'/ron-presence.html',{waitUntil:'domcontentloaded',timeout:12000});
  await cpuPage.waitForFunction(()=>document.getElementById('providerSel')?.value==='browser'&&
   document.getElementById('modelIn')?.value==='gemma3-270m-cpu',null,{timeout:11000});
  assert.match(await cpuPage.locator('#autoEngineStatus').innerText(),/processeur|CPU/i);
  assert(await cpuPage.locator('#noPaidChk').isChecked(),'CPU mode never enables a paid API');
  await cpuPage.locator('#textIn').fill('Bonjour RON');
  await cpuPage.locator('#sendBtn').click();
  try{
   await cpuPage.waitForFunction(()=>document.getElementById('ronLine')?.textContent?.includes('Bonjour du CPU sans GPU.'),null,{timeout:10000});
  }catch(error){
   const diag=await cpuPage.evaluate(()=>({
    state:document.getElementById('state')?.textContent,
    output:document.getElementById('ronLine')?.textContent,
    hint:document.getElementById('connectionHint')?.textContent,
    input:document.getElementById('textIn')?.value
   }));
   throw Error('Android CPU worker failed: '+JSON.stringify({diag,cpuErrors})+'; '+error.message);
  }
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
  // Real browser CPU path: a nonsensical, unfinished answer is an error,
  // not a successful RON reply saved to the conversation.
  await cpuPage.locator('#textIn').fill('malforme');
  await cpuPage.locator('#sendBtn').click();
  await cpuPage.waitForFunction(()=>/incomplète/i.test(document.getElementById('ronLine')?.textContent||''),null,{timeout:10000});
  assert.equal(await cpuPage.locator('#textIn').inputValue(),'malforme','Rejected nonsense preserves original question');
  await cpuPage.locator('#textIn').fill('tu peux parler français ?');
  await cpuPage.locator('#sendBtn').click();
  await cpuPage.waitForFunction(()=>document.getElementById('ronLine')?.textContent?.includes('Oui, je peux te répondre en français.'),null,{timeout:10000});
  assert.deepEqual(cpuErrors,[],'French response and quality rejection are browser-safe');
  console.log(JSON.stringify({passed:true,suite:'browser-smoke',mobileViewport:true,firstInteractiveMs:startupMs,noKeyNativePrompt:true,androidCpuSelected:true,exceptions}));
  await context.close();
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exit(1);});
