'use strict';
// Only ship actual PWA / studio files. Historical experiments, tests and
// workflow files stay in Git history/repository but never become public pages.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const target=path.join(root,'ron-dist');
const files=[
 'index.html','ron-presence.html','ron-presence.webmanifest',
 'ron-presence-sw.js','ron-angel.svg','ron-icon-192.png','ron-icon-512.png',
 'ron-auto-config.js','ron-browser-ai.js','ron-cpu-worker.js','ron-net.js','ron-food.js','ron-agent-hub.js','ron-autonomy.js','ron-updater.js','ron-version.json','ron-knowledge.js','ron-knowledge.css',
 'ron-vendor/three.min.js','ron-vendor/three-LICENSE',
 'ron-vendor/marked.js','ron-vendor/marked-LICENSE',
 'ron-vendor/purify.min.js','ron-vendor/dompurify-LICENSE',
 'ron-vendor/fuse.basic.min.js','ron-vendor/fuse-LICENSE'
];
function build(){
 const sha=String(process.env.GITHUB_SHA||'').toLowerCase();
 const version=/^[0-9a-f]{40}$/.test(sha)?sha:'development';
 fs.rmSync(target,{recursive:true,force:true});
 for(const name of files){
  const source=path.resolve(root,name);
  const dest=path.resolve(target,name);
  if(!source.startsWith(root+path.sep)||!dest.startsWith(target+path.sep))
   throw Error('Unsafe public asset: '+name);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  if(name==='ron-version.json'){
   fs.writeFileSync(dest,JSON.stringify({version})+'\n');
   continue;
  }
  if(!fs.existsSync(source))throw Error('Missing public asset: '+name);
  if(name==='ron-presence-sw.js'){
   const sourceText=fs.readFileSync(source,'utf8');
   if(!sourceText.includes("const RELEASE='development';"))throw Error('Service worker release injection point missing');
   fs.writeFileSync(dest,sourceText.replace("const RELEASE='development';","const RELEASE='"+version+"';"));
  }else if(name==='ron-presence.html'){
   const sourceText=fs.readFileSync(source,'utf8');
   if(!sourceText.includes('content="development" id="ronRelease"'))throw Error('HTML release injection point missing');
   fs.writeFileSync(dest,sourceText.replace('content="development" id="ronRelease"','content="'+version+'" id="ronRelease"'));
  }else fs.copyFileSync(source,dest);
 }
 const assetPaths=fs.readdirSync(target,{recursive:true,withFileTypes:true}).filter(d=>d.isFile()).map(d=>d.name);
 if(assetPaths.length!==files.length)throw Error('Unexpected public asset count');
 return files.slice();
}
if(require.main===module){
 const built=build();
 console.log('RON Pages public bundle: '+built.length+' approved files (no backups/tests/private files).');
}
module.exports={build,files,root,target};
