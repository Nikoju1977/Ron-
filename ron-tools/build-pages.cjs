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
 'ron-auto-config.js','ron-browser-ai.js','ron-cpu-worker.js','ron-knowledge.js','ron-knowledge.css',
 'ron-vendor/three.min.js','ron-vendor/three-LICENSE',
 'ron-vendor/marked.js','ron-vendor/marked-LICENSE',
 'ron-vendor/purify.min.js','ron-vendor/dompurify-LICENSE',
 'ron-vendor/fuse.basic.min.js','ron-vendor/fuse-LICENSE'
];
function build(){
 fs.rmSync(target,{recursive:true,force:true});
 for(const name of files){
  const source=path.resolve(root,name);
  const dest=path.resolve(target,name);
  if(!source.startsWith(root+path.sep)||!dest.startsWith(target+path.sep)||!fs.existsSync(source))
   throw Error('Missing/unsafe public asset: '+name);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.copyFileSync(source,dest);
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
