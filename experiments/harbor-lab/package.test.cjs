const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {packageLab,files}=require('./package.cjs');

test('Pages preview is self-contained below lab and leaves the production entry unchanged',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'windward-pages-'));
  try{
    fs.writeFileSync(path.join(root,'index.html'),'production entry sentinel');
    const lab=packageLab(root);assert.equal(fs.readFileSync(path.join(root,'index.html'),'utf8'),'production entry sentinel');
    function list(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?list(path.join(dir,e.name)):path.relative(lab,path.join(dir,e.name)).split(path.sep).join('/'));}
    assert.deepEqual(list(lab).sort(),files.slice().sort());
    const html=fs.readFileSync(path.join(lab,'index.html'),'utf8');
    assert.doesNotMatch(html,/(?:src|href)=["']\//);
    for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){if(match[1].startsWith('data:'))continue;assert.ok(fs.existsSync(path.join(lab,match[1])),match[1]);}
    for(const name of ['geography.js','navigation.js','engine.js'])assert.deepEqual(fs.readFileSync(path.join(lab,name)),fs.readFileSync(path.join(__dirname,'../..',name)));
    assert.ok(!files.some(name=>/test|server|README|bench|\.png|\.env/.test(name)));
  }finally{
    // Remove only the unique test directory under the OS temporary directory.
    assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('windward-pages-'));fs.rmSync(root,{recursive:true});
  }
});
