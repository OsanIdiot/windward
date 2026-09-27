const fs=require('node:fs');
const path=require('node:path');
const repo=path.resolve(__dirname,'../..');
const local=['index.html','lab.css','lab.js','model.js','world.js','terrain-data.js','ocean.js','painted.js','painted-materials.webp','vendor/three.module.min.js','vendor/three.core.min.js','vendor/LICENSE-three.txt'];
const shared=['geography.js','navigation.js','engine.js'];

function packageLab(siteRoot=path.join(repo,'_site')){
  const destination=path.join(siteRoot,'lab');
  for(const name of [...local,...shared]){
    const source=path.join(shared.includes(name)?repo:__dirname,name),target=path.join(destination,name);
    fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);
  }
  return destination;
}
if(require.main===module)console.log(`Isolated browser preview: ${packageLab()}`);
module.exports={packageLab,files:[...local,...shared]};
