'use strict';
/* Real Apple WebKit engine (Linux Playwright build) with iPhone device profile.
   Verifies keyless Food Maps without WASM or any cloud model. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {webkit,devices}=require('playwright');
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
async function main(){
 const dir=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,'');}
  catch(e){res.writeHead(400).end();return;}
  const file=path.resolve(dir,pathname||'ron-presence.html');
  if(!file.startsWith(dir+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,contents)=>{
   if(err){res.writeHead(404).end();return;}
   res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
   res.end(contents);
  });
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await webkit.launch({headless:true});
  // Playwright cannot intercept cross-origin requests that pass through a
  // service worker in WebKit. Disable SW only in this connector-fixture test;
  // the production PWA still registers and uses its offline service worker.
  const context=await browser.newContext({...devices['iPhone 13'],locale:'fr-FR',timezoneId:'Europe/Paris',serviceWorkers:'block'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  // iOS does not expose Chrome Prompt API or necessarily working WebGPU.
  await page.addInitScript(()=>{
   Object.defineProperty(window,'LanguageModel',{configurable:true,value:undefined});
   Object.defineProperty(navigator,'gpu',{configurable:true,value:undefined});
   Object.defineProperty(window,'WebAssembly',{configurable:true,value:undefined});
  });
  const url='http://127.0.0.1:'+server.address().port+'/ron-presence.html';
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:16000});
  await page.waitForFunction(()=>document.getElementById('state')?.textContent!=='Initialisation…',null,{timeout:11000});
  const meta=await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content');
  assert.equal(meta,'yes','RON is installable from iOS Safari home screen');
  assert(await page.locator('#foodMapsBtn').isVisible(),'Food Maps is visible on narrow iPhone screens');
  // The missing-model alert can open Settings on iOS, but Food Maps works
  // without a model: dismiss the unrelated panel before tapping its button.
  if(await page.locator('#panel').evaluate(e=>e.classList.contains('open')))await page.locator('#panelClose').click();
  await page.locator('#foodMapsBtn').click();
  assert(await page.locator('#knowledgeDialog').evaluate(x=>x.open),'Touch opens Food Maps dialog');
  const fsSize=await page.locator('#foodGrams').evaluate(x=>parseFloat(getComputedStyle(x).fontSize));
  assert(fsSize>=16,'Safari must not auto-zoom the portion input');
  await page.locator('#foodGrams').fill('150');
  await page.locator('#foodCarbs100').fill('24,5');
  await page.locator('#foodSearchBtn').click();
  await page.waitForFunction(()=>document.querySelector('#foodResults')?.textContent?.includes('36,8 g de glucides'),null,{timeout:6000});
  let requests=0;
  await page.route('https://world.openfoodfacts.org/**',route=>{
   requests++;
   return route.fulfill({status:200,contentType:'application/json',
    headers:{'Access-Control-Allow-Origin':'*'},
    body:JSON.stringify({products:[
     {code:'3017620422003',product_name_fr:'Riz cuit',brands:'Produit test',nutriments:{carbohydrates_100g:28}},
     {code:'3017620422005',product_name_fr:'Riz cru',brands:'Autre marque',nutriments:{carbohydrates_100g:75}}
    ]})
   });
  });
  assert.equal(requests,0,'Manual food label math stays offline and private');
  await page.locator('#foodCarbs100').fill('');
  await page.locator('#foodQuery').fill('riz');
  await page.locator('#foodSearchBtn').click();
  try{
   await page.waitForFunction(()=>document.querySelector('#foodResults')?.textContent?.includes('42 g de glucides'),null,{timeout:8000});
  }catch(e){
   const diag=await page.evaluate(()=>({
    status:document.querySelector('#foodStatus')?.textContent,
    results:document.querySelector('#foodResults')?.textContent,
    query:document.querySelector('#foodQuery')?.value,
    weight:document.querySelector('#foodGrams')?.value,
    manual:document.querySelector('#foodCarbs100')?.value,
    hasFood:!!window.RONFood
   }));
   throw Error('iOS Open Food Facts search failed: '+JSON.stringify({diag,requests,errors})+' '+e.message);
  }
  assert.match(await page.locator('#foodResults').innerText(),/Choisis le bon produit/);
  assert.equal(requests,1,'One explicit worldwide food lookup');
  await page.locator('#knowledgeClose').click();
  if(await page.locator('#panel').evaluate(e=>e.classList.contains('open')))await page.locator('#panelClose').click();
  await page.locator('#textIn').fill('150 g de riz ?');
  await page.locator('#sendBtn').click();
  await page.waitForFunction(()=>document.querySelector('#ronLine')?.textContent?.includes('42 g de glucides'),null,{timeout:6500});
  // An insulin dose question must never reach any public food API.
  const before=requests;
  await page.locator('#textIn').fill('Quelle dose d’insuline pour 30 g de glucides ?');
  await page.locator('#sendBtn').click();
  await page.waitForFunction(()=>document.querySelector('#ronLine')?.textContent?.includes('ne prescris ni dose'),null,{timeout:6500});
  assert.equal(requests,before,'Sensitive health question stays on-device');
  assert.deepEqual(errors,[],'iOS WebKit app never throws a script exception');
  console.log(JSON.stringify({passed:true,suite:'ios-webkit',iphone:true,safariEngine:true,checks:15,externalFoodQueries:requests,insulinDoseCalls:0}));
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
}
main().catch(error=>{console.error(error);process.exitCode=1});
