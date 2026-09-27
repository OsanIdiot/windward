const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {packageDemo,core,art}=require('./package-demo.cjs');
const repo=path.resolve(__dirname,'../..');
test('integrated build reuses production gameplay and isolates all persistent preferences',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'windward-demo-'));
  try{
    fs.writeFileSync(path.join(root,'index.html'),'production sentinel');
    const dest=packageDemo(root),read=name=>fs.readFileSync(path.join(dest,name),'utf8');
    assert.equal(fs.readFileSync(path.join(root,'index.html'),'utf8'),'production sentinel');
    for(const name of core.filter(n=>!['voyage-ui.js','app.js'].includes(n)))assert.deepEqual(fs.readFileSync(path.join(dest,name)),fs.readFileSync(path.join(repo,name)),name);
    assert.equal(read('app.js').replace(/  let renderedStats = '';\r?\n/,'').replace(/\r?\n    const statsKey = \[state\.gold[^\n]+\n    if \(statsKey === renderedStats\) return;\r?\n    renderedStats = statsKey;/,''),fs.readFileSync(path.join(repo,'app.js'),'utf8'));
    const E=require('../../engine.js'),context={window:{Windward:E}};vm.runInNewContext(read('demo-bootstrap.js'),context);
    assert.equal(context.window.Windward.KEY,'windward-demo-v1');assert.equal(E.KEY,'windward-v1');
    for(const key of ['act','advance','initial','migrate'])assert.equal(context.window.Windward[key],E[key]);
    assert.doesNotMatch(read('audio.js'),/'windward-audio-enabled'/);assert.match(read('audio.js'),/'windward-demo-audio-enabled'/);
    assert.doesNotMatch(read('voyage-ui.js'),/'windward-camera'/);assert.match(read('voyage-ui.js'),/'windward-demo-camera'/);
    assert.doesNotMatch(read('demo-voyage.js'),/\bE\.(advance|act)\(/,'Renderer cannot run a second simulation');
    const html=read('index.html');assert.ok(html.indexOf('engine.js')<html.indexOf('demo-bootstrap.js'));
    assert.match(html,/<script type="module" src="demo-entry.js\?v=[a-f0-9]+"><\/script>/);assert.doesNotMatch(html,/<script src="app\.js/);
    const revision=html.match(/demo-entry.js\?v=([a-f0-9]+)/)[1];
    for(const name of ['demo-entry.js','demo-voyage.js','terrain-loader.js','terrain-worker.js']){
      for(const [,url] of read(name).matchAll(/['"](\.\/[^'\"]+\.js[^'\"]*)['"]/g))assert.ok(url.endsWith(`?v=${revision}`),url);
    }
    for(const [,url] of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
      if(/^(data:|https?:|\.\.\/)/.test(url))continue;
      assert.ok(fs.existsSync(path.join(dest,url.split('?')[0])),url);
    }
    for(const sound of Object.values(require('../../audio-config.js').sfx.sounds))assert.ok(fs.existsSync(path.join(dest,sound.file)),sound.file);
    const list=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?list(path.join(dir,e.name)):path.relative(dest,path.join(dir,e.name)).split(path.sep).join('/'));
    assert.ok(!list(dest).some(n=>/test\.cjs|server\.cjs|README|bench|\.png$|\.env/.test(n)));
    for(const name of art)assert.ok(list(dest).includes(name));
  }finally{assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('windward-demo-'));fs.rmSync(root,{recursive:true});}
});
