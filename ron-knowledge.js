/* RON Savoirs — optional, browser-only connectors. No credentials; no background network requests. */
(function(root){
'use strict';
const MAX_DOCS=30, MAX_TEXT=32000, MAX_TOTAL=320000, MAX_FILE=1024*1024;
const state={docs:[],persist:false,share:false,ready:false};
let storage=null, notify=()=>{}, searchIndex=null, searchItems=[];
const $=id=>document.getElementById(id);
const limitText=(s,n=MAX_TEXT)=>String(s||'').replace(/\u0000/g,'').slice(0,n).trim();
function feedback(message,bad=false){const e=$('knowledgeStatus');if(e){e.textContent=message;e.dataset.error=bad?'true':'false';}if(bad)notify(message);}
function invalidate(){searchIndex=null;searchItems=[];}
function prepareSearch(){
 if(searchIndex)return;
 searchItems=[];
 for(const doc of state.docs){
  const value=doc.text, size=850, step=700;
  for(let start=0;start<value.length;start+=step)searchItems.push({id:doc.id,title:doc.title,part:value.slice(start,start+size),link:doc.link||'',at:start});
 }
 searchIndex=root.Fuse ? new root.Fuse(searchItems,{keys:[{name:'title',weight:0.35},{name:'part',weight:0.65}],threshold:0.38,ignoreLocation:true,includeScore:true}) : null;
}
function search(query,limit=8){
 const term=String(query||'').trim().slice(0,250);
 prepareSearch();
 if(!term)return searchItems.filter(x=>x.at===0).slice(-limit).reverse();
 if(searchIndex)return searchIndex.search(term,{limit}).map(x=>x.item);
 const word=term.toLocaleLowerCase('fr');
 return searchItems.filter(x=>(x.title+' '+x.part).toLocaleLowerCase('fr').includes(word)).slice(0,limit);
}
function contextForQuery(query){
 if(!state.share || !state.docs.length)return '';
 const items=search(query,4),used=new Set();
 const excerpts=items.filter(x=>{const key=x.id+':'+x.at;if(used.has(key))return false;used.add(key);return true;}).slice(0,4);
 return excerpts.map((x,i)=>'['+(i+1)+'] '+x.title+(x.link?' · '+x.link:'')+'\n'+x.part.slice(0,950)).join('\n\n').slice(0,4400);
}
async function persist(){
 if(!storage)return false;
 if(!state.persist){await storage.del('knowledgeDocsV1');await storage.del('knowledgeRememberV1');return true;}
 const ok=await storage.set('knowledgeDocsV1',state.docs);
 const flag=await storage.set('knowledgeRememberV1',ok);
 if(!ok || !flag){state.persist=false;$('knowledgeRemember').checked=false;feedback('Stockage indisponible : les documents restent dans cet onglet uniquement.',true);return false;}
 return true;
}
function validUrl(value){
 try{const u=new URL(value);return u.protocol==='https:' && ['github.com','fr.wikipedia.org'].includes(u.hostname)?u.href:'';}catch(e){return '';}
}
function render(){
 const container=$('knowledgeResults');if(!container)return;
 container.replaceChildren();
 const found=search($('knowledgeSearch').value);
 $('knowledgeCount').textContent=state.docs.length+' document(s) · '+found.length+' extrait(s) affiché(s)';
 if(!found.length){const p=document.createElement('p');p.className='hint';p.textContent=state.docs.length?'Aucun extrait correspondant.':'Aucun document. Ajoute du texte, un fichier ou une source publique.';container.append(p);}
 const ids=new Set();
 for(const hit of found){
  const doc=state.docs.find(x=>x.id===hit.id);if(!doc)continue;
  const card=document.createElement('article');card.className='knowledge-card';
  const top=document.createElement('div');top.className='knowledge-card-top';
  const title=document.createElement('strong');title.textContent=doc.title;top.append(title);
  if(!ids.has(doc.id)){
   const remove=document.createElement('button');remove.type='button';remove.className='knowledge-small';remove.textContent='Supprimer';remove.setAttribute('aria-label','Supprimer '+doc.title);
   remove.addEventListener('click',async()=>{state.docs=state.docs.filter(x=>x.id!==doc.id);invalidate();await persist();render();});
   top.append(remove);ids.add(doc.id);
  }
  card.append(top);
  const excerpt=document.createElement('p');excerpt.textContent=hit.part.slice(0,300)+(hit.part.length>300?'…':'');card.append(excerpt);
  const url=validUrl(doc.link);if(url){const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Source publique ↗';card.append(link);}
  container.append(card);
 }
 $('knowledgeShare').checked=state.share;
 $('knowledgeRemember').checked=state.persist;
}
async function addDocument(title,body,origin='local',link=''){
 const text=limitText(body);
 if(!text)throw Error('Le document est vide.');
 if(state.docs.length>=MAX_DOCS)throw Error('Limite de 30 documents atteinte : supprime un élément.');
 if(state.docs.reduce((sum,d)=>sum+d.text.length,0)+text.length>MAX_TOTAL)throw Error('La bibliothèque locale est pleine (320 000 caractères).');
 const doc={id:'kb_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8),title:limitText(title,140)||'Sans titre',text,origin,link:validUrl(link),addedAt:new Date().toISOString()};
 state.docs.push(doc);invalidate();await persist();render();return doc;
}
async function addFiles(files){
 let count=0;
 for(const file of Array.from(files||[]).slice(0,8)){
  if(file.size>MAX_FILE){feedback(file.name+' : fichier trop volumineux (1 Mo maximum).',true);continue;}
  if(!/\.(txt|md|markdown|csv|json|html?|css|js|mjs|cjs|jsx|ts|tsx|xml|ya?ml|py|sql|log|rtf)$/i.test(file.name)){feedback(file.name+' : format non pris en charge. Utilise un fichier texte.',true);continue;}
  try{await addDocument(file.name,await file.text(),'file');count++;}catch(e){feedback(e.message,true);}
 }
 if(count)feedback(count+' document(s) texte importé(s). Rien n’a été envoyé à un serveur.');
}
async function readJson(url,options={}){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
 try{
  const response=await fetch(url,{credentials:'omit',cache:'no-store',signal:ctrl.signal,...options});
  if(!response.ok)throw Error('Source indisponible (HTTP '+response.status+'). Vérifie le lien ou les limites du service.');
  return await response.json();
 }finally{clearTimeout(timer);}
}
function parseRepo(raw){
 const input=String(raw||'').trim();let text=input;
 if(/^https:\/\/github\.com\//i.test(input)){const u=new URL(input);if(u.hostname!=='github.com')throw Error('Adresse GitHub non reconnue.');text=u.pathname.replace(/^\/+|\/+$/g,'');}
 const match=text.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
 if(!match || match[1]==='.' || match[2]==='.')throw Error('Utilise owner/repo ou https://github.com/owner/repo.');
 return {owner:match[1],repo:match[2]};
}
function decodeBase64(value){
 const binary=atob(String(value||'').replace(/\s/g,'')),bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return new TextDecoder('utf-8').decode(bytes);
}
async function importGithub(){
 const {owner,repo}=parseRepo($('knowledgeGithub').value);
 const base='https://api.github.com/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repo);
 const info=await readJson(base,{headers:{Accept:'application/vnd.github+json'}});
 if(info.private)throw Error('Ce connecteur accepte uniquement les dépôts publics.');
 const readme=await readJson(base+'/readme',{headers:{Accept:'application/vnd.github+json'}});
 if(!readme.content)throw Error('Le dépôt ne contient pas de README lisible.');
 await addDocument(owner+'/'+repo+' · '+(readme.name||'README'),decodeBase64(readme.content),'github',readme.html_url||'https://github.com/'+owner+'/'+repo);
 feedback('README public GitHub importé. Aucun jeton requis ni conservé.');
}
async function importWikipedia(){
 const term=$('knowledgeWiki').value.trim().slice(0,160);if(!term)throw Error('Indique un sujet Wikipédia.');
 const params=new URLSearchParams({action:'query',generator:'search',gsrsearch:term,gsrlimit:'3',prop:'extracts',exintro:'1',explaintext:'1',format:'json',origin:'*'});
 const response=await readJson('https://fr.wikipedia.org/w/api.php?'+params.toString());
 const pages=Object.values(response.query?.pages||{}).sort((a,b)=>(a.index||0)-(b.index||0));
 const page=pages.find(x=>typeof x.extract==='string'&&x.extract.trim());
 if(!page)throw Error('Aucun extrait encyclopédique trouvé.');
 const link='https://fr.wikipedia.org/?curid='+encodeURIComponent(page.pageid);
 // Explicitly allow verified Wikipedia article URLs only.
 await addDocument('Wikipédia · '+page.title,page.extract,'wikipedia','https://fr.wikipedia.org/wiki/'+encodeURIComponent(page.title.replace(/ /g,'_')));
 feedback('Extrait Wikipédia ajouté. Source publique, à vérifier pour les informations sensibles.');
}
async function init(options={}){
 storage=options.store||null;notify=typeof options.notify==='function'?options.notify:()=>{};
 state.persist=(await storage?.get('knowledgeRememberV1'))===true;
 if(state.persist){
  const saved=await storage.get('knowledgeDocsV1');
  if(Array.isArray(saved))state.docs=saved.filter(d=>d&&typeof d.id==='string'&&typeof d.title==='string'&&typeof d.text==='string'&&d.text.length<=MAX_TEXT).slice(0,MAX_DOCS);
 }
 state.ready=true;invalidate();render();
 const execute=(f)=>async()=>{try{await f();}catch(e){feedback(e.message||String(e),true);}};
 $('knowledgeBtn').addEventListener('click',open);
 $('knowledgeClose').addEventListener('click',()=> $('knowledgeDialog').close());
 $('knowledgeSearch').addEventListener('input',render);
 $('knowledgeShare').addEventListener('change',e=>{state.share=e.target.checked;feedback(state.share?'Autorisation active pour les prochaines questions de cette session.':'Partage des documents désactivé.');});
 $('knowledgeRemember').addEventListener('change',execute(async()=>{state.persist=$('knowledgeRemember').checked;await persist();render();}));
 $('knowledgePasteBtn').addEventListener('click',execute(async()=>{
  await addDocument($('knowledgeTitle').value,$('knowledgeText').value,'note');
  $('knowledgeTitle').value='';$('knowledgeText').value='';feedback('Note ajoutée localement.');
 }));
 $('knowledgeFileBtn').addEventListener('click',()=> $('knowledgeFiles').click());
 $('knowledgeFiles').addEventListener('change',execute(async()=>{await addFiles($('knowledgeFiles').files);$('knowledgeFiles').value='';}));
 $('knowledgeGithubBtn').addEventListener('click',execute(importGithub));
 $('knowledgeWikiBtn').addEventListener('click',execute(importWikipedia));
 $('knowledgeClearBtn').addEventListener('click',execute(async()=>{
  if(!confirm('Effacer tous les documents locaux de RON ?'))return;
  state.docs=[];state.share=false;invalidate();await persist();render();feedback('Bibliothèque effacée de cet appareil.');
 }));
 feedback('Connecteurs gratuits prêts : fichiers locaux, GitHub public et Wikipédia.');
}
function open(){render();$('knowledgeDialog').showModal();}
root.RONKnowledge={init,open,search,contextForQuery,addDocument,parseRepo,getState:()=>({count:state.docs.length,persist:state.persist,share:state.share,ready:state.ready})};
})(window);
