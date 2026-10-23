'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {build,files,target}=require('../ron-tools/build-pages.cjs');
const built=build();
assert.equal(built.length,19);
assert(fs.existsSync(path.join(target,'ron-presence.html')));
assert(fs.existsSync(path.join(target,'index.html')));
assert(fs.existsSync(path.join(target,'ron-presence-sw.js')));
assert(!fs.existsSync(path.join(target,'ron-tests')),'Do not ship test fixtures');
assert(!fs.existsSync(path.join(target,'.github')),'Do not ship CI workflows');
assert(!fs.existsSync(path.join(target,'RON_DOTS_Mistral_RateGuard_Agentique.html')),'Exclude old standalone prototype');
assert(!fs.existsSync(path.join(target,'index_original_jarvis.html')),'Exclude old prototype');
const html=fs.readFileSync(path.join(target,'ron-presence.html'),'utf8');
const worker=fs.readFileSync(path.join(target,'ron-presence-sw.js'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(target,'ron-presence.webmanifest'),'utf8'));
for(const src of [...html.matchAll(/<(?:script|link|img)\b[^>]*?\b(?:src|href)=["'](\.[^"'#?]+)["']/g)].map(x=>x[1])){
 assert(fs.existsSync(path.resolve(target,src)),'Published HTML references missing asset: '+src);
}
const shell=[...worker.matchAll(/'([^']+\.(?:html|js|webmanifest|png|svg|css))'/g)].map(x=>x[1]);
for(const src of shell)assert(files.includes(src),'Missing offline PWA shell file '+src);
for(const icon of manifest.icons)assert(fs.existsSync(path.resolve(target,icon.src)),'Missing PWA icon: '+icon.src);
assert(!shell.includes('ron-vendor/three.min.js'),'3D file should not be precached at PWA install');
console.log(JSON.stringify({passed:true,suite:'public-bundle',files:built.length,excludedLegacy:true}));
