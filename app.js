(() => {
  'use strict';
  const E = window.Windward;
  const testMode = new URLSearchParams(location.search).get('test') === '1';
  const saveKey = testMode ? `${E.KEY}-test` : E.KEY;
  const saveLabel = testMode ? '테스트 기록 별도 저장' : '이 브라우저에 자동 저장';
  const $ = id => document.getElementById(id);
  const compactLayout = matchMedia('(max-width: 900px)');
  const fitChartDetails = () => { $('chart-details').open = !compactLayout.matches; };
  compactLayout.addEventListener('change', fitChartDetails);
  fitChartDetails();
  const number = value => value.toLocaleString('ko-KR');
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let state = E.initial(), tab = testMode ? 'ship' : 'market', side = 'buy', toastTimer, chart, voyage, sound, seaView = 'sea';
  let previousFrame = 0, lastSave = 0;
  let chartReturnAt = 0;
  const chartPointers = new Set();
  let playing = false, hasVoyage = false;
  let storageOK = true, storageMessage = '';
  const quantities = Object.fromEntries(E.GOODS.map(g => [g.id, 1]));
  try {
    const saved = localStorage.getItem(saveKey) || (testMode ? localStorage.getItem(E.KEY) : null);
    if (saved) {
      const parsed = JSON.parse(saved);
      const restored = E.migrate(parsed);
      if (restored) { state = restored; hasVoyage = true; if (parsed.version < 4) storageMessage = '기존 항해 기록을 이어갑니다. 항구 버튼으로 항해도를 열어보세요.'; }
      else storageMessage = '저장 기록을 읽을 수 없어 새 항해로 시작합니다.';
    }
  } catch (_) { storageOK = false; storageMessage = '저장 기능을 사용할 수 없습니다. 이 탭에서만 진행됩니다.'; }


  function toast(message, error = false) {
    clearTimeout(toastTimer);
    if ($('service-dialog').open) {
      $('service-feedback').textContent = message;
      $('service-feedback').classList.toggle('error', error);
      $('service-feedback').hidden = false;
    }
    $('toast').textContent = message;
    $('toast').classList.toggle('error', error);
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4300);
  }
  function save() {
    hasVoyage = true;
    try { localStorage.setItem(saveKey, JSON.stringify(state)); storageOK = true; }
    catch (_) { storageOK = false; }
    $('save-status').textContent = storageOK ? saveLabel : '저장 불가 · 이 탭에서만 유지';
  }
  function perform(action) {
    try {
      const wonBefore = state.won;
      const adventureBefore = state.adventureWon;
      state = E.act(state, action);
      save();
      if (action.type === 'resume' && seaView === 'map' && state.navigation?.running) showVoyage();
      else render();
      if (!['show-chart', 'enter-port'].includes(action.type)) toast(!adventureBefore && state.adventureWon ? '모험 목표 달성! 지중해의 모든 발견을 기록했습니다.' : !wonBefore && state.won ? '목표 달성! 지중해가 인정하는 무역상이 되었습니다.' : state.log[0]);
      return true;
    } catch (error) { toast(error.message, true); return false; }
  }
  function maxQuantity(good) {
    return side === 'buy' ? Math.max(0, Math.min(E.SHIPS[state.ship].capacity - E.used(state), Math.floor(state.gold / E.price(state, good).buy))) : state.cargo[good];
  }
  function quantity(good) {
    const max = maxQuantity(good);
    return max === 0 ? 0 : Math.min(max, Math.max(1, quantities[good]));
  }
  function goodsArt(good) {
    const paths = {
      grain: '<path d="M14 26V6m0 10C3 15 3 9 5 8c7 0 9 5 9 8Zm0 6c-10-1-11-6-9-7 6 0 9 3 9 7Zm0-11c0-7 3-10 5-9 4 4 1 9-5 9Zm0 8c1-7 7-11 10-8 1 6-4 9-10 8Z"/>',
      timber: '<path d="m4 17 13-9 9 5-13 10Z"/><path d="m4 12 13-9 9 5-13 10Z"/><ellipse cx="8" cy="21" rx="5" ry="5"/><ellipse cx="8" cy="21" rx="2" ry="2"/>',
      cloth: '<path d="M6 4h16v21H6Z"/><path d="M10 4v21M18 4v21M6 10h16M6 18h16"/><path d="m22 4 4 4v20H10l-4-3"/>',
      spice: '<path d="m11 8-3-6h12l-3 6c8 7 12 17 4 19H7C-1 25 3 14 11 8Z"/><path d="M10 8h9M10 11h9"/><circle cx="14" cy="20" r="3"/>'
    };
    return `<div class="goods-art"><svg viewBox="0 0 30 30" fill="none" stroke="${good.color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[good.id]}</svg></div>`;
  }
  function renderMap() { chart?.render(); }
  function renderMarket() {
    const port = E.portOf(state.port);
    const active = E.CONTRACTS.find(c => c.id === state.activeContract);
    $('dock-content').innerHTML = `${active ? `<div class="contract-reminder">납품 예정: ${E.GOODS.find(g => g.id === active.good).name} ${active.qty}개 → ${E.portLabel(state, active.to)}<br>일반 판매 시 의뢰용 물품도 차감됩니다. <button class="text-button" data-open-tab="contracts">의뢰 확인</button></div>` : ''}<div class="market-top"><p>항구별 고정 시세 · 1단위 기준</p><div class="segmented" aria-label="거래 방식"><button data-side="buy" aria-pressed="${side === 'buy'}" class="${side === 'buy' ? 'active' : ''}">구매</button><button data-side="sell" aria-pressed="${side === 'sell'}" class="${side === 'sell' ? 'active' : ''}">판매</button></div></div>
      ${E.GOODS.map(g => {
        const prices = E.price(state, g.id), qty = quantity(g.id), max = maxQuantity(g.id);
        return `<article class="commodity" data-good="${g.id}"><div class="commodity-head">${goodsArt(g)}<div class="commodity-info"><h3>${g.name}${port.specialty === g.id ? '<span class="badge">특산품</span>' : ''}</h3><p>보유 ${state.cargo[g.id]}${g.unit} <i>·</i> ${side === 'buy' ? '매입' : '판매'} 가능 ${max}</p></div><div class="commodity-price">${prices[side]} <small>G</small><p>${side === 'buy' ? `판매가 ${prices.sell}` : `구매가 ${prices.buy}`} G</p></div></div><div class="trade-controls"><div class="stepper"><button data-step="-1" data-good="${g.id}" aria-label="${g.name} 수량 줄이기" ${qty <= 1 ? 'disabled' : ''}>−</button><input type="number" inputmode="numeric" id="qty-${g.id}" data-quantity="${g.id}" aria-label="${g.name} 거래 수량" min="${max ? 1 : 0}" max="${max}" value="${qty}" ${max ? '' : 'disabled'}><button data-step="1" data-good="${g.id}" aria-label="${g.name} 수량 늘리기" ${qty >= max ? 'disabled' : ''}>+</button></div><button class="max-button" data-max="${g.id}" ${max ? '' : 'disabled'}>최대</button><button class="trade-button" data-trade="${g.id}" ${qty ? '' : 'disabled'}>${side === 'buy' ? '구매' : '판매'} · ${number(qty * prices[side])} G</button></div></article>`;
      }).join('')}
      <div class="market-tip">선장의 메모<br>${port.id === 'lume' ? '밀은 이곳에서 16 G, 카디스에서는 27 G에 팔 수 있어요. 출항 경비를 남겨두는 것도 잊지 마세요.' : port.id === 'haven' ? '이곳은 수입품 가격이 높은 자유항입니다. 다른 항구의 특산품을 가져와 판매해 보세요.' : `${E.GOODS.find(g => g.id === port.specialty).name}은(는) 이 항구의 특산품입니다. 저렴하게 매입해서 베네치아으로 운반해 보세요.`}</div>
      ${state.gold < 80 ? '<div class="relief"><button class="secondary" id="relief-button">부두 일하기 · 3일 / +100 G</button><p class="hint">금화가 80 G 미만이면 다시 항해할 수 있도록 일자리가 제공됩니다.</p></div>' : ''}`;
  }
  function updateQuantity(good, value) {
    const max = maxQuantity(good);
    quantities[good] = max ? Math.min(max, Math.max(1, Number.isFinite(value) ? Math.floor(value) : 1)) : 0;
    const input = $(`qty-${good}`), qty = quantities[good];
    input.value = qty;
    const row = input.closest('.commodity');
    row.querySelector('[data-step="-1"]').disabled = qty <= 1;
    row.querySelector('[data-step="1"]').disabled = qty >= max;
    const button = row.querySelector('[data-trade]');
    button.disabled = qty === 0;
    button.textContent = `${side === 'buy' ? '구매' : '판매'} · ${number(qty * E.price(state, good)[side])} G`;
  }
  function renderShip() {
    const ship = E.SHIPS[state.ship], next = E.SHIPS[state.ship + 1];
    $('dock-content').innerHTML = `<div class="ship-portrait"><svg aria-hidden="true"><use href="#ship-art"/></svg><p class="eyebrow">${ship.english}</p><h3>제비호</h3><p class="hint">${ship.name} · ${state.ship + 1} / ${E.SHIPS.length}단계</p></div><dl class="ship-details"><div><dt>화물 적재</dt><dd>${E.used(state)} / ${ship.capacity}칸</dd></div><div><dt>항해 속도</dt><dd>${ship.speed}배</dd></div><div><dt>누적 항해</dt><dd>${state.voyages}회</dd></div></dl>${next ? `<div class="upgrade-box"><p class="eyebrow">ROOM FOR A BIGGER DREAM</p><h3>${next.name} <small>${state.ship + 2}단계</small></h3><p>적재량 ${next.capacity}칸 · 속도 ${next.speed}배<br>보유 화물과 항해 기록은 그대로 이어집니다.</p><button class="primary" id="upgrade-button" ${state.gold < next.price ? 'disabled' : ''}>선박 교체 · ${number(next.price)} G</button>${state.gold < next.price ? `<p>${number(next.price - state.gold)} G를 더 모으면 구입할 수 있어요.</p>` : ''}</div>` : '<div class="upgrade-box"><h3>바다를 누빌 준비 완료</h3><p>가장 큰 무역선입니다. 이제 더 많은 화물을 싣고 새로운 교역로를 개척해 보세요.</p></div>'}<div class="cargo-manifest"><h3>화물 명세</h3>${E.GOODS.map(g => `<p><span>${g.name}</span><span>${state.cargo[g.id]}${g.unit}</span></p>`).join('')}</div>`;
    $('dock-content').insertAdjacentHTML('beforeend', `<details class="ship-roster"><summary>전체 선박 ${E.SHIPS.length}단계 보기</summary><ol>${E.SHIPS.map((item, i) => `<li${i === state.ship ? ' class="current"' : ''}><strong>${i + 1}단계 · ${item.name}${i === state.ship ? ' (현재)' : ''}</strong><span>적재 ${item.capacity}칸 · 속도 ${item.speed}배 · ${number(item.price)} G</span></li>`).join('')}</ol><p class="hint">가격은 단계별 교체 비용입니다. 제원과 등급은 게임용 설정입니다.</p></details>${testSupport()}`);
  }
  function testSupport() {
    return testMode
      ? '<div class="test-tools"><p class="eyebrow">TEST HARBOR</p><h3>선장 테스트 도구</h3><p>일반 기록과 별도 저장됩니다. 화물·발견·의뢰 기록은 유지합니다.</p><div><button class="secondary" id="test-gold-button">금화 +50,000 G</button><button class="primary" id="test-ship-button">최고 등급 배 장착</button></div></div>'
      : '<p class="hint">빠르게 시험해 보고 싶다면 <a href="?v=5&test=1">테스트 모드 열기</a> · 일반 기록은 변경되지 않습니다.</p>';
  }
  function applyTestSupport(kind) {
    if (!testMode || state.screen !== 'port' || !state.port) return;
    const next = JSON.parse(JSON.stringify(state));
    if (kind === 'gold') next.gold += 50000;
    if (kind === 'ship') next.ship = E.SHIPS.length - 1;
    if (!E.valid(next)) { toast('테스트 변경을 적용할 수 없습니다.', true); return; }
    state = next; save(); render();
    toast(kind === 'gold' ? '테스트 금화 50,000 G를 받았습니다.' : '7단계 대양 기함 장착! 적재량 320칸 · 속도 4배.');
  }
  function siteArt(site) {
    const drawings = {
      tide: '<path d="m130 133 9-78h26l9 78" fill="#e8dec0"/><path d="M136 54h32V37h-32Zm-5-17 21-15 21 15" fill="#af7052"/><path d="M147 69h10v15h-10Zm0 39h10v25h-10Z" fill="#698d85"/><path d="M136 45 38 64V25Zm32 0 94-20v39Z" fill="#f9ebbc" opacity=".6"/>',
      grove: '<g fill="#6d917b"><path d="m93 28-29 65h58Zm0 31-39 64h78Z"/><path d="m181 21-31 70h62Zm0 34-41 69h82Z"/></g><path d="M92 114v30m89-26v26" stroke="#6b7860" stroke-width="6"/><path d="m121 134 6-39 26-6 17 45Z" fill="#b5b292"/><path d="m137 103 7 18 10-16m-19 22h20" stroke="#e9e3c8" fill="none" stroke-width="2"/>',
      stars: '<path d="M95 133V81a55 55 0 0 1 110 0v52" fill="#c4c6aa"/><path d="M90 81h120M118 87v45m33-45v45m31-45v45" stroke="#82998c" stroke-width="3"/><path d="m148 60 14-31m-23 19 29 11" stroke="#bd8255" stroke-width="5"/><g fill="#f5efd2"><circle cx="49" cy="37" r="3"/><circle cx="236" cy="38" r="3"/><circle cx="215" cy="17" r="2"/><circle cx="71" cy="69" r="2"/></g>',
      garden: '<path d="M61 135V67h178v68" fill="#c7c6a0"/><path d="M126 135V83a25 25 0 0 1 50 0v52" fill="#789b82"/><g stroke="#587e66" stroke-width="3" fill="#92aa7d"><path d="M88 135V61m0 23c-24 0-26-20-13-16l13 16c23 0 24-25 12-21Z"/><path d="M211 135V50m0 29c-24 0-27-23-13-20l13 20c24 0 25-25 12-21Z"/></g><g fill="#b97957"><circle cx="78" cy="61" r="5"/><circle cx="220" cy="51" r="5"/><circle cx="99" cy="72" r="4"/></g>',
      archive: '<path d="M67 134V69h166v65" fill="#d3c6a4"/><path d="m54 69 96-47 97 47" fill="#9d8061"/><g stroke="#ece2c4" stroke-width="11"><path d="M88 78v53m40-53v53m43-53v53m40-53v53"/></g><path d="M64 134h174" stroke="#8b9278" stroke-width="5"/><path d="M128 104q12-5 22 1 12-6 23-1v20q-12-4-23 0-10-4-22 0Z" fill="#fcf1d5" stroke="#9c8b6b"/><path d="M150 105v19" stroke="#9c8b6b"/>'
    };
    return `<svg class="site-art" viewBox="0 0 300 164" aria-hidden="true"><rect width="300" height="164" fill="${site.id === 'stars' ? '#779a99' : '#cbdcd0'}"/><circle cx="241" cy="39" r="18" fill="#efe5bf" opacity=".8"/><path d="M0 137q43-17 92-2t103-5 105 4v30H0Z" fill="#9ab5a0"/><path d="M0 153q67-13 144-2t156-4" fill="none" stroke="#e2e4cc" stroke-width="2"/>${drawings[site.id]}</svg>`;
  }
  function renderAdventure() {
    const site = E.SITES.find(s => s.port === state.port);
    if (!site) { $('dock-content').innerHTML = '<div class="market-tip">이 항구에서는 교역과 선박 정비를 할 수 있습니다. 다른 항구에서 모험 단서를 찾아보세요.</div>'; return; }
    const found = state.discoveries.includes(site.id);
    const missing = site.requires.filter(id => !state.discoveries.includes(id)).map(id => E.SITES.find(s => s.id === id));
    $('dock-content').innerHTML = `<div class="explorer-summary"><span>발견 <strong>${state.discoveries.length} / 5</strong></span><span>항해자 명성 <strong>${state.reputation}</strong></span></div><article class="exploration-card">${siteArt(site)}<div class="exploration-body"><p class="eyebrow">${site.kind} · ${found ? '기록 완료' : '조사할 장소'}</p><h3>${site.name}</h3><p>${found ? site.story : site.rumor}</p>${found ? `<div class="discovery-perk">${site.benefit}</div>` : `<dl class="expedition-cost"><div><dt>탐험 준비</dt><dd>${site.cost} G · ${site.days}일</dd></div><div><dt>발견 보상</dt><dd>${site.reward} G · 명성 +${site.fame}</dd></div></dl><p class="hint">완료 후 순수입 +${site.reward - site.cost} G · 보상은 최초 1회</p>${missing.length ? `<p class="clue-needed">필요한 단서: ${missing.map(s => `${E.portLabel(state, s.port)}의 ${s.name}`).join(', ')}</p>` : ''}<button class="primary" id="explore-button" data-site="${site.id}" ${missing.length || state.gold < site.cost ? 'disabled' : ''}>${missing.length ? '단서를 먼저 찾아주세요' : state.gold < site.cost ? `준비금 ${site.cost - state.gold} G 부족` : `${site.days}일간 탐험하기`}</button>`}</div></article><div class="discovery-atlas"><h3>나의 발견 도감</h3>${E.SITES.map(s => `<details ${s.id === site.id && found ? 'open' : ''}><summary><span class="atlas-status ${state.discoveries.includes(s.id) ? 'found' : ''}">${state.discoveries.includes(s.id) ? '완료' : '미발견'}</span><span>${s.name}<small>${E.portLabel(state, s.port)}</small></span></summary><p>${state.discoveries.includes(s.id) ? s.story : s.rumor}</p>${state.discoveries.includes(s.id) ? `<p class="discovery-perk">${s.benefit}</p>` : ''}</details>`).join('')}</div>`;
  }
  function renderContracts() {
    const active = E.CONTRACTS.find(c => c.id === state.activeContract);
    const offered = E.CONTRACTS.find(c => c.from === state.port);
    const describe = c => { const g = E.GOODS.find(g => g.id === c.good); return `${g.name} ${c.qty}${g.unit} → ${E.portLabel(state, c.to)}`; };
    let activeHTML = '';
    if (active) {
      const enough = state.cargo[active.good] >= active.qty, arrived = state.port === active.to;
      activeHTML = `<article class="contract-card active-contract"><p class="eyebrow">YOUR CURRENT PROMISE</p><h3>${active.name}</h3><p>${describe(active)}</p><p class="hint">보유 ${state.cargo[active.good]} / 필요 ${active.qty}<br>납품 대금 ${active.reward} G · 명성 +${active.fame}</p><button class="primary" id="deliver-button" ${enough && arrived ? '' : 'disabled'}>${!arrived ? `${E.portLabel(state, active.to)}에서 납품 가능` : !enough ? '납품할 화물이 부족합니다' : `물품 납품 · ${active.reward} G 받기`}</button><p class="hint">대금은 물품값 포함입니다. 일반 판매 대신 여기서 납품하세요.</p><button class="text-button" id="cancel-contract-button">의뢰 취소 (화물 유지)</button></article>`;
    }
    if (!offered) { $('dock-content').innerHTML = activeHTML || '<p class="hint">지금은 새로운 의뢰가 없습니다. 다른 항구에서 사람들의 이야기를 들어보세요.</p>'; return; }
    const done = state.contractsDone.includes(offered.id);
    $('dock-content').innerHTML = `<div class="explorer-summary"><span>완료한 의뢰 <strong>${state.contractsDone.length} / 5</strong></span><span>명성 <strong>${state.reputation}</strong></span></div>${activeHTML}<article class="contract-card"><p class="eyebrow">LETTERS FROM THE HARBOR</p><h3>${offered.name}</h3><p>${offered.story}</p><p class="delivery-line">${describe(offered)}</p><dl class="expedition-cost"><div><dt>납품 대금 (물품값 포함)</dt><dd>${offered.reward} G</dd></div><div><dt>완료 명성</dt><dd>+${offered.fame}</dd></div></dl><button class="secondary" id="accept-contract-button" data-contract="${offered.id}" ${done || active ? 'disabled' : ''}>${done ? '이미 전달한 마음입니다' : active ? '진행 중인 의뢰가 있습니다' : '의뢰 수락하기'}</button></article><p class="hint">물품은 직접 구매해서 준비합니다. 한 번에 1건, 시간제한 없이 진행하며 각 의뢰는 한 번만 보상받습니다.</p>`;
  }
  function renderDock() {
    if (!state.port || state.screen !== 'port') return;
    $('port-name').innerHTML = `${E.portOf(state.port).name} <small>항구</small>`;
    $('port-subtitle').textContent = E.portOf(state.port).subtitle;
    $('port-description').textContent = E.portOf(state.port).flavor;
    $('service-port').textContent = E.portOf(state.port).name + ' · 항구 시설';
    $('service-title').textContent = { market: '교역소', adventure: '탐험', contracts: '의뢰', ship: '조선소 · 선박', log: '항해 일지' }[tab];
    document.querySelectorAll('[data-tab]').forEach(button => {
      const active = button.dataset.tab === tab;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    $('dock-content').setAttribute('aria-labelledby', `tab-${tab}`);
    if (tab === 'market') renderMarket();
    if (tab === 'ship') renderShip();
    if (tab === 'adventure') renderAdventure();
    if (tab === 'contracts') renderContracts();
    if (tab === 'log') $('dock-content').innerHTML = `<p class="hint">${state.day}일의 여정 · ${state.voyages}번의 항해<br>가장 최근 기록부터 표시됩니다.</p><ol class="log-list">${state.log.map(line => `<li>${escape(line)}</li>`).join('')}</ol>`;
    for (const p of E.PORTS) if (!state.visited.includes(p.id)) $('dock-content').innerHTML = $('dock-content').innerHTML.split(p.name).join('미확인 항구');
  }
  function renderStats() {
    $('gold').innerHTML = `${number(state.gold)} <em>G</em>`;
    $('cargo-count').innerHTML = `${E.used(state)} <em>/ ${E.SHIPS[state.ship].capacity}</em>`;
    $('day').innerHTML = `${state.day} <em>일째</em>`;
    $('visited').innerHTML = `${state.visited.length} <em>/ ${E.PORTS.length}</em>`;
    $('quest-checks').innerHTML = `<span class="${state.visited.length === E.PORTS.length ? 'complete' : ''}">항구 ${state.visited.length}/${E.PORTS.length}</span><span class="${state.ship >= 1 ? 'complete' : ''}">선박 업그레이드 ${state.ship >= 1 ? '완료' : '준비 중'}</span><span class="${state.gold >= 5000 ? 'complete' : ''}">${number(state.gold)} / 5,000 G</span>${state.won ? '<span class="complete">첫 챕터 완료! 자유롭게 계속 항해하세요.</span>' : ''}`;
    $('adventure-checks').innerHTML = `<span class="${state.discoveries.length === 5 ? 'complete' : ''}">발견 ${state.discoveries.length}/5</span><span class="${state.contractsDone.length >= 3 ? 'complete' : ''}">의뢰 ${state.contractsDone.length}/3</span><span>명성 ${state.reputation}</span>${state.adventureWon ? '<span class="complete">모험 목표 달성</span>' : ''}`;
  }
  function render() {
    document.body.classList.toggle('playing', playing);
    if (!playing || state.screen !== 'chart' || seaView !== 'map' || !state.navigation?.running) cancelChartPeek();
    $('entry-screen').hidden = playing;
    $('game-screen').hidden = !playing;
    $('chart-screen').hidden = !playing || state.screen !== 'chart' || seaView !== 'map';
    $('voyage-screen').hidden = !playing || state.screen !== 'chart' || seaView !== 'sea';
    $('dock').hidden = !playing || state.screen !== 'port';
    $('start-button').innerHTML = `${hasVoyage ? '이어하기' : '항해 시작'} <span aria-hidden="true">→</span>`;
    $('entry-summary').textContent = hasVoyage ? `${state.day}일째 · ${state.port ? E.portLabel(state, state.port) : '해상에서 정지 중'} · ${number(state.gold)} G` : '리스본, 작은 돛배 한 척에서 시작되는 이야기';
    renderStats(); renderMap(); renderDock(); voyage?.render();
    syncSound();
  }
  function syncSound() {
    sound?.update({ active: playing && !document.hidden, sea: state.screen === 'chart', moving: !!state.navigation?.running, speed: state.navigation?.running ? state.motion?.speed ?? 1 : 0, turning: !!state.motion?.turning });
  }
  function focusScreen(id) {
    $(id).focus({ preventScroll: true });
    $(id).scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }
  function cancelChartPeek() {
    chartReturnAt = 0;
    $('chart-peek-note').hidden = true;
  }
  function showVoyage() {
    cancelChartPeek(); chartPointers.clear();
    seaView = 'sea'; render(); focusScreen('voyage-heading');
  }
  function updateChartPeek(stamp) {
    if (!chartReturnAt) return;
    if (!playing || document.hidden || state.screen !== 'chart' || seaView !== 'map' || !state.navigation?.running) { cancelChartPeek(); return; }
    // Let map gestures, dialogs and expanded mobile details finish before returning.
    if (chartPointers.size || document.querySelector('dialog[open]') || (compactLayout.matches && $('chart-details').open)) chartReturnAt = stamp + 3000;
    const remaining = Math.max(0, Math.ceil((chartReturnAt - stamp) / 1000));
    $('chart-peek-note').hidden = false;
    const note = `항해 중 · ${remaining}초 뒤 배로 복귀 · 정지하면 해도 유지`;
    if ($('chart-peek-note').textContent !== note) $('chart-peek-note').textContent = note;
    if (stamp >= chartReturnAt) showVoyage();
  }
  function navigate(action) {
    try {
      state = E.act(state, { type: 'navigate', ...action });
      save();
      if (seaView === 'map' && state.navigation?.running) showVoyage();
      else render();
      return true;
    } catch (error) { toast(error.message, true); return false; }
  }
  function steer(heading) {
    try {
      state = E.act(state, { type: 'steer', heading }); save(); render(); return true;
    } catch (error) { toast(error.message, true); return false; }
  }
  function frame(stamp) {
    const dt = Math.min(.15, Math.max(0, (stamp - previousFrame) / 1000));
    previousFrame = stamp;
    if (playing && state.navigation?.running && dt > 0 && !document.hidden) {
      const wasPort = state.port;
      try { state = E.advance(state, dt); }
      catch (error) { state = E.act(state, { type: 'pause' }); toast(error.message, true); }
      renderStats(); renderMap();
      if (wasPort !== state.port || !state.navigation?.running) {
        if (state.port) { side = 'sell'; tab = E.CONTRACTS.find(c => c.id === state.activeContract)?.to === state.port ? 'contracts' : 'market'; }
        renderDock(); save(); toast(state.log[0]);
      } else if (stamp - lastSave > 700) { save(); lastSave = stamp; }
    }
    voyage?.render(stamp);
    updateChartPeek(stamp);
    syncSound();
    requestAnimationFrame(frame);
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button?.disabled) return;
    if (!button) return;
    if (button.hasAttribute('data-sound')) { sound.toggle(); return; }
    if (button.hasAttribute('data-support')) { window.open('https://litt.ly/iwiwi', '_blank', 'noopener,noreferrer'); return; }
    if (button.dataset.close) { $(button.dataset.close).close(); return; }
    if (button.id === 'help-button' || button.hasAttribute('data-help')) { $('help-dialog').showModal(); return; }
    if (button.dataset.service) {
      if (!playing || !state.port || state.screen !== 'port') return;
      tab = button.dataset.service; renderDock();
      $('service-feedback').hidden = true;
      $('service-dialog').showModal(); $('service-dialog').scrollTop = 0;
      $('service-title').focus({ preventScroll: true }); return;
    }
    if (button.id === 'start-button') {
      playing = true; save(); render(); sound.unlock(); focusScreen('game-screen'); return;
    }
    if (button.id === 'return-menu-button') {
      $('service-dialog').close();
      if (state.navigation?.running) state = E.act(state, { type: 'pause' });
      playing = false; save(); render();
      clearTimeout(toastTimer); $('toast').hidden = true;
      focusScreen('entry-title'); return;
    }
    if (button.id === 'harbor-button') {
      $('service-dialog').close();
      seaView = 'sea';
      if (perform({ type: 'show-chart' })) { chart.reset(); voyage.reset(); focusScreen('voyage-heading'); }
      return;
    }
    if (button.id === 'open-chart-button' || button.id === 'mini-chart-button') {
      seaView = 'map'; chartPointers.clear();
      chartReturnAt = state.navigation?.running ? performance.now() + 3000 : 0;
      render(); chart.reset(); updateChartPeek(performance.now()); focusScreen('chart-heading'); return;
    }
    if (button.id === 'return-sea-button') {
      showVoyage(); return;
    }
    if (button.id === 'enter-port-button' || button.id === 'voyage-enter-port') {
      const arrived = !state.port;
      if (perform({ type: 'enter-port' })) {
        sound.arrival();
        side = arrived ? 'sell' : side;
        tab = E.CONTRACTS.find(c => c.id === state.activeContract)?.to === state.port ? 'contracts' : 'market';
        renderDock(); focusScreen('port-name');
        if (arrived) toast(state.log[0]);
      }
      return;
    }
    if (button.dataset.openTab) {
      if (state.screen !== 'port') return;
      tab = button.dataset.openTab; renderDock();
      $('service-dialog').scrollTop = 0;
      $(`tab-${tab}`).focus({ preventScroll: true }); return;
    }
    if (button.dataset.tab) { tab = button.dataset.tab; $('service-feedback').hidden = true; renderDock(); return; }
    if (button.dataset.side) { side = button.dataset.side; renderDock(); return; }
    if (button.dataset.step) { const g = button.dataset.good; updateQuantity(g, Number($(`qty-${g}`).value) + Number(button.dataset.step)); return; }
    if (button.dataset.max) { const g = button.dataset.max; updateQuantity(g, maxQuantity(g)); return; }
    if (button.dataset.trade) { const g = button.dataset.trade; updateQuantity(g, Number($(`qty-${g}`).value)); perform({ type: 'trade', good: g, qty: quantities[g], side }); return; }
    if (button.id === 'test-gold-button') { applyTestSupport('gold'); return; }
    if (button.id === 'test-ship-button') { applyTestSupport('ship'); return; }
    if (button.id === 'upgrade-button') { perform({ type: 'upgrade' }); return; }
    if (button.id === 'rescue-button' || button.id === 'voyage-rescue') { perform({ type: 'rescue' }); chart.reset(); voyage.reset(); return; }
    if (button.id === 'relief-button') { perform({ type: 'relief' }); return; }
    if (button.id === 'accept-contract-button') { perform({ type: 'accept', contract: button.dataset.contract }); return; }
    if (button.id === 'deliver-button') { perform({ type: 'deliver' }); return; }
    if (button.id === 'cancel-contract-button') { perform({ type: 'cancel-contract' }); return; }
    if (button.id === 'explore-button') {
      const site = E.SITES.find(s => s.id === button.dataset.site);
      if (perform({ type: 'explore', site: site.id })) {
        $('discovery-art').innerHTML = siteArt(site);
        $('discovery-title').textContent = site.name;
        $('discovery-story').textContent = site.story;
        $('discovery-benefit').textContent = site.benefit;
        $('discovery-reward').textContent = `${site.days}일 조사 완료 · 경비 ${site.cost} G · 학회 보상 ${site.reward} G · 명성 +${site.fame}`;
        $('discovery-dialog').showModal();
      }
      return;
    }
    if (button.id === 'reset-button') { $('reset-dialog').showModal(); return; }
    if (button.id === 'confirm-reset') {
      state = E.initial(); tab = 'market'; side = 'buy';
      E.GOODS.forEach(g => { quantities[g.id] = 1; });
      playing = true; seaView = 'sea';
      syncSound(); sound.unlock();
      $('reset-dialog').close(); save(); render(); chart.reset(); focusScreen('game-screen'); toast('리스본에서 새로운 항해가 시작되었습니다.');
    }
  });
  document.addEventListener('change', event => {
    if (event.target.dataset.quantity) updateQuantity(event.target.dataset.quantity, Number(event.target.value));
  });
  document.querySelector('.tabs').addEventListener('keydown', event => {
    const tabs = [...document.querySelectorAll('[data-tab]')];
    const index = tabs.indexOf(document.activeElement);
    if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
    tab = tabs[next].dataset.tab; renderDock(); tabs[next].focus();
  });
  window.addEventListener('storage', event => {
    if (event.key === saveKey) toast('다른 탭에서 항해 기록이 변경되었습니다. 기록 충돌을 피하려면 한 탭에서 플레이해 주세요.', true);
  });
  if (testMode) {
    const banner = document.createElement('aside');
    banner.className = 'test-banner';
    banner.innerHTML = '<strong>테스트 모드</strong><span>일반 기록과 별도로 저장 · 선박 메뉴에서 금화 지급 / 최고 등급 장착</span><a href="?v=5">일반 플레이로 돌아가기</a>';
    $('entry-screen').prepend(banner);
    $('play-mode-label').textContent = '테스트 모드';
    document.title += ' · 테스트 모드';
  }
  chart = window.createSeaUI({ read: () => state, navigate, toggle: type => perform({ type }), notify: toast });
  voyage = window.createVoyageUI({ read: () => state, steer, navigate, toggle: type => perform({ type }), notify: toast });
  sound = window.createSeaAudio({ notify: toast, changed: ({ enabled, supported, waiting }) => {
    document.querySelectorAll('[data-sound]').forEach(button => {
      button.textContent = !supported ? '소리 미지원' : waiting ? '소리 대기' : enabled ? '소리 켜짐' : '소리 꺼짐';
      button.setAttribute('aria-pressed', String(enabled && supported));
      button.setAttribute('aria-label', !supported ? '항해 소리 미지원' : enabled ? '항해 소리 끄기' : '항해 소리 켜기');
      button.title = waiting ? '화면을 터치하면 소리가 재개됩니다. 누르면 소리를 끕니다.' : '은은한 물살·바람·갈매기·선박·입항 알림음';
      button.disabled = !supported;
    });
  } });
  document.addEventListener('pointerdown', () => { if (playing) sound.unlock(); });
  document.addEventListener('keydown', () => { if (playing) sound.unlock(); });
  $('chart-screen').addEventListener('pointerdown', event => { if (chartReturnAt) chartPointers.add(event.pointerId); });
  const releaseChartPointer = event => {
    if (chartPointers.delete(event.pointerId) && chartReturnAt) chartReturnAt = performance.now() + 3000;
  };
  document.addEventListener('pointerup', releaseChartPointer);
  document.addEventListener('pointercancel', releaseChartPointer);
  $('chart-screen').addEventListener('wheel', () => { if (chartReturnAt) chartReturnAt = performance.now() + 3000; }, { passive: true });
  $('chart-screen').addEventListener('keydown', () => { if (chartReturnAt) chartReturnAt = performance.now() + 3000; });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelChartPeek(); chartPointers.clear(); }
    if (document.hidden && state.navigation?.running) { state = E.act(state, { type: 'pause' }); save(); renderMap(); }
    syncSound();
  });
  window.addEventListener('pagehide', () => { sound.update({ active: false, sea: false, moving: false }); if (hasVoyage) save(); });
  requestAnimationFrame(frame);
  render();
  $('save-status').textContent = storageOK ? saveLabel : '저장 불가 · 이 탭에서만 유지';
  if (storageMessage) toast(storageMessage);
})();
