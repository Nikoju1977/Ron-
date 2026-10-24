'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const calls=[],payload={
 products:[
  {code:'3017620422003',product_name_fr:'Pâtes sèches',brands:'Marque test',nutriments:{carbohydrates_100g:70}},
  {code:'3245410000005',product_name_fr:'Pâtes cuites',brands:'Deuxième marque',nutriments:{carbohydrates_100g:23.5}},
  {code:'3017620422004',product_name:'Données absentes',nutriments:{}},
  {code:'3017620422005',product_name:'Valeur invalide',nutriments:{carbohydrates_100g:125}}
 ]};
const fetcher=async(u,options)=>{
 const url=new URL(u);calls.push(url);
 assert.equal(url.hostname,'world.openfoodfacts.org');
 assert.equal(url.protocol,'https:');
 assert.equal(options.method,'GET');
 assert.equal(options.credentials,'omit');
 assert.equal(options.cache,'no-store');
 assert(!url.search.includes('insuline')&&!url.search.includes('glycemie'),'Never send private medical terms to search service');
 if(url.pathname.includes('/product/'))return {ok:true,json:async()=>({product:payload.products[0]})};
 assert.equal(url.pathname,'/cgi/search.pl','Use full-text search rather than v2 filters for named foods');
 assert.equal(url.searchParams.get('page_size'),'20');
 return {ok:true,json:async()=>payload};
};
const root={navigator:{onLine:true},fetch:fetcher};
vm.runInNewContext(fs.readFileSync('ron-food.js','utf8'),{window:root,URL,URLSearchParams,AbortController,setTimeout,clearTimeout,console,Date,Intl},{filename:'ron-food.js'});
vm.runInNewContext(fs.readFileSync('ron-agent-hub.js','utf8'),{window:root,URL,Object,console},{filename:'ron-agent-hub.js'});
const food=root.RONFood,hub=root.RONAgentHub;
async function main(){
 assert(food,'Food Maps must load');
 assert.equal(food.carbs(150,20),30);
 assert.equal(food.carbs('150','24,5'),36.8);
 assert.equal(food.carbs(100,0),0);
 assert.throws(()=>food.carbs(150,101),/Glucides/);
 assert.throws(()=>food.carbs(-1,20),/Poids/);
 assert.equal(food.parse('combien de glucides dans 150 g de pâtes ?').grams,150);
 assert.equal(food.parse('150 g de riz').query,'riz');
 assert.equal(food.parse('Glucides dans 250 g de pommes ?').grams,250);
 assert.equal(food.parse('code-barres 3017620422003').code,'3017620422003');
 assert.equal(food.parse('3017620422003').code,'3017620422003');
 assert.equal(food.parse('mes documents personnels'),null);
 assert.equal(food.parse('je suis triste'),null);
 assert.equal(food.parse('combien d’unités d’insuline pour 30 g de glucides ?').kind,'type1');
 assert.equal(food.parse('diabète de type 1 et hypoglycémie sévère').kind,'type1');
 assert.match((await food.answer({kind:'type1',question:'quelle dose insuline'})).text,/ne prescris ni dose/);
 assert.match((await food.answer({kind:'type1',question:'hypoglycémie sévère'})).text,/15 ou le 112/);
 const manual=await food.answer({kind:'food',query:'riz',grams:'150',manualCarb100:'24,5'},{fetcher});
 assert.equal(manual.manual,true);
 assert.match(manual.text,/36,8 g de glucides/);
 assert.equal(manual.sources.length,0,'Manual values are not falsely attributed to OFF');
 assert.equal(calls.length,0,'Manual calculations must never use the network');

 // Without raw/cooked information, no numerical result from arbitrary food.
 const question=await food.answer({kind:'food',query:'pâtes',grams:150},{fetcher});
 assert.equal(question.needsClarification,true);
 assert.match(question.spoken,/crus ou cuits/);
 assert.equal(calls.length,0,'Never call food search before the preparation is known');
 const followup=food.parse('cuites');
 assert.equal(followup.kind,'food');
 assert.equal(followup.grams,150);
 assert.match(followup.query,/pâtes cuit/);
 const cooked=await food.answer(followup,{fetcher});
 assert.equal(cooked.products.length,1,'Exclude dry pasta when cooked pasta was requested');
 assert.match(cooked.text,/35,3 g de glucides/);
 assert.match(cooked.spoken,/35,3 grammes de glucides/);
 assert.equal(calls.length,1,'One search only once raw/cooked was clarified');
 const repeat=await food.answer({kind:'food',query:followup.query,grams:200},{fetcher});
 assert.match(repeat.text,/47 g de glucides/);
 assert.equal(calls.length,1,'Cache avoids repeated OFF calls for each portion change');
 const dry=await food.answer({kind:'food',query:'pâtes crues',grams:150},{fetcher});
 assert.equal(dry.products.length,1);
 assert.match(dry.text,/105 g de glucides/);
 assert.equal(calls.length,2);
 const barcode=await food.answer({kind:'food',code:'3017620422003',grams:50},{fetcher});
 assert.match(barcode.text,/35 g de glucides/);
 assert.match(barcode.spoken,/35 grammes de glucides/);
 assert.equal(calls.length,3,'Barcode uses direct product endpoint');
 const manualSpoken=await food.answer(food.parse('150 g de pâtes, étiquette 24,5 g de glucides pour 100 g'),{fetcher});
 assert.match(manualSpoken.spoken,/36,8 grammes de glucides/);
 assert.equal(calls.length,3,'An orally provided label is used locally, never sent online');
 const meal=food.parse("J’ai mangé 100 g de pâtes cuites et 50 g de pain, combien de glucides ?");
 assert.equal(meal.kind,'food');
 assert.equal(meal.mealParts.length,2,'A multi-ingredient meal is not treated as one product');
 const mealReply=await food.answer(meal,{fetcher});
 assert.equal(mealReply.needsClarification,true);
 assert.match(mealReply.spoken,/Pour calculer un total fiable/);
 assert.equal(calls.length,3,'Do not manufacture the total of several unverified foods');
 assert.match(food.parse('Ron, j’ai mangé 150 grammes de riz cuit, ça fait combien de glucides ?').query,/riz cuit/);
 assert.equal(food.parse('combien de glucides pour 150 g de pâtes').kind,'food');
 const p=hub.plan('150 g de pâtes cuites');
 assert.equal(p.request.kind,'food');
 assert.equal(p.specialist.name,'Food Maps · glucides');
 const result=await hub.run('150 g de pâtes cuites',{connectorOptions:{fetcher}});
 assert.equal(result.kind,'food');
 assert.match(result.text,/35,3 g de glucides/);
 assert(result.sources.every(u=>u.startsWith('https://world.openfoodfacts.org/')));
 const m=hub.verify({kind:'food'},{kind:'food',manual:true,text:'36 g de glucides par calcul de poids.',sources:[]});
 assert.equal(m.sources.length,0,'Allow explicitly user-supplied food label with no invented source');
 const clarification=hub.verify({kind:'food'},{kind:'food',needsClarification:true,text:'Pâtes crues ou cuites ?',sources:[]});
 assert.equal(clarification.sources.length,0,'Clarification is valid without claiming a food database source');
 assert.throws(()=>hub.verify({kind:'food'},{kind:'food',text:'Vérifié',sources:['https://evil.example/'] }),/source publique/);
 assert.throws(()=>hub.verify({kind:'type1'},{kind:'type1',text:'Aide',sources:['https://world.openfoodfacts.org/product/3017620422003']}),/source publique/);
 assert.equal(root.RONFood.parse('explique moi la physique quantique'),null,'Do not hijack unrelated questions');
 console.log(JSON.stringify({passed:true,suite:'food',checks:52,requests:calls.length,worldwideProducts:true,spokenFrench:true,insulinDoses:false}));
}
main().catch(e=>{console.error(e);process.exit(1)});
