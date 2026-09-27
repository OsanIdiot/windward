if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
const status=document.getElementById('demo-loading');
async function script(src){await new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=src;el.onload=resolve;el.onerror=reject;document.head.append(el);});}
try{
  const {installPaintedVoyage}=await import('./demo-voyage.js');
  await installPaintedVoyage();
}catch(error){
  console.warn('Painted renderer unavailable; retaining the chart renderer.',error);
  document.getElementById('demo-note').textContent='3D 화면을 준비하지 못해 기존 항해 화면으로 실행합니다. 체험판 기록은 별도로 저장됩니다.';
}
try{
  await script('app.js');status.remove();
  document.getElementById('play-mode-label').textContent='체험판';
  document.getElementById('play-mode-label').title='2.5D 통합 체험판 · 정식판과 별도 저장';
  document.getElementById('start-button').disabled=false;
  window.windwardDemoReady=true;
}catch(error){status.textContent='게임 파일을 불러오지 못했습니다. 새로고침해 주세요.';console.error(error);}
