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
 const named=await food.answer({kind:'food',query:'pâtes',grams:150},{fetcher});
 assert.equal(named.products.length,2,'Missing/impossible nutritional values are not presented as facts');
 assert.match(named.text,/105 g de glucides/);
 assert.match(named.text,/35,3 g de glucides/);
 assert.match(named.text,/Choisis le bon produit/);
 assert(named.sources.every(u=>u.startsWith('https://world.openfoodfacts.org/product/')));
 assert.equal(calls.length,1,'One global search for wide food coverage');
 const repeat=await food.answer({kind:'food',query:'pâtes',grams:200},{fetcher});
 assert.match(repeat.text,/140 g de glucides/);
 assert.equal(calls.length,1,'Cache avoids repeated OFF calls for each portion change');
 const barcode=await food.answer({kind:'food',code:'3017620422003',grams:50},{fetcher});
 assert.match(barcode.text,/35 g de glucides/);
 assert.equal(calls.length,2,'Barcode uses direct product endpoint');
 const p=hub.plan('150 g de riz');
 assert.equal(p.request.kind,'food');
 assert.equal(p.specialist.name,'Food Maps · glucides');
 const result=await hub.run('150 g de riz',{connectorOptions:{fetcher}});
 assert.equal(result.kind,'food');
 assert.match(result.text,/105 g de glucides/);
 assert(result.sources.every(u=>u.startsWith('https://world.openfoodfacts.org/')));
 const m=hub.verify({kind:'food'},{kind:'food',manual:true,text:'36 g de glucides par calcul de poids.',sources:[]});
 assert.equal(m.sources.length,0,'Allow explicitly user-supplied food label with no invented source');
 assert.throws(()=>hub.verify({kind:'food'},{kind:'food',text:'Vérifié',sources:['https://evil.example/'] }),/source publique/);
 assert.throws(()=>hub.verify({kind:'type1'},{kind:'type1',text:'Aide',sources:['https://world.openfoodfacts.org/product/3017620422003']}),/source publique/);
 assert.equal(root.RONFood.parse('explique moi la physique quantique'),null,'Do not hijack unrelated questions');
 console.log(JSON.stringify({passed:true,suite:'food',checks:32,requests:calls.length,worldwideProducts:true,insulinDoses:false}));
}
main().catch(e=>{console.error(e);process.exit(1)});
