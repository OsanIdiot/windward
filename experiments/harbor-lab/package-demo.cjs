const fs=require('node:fs'),path=require('node:path');
const {createHash}=require('node:crypto');
const repo=path.resolve(__dirname,'../..');
const core=['style.css','geography.js','navigation.js','engine.js','sea-ui.js','voyage-camera.js','voyage-art.js','voyage-ui.js','audio-config.js','play-session.js','discovery-ui.js','app.js','LICENSE','VERSION','assets/harbor-town.webp','assets/merchant-caravel.webp','assets/audio/RECORDING-CREDITS.md'];
const art=['demo-bootstrap.js','demo-entry.js','demo-voyage.js','demo.css','terrain-data.js','terrain-loader.js','terrain-worker.js','world.js','painted.js','ocean.js','painted-materials.webp','vendor/three.module.min.js','vendor/three.core.min.js','vendor/LICENSE-three.txt'];
function replaceOnce(text,pattern,value){const matches=text.match(new RegExp(pattern.source,'g'));if(matches?.length!==1)throw Error(`Integration anchor changed: ${pattern}`);return text.replace(pattern,value);}
function packageDemo(siteRoot=path.join(repo,'_site')){
  const destination=path.join(siteRoot,'demo');fs.mkdirSync(destination,{recursive:true});
  const copy=(source,name)=>{const target=path.join(destination,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(source,name),target);};
  core.forEach(name=>copy(repo,name));art.forEach(name=>copy(__dirname,name));
  const hash=createHash('sha256');for(const name of [...core,...art])hash.update(fs.readFileSync(path.join(destination,name)));hash.update(fs.readFileSync(__filename));
  const revision=hash.digest('hex').slice(0,12);
  const audio=fs.readdirSync(path.join(repo,'assets/audio')).filter(name=>/\.(wav|mp3|ogg|m4a)$/.test(name));audio.forEach(name=>copy(repo,`assets/audio/${name}`));
  let html=fs.readFileSync(path.join(repo,'index.html'),'utf8');
  html=replaceOnce(html,/<script src="engine\.js[^\"]*" defer><\/script>/,'$&\n  <script src="demo-bootstrap.js" defer></script>');
  html=replaceOnce(html,/<script src="app\.js[^\"]*" defer><\/script>/,'<script type="module" src="demo-entry.js"></script>');
  html=replaceOnce(html,/<\/head>/,'<link rel="stylesheet" href="demo.css"><meta name="robots" content="noindex,nofollow">\n</head>');
  html=replaceOnce(html,/<title>[^<]+<\/title>/,'<title>바람의 항로 · 2.5D 통합 체험판</title>');
  html=replaceOnce(html,/<body>/,'<body>\n<div id="demo-loading" class="demo-loading" role="status"><strong>체험판을 준비하고 있습니다.</strong><p>교역·탐험 기록은 정식판과 별도로 저장합니다.</p></div>');
  html=replaceOnce(html,/<section id="entry-screen" aria-label="입장 화면">/,'$&\n<aside class="demo-banner"><strong>2.5D 통합 체험판</strong><span id="demo-note"> · 기존 교역·탐험·의뢰·선박 기능 연결 · 정식판과 별도 자동 저장</span><small>기존 기록을 자동으로 가져오거나 덮어쓰지 않습니다. 새 항해로 시작합니다.</small><a href="../">정식 게임</a><a href="../lab/">그래픽 시험실</a></aside>');
  html=replaceOnce(html,/<button id="start-button"/,'<button disabled id="start-button"');
  html=html.replace(/(src|href)="([^"#]+\.(?:js|css))(?:\?[^\"]*)?"/g,`$1="$2?v=${revision}"`);
  fs.writeFileSync(path.join(destination,'index.html'),html);
  // A new HTML URL alone does not invalidate cached module imports on mobile.
  for(const name of art.filter(name=>name.endsWith('.js')&&!name.startsWith('vendor/'))){
    const file=path.join(destination,name);fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace(/(['"])(\.\/[^'"?]+\.js)\1/g,`$1$2?v=${revision}$1`));
  }
  const sound=replaceOnce(fs.readFileSync(path.join(repo,'audio.js'),'utf8'),/'windward-audio-enabled'/,"'windward-demo-audio-enabled'");fs.writeFileSync(path.join(destination,'audio.js'),sound);
  const fallback=fs.readFileSync(path.join(repo,'voyage-ui.js'),'utf8');
  if(fallback.split("'windward-camera'").length!==3)throw Error('Fallback camera storage anchor changed');
  fs.writeFileSync(path.join(destination,'voyage-ui.js'),fallback.replaceAll("'windward-camera'","'windward-demo-camera'"));
  // Only the copied view layer changes: navigation and simulation cadence stay intact.
  const app=replaceOnce(fs.readFileSync(path.join(repo,'app.js'),'utf8'),/  function renderStats\(\) \{/,
    `  let renderedStats = '';
  function renderStats() {
    const statsKey = [state.gold, E.used(state), state.ship, state.day, state.visited.length, state.discoveries.length, state.contractsDone.length, state.reputation, state.won, state.adventureWon].join('|');
    if (statsKey === renderedStats) return;
    renderedStats = statsKey;`);
  fs.writeFileSync(path.join(destination,'app.js'),app);
  return destination;
}
if(require.main===module)console.log(`Integrated demo: ${packageDemo()}`);
module.exports={packageDemo,core,art};
