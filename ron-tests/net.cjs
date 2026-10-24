'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
async function main(){
 const calls=[],hits=[],stubData={
  'geocoding-api.open-meteo.com':{results:[{name:'Nantes',country:'France',latitude:47.22,longitude:-1.55}]},
  'api.open-meteo.com':{daily:{time:['2026-10-24','2026-10-25','2026-10-26'],weather_code:[3,61,1],
   temperature_2m_min:[8,9,10],temperature_2m_max:[13,16,18],precipitation_probability_max:[10,75,0],
   precipitation_sum:[0,4.2,0],wind_speed_10m_max:[14,29,9]}},
  'fr.wikipedia.org':{query:{pages:{123:{title:'Physique quantique',pageid:123,extract:'Étude physique de la matière.'}}}},
  'api.openalex.org':{results:[{id:'https://openalex.org/W123',title:'A scientific paper',
   publication_year:2025,doi:'https://doi.org/10.1234/test',primary_location:{source:{display_name:'Test Journal'}}}]},
  'api.github.com':{full_name:'Nikoju1977/Ron-',html_url:'https://github.com/Nikoju1977/Ron-',
   description:'Assistant personnel',stargazers_count:1,updated_at:'2026-10-24T00:00:00Z'}
 };
 const fetcher=async(url,opts)=>{
  const u=new URL(url);
  calls.push({host:u.hostname,url:u.toString(),opts});
  assert.equal(u.protocol,'https:');
  assert.equal(opts.method,'GET');
  assert.equal(opts.credentials,'omit');
  assert(!String(url).includes('api_key')&&!String(url).includes('token'),'No paid service or secret');
  if(!Object.hasOwn(stubData,u.hostname))throw Error('Unexpected outbound host '+u.hostname);
  return {ok:true,status:200,json:async()=>stubData[u.hostname]};
 };
 const root={navigator:{onLine:true},fetch:fetcher};
 const sandbox={window:root,URL,URLSearchParams,AbortController,setTimeout,clearTimeout,console};
 vm.runInNewContext(fs.readFileSync('ron-net.js','utf8'),sandbox,{filename:'ron-net.js'});
 const net=root.RONNet;
 assert(net,'Net connector must initialize');
 let p=net.parse('dis moi quel temps il fait demain ?');
 assert.equal(p.kind,'weather');assert.equal(p.day,1);assert.equal(p.city,'');
 assert.equal(net.parse('Quel temps demain à Nantes ?').city,'Nantes');
 assert.equal(net.parse('Météo demain à Nantes').kind,'weather');
 assert.equal(net.parse('je ne me sens pas bien'),null,'Private chats must not be transmitted');
 assert.equal(net.parse('mes fichiers personnels'),null);
 assert.equal(net.parse('cherche des études scientifiques sur les mitochondries').kind,'science');
 assert.equal(net.parse('Cherche sur Wikipédia la physique quantique').kind,'wiki');
 assert.equal(net.parse('regarde GitHub Nikoju1977/Ron-').kind,'github');
 const result=await net.answer(net.parse('Quel temps demain à Nantes ?'),{fetcher});
 assert.equal(result.kind,'weather');
 assert.match(result.text,/Prévision pour Nantes, France/);
 assert.match(result.text,/2026-10-25/);
 assert.match(result.text,/9 °C à 16 °C/);
 assert.match(result.text,/75%/);
 assert.match(result.text,/Open-Meteo/);
 assert.equal(calls.filter(x=>x.host.includes('open-meteo.com')).length,2);
 const geoCalls=[];
 const geo={getCurrentPosition:success=>{
  geoCalls.push('asked');
  success({coords:{latitude:47.0,longitude:-1.0}});
 }};
 const before=calls.length;
 const geolocated=await net.answer(net.parse('Quel temps fait-il demain ?'),{fetcher,geolocation:geo});
 assert.equal(geoCalls.length,1,'Browser location only on explicit weather query without a city');
 assert.match(geolocated.text,/ta position/);
 assert.equal(calls.length-before,1,'No geocoding API call when coordinates permitted');
 await assert.rejects(()=>net.answer(net.parse('Météo demain'),{
  fetcher,geolocation:{getCurrentPosition:(success,error)=>error({code:1})}
 }),/Position non autorisée/);
 const wiki=await net.answer(net.parse('Cherche sur Wikipédia la physique quantique'),{fetcher});
 assert.equal(wiki.kind,'wiki');assert.match(wiki.text,/Physique quantique/);
 assert.match(wiki.text,/fr.wikipedia.org/);
 const sci=await net.answer(net.parse('cherche des études scientifiques sur les mitochondries'),{fetcher});
 assert.equal(sci.kind,'science');assert.match(sci.text,/Test Journal/);assert.match(sci.text,/doi.org/);
 const gh=await net.answer(net.parse('regarde GitHub Nikoju1977/Ron-'),{fetcher});
 assert.equal(gh.kind,'github');assert.match(gh.text,/Nikoju1977/);assert.match(gh.text,/github.com/);
 assert(calls.every(c=>['api.open-meteo.com','geocoding-api.open-meteo.com','fr.wikipedia.org','api.openalex.org','api.github.com'].includes(c.host)));
 const ctrl=new AbortController();ctrl.abort();
 await assert.rejects(()=>net.answer({kind:'weather',day:1,city:'Nantes'},{fetcher,signal:ctrl.signal}),/annulée/);
 console.log(JSON.stringify({passed:true,suite:'net',checks:29,hosts:[...new Set(calls.map(c=>c.host))],paidRequests:0,geoPermissionRequestedOnce:true}));
}
main().catch(error=>{console.error(error);process.exit(1);});
