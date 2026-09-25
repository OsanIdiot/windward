(function (root) {
  'use strict';
  root.createDiscoveryUI = function ({ read, active, perform, navigate }) {
    const E = root.Windward, N = E.N, $ = id => document.getElementById(id);
    const dialog = $('sea-atlas-dialog');
    let lastUpdate = 0;
    function rumors({ port, inAtlas = false } = {}) {
      const state = read();
      const entries = E.SEA_RUMORS.filter(r => port ? r.port === port && E.rumorStage(state, r.id) !== 'locked' : state.seaRumors.includes(r.id));
      if (!entries.length) return port ? '' : '<p class="hint">기록한 소문이 없습니다. 리스본의 탐험 메뉴에서 뱃사공의 이야기를 들어보세요.</p>';
      return entries.map(r => {
        const stage = E.rumorStage(state, r.id), heard = stage !== 'offered', complete = stage === 'complete';
        const steps = [heard, state.seaClues.includes(r.site), state.seaDiscoveries.includes(r.site), complete];
        const here = state.screen === 'port' && state.port === r.port;
        const next = E.SEA_RUMORS.find(other => other.requires.includes(r.id));
        const instruction = stage === 'search' ? '소문 속 방향으로 출항해 망원경으로 흔적을 찾아보세요. 소문만으로 해도에 위치가 표시되지는 않습니다.'
          : stage === 'investigate' ? '흔적을 찾았습니다. 해상 발견 도감의 단서로 접근해 완전히 정지한 뒤 조사하세요.'
          : stage === 'report' ? `조사 기록이 준비되었습니다. ${E.portLabel(state, r.port)}에 입항해 탐험 메뉴에서 이야기를 전하세요. 이미 조사한 발견은 다시 찾을 필요가 없습니다.` : '';
        const progress = `<ol class="rumor-steps">${['소문 기록', '흔적 발견', '바다 조사', '항구에 전달'].map((label, i) => `<li class="${steps[i] ? 'complete' : ''}"><span>${i + 1}</span>${label}${steps[i] ? '<small>완료</small>' : ''}</li>`).join('')}</ol>`;
        const followup = next && !state.seaRumors.includes(next.id) ? `<p class="rumor-next"><strong>이어지는 소문 · ${E.portLabel(state, next.port)}</strong><br>${next.lead}</p>` : '';
        const action = stage === 'report' && here ? `<button class="primary" data-rumor-report="${r.id}">기록 전달 · 명성 +${r.fame}</button>` : !inAtlas ? '<button class="secondary" data-sea-atlas aria-haspopup="dialog" aria-controls="sea-atlas-dialog">소문과 발견 도감 보기</button>' : '';
        const result = complete ? `<p class="rumor-ending">${r.ending}</p><p class="hint">기록 전달 보상: 명성 +${r.fame} 수령 완료 · 조사 보상은 기존 발견 보상으로 1회 지급</p>${followup}` : `<p class="rumor-next">${instruction}</p>${action}`;
        const body = heard ? `<blockquote>${r.hint}</blockquote>${progress}${result}` : `<p>${r.invitation}</p><button class="primary" data-rumor-hear="${r.id}">소문 듣고 기록하기</button><p class="hint">무료 · 시간제한 없음 · 바다 조사 후 이 항구에 기록을 전달하면 명성 +${r.fame}</p>`;
        return `<article class="rumor-card ${complete ? 'recorded' : ''}" data-rumor-card="${r.id}"><p class="eyebrow">${complete ? 'A STORY TO KEEP / 이야기 완결' : 'WORD ON THE QUAY / 항구의 소문'}</p><h3 tabindex="-1">${r.title}</h3><p class="rumor-speaker">${E.portLabel(state, r.port)} · ${r.speaker}</p>${body}</article>`;
      }).join('');
    }
    function build() {
      const state = read();
      $('sea-rumor-list').innerHTML = rumors({ inAtlas: true });
      const ready = E.SEA_RUMORS.filter(r => E.rumorStage(state, r.id) === 'report');
      $('sea-rumor-notice').hidden = !ready.length;
      $('sea-rumor-notice').textContent = ready.map(r => `조사 기록이 준비되었습니다. ${E.portLabel(state, r.port)} 탐험 메뉴에서 '${r.title}' 이야기를 전달하세요.`).join(' ');
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
      build(); dialog.querySelector('.rumor-journal').open = !scan && read().seaRumors.length > 0;
      if (!dialog.open) dialog.showModal(); dialog.scrollTop = 0; $('sea-atlas-title').focus({ preventScroll: true });
    }
    document.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || button.disabled || !active()) return;
      if (button.hasAttribute('data-sea-atlas')) open(false);
      if (button.dataset.rumorHear || button.dataset.rumorReport) {
        const id = button.dataset.rumorHear || button.dataset.rumorReport;
        if (perform({ type: button.dataset.rumorHear ? 'hear-rumor' : 'report-rumor', rumor: id })) {
          if (dialog.open) build();
          (dialog.open ? dialog : $('dock-content')).querySelector(`[data-rumor-card="${id}"] h3`)?.focus({ preventScroll: true });
        }
      }
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
    return { rumors, render(stamp) {
      if (stamp - lastUpdate < 250 || !active()) return;
      lastUpdate = stamp;
      if (dialog.open) update();
      const state = read(), hints = E.seaSightings(state).filter(s => !state.seaDiscoveries.includes(s.id));
      $('lookout-button').textContent = hints.length ? '망원경 · 단서 있음' : '망원경';
    } };
  };
})(window);
