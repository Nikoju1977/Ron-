'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom');
const {TextDecoder}=require('node:util');
const errors=[],calls=[];
const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const controls={
 knowledgeDialog:'dialog', knowledgeStatus:'p',knowledgeResults:'div',knowledgeCount:'div',knowledgeSearch:'input',
 knowledgeShare:'checkbox',knowledgeRemember:'checkbox',knowledgeBtn:'button',knowledgeClose:'button',
 knowledgeTitle:'input',knowledgeText:'textarea',knowledgePasteBtn:'button',knowledgeFileBtn:'button',
 knowledgeFiles:'file',knowledgeGithub:'input',knowledgeGithubBtn:'button',knowledgeWiki:'input',
 knowledgeWikiBtn:'button',knowledgeClearBtn:'button'
};
const html='<!doctype html><html><body>'+Object.entries(controls).map(([id,tag])=>
 tag==='checkbox'?'<input type="checkbox" id="'+id+'">':
 tag==='file'?'<input type="file" id="'+id+'">':
 '<'+tag+' id="'+id+'"></'+tag+'>').join('')+'</body></html>';
const dom=new JSDOM(html,{url:'https://nikoju1977.github.io/Ron-/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
 w.TextDecoder=TextDecoder;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.confirm=()=>true;
}});
const w=dom.window,d=w.document,mem=new Map(),store={
 async get(k){return mem.get(k)},
 async set(k,v){mem.set(k,v);return true},
 async del(k){mem.delete(k)}
};
w.eval(fs.readFileSync('ron-vendor/fuse.basic.min.js','utf8'));
w.eval(fs.readFileSync('ron-knowledge.js','utf8'));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let n=0;n<70;n++){if(fn())return;await wait(20);}throw Error('Timed out');}
async function main(){
 const K=w.RONKnowledge;
 assert.equal(typeof w.Fuse,'function','Pinned fuzzy search library loads');
 assert.deepEqual({owner:K.parseRepo('Nikoju1977/Ron-').owner,repo:K.parseRepo('Nikoju1977/Ron-').repo},{owner:'Nikoju1977',repo:'Ron-'});
 assert.equal(K.parseRepo('https://github.com/Nikoju1977/Ron-.git').repo,'Ron-');
 assert.throws(()=>K.parseRepo('https://evil.example/owner/repo'));
 assert.throws(()=>K.parseRepo('../secret'));
 w.fetch=async()=>{throw Error('No external request allowed during initialization');};
 await K.init({store,notify:()=>{}});
 assert.equal(K.getState().count,0);
 assert.equal(K.getState().share,false);
 assert.equal(K.getState().persist,false);
 K.open();assert.equal(d.getElementById('knowledgeDialog').open,true);
 await K.addDocument('Lumière <img src=x onerror=alert(1)>','Caméra et lumière douce pour une scène de cinéma.');
 assert.equal(K.getState().count,1);
 assert.equal(d.querySelectorAll('#knowledgeResults img').length,0,'Document title must not inject HTML');
 assert.equal(K.contextForQuery('caméra'),'','No implicit sharing');
 d.getElementById('knowledgeShare').checked=true;
 d.getElementById('knowledgeShare').dispatchEvent(new w.Event('change'));
 assert.match(K.contextForQuery('caméra'),/Caméra et lumière/i,'Context only after explicit consent');
 assert.equal(mem.has('knowledgeDocsV1'),false,'Default is session-only');
 d.getElementById('knowledgeRemember').checked=true;
 d.getElementById('knowledgeRemember').dispatchEvent(new w.Event('change'));
 await until(()=>mem.has('knowledgeDocsV1'));
 assert.equal(mem.get('knowledgeDocsV1').length,1);
 w.fetch=async(url,options)=>{
  calls.push({url:String(url),options});
  if(String(url)==='https://api.github.com/repos/Nikoju1977/Ron-')return {ok:true,json:async()=>({private:false,default_branch:'main'})};
  if(String(url)==='https://api.github.com/repos/Nikoju1977/Ron-/readme')return {ok:true,json:async()=>({name:'README.md',content:Buffer.from('# RON public assistant').toString('base64'),html_url:'https://github.com/Nikoju1977/Ron-/blob/main/README.md'})};
  if(String(url).startsWith('https://fr.wikipedia.org/w/api.php?'))return {ok:true,json:async()=>({query:{pages:{'12':{pageid:12,title:'Cinéma',extract:'Le cinéma est un art audiovisuel.',index:1}}}})};
  throw Error('Unexpected network destination '+url);
 };
 d.getElementById('knowledgeGithub').value='Nikoju1977/Ron-';
 d.getElementById('knowledgeGithubBtn').click();
 await until(()=>K.getState().count===2);
 assert.match(K.contextForQuery('assistant'),/RON public assistant/);
 d.getElementById('knowledgeWiki').value='cinéma';
 d.getElementById('knowledgeWikiBtn').click();
 await until(()=>K.getState().count===3);
 assert(calls.length===3,'Only three requests after explicit user actions');
 assert(calls.every(x=>!x.options.headers?.Authorization),'No personal API token sent');
 d.getElementById('knowledgeSearch').value='cinéma';
 d.getElementById('knowledgeSearch').dispatchEvent(new w.Event('input'));
 assert(d.querySelectorAll('#knowledgeResults article').length>0,'Local search returns matches');
 d.getElementById('knowledgeClearBtn').click();
 await until(()=>K.getState().count===0);
 assert.equal(mem.get('knowledgeDocsV1').length,0,'Erase persisted docs');
 assert.equal(K.contextForQuery('caméra'),'','Erase also ends document sharing');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,suite:'knowledge',connectors:['local','GitHub-public','Wikipedia'],externalRequests:calls.length,securityChecks:6}));
 w.close();
}
main().catch(e=>{console.error(e);w.close();process.exit(1)});
