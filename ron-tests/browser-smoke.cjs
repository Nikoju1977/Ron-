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
  await page.waitForFunction(()=>document.getElementById('connectionHint')?.textContent.includes('IA absente'),null,{timeout:8000});
  await page.locator('#textIn').fill('Bonjour');
  await page.locator('#sendBtn').click();
  await page.waitForFunction(()=>document.getElementById('ronLine')?.textContent?.includes('aucun moteur IA local'),null,{timeout:8000});
  assert.equal(await page.locator('#textIn').inputValue(),'Bonjour','Prompt remains available when there is no AI engine');
  assert.deepEqual(exceptions,[],'No uncaught browser script exceptions');
  console.log(JSON.stringify({passed:true,suite:'browser-smoke',mobileViewport:true,firstInteractiveMs:startupMs,exceptions}));
  await context.close();
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exit(1);});
