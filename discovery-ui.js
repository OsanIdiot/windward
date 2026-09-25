(function (root) {
  'use strict';
  root.createDiscoveryUI = function ({ read, active, perform, navigate }) {
    const E = root.Windward, N = E.N, $ = id => document.getElementById(id);
    const dialog = $('sea-atlas-dialog');
    let lastUpdate = 0;
    function build() {
      const state = read();
      $('sea-atlas-count').textContent = `해상 발견 ${state.seaDiscoveries.length} / ${E.SEA_SITES.length}`;
      const priority = site => state.seaDiscoveries.includes(site.id) ? 1 : state.seaClues.includes(site.id) ? 0 : 2;
      $('sea-atlas-list').innerHTML = [...E.SEA_SITES].sort((a, b) => priority(a) - priority(b)).map(site => {
        const found = state.seaDiscoveries.includes(site.id), known = state.seaClues.includes(site.id);
        return `<article class="sea-find ${found ? 'recorded' : ''}" data-sea-card="${site.id}"><p class="eyebrow">${found ? 'RECORDED / 기록 완료' : known ? 'ON THE HORIZON / 단서 발견' : 'UNCHARTED / 미확인'}</p><h3>${found ? site.name : known ? site.clue : '아직 만나지 못한 바다의 이야기'}</h3>${found ? `<p>${site.story}</p><p class="hint">${site.kind} · 최초 보상 ${site.reward} G · 명성 +${site.fame} 수령 완료</p>` : known ? `<p class="hint">가까이 접근해 완전히 정지한 뒤 조사하세요. 최초 보상 ${site.reward} G · 명성 +${site.fame}</p>` : '<p class="hint">항해 중 망원경으로 주변 해역을 살펴보세요.</p>'}${known && !found ? `<p class="sea-find-distance" data-sea-distance="${site.id}"></p><div class="sea-find-actions"><button class="secondary" data-sea-approach="${site.id}">단서로 접근</button><button class="secondary" data-sea-stop="${site.id}">정지</button><button class="primary" data-sea-survey="${site.id}">조사하기</button></div>` : ''}</article>`;
      }).join('');
      update();
    }
    function update() {
      const state = read(), atSea = state.screen === 'chart';
      $('sea-atlas-scan').hidden = !atSea;
      for (const site of E.SEA_SITES) {
        const label = dialog.querySelector(`[data-sea-distance="${site.id}"]`);
        if (!label) continue;
        const distance = N.distance(state.position, site), clear = N.clear(state.position, site);
        const angle = (Math.atan2(site.x - state.position.x, state.position.y - site.y) * 180 / Math.PI + 360) % 360;
        const direction = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'][Math.round(angle / 45) % 8];
        const near = distance <= E.SURVEY_RANGE && clear, moving = !!state.navigation?.running || state.motion.speed > 0;
        label.textContent = !atSea ? '출항 후 접근할 수 있습니다.' : `${direction}쪽 · ${Math.ceil(distance)} 해도 단위 · ${!clear ? '육지 너머: 해도로 우회하세요' : near ? moving ? '조사 범위 안 · 정지 필요' : '조사할 수 있습니다' : moving ? '항해는 계속됩니다' : '단서에 더 가까이 접근하세요'}`;
        dialog.querySelector(`[data-sea-approach="${site.id}"]`).disabled = !atSea || !clear || near;
        const stop = dialog.querySelector(`[data-sea-stop="${site.id}"]`);
        stop.disabled = !atSea || !state.navigation?.running || state.navigation.stopping;
        stop.textContent = state.navigation?.stopping ? '감속 중' : '정지';
        dialog.querySelector(`[data-sea-survey="${site.id}"]`).disabled = !atSea || !!state.port || !near || moving;
      }
    }
    function open(scan) {
      if (!active()) return;
      if (scan && !perform({ type: 'lookout' })) return;
      build(); if (!dialog.open) dialog.showModal(); dialog.scrollTop = 0; $('sea-atlas-title').focus({ preventScroll: true });
    }
    document.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || button.disabled || !active()) return;
      if (button.hasAttribute('data-sea-atlas')) open(false);
      if (button.id === 'lookout-button') open(true);
      if (button.id === 'sea-atlas-scan' && perform({ type: 'lookout' })) { build(); $('sea-atlas-scan').focus(); }
      if (button.dataset.seaApproach) {
        const site = E.SEA_SITES.find(s => s.id === button.dataset.seaApproach);
        if (site && read().seaClues.includes(site.id) && navigate({ mode: 'manual', point: { x: site.x, y: site.y } })) dialog.close();
      }
      if (button.dataset.seaStop) { perform({ type: 'pause' }); update(); }
      if (button.dataset.seaSurvey && perform({ type: 'survey-sea', site: button.dataset.seaSurvey })) {
        build(); $('sea-atlas-count').focus({ preventScroll: true });
      }
    });
    return { render(stamp) {
      if (stamp - lastUpdate < 250 || !active()) return;
      lastUpdate = stamp;
      if (dialog.open) update();
      const state = read(), hints = E.seaSightings(state).filter(s => !state.seaDiscoveries.includes(s.id));
      $('lookout-button').textContent = hints.length ? '망원경 · 단서 있음' : '망원경';
    } };
  };
})(window);
