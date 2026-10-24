/* Food Maps: worldwide food labels via Open Food Facts, plus deterministic
 carbohydrate portion calculations and a non-prescribing type 1 diabetes agent. */
(function(root){
'use strict';
const HOST='https://world.openfoodfacts.org';
const AJD='https://www.ajd-diabete.fr/vivre-avec-un-diabete-de-type-1/prise-en-charge-du-diabete-de-type-1/lalimentation/';
const AMELI='https://www.ameli.fr/assure/sante/themes/diabete-adulte/diabete-symptomes-evolution/acido-cetose-hypoglycemie-hyperglycemie';
const requests=[],cache=new Map();
let pendingPreparation=null; // Only the ingredient + portion, in memory for 2 minutes; never persisted.
function clean(s,n=140){return String(s||'').replace(/[\u0000-\u001f\u007f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);}
function norm(s){return clean(s,300).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function num(x){if(typeof x==='number')return Number.isFinite(x)?x:NaN;const s=String(x??'').trim().replace(',','.');return /^\d+(?:\.\d+)?$/.test(s)?Number(s):NaN;}
function fmt(n){return Number(n).toLocaleString('fr-FR',{maximumFractionDigits:1});}
function carbs(grams,per100){
 const g=num(grams),c=num(per100);
 if(!(g>0&&g<=5000))throw Error('Poids invalide : entre 0 et 5 000 g.');
 if(!(c>=0&&c<=100))throw Error('Glucides pour 100 g invalides : vérifie l’étiquette.');
 return Math.round(g*c/10)/10;
}
function type1(text){
 const q=norm(text);
 const dose=/\b(insuline|bolus|unites? d.insuline|quelle dose|combien d.unites|ratio insuline)\b/.test(q);
 const severe=/\b(inconscient|perte de connaissance|convulsions|respiration difficile|acidocetose|hypoglycemie severe|cetones? elevees?)\b/.test(q);
 let msg;
 if(severe)msg='**Urgence possible.** En cas de perte de connaissance, convulsions, impossibilité d’avaler ou de signes graves d’acidocétose, appelle le **15 ou le 112**. Ne donne rien par la bouche à une personne inconsciente. Suis le plan d’urgence fourni par ton équipe soignante.';
 else if(dose)msg='**Calcul de dose d’insuline : non.** Je peux calculer les grammes de glucides d’une portion, mais je ne prescris ni dose ni modification de bolus. Le calcul d’insuline utilise un protocole individuel établi avec un professionnel, comprenant glycémie, insuline active et autres facteurs.';
 else msg='**Agent éducatif diabète de type 1.** Je peux expliquer le comptage des glucides, la différence entre produits crus et cuits et les étiquettes. Les glucides de la portion valent : **poids mangé × glucides pour 100 g ÷ 100**. Pour une décision médicale, suis ton équipe soignante.';
 return {kind:'type1',sources:[AJD,AMELI],text:msg+'\n\nSources : [AJD — alimentation]('+AJD+') · [Assurance Maladie]('+AMELI+').',spoken:msg.replace(/\*/g,'')};
}

function preparation(name){
 const n=norm(name);
 if(!/\b(pates?|riz|semoule|quinoa|lentilles?|boulgour|couscous|nouilles?)\b/.test(n))return null;
 if(/\b(cuit|cuite|cuits|cuites|bouilli|bouillie|bouillis|bouillies)\b/.test(n))return 'cuit';
 if(/\b(cru|crue|crus|crues|sec|seche|secs|seches|avant cuisson)\b/.test(n))return 'cru';
 return 'missing';
}
function parse(text){
 const raw=clean(text,280),q=norm(raw);
 if(!q)return null;
 // Bare answer to RON's previous raw/cooked question, without repeating the
 // whole food and the quantity. 2-minute timeout; never stored on a server.
 if(pendingPreparation && Date.now()<pendingPreparation.until &&
    /^(?:cuit(?:es?|s)?|bouilli(?:es?|s)?|cru(?:es?|s)?|sec(?:hes?|s)?)$/.test(q)){
  const p=pendingPreparation;pendingPreparation=null;
  const state=/^(?:cuit|bouilli)/.test(q)?'cuit':'cru';
  return {kind:'food',query:p.query+' '+state,grams:p.grams,confirmedPreparation:true};
 }
 if(pendingPreparation&&Date.now()>=pendingPreparation.until)pendingPreparation=null;
 // An insulin question must never turn into an automatic carb-to-dose conversion.
 const insulin=/\b(insuline|bolus|unites? d.insuline|quelle dose|combien d.unites|ratio insuline|injecter)\b/.test(q);
 const highRisk=/\b(inconscient|perte de connaissance|convulsions|acidocetose|hypoglycemie|hyperglycemie|cetones?|glycemie)\b/.test(q);
 if(insulin||highRisk)return {kind:'type1',question:raw};
 const code=(q.match(/\b(?:code[- ]?barres?|ean|produit)\s*(?:n[°o]\s*)?(\d{8,14})\b/)||[])[1]||(/^\d{8,14}$/.test(q)?q:null);
 if(code)return {kind:'food',code,grams:100};
 const gc=/\b(glucides?|carbohydrates?|carbs?|comptage des glucides|food maps)\b/.test(q);
 const medical=/\b(diabete (?:de )?type 1|diabetologue)\b/.test(q);
 if(medical&&!gc)return {kind:'type1',question:raw};
 const explicitLabel=raw.match(/(\d{1,3}(?:[.,]\d{1,2})?)\s*g(?:rammes?)?\s+de\s+glucides\s*(?:pour|\/|par)\s*100\s*g\b/i)
  ||raw.match(/glucides\s*(?:pour|par|\/)\s*100\s*g\s*(?::|=|de|a|à)?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*g?\b/i);
 // Strip the trailing conversational question; preserve the food's name.
 const withoutQuestion=raw.replace(/\s*(?:,|;|\?)?\s*(?:ça fait|ca fait|combien (?:ça|ca|de|des|en)|quel(?:le)? (?:est |sont )?(?:le |la )?(?:taux|quantite|nombre)|tu (?:peux|sais) (?:me )?dire).{0,100}$/iu,'').trim();
 const portionRe=/(\d{1,4}(?:[.,]\d{1,2})?)\s*(kg|g|grammes?)\s*(?:de\s+|d['’]\s*|du\s+|des\s+)?([^,;?!]+?)(?=\s*(?:,|;|\bet\b|\bavec\b|\bplus\b)\s*\d{1,4}(?:[.,]\d{1,2})?\s*(?:kg|g|grammes?)\b|$)/giu;
 const portions=[];
 for(const m of withoutQuestion.matchAll(portionRe)){
  let name=clean(m[3].replace(/\s*(?:[,;]|et)\s*$/, '').replace(/\b(glucides?|carbs?)\b.*$/iu,'').trim(),90);
  if(!name||/^(?:de |du |des )?(?:glucides?|carbs?|repas)$/i.test(name))continue;
  portions.push({name,grams:num(m[1])*(m[2].toLowerCase()==='kg'?1000:1)});
 }
 if(portions.length>1)return {kind:'food',mealParts:portions.slice(0,8)};
 if(portions.length===1){
  const p=portions[0];
  return {kind:'food',query:p.name,grams:p.grams,...(explicitLabel?{manualCarb100:explicitLabel[1]}:{})};
 }
 if(gc){
  const generic=raw.replace(/^.*?\b(?:glucides?|carbohydrates?|carbs?)\s+(?:dans|de|pour|du|des|d['’])\s*/iu,'')
   .replace(/[?!.,;:]+$/,'').trim();
  const name=clean(generic.replace(/\b(?:combien de glucides|glucides|stp|svp)\s*$/giu,'').trim(),90);
  if(!name||/^(?:je|mon|ma|mes|diabete|insuline|repas|aliment|produit)$/i.test(norm(name)))
   return {kind:'type1',question:raw};
  return {kind:'food',query:name,grams:100};
 }
 return null;
}

function normalizeProduct(p){
 const code=clean(p?.code,15),c=num(p?.nutriments?.carbohydrates_100g);
 if(!/^\d{8,14}$/.test(code)||!(c>=0&&c<=100))return null;
 return {code,carbs100:c,name:clean(p.product_name_fr||p.product_name||p.generic_name_fr||'Aliment sans nom',110),
  brands:clean(p.brands||'',60),source:HOST+'/product/'+code};
}
async function lookup(request,opts={}){
 const code=request.code,query=clean(request.query,75);
 if(!code && query.length<2)throw Error('Précise un aliment ou un code-barres.');
 const key=code?'c:'+code:'q:'+norm(query);
 const cached=cache.get(key);
 if(cached&&Date.now()-cached.at<600000)return cached.items;
 const now=Date.now();
 while(requests.length && now-requests[0]>60000)requests.shift();
 if(requests.length>=9)throw Error('Limite gratuite atteinte : attends une minute avant une autre recherche.');
 requests.push(now);
 const params=code
  ?new URLSearchParams({fields:'code,product_name,product_name_fr,generic_name_fr,brands,nutriments,serving_size'})
  :new URLSearchParams({search_terms:query,search_simple:'1',action:'process',json:'1',page:'1',page_size:'20',fields:'code,product_name,product_name_fr,generic_name_fr,brands,nutriments,serving_size'});
 const u=code?HOST+'/api/v2/product/'+code+'?'+params:HOST+'/cgi/search.pl?'+params;
 const controller=new AbortController();
 const abort=()=>controller.abort();opts.signal?.addEventListener('abort',abort,{once:true});
 if(opts.signal?.aborted){abort();throw Error('Recherche annulée.');}
 const timeout=setTimeout(abort,10000);
 let data;
 try{
  const res=await (opts.fetcher||root.fetch.bind(root))(u,{method:'GET',mode:'cors',credentials:'omit',cache:'no-store',headers:{Accept:'application/json'},signal:controller.signal});
  if(!res?.ok)throw Error(res?.status===429||res?.status===503?'Open Food Facts limite les recherches. Réessaie plus tard.':'Open Food Facts indisponible : HTTP '+(res?.status||'?'));
  data=await res.json();
 }catch(e){
  if(controller.signal.aborted)throw Error(opts.signal?.aborted?'Recherche annulée.':'Recherche nutritionnelle trop lente.');
  throw e;
 }finally{clearTimeout(timeout);opts.signal?.removeEventListener('abort',abort);}
 const products=(code?(data.product?[data.product]:[]):(data.products||[])).map(normalizeProduct).filter(Boolean).slice(0,10);
 cache.set(key,{at:now,items:products});if(cache.size>35)cache.delete(cache.keys().next().value);
 return products;
}

function spokenNumber(value){
 return fmt(value).replace(/\u202f/g,' ');
}
function explainPortions(parts){
 const names=parts.map(p=>fmt(p.grams)+' g de '+p.name).join(', ');
 const missing=parts.filter(p=>preparation(p.name)==='missing').map(p=>p.name);
 const message=missing.length
  ?'J’ai reconnu '+names+'. Pour '+missing.join(' et ')+', précise si le poids a été mesuré cru ou cuit.'
  :'J’ai reconnu '+names+'. Pour calculer un total fiable, donne les glucides pour 100 grammes de chaque aliment, indiqués sur les étiquettes, ou examine les produits un par un dans Food Maps.';
 return {kind:'food',needsClarification:true,sources:[],text:'**Repas composé :** '+names+'.\n\n'+message+
  '\n\nJe ne peux pas additionner les glucides sans valeurs nutritionnelles identifiées pour chaque élément.',
  spoken:message};
}
async function answer(request,opts={}){
 if(request.kind==='type1')return type1(request.question);
 if(request.kind!=='food')throw Error('Question non alimentaire.');
 if(Array.isArray(request.mealParts))return explainPortions(request.mealParts);
 const grams=request.grams===undefined?100:num(request.grams);
 if(!(grams>0&&grams<=5000))throw Error('Poids : indique une portion en grammes de 1 à 5 000.');
 if(request.manualCarb100!==undefined&&String(request.manualCarb100).trim()!==''){
  const c=num(request.manualCarb100),total=carbs(grams,c);
  const spoken='Pour '+spokenNumber(grams)+' grammes de cet aliment, avec '+spokenNumber(c)+' grammes de glucides pour 100 grammes sur l’étiquette, cela fait '+spokenNumber(total)+' grammes de glucides. Vérifie que l’étiquette correspond bien à la préparation pesée.';
  return {kind:'food',manual:true,sources:[],spoken,text:'**Food Maps — étiquette saisie par toi (non vérifiée)**\n\n'+fmt(grams)+' g × '+fmt(c)+' g de glucides pour 100 g ÷ 100 = **'+fmt(total)+' g de glucides**.\n\nVérifie l’étiquette et le poids cru/cuit. Ce chiffre ne détermine pas une dose d’insuline.'};
 }
 const state=preparation(request.query||'');
 if(state==='missing' && !request.code){
  pendingPreparation={query:request.query,grams,until:Date.now()+120000};
  const spoken='Pour '+request.query+', est-ce que tu as pesé '+spokenNumber(grams)+' grammes crus ou cuits ? Les glucides sont différents selon la cuisson.';
  return {kind:'food',needsClarification:true,sources:[],spoken,
   text:'**J’ai besoin d’une précision.** '+spoken+'\n\nRéponds simplement **« cru »** ou **« cuit »**.'};
 }
 const matches=await lookup(request,opts);
 if(!matches.length)throw Error('Aucun produit avec données glucidiques disponibles. Essaie le code-barres ou saisis les glucides pour 100 g indiqués sur l’étiquette.');
 const opposite=state==='cuit'?/(cru|secs?|s[èe]ches?|non cuit)/i
   :state==='cru'?/(cuit|cuite|cuits|cuites|prêt à manger)/i:null;
 const compatible=opposite?matches.filter(p=>!opposite.test(p.name)):matches;
 if(!compatible.length){
  return {kind:'food',needsClarification:true,sources:[],spoken:'Aucun produit compatible avec la préparation demandée. Donne-moi la marque, le code-barres ou les glucides pour 100 grammes sur l’étiquette.',
   text:'**Produit non identifié de manière fiable.** Les fiches trouvées ne correspondent pas à « '+clean(request.query,90)+' ». Précise le code-barres ou les glucides pour 100 g.'};
 }
 const chosen=compatible.slice(0,request.code?1:5);
 const rows=chosen.map((p,i)=>(request.code?'':'**'+(i+1)+'.** ')+'['+p.name.replace(/[\[\]*]/g,'')+' — '+p.brands.replace(/[\[\]*]/g,'')+']('+p.source+') : '+fmt(p.carbs100)+' g/100 g → **'+fmt(carbs(grams,p.carbs100))+' g de glucides** pour '+fmt(grams)+' g.');
 const first=chosen[0],firstTotal=carbs(grams,first.carbs100);
 const spoken=request.code
  ?'Selon la fiche Open Food Facts de '+first.name+', '+spokenNumber(grams)+' grammes correspondent à '+spokenNumber(firstTotal)+' grammes de glucides. Vérifie les informations sur ton emballage. Ce n’est pas une dose d’insuline.'
  :'Selon la première fiche Open Food Facts, '+first.name+', '+spokenNumber(grams)+' grammes correspondent à '+spokenNumber(firstTotal)+' grammes de glucides. '+(chosen.length>1?'Il existe plusieurs produits possibles. Confirme la marque ou le code-barres avant de te fier à ce chiffre.':'Confirme avec la marque et l’étiquette de ton aliment.');
 return {kind:'food',sources:chosen.map(p=>p.source),products:chosen,spoken,
  text:'**Food Maps · résultats d’Open Food Facts**\n\n'+rows.join('\n\n')+'\n\n'+(request.code?'Vérifie ton étiquette.':'**Choisis le bon produit ou cherche par code-barres.** Les marques et recettes varient.')+' Le poids cru et cuit n’est pas interchangeable. Données participatives pouvant contenir des erreurs. **Ce n’est pas une dose d’insuline.**\n\nSource : [Open Food Facts](https://world.openfoodfacts.org/) (ODbL).'};
}
root.RONFood={parse,answer,lookup,carbs,type1,normalizeProduct};
})(window);
