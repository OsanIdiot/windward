(function (root) {
  'use strict';
  const N = root.SeaNavigation || require('./navigation.js');
  const GOODS = [
    { id: 'grain', name: '밀', unit: '자루', base: 24, color: '#c99748' },
    { id: 'timber', name: '목재', unit: '묶음', base: 38, color: '#8d6249' },
    { id: 'cloth', name: '직물', unit: '필', base: 65, color: '#798faa' },
    { id: 'spice', name: '향신료', unit: '상자', base: 100, color: '#b85f42' }
  ];
  const PORTS = [
    { id: 'lume', name: '리스본', subtitle: '포르투갈 왕국 · 대서양 교역항', specialty: 'grain', lon: -9.14, lat: 38.72, sea: [-9.34, 38.66], prices: [16, 42, 74, 120], flavor: '1550년경, 포르투갈의 해외 교역이 모이는 테주강의 항구. 벨렝 앞바다에서 항해를 시작합니다.' },
    { id: 'cedar', name: '카디스', subtitle: '카스티야 왕관령 · 대서양의 관문', specialty: 'timber', lon: -6.29, lat: 36.53, sea: [-6.34, 36.52], prices: [30, 25, 79, 113], flavor: '대서양과 지중해 사이를 오가는 선박들이 모이는 카디스 만. 동쪽으로 가면 지브롤터 해협에 이릅니다.' },
    { id: 'azure', name: '제노바', subtitle: '제노바 공화국 · 리구리아의 항구', specialty: 'cloth', lon: 8.93, lat: 44.41, sea: [8.93, 44.38], prices: [33, 49, 42, 127], flavor: '리구리아 해안의 해상 교역 도시. 상인과 금융가들이 지중해의 여러 항구를 연결합니다.' },
    { id: 'saffron', name: '알렉산드리아', subtitle: '오스만 제국 · 이집트의 교역항', specialty: 'spice', lon: 29.89, lat: 31.2, sea: [29.86, 31.24], prices: [36, 53, 81, 64], flavor: '이집트의 지중해 교역항. 내륙과 바다를 잇는 상인들이 곡물과 다양한 수입품을 거래합니다.' },
    { id: 'haven', name: '베네치아', subtitle: '베네치아 공화국 · 아드리아해의 항구', specialty: null, lon: 12.34, lat: 45.43, sea: [12.45, 45.32], prices: [39, 57, 93, 145], flavor: '석호 위에 세워진 해상 공화국. 리도 바깥 정박지로 접근하면 베네치아에 입항할 수 있습니다.' },
    { id: 'barcelona', name: '바르셀로나', subtitle: '아라곤 왕관령 · 카탈루냐 해안', specialty: 'cloth', lon: 2.18, lat: 41.38, sea: [2.21, 41.35], prices: [27, 43, 47, 118], flavor: '서부 지중해의 항구 도시. 이베리아 반도 동해안을 따라 북상하는 상선들이 들릅니다.' },
    { id: 'marseille', name: '마르세유', subtitle: '프랑스 왕국 · 프로방스의 항구', specialty: 'timber', lon: 5.37, lat: 43.3, sea: [5.32, 43.27], prices: [31, 29, 68, 126], flavor: '프로방스 해안의 오래된 교역항. 동쪽의 리구리아와 남쪽 지중해로 항로가 이어집니다.' },
    { id: 'ragusa', name: '라구사', subtitle: '라구사 공화국 · 오늘날의 두브로브니크', specialty: 'grain', lon: 18.11, lat: 42.64, sea: [18.1, 42.62], prices: [22, 38, 76, 132], flavor: '아드리아해 동해안의 해상 공화국. 오늘날 두브로브니크로 알려진 이 항구는 교역으로 번성했습니다.' }
  ].map(p => ({ ...p, ...N.nearestSea(N.project(...p.sea)) }));
  const SHIPS = [
    { name: '작은 돛배', english: 'THE LITTLE SWALLOW', capacity: 24, speed: 1, price: 0 },
    { name: '무역용 캐러벨', english: 'THE TRADING SWALLOW', capacity: 40, speed: 1.3, price: 650 },
    { name: '상인용 카락', english: 'THE GRAND SWALLOW', capacity: 64, speed: 1.65, price: 1600 },
    { name: '대형 카락', english: 'THE OCEAN SWALLOW', capacity: 100, speed: 2, price: 3200 },
    { name: '원양 무역선', english: 'THE FAR HORIZON', capacity: 150, speed: 2.5, price: 6000 },
    { name: '대형 상선', english: 'THE GOLDEN PASSAGE', capacity: 220, speed: 3.1, price: 11000 },
    { name: '대양 기함', english: 'THE WINDWARD FLAGSHIP', capacity: 320, speed: 4, price: 20000 }
  ];
  const SITES = [
    { id: 'tide', port: 'lume', name: '벨렝 앞바다의 해류', kind: '항로 조사', days: 2, cost: 90, reward: 180, fame: 10, requires: [], rumor: '벨렝의 선원에게서 테주강 하구의 해류를 배울 수 있습니다.', story: '선원들과 하구를 조사하여 조류와 바람을 해도에 기록했습니다. 이 지식이 다음 항해의 경비를 줄여줍니다.', benefit: '해류 지도 획득: 모든 항해의 하루 경비 8 G → 7 G.' },
    { id: 'grove', port: 'cedar', name: '카디스 항해자의 기록', kind: '항해 기록', days: 3, cost: 150, reward: 260, fame: 15, requires: [], rumor: '항해자가 남긴 기록에서 별을 보고 방향을 읽는 지혜를 배웁니다.', story: '기록에 적힌 상인의 표식이 리구리아의 항로 문서와 이어집니다.', benefit: '항해 기록 획득: 리구리아 해안에서 다음 문서를 조사할 수 있습니다.' },
    { id: 'stars', port: 'azure', name: '제노바의 항로 문서', kind: '문서 발견', days: 3, cost: 200, reward: 380, fame: 20, requires: ['grove'], rumor: '서쪽 항구에서 얻은 기록을 바탕으로 제노바 상인들의 문서를 조사합니다.', story: '상인의 문서를 대조해 아드리아해 항로를 정리했습니다. 마지막 서고의 열람 허가에 필요한 표식을 발견했습니다.', benefit: '상인 문서 획득: 아드리아해 서고를 찾는 첫 번째 단서.' },
    { id: 'garden', port: 'saffron', name: '알렉산드리아 식물 표본', kind: '식물 발견', days: 3, cost: 180, reward: 340, fame: 20, requires: ['tide'], rumor: '항해 지식을 교환하며 이집트 시장의 식물과 교역품 표본을 조사합니다.', story: '시장의 식물 표본을 분류하고 상인들의 이야기를 기록했습니다. 협조한 상인이 추천 편지를 건넸습니다.', benefit: '추천 편지 획득: 아드리아해 서고를 찾는 두 번째 단서.' },
    { id: 'archive', port: 'haven', name: '베네치아의 해도 서고', kind: '최종 발견', days: 4, cost: 260, reward: 520, fame: 35, requires: ['stars', 'garden'], rumor: '상인의 문서와 추천 편지가 있으면 베네치아의 해도 기록을 조사할 수 있습니다.', story: '해도와 항해 일지를 대조해 나만의 지중해 항로집을 완성했습니다. 서로 다른 항구에서 모은 지식이 하나로 이어졌습니다.', benefit: '지중해 항로집 완성. 다섯 탐험의 이야기를 모두 기록했습니다.' }
  ];
  // Fictional encounters on the historical chart, not claims about real wrecks.
  const SEA_SITES = [
    { id: 'seabirds', name: '물새들의 쉼터', clue: '수면 위를 맴도는 새 떼', kind: '자연 관찰', sea: [-9.65, 38.25], reward: 80, fame: 5, story: '새들이 낮게 도는 곳에서 작은 물고기 떼를 발견했습니다. 물결과 새들의 움직임을 항해 일지에 그려 넣었습니다.' },
    { id: 'wreck', name: '부서진 배의 항해 일지', clue: '물결에 흔들리는 부서진 돛대', kind: '난파 흔적', sea: [-7.4, 36.3], reward: 120, fame: 8, story: '떠다니는 선체 조각에서 방수 천으로 감싼 일지를 건졌습니다. 이름 없는 선원이 남긴 별자리 스케치를 도감에 보관했습니다.' },
    { id: 'shoal', name: '푸른 여울의 암초', clue: '유난히 밝게 빛나는 얕은 물', kind: '해역 조사', sea: [3.0, 40.25], reward: 100, fame: 6, story: '배를 안전한 물에 세우고 망원경으로 물빛을 살폈습니다. 수면 아래 암초의 윤곽을 그려 다음 항해에 참고할 표식을 남겼습니다.' },
    { id: 'dolphins', name: '뱃머리를 앞서는 돌고래', clue: '수평선 가까이 튀어 오르는 물보라', kind: '자연 관찰', sea: [7.7, 43.25], reward: 90, fame: 6, story: '돌고래 무리가 배 옆을 지나갔습니다. 잠시 돛을 내리고 기다리며 등지느러미와 헤엄치는 모습을 기록했습니다.' },
    { id: 'cargo', name: '바다가 돌려준 도기', clue: '밧줄에 엉킨 작은 부유물', kind: '표류물 조사', sea: [17.3, 41.9], reward: 130, fame: 8, story: '낡은 그물에 싸인 도기 조각을 건져 올렸습니다. 바닥의 상인 표식을 베껴 항해 도감에 남겼습니다.' }
  ].map(s => ({ ...s, ...N.nearestSea(N.project(...s.sea)) }));
  const SIGHT_RANGE = 75, SURVEY_RANGE = 7;
  const SEA_RUMORS = [
    { id: 'seabirds', port: 'lume', site: 'seabirds', requires: [], title: '새들이 가리킨 물길', speaker: '벨렝의 늙은 뱃사공', fame: 3,
      invitation: '뱃사공이 남서쪽 바다를 바라보다 당신에게 손짓합니다.',
      hint: '리스본에서 남서쪽 앞바다로 나가 보게. 새들이 유난히 낮게 모이는 곳이 있어. 해안을 뒤로하고 망원경으로 둘러보면 알아볼 걸세.',
      ending: '새 떼와 물고기를 그린 항해일지를 펼치자 뱃사공이 웃었습니다. "바다는 금화 말고도 남길 것이 많지." 당신의 관찰은 부두 선원들이 함께 읽는 기록이 되었습니다.' },
    { id: 'wreck', port: 'cedar', site: 'wreck', requires: ['seabirds'], title: '물결에 남은 한 페이지', speaker: '부두의 기록 수집가', fame: 5,
      invitation: '새 떼를 관찰한 선장이라는 말을 들었다며, 기록 수집가가 작은 부탁을 건넵니다.',
      hint: '이 항구에서 서쪽 바깥바다로 가 보세요. 물결 사이로 부서진 돛대가 보인다는군요. 망원경으로 흔적을 찾고, 가까이에서 멈춘 뒤 남은 기록이 있는지 살펴봐 주세요.',
      ending: '건져 올린 별자리 스케치를 기록 수집가에게 보여 주었습니다. 이름 없는 선원의 한 페이지가 새들의 물길을 그린 당신의 기록 옆에 놓였습니다. 서로 다른 항구의 작은 이야기가 하나의 항해일지로 이어졌습니다.',
      lead: '리스본 남동쪽 해안을 따라, 지브롤터 서편에 있는 항구의 탐험 메뉴에서 기록 수집가를 만나세요.' }
  ];
  function rumorStage(state, id) {
    const rumor = SEA_RUMORS.find(r => r.id === id);
    if (!rumor || !rumor.requires.every(required => (state.seaStories || []).includes(required))) return 'locked';
    if ((state.seaStories || []).includes(id)) return 'complete';
    if (!(state.seaRumors || []).includes(id)) return 'offered';
    if ((state.seaDiscoveries || []).includes(rumor.site)) return 'report';
    return (state.seaClues || []).includes(rumor.site) ? 'investigate' : 'search';
  }
  const seaSightings = state => state.screen === 'chart' ? SEA_SITES.filter(s => N.distance(state.position, s) <= SIGHT_RANGE && N.clear(state.position, s)) : [];
  const CONTRACTS = [
    { id: 'bread', from: 'lume', to: 'cedar', name: '항구의 제빵사를 위해', good: 'grain', qty: 8, reward: 260, fame: 8, story: '카디스의 제빵사가 새로 문을 엽니다. 밀을 구해 전해주세요.' },
    { id: 'loom', from: 'cedar', to: 'azure', name: '직조공의 새 베틀', good: 'timber', qty: 10, reward: 540, fame: 10, story: '제노바의 직조공들이 튼튼한 목재로 새 베틀을 만들고 싶어 합니다.' },
    { id: 'sails', from: 'azure', to: 'saffron', name: '시장의 천막', good: 'cloth', qty: 6, reward: 560, fame: 10, story: '알렉산드리아의 작은 축제에 햇빛을 가려줄 직물이 필요합니다.' },
    { id: 'tea', from: 'saffron', to: 'haven', name: '상인의 향신료 주문', good: 'spice', qty: 5, reward: 810, fame: 12, story: '베네치아의 상인이 동지중해를 거쳐 온 향신료를 주문했습니다.' },
    { id: 'pier', from: 'haven', to: 'lume', name: '고향의 작은 부두', good: 'timber', qty: 6, reward: 350, fame: 8, story: '리스본의 낡은 부두를 고칠 목재가 필요합니다. 구입할 항구는 자유롭게 정하세요.' }
  ];
  // Legacy IDs and storage key preserve existing voyages as geography changes.
  const KEY = 'windward-v1';
  const adventureDefaults = () => ({ discoveries: [], seaClues: [], seaDiscoveries: [], seaRumors: [], seaStories: [], contractsDone: [], activeContract: null, reputation: 0, adventureWon: false });
  const bearing = (a, b) => (Math.atan2(b.x - a.x, a.y - b.y) * 180 / Math.PI + 360) % 360;
  const angleDelta = (from, to) => (to - from + 540) % 360 - 180;
  function windAt(state, heading = state.motion?.heading ?? 225) {
    // Fictional, continuous weather from saved voyage progress; no wall clock or new save fields.
    const time = (state.day + state.seaProgress) / 12;
    const phase = time + state.position.x / 350 + state.position.y / 500;
    const from = (300 + 65 * Math.sin(phase) + 25 * Math.sin(time * .43) + 360) % 360;
    const strength = .2 + .8 * (.5 + .5 * Math.sin(phase * .73 + 1.2));
    const alignment = Math.cos(angleDelta(heading, from) * Math.PI / 180);
    return { from, strength, knots: 4 + strength * 10,
      factor: .9 - .1 * strength * alignment,
      kind: alignment > .5 ? '맞바람' : alignment < -.5 ? '순풍' : '옆바람' };
  }
  const BRAKE = .45;
  const motionDefaults = state => ({ speed: 0, heading: state?.navigation?.points[0] ? bearing(state.position, state.navigation.points[0]) : 225, turning: false, braking: false });
  function stopMotion(state) {
    state.motion.speed = 0; state.motion.turning = false; state.motion.braking = false;
    if (state.navigation) state.navigation.stopping = false;
  }
  const initial = () => ({ version: 4, screen: 'port', gold: 700, day: 1, port: 'lume', lastPort: 'lume', position: { x: PORTS[0].x, y: PORTS[0].y }, navigation: null, motion: motionDefaults(), seaProgress: 0, ship: 0, cargo: { grain: 0, timber: 0, cloth: 0, spice: 0 }, visited: ['lume'], voyages: 0, earned: 0, rescues: 0, won: false, ...adventureDefaults(), log: ['1550년, 리스본에서 700 G와 작은 돛배로 첫 항해를 준비합니다.'] });
  const portOf = id => PORTS.find(p => p.id === id);
  const nearbyPort = state => PORTS.find(p => N.distance(state.position, p) <= 6 && N.clear(state.position, p)) || null;
  const portLabel = (state, id) => state.visited.includes(id) ? portOf(id).name : '미확인 항구';
  const used = state => Object.values(state.cargo).reduce((a, b) => a + b, 0);
  const MARKET_EVENTS = [
    { id: 'grain-shortage', port: 'cedar', good: 'grain', percent: 30, title: '밀 공급 부족', region: '리스본 남동쪽, 지브롤터 서편의 항구', story: '곡물 수송이 늦어져 제빵사들이 밀을 구하고 있습니다.' },
    { id: 'timber-demand', port: 'lume', good: 'timber', percent: 25, title: '부두 수리용 목재 수요', region: '이베리아 서쪽, 테주강 하구의 항구', story: '부두 수리가 시작되어 상인들이 목재를 평소보다 비싸게 사고 있습니다.' },
    { id: 'cloth-demand', port: 'marseille', good: 'cloth', percent: 25, title: '축제용 직물 수요', region: '서부 지중해 북쪽, 프로방스 해안의 항구', story: '축제를 앞두고 천막과 장식에 쓸 직물을 찾는 사람이 늘었습니다.' }
  ];
  function marketEvent(state) {
    // Twenty game days of demand, then four quiet days. Reloading never rerolls prices.
    const cycle = Math.floor((state.day - 1) / 24), elapsed = (state.day - 1) % 24;
    if (elapsed >= 20) return null;
    return { ...MARKET_EVENTS[cycle % MARKET_EVENTS.length], startDay: cycle * 24 + 1, endDay: cycle * 24 + 20, remaining: 20 - elapsed };
  }
  function price(state, good, portId = state.port) {
    const index = GOODS.findIndex(g => g.id === good);
    const port = portOf(portId);
    if (!port || index < 0) throw Error('알 수 없는 항구 또는 상품입니다.');
    const event = marketEvent(state);
    const affected = event?.port === portId && event.good === good;
    const buy = affected ? Math.ceil(port.prices[index] * (100 + event.percent) / 100) : port.prices[index];
    return { buy, sell: Math.floor(buy * 0.9) };
  }
  function quote(state, destination) {
    const to = portOf(destination);
    if (!to || state.port === to.id) throw Error('다른 항구를 선택해 주세요.');
    if (!state.visited.includes(destination)) throw Error('미확인 항구는 수동항해로 먼저 방문해 주세요.');
    return passage(state, N.route(state.position, to));
  }
  function passage(state, points) {
    const distance = N.length(state.position, points);
    const days = Math.floor(state.seaProgress + distance / (55 * SHIPS[state.ship].speed) + 1e-9);
    return { distance, days, cost: days * (state.discoveries.includes('tide') ? 7 : 8), points };
  }
  function plan(state, action) {
    if (action.mode === 'auto') return { ...quote(state, action.destination), targetPort: action.destination, mode: 'auto' };
    if (action.mode !== 'manual' || !N.isSea(action.point)) throw Error('육지가 아닌 바다 안의 지점을 눌러 주세요.');
    if (!N.clear(state.position, action.point)) throw Error('이 방향은 육지에 막혀 있습니다. 해안을 따라 중간 바다 지점을 눌러 우회하세요.');
    if (N.distance(state.position, action.point) < 1) throw Error('조금 더 먼 바다 지점을 선택해 주세요.');
    return { ...passage(state, [{ x: action.point.x, y: action.point.y }]), targetPort: null, mode: 'manual' };
  }
  function dock(state, port) {
    const first = !state.visited.includes(port.id);
    state.position = { x: port.x, y: port.y }; state.port = port.id; state.lastPort = port.id;
    state.navigation = null; state.screen = 'port'; state.voyages++; stopMotion(state);
    if (first) state.visited.push(port.id);
    return finish(state, first ? `${port.name} 발견! 직접 입항하여 항구 이름과 자동항해가 해제되었습니다.` : `${port.name}에 입항했습니다.`);
  }
  function prepareArrival(state, nav) {
    nav.arrivalPort = nav.mode === 'auto' ? nav.targetPort : null;
    if (nav.mode !== 'manual') return;
    let start = state.position;
    for (let i = 0; i < nav.points.length; i++) {
      const end = nav.points[i], dx = end.x - start.x, dy = end.y - start.y, length2 = dx * dx + dy * dy;
      let nearest = null;
      for (const port of PORTS) {
        // Departing from an arrival zone must not immediately capture the ship again.
        if (N.distance(state.position, port) < 5 && N.distance(nav.points.at(-1), port) >= 2) continue;
        if (length2 < 1e-10) continue;
        const px = start.x - port.x, py = start.y - port.y;
        const b = px * dx + py * dy, c = px * px + py * py - 4.5 ** 2;
        const discriminant = b * b - length2 * c;
        if (discriminant < 0) continue;
        const t = c < 0 ? 1 : (-b - Math.sqrt(discriminant)) / length2;
        if (t < 0 || t > 1 || (nearest && t >= nearest.t)) continue;
        const point = { x: start.x + dx * t, y: start.y + dy * t };
        if (N.distance(point, port) > 5 || !N.clear(point, port)) continue;
        nearest = { t, point, port };
      }
      if (nearest) {
        nav.points = [...nav.points.slice(0, i), nearest.point]; nav.arrivalPort = nearest.port.id;
        return;
      }
      start = end;
    }
  }
  function advance(input, seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 1) throw Error('항해 시간 간격이 올바르지 않습니다.');
    const state = JSON.parse(JSON.stringify(input)), nav = state.navigation;
    state.motion ||= motionDefaults(state);
    if (!nav?.running) { stopMotion(state); return state; }
    if (nav.arrivalPort === undefined) prepareArrival(state, nav);
    const motion = state.motion, cruise = 15.75 * SHIPS[state.ship].speed;
    let remaining = seconds;
    // Small time slices preserve coastal safety and consistent handling at any frame rate.
    while (remaining > 0.000001 && nav.points.length) {
      const target = nav.points[0], distance = N.distance(state.position, target);
      if (distance < 0.00001) { nav.points.shift(); continue; }
      const dt = Math.min(remaining, .025, 2 / cruise);
      remaining -= dt;
      const direction = bearing(state.position, target), error = angleDelta(motion.heading, direction);
      motion.heading = (motion.heading + Math.max(-95 * dt, Math.min(95 * dt, error)) + 360) % 360;
      let desired = .24 + .76 * Math.max(0, 1 - Math.abs(error) / 110) ** 2;
      const nextPoint = nav.points[1];
      const bend = nextPoint ? Math.min(1, Math.abs(angleDelta(direction, bearing(target, nextPoint))) / 110) : 0;
      const approach = Math.max(0, 1 - distance / (cruise * .85 + 4));
      desired = Math.min(desired, 1 - .72 * bend * approach);
      desired *= windAt(state, motion.heading).factor;
      const distanceLeft = N.length(state.position, nav.points);
      const landing = !nav.hardEnd || !!nav.arrivalPort;
      // v^2 = 2ad: brake along the remaining safe route, including its corners.
      const approachSpeed = landing ? Math.sqrt(2 * BRAKE * distanceLeft / cruise) : 1;
      desired = nav.stopping ? 0 : Math.min(desired, approachSpeed);
      motion.braking = !!nav.stopping || (landing && approachSpeed < .95);
      motion.turning = Math.abs(error) > 8 || (bend > .2 && approach > .15);
      const before = motion.speed;
      const brakingRate = motion.braking ? Math.max(BRAKE, landing ? before * before * cruise / (2 * distanceLeft) : 0) : 2.1;
      const change = dt * (desired < before ? brakingRate : .38);
      motion.speed += Math.max(-change, Math.min(change, desired - before));
      const step = Math.min(distance, cruise * dt * (before + motion.speed) / 2, 2);
      const next = { x: state.position.x + (target.x - state.position.x) * step / distance, y: state.position.y + (target.y - state.position.y) * step / distance };
      if (!N.clear(state.position, next)) { nav.running = false; stopMotion(state); return finish(state, '해안에 접근하여 정지했습니다. 바다 쪽으로 새 항로를 지정하세요.'); }
      const progress = state.seaProgress + step / (55 * SHIPS[state.ship].speed);
      const days = Math.floor(progress + 1e-9), cost = days * (state.discoveries.includes('tide') ? 7 : 8);
      if (state.gold < cost) { nav.running = false; stopMotion(state); return finish(state, '항해 경비가 부족해 정지했습니다. 가까운 항구로 이동하거나 귀환 지원을 요청하세요.'); }
      state.gold -= cost; state.day += days; state.seaProgress = Math.max(0, progress - days); state.position = next;
      if (distance <= step + 0.00001) nav.points.shift();
      if (nav.stopping && motion.speed === 0 && nav.points.length) {
        nav.running = false; nav.stopping = false; stopMotion(state);
        return finish(state, '돛을 내려 서서히 정지했습니다. 계속 버튼으로 항로를 이어갈 수 있습니다.');
      }
    }
    if (!nav.points.length) {
      state.navigation = null; stopMotion(state);
      return finish(state, nav.arrivalPort ? `${portLabel(state, nav.arrivalPort)} 근처에 도착했습니다. 입항 버튼을 눌러 항구로 들어가세요.` : '지정한 해상 지점에 도착했습니다. 다음 바다 지점을 선택하세요.');
    }
    return state;
  }
  function finish(state, message) {
    state.log.unshift(`${state.day}일 | ${message}`);
    if (!state.won && state.gold >= 5000 && state.visited.length === PORTS.length && state.ship >= 1) {
      state.won = true;
      state.log.unshift('경제 목표 달성! 이제 당신은 지중해의 항구들이 인정하는 무역상입니다.');
    }
    if (!state.adventureWon && state.discoveries.length === SITES.length && state.contractsDone.length >= 3) {
      state.adventureWon = true;
      state.log.unshift('모험 목표 달성! 다섯 발견과 세 의뢰로 지중해의 사람과 이야기를 연결했습니다.');
    }
    state.log = state.log.slice(0, 30);
    return state;
  }
  function act(input, action) {
    const state = JSON.parse(JSON.stringify(input));
    state.motion ||= motionDefaults(state);
    state.seaClues ??= []; state.seaDiscoveries ??= [];
    state.seaRumors ??= []; state.seaStories ??= [];
    if (action.type === 'lookout') {
      if (state.screen !== 'chart') throw Error('바다에 나가 망원경을 펼쳐 주세요.');
      const found = seaSightings(state).filter(s => !state.seaClues.includes(s.id));
      state.seaClues.push(...found.map(s => s.id));
      return finish(state, found.length ? `망원경으로 새로운 단서 ${found.length}곳을 찾았습니다. 가까이 접근해 정지한 뒤 조사하세요.` : '주변을 살폈습니다. 새 단서는 없습니다. 다른 해역에서 다시 살펴보세요.');
    }
    if (action.type === 'survey-sea') {
      const site = SEA_SITES.find(s => s.id === action.site);
      if (!site || !state.seaClues.includes(site.id)) throw Error('망원경으로 단서를 먼저 찾아주세요.');
      if (state.seaDiscoveries.includes(site.id)) throw Error('이미 도감에 기록한 발견입니다.');
      if (state.screen !== 'chart' || state.port || N.distance(state.position, site) > SURVEY_RANGE || !N.clear(state.position, site)) throw Error('단서 가까이 접근한 뒤 조사해 주세요.');
      if (state.navigation?.running || state.motion.speed > 0) throw Error('배가 완전히 멈춘 뒤 조사해 주세요.');
      state.seaDiscoveries.push(site.id); state.gold += site.reward; state.earned += site.reward; state.reputation += site.fame;
      return finish(state, `해상 발견: ${site.name}. 기록 보상 ${site.reward} G · 명성 +${site.fame}.`);
    }
    if (action.type === 'show-chart') { state.screen = 'chart'; return state; }
    if (action.type === 'enter-port') {
      if (state.navigation?.running) throw Error('배를 정지한 뒤 입항해 주세요.');
      const port = nearbyPort(state);
      if (!port) throw Error('입항하려면 항구의 해상 정박점 가까이 이동해 주세요.');
      if (state.port === port.id) { state.navigation = null; state.screen = 'port'; stopMotion(state); return state; }
      return dock(state, port);
    }
    if (action.type === 'navigate' || action.type === 'sail' || action.type === 'steer') {
      if (state.screen !== 'chart') throw Error('항구 메뉴에서 항해도로 나간 뒤 출항해 주세요.');
      let instruction = action.type === 'sail' ? { mode: 'auto', destination: action.destination } : action;
      if (action.type === 'steer') {
        const daily = state.discoveries.includes('tide') ? 7 : 8;
        const affordable = Math.max(0, (Math.floor(state.gold / daily) + 1 - state.seaProgress) * 55 * SHIPS[state.ship].speed - .01);
        const point = N.headingTarget(state.position, action.heading, Math.min(affordable, Math.hypot(N.G.width, N.G.height)));
        if (N.distance(state.position, point) < 1) throw Error('이 방향은 해안이나 해역 경계에 가깝거나 경비가 부족합니다. 다른 방향 또는 귀환 지원을 이용하세요.');
        instruction = { mode: 'manual', point };
      }
      const route = plan(state, instruction);
      if (route.cost > state.gold) throw Error(`예상 경비 ${route.cost} G가 부족합니다. 가까운 지점으로 이동하거나 귀환 지원을 이용하세요.`);
      state.navigation = { mode: route.mode, targetPort: route.targetPort, points: route.points, running: true, stopping: false, hardEnd: action.type === 'steer' };
      prepareArrival(state, state.navigation);
      state.motion.braking = false;
      state.port = null;
      return finish(state, action.type === 'steer' ? '조타: 정한 방향으로 항해합니다. 해안·경계·예산 한계에 도달하면 정지합니다.' : route.mode === 'auto' ? `${portLabel(state, route.targetPort)}(으)로 자동항해를 시작합니다.` : '수동항해: 클릭한 해상 지점으로 이동합니다.');
    }
    if (action.type === 'pause') {
      if (state.navigation?.running && state.motion.speed > 0 && !action.immediate) {
        state.navigation.stopping = true; state.motion.braking = true;
      } else {
        if (state.navigation) { state.navigation.running = false; state.navigation.stopping = false; }
        stopMotion(state);
      }
      return state;
    }
    if (action.type === 'resume') {
      if (!state.navigation?.points.length) throw Error('이어갈 항로가 없습니다. 바다를 눌러 주세요.');
      if (passage(state, state.navigation.points).cost > state.gold) throw Error('항해 경비가 부족합니다.');
      if (!state.navigation.running) stopMotion(state);
      state.navigation.stopping = false; state.motion.braking = false; state.navigation.running = true; return state;
    }
    if (action.type === 'rescue') {
      if (state.port) throw Error('이미 항구에 정박해 있습니다.');
      const port = portOf(state.lastPort), fee = Math.min(40, state.gold);
      state.gold -= fee; state.day += 3; state.position = { x: port.x, y: port.y }; state.port = null; state.navigation = null; state.screen = 'chart';
      stopMotion(state);
      return finish(state, `${port.name} 앞바다로 복귀했습니다. 3일 · ${fee} G. 입항 버튼을 눌러 주세요.`);
    }
    if (!state.port || state.screen !== 'port') throw Error('교역·탐험·의뢰는 항구 화면에서 이용할 수 있습니다. 입항 버튼을 눌러 주세요.');
    if (action.type === 'hear-rumor' || action.type === 'report-rumor') {
      const rumor = SEA_RUMORS.find(r => r.id === action.rumor);
      if (!rumor || rumor.port !== state.port) throw Error('소문을 전하는 사람이 있는 항구에 먼저 입항해 주세요.');
      const stage = rumorStage(state, rumor.id);
      if (stage === 'locked') throw Error('앞선 항구의 이야기를 먼저 마무리해 주세요.');
      if (action.type === 'hear-rumor') {
        if (stage !== 'offered') throw Error('이미 항해일지에 기록한 소문입니다.');
        state.seaRumors.push(rumor.id);
        return finish(state, `소문 기록: ${rumor.title}. ${state.seaDiscoveries.includes(rumor.site) ? '이미 조사한 기록을 이 항구에서 전달할 수 있습니다.' : '방향 단서를 발견 도감에 남겼습니다.'}`);
      }
      if (stage === 'complete') throw Error('이미 이야기를 전달하고 보상받았습니다.');
      if (stage !== 'report') throw Error('소문을 듣고 바다의 흔적을 조사한 뒤 돌아와 주세요.');
      state.seaStories.push(rumor.id); state.reputation += rumor.fame;
      return finish(state, `이야기 완결: ${rumor.title}. 항해 기록 전달 · 명성 +${rumor.fame}.`);
    }
    if (action.type === 'explore') {
      const site = SITES.find(s => s.id === action.site);
      if (!site || site.port !== state.port) throw Error('탐험 지역의 항구에 먼저 도착해 주세요.');
      if (state.discoveries.includes(site.id)) throw Error('이미 기록한 발견입니다.');
      if (!site.requires.every(id => state.discoveries.includes(id))) throw Error('먼저 다른 탐험에서 단서를 찾아주세요.');
      if (state.gold < site.cost) throw Error('탐험 준비 비용이 부족합니다. 교역이나 의뢰로 자금을 모아보세요.');
      state.gold += site.reward - site.cost;
      state.day += site.days;
      state.reputation += site.fame;
      state.discoveries.push(site.id);
      return finish(state, `${site.name} 발견! ${site.days}일 조사 · 경비 ${site.cost} G · 학회 보상 ${site.reward} G · 명성 +${site.fame}.`);
    }
    if (action.type === 'accept') {
      const contract = CONTRACTS.find(c => c.id === action.contract);
      if (!contract || contract.from !== state.port) throw Error('의뢰를 소개한 항구에서 수락해 주세요.');
      if (state.activeContract) throw Error('진행 중인 의뢰를 먼저 완료하거나 취소해 주세요.');
      if (state.contractsDone.includes(contract.id)) throw Error('이미 완료한 의뢰입니다.');
      state.activeContract = contract.id;
      return finish(state, `의뢰 수락: ${contract.name}. ${portLabel(state, contract.to)}에 물품을 전달해 주세요.`);
    }
    if (action.type === 'deliver') {
      const contract = CONTRACTS.find(c => c.id === state.activeContract);
      if (!contract || state.contractsDone.includes(contract.id)) throw Error('진행 중인 의뢰가 없습니다.');
      if (state.port !== contract.to) throw Error('의뢰의 도착 항구에서 납품해 주세요.');
      if (state.cargo[contract.good] < contract.qty) throw Error('납품할 화물이 부족합니다. 교역소에서 준비해 주세요.');
      state.cargo[contract.good] -= contract.qty;
      state.gold += contract.reward;
      state.earned += contract.reward;
      state.reputation += contract.fame;
      state.contractsDone.push(contract.id);
      state.activeContract = null;
      return finish(state, `의뢰 완료: ${contract.name}. 납품 대금 ${contract.reward} G · 명성 +${contract.fame}.`);
    }
    if (action.type === 'cancel-contract') {
      if (!state.activeContract) throw Error('진행 중인 의뢰가 없습니다.');
      state.activeContract = null;
      return finish(state, '의뢰를 취소했습니다. 보유 화물은 그대로이며 소개 항구에서 다시 수락할 수 있습니다.');
    }
    if (action.type === 'trade') {
      const good = GOODS.find(g => g.id === action.good);
      const qty = action.qty;
      if (!good || !Number.isSafeInteger(qty) || qty <= 0 || !['buy', 'sell'].includes(action.side)) throw Error('거래 수량을 확인해 주세요.');
      const unit = price(state, good.id)[action.side];
      const total = unit * qty;
      if (action.side === 'buy') {
        if (qty + used(state) > SHIPS[state.ship].capacity) throw Error('적재 공간이 부족합니다. 먼저 화물을 판매해 주세요.');
        if (total > state.gold) throw Error('보유 금화가 부족합니다.');
        state.gold -= total;
        state.cargo[good.id] += qty;
      } else {
        if (qty > state.cargo[good.id]) throw Error('보유한 화물보다 많이 팔 수 없습니다.');
        state.gold += total;
        state.cargo[good.id] -= qty;
        state.earned += total;
      }
      return finish(state, `${good.name} ${qty}${good.unit} ${action.side === 'buy' ? '매입' : '판매'} · ${total.toLocaleString('ko-KR')} G`);
    }
    if (action.type === 'upgrade') {
      const next = SHIPS[state.ship + 1];
      if (!next) throw Error('이미 가장 큰 선박입니다.');
      if (state.gold < next.price) throw Error('선박 교체 비용이 부족합니다.');
      state.gold -= next.price;
      state.ship++;
      return finish(state, `${next.name} 구입! 적재량 ${next.capacity}칸, 항해 속도가 향상되었습니다.`);
    }
    if (action.type === 'relief') {
      if (state.gold >= 80) throw Error('항구 지원은 보유 금화가 80 G 미만일 때 받을 수 있습니다.');
      state.gold += 100;
      state.day += 3;
      state.rescues++;
      return finish(state, '부두에서 3일간 일하고 100 G를 받았습니다. 다시 항해를 준비하세요.');
    }
    throw Error('알 수 없는 행동입니다.');
  }
  function validBase(s) {
    const integer = n => Number.isSafeInteger(n) && n >= 0;
    return !!(s && [1, 2, 3, 4].includes(s.version) && integer(s.gold) && integer(s.day) && s.day >= 1 && integer(s.ship) && SHIPS[s.ship]
      && (portOf(s.port) || (s.version >= 3 && s.port === null)) && s.cargo && Object.keys(s.cargo).length === GOODS.length && GOODS.every(g => integer(s.cargo[g.id]))
      && used(s) <= SHIPS[s.ship].capacity && Array.isArray(s.visited) && (s.port === null || s.visited.includes(s.port))
      && new Set(s.visited).size === s.visited.length && s.visited.every(id => portOf(id))
      && integer(s.voyages) && integer(s.earned) && integer(s.rescues) && typeof s.won === 'boolean'
      && Array.isArray(s.log) && s.log.length <= 30 && s.log.every(line => typeof line === 'string' && line.length < 500));
  }
  function valid(s) {
    if (!validBase(s) || s.version !== 4 || !N.isSea(s.position) || !portOf(s.lastPort) || !s.visited.includes(s.lastPort)) return false;
    if (!['chart', 'port'].includes(s.screen) || (s.screen === 'port' && !s.port)) return false;
    if (!Number.isFinite(s.seaProgress) || s.seaProgress < 0 || s.seaProgress >= 1) return false;
    if (s.motion !== undefined && (!s.motion || !Number.isFinite(s.motion.speed) || s.motion.speed < 0 || s.motion.speed > 1
      || !Number.isFinite(s.motion.heading) || s.motion.heading < 0 || s.motion.heading >= 360 || typeof s.motion.turning !== 'boolean')) return false;
    if (s.motion?.braking !== undefined && typeof s.motion.braking !== 'boolean') return false;
    if (s.port && (s.navigation || s.lastPort !== s.port || N.distance(s.position, portOf(s.port)) > 0.01)) return false;
    if (s.navigation !== null) {
      const nav = s.navigation;
      if (!nav || s.port || !['manual', 'auto'].includes(nav.mode) || typeof nav.running !== 'boolean' || !Array.isArray(nav.points) || !nav.points.length || nav.points.length > 500) return false;
      if (['stopping', 'hardEnd'].some(key => nav[key] !== undefined && typeof nav[key] !== 'boolean')) return false;
      if (nav.arrivalPort != null && (!portOf(nav.arrivalPort) || N.distance(nav.points.at(-1), portOf(nav.arrivalPort)) > 5.01)) return false;
      if (nav.mode === 'auto' && nav.arrivalPort != null && nav.arrivalPort !== nav.targetPort) return false;
      if (nav.mode === 'auto' ? !s.visited.includes(nav.targetPort) : nav.targetPort !== null) return false;
      if (!nav.points.every((p, i) => N.clear(i ? nav.points[i - 1] : s.position, p))) return false;
      if (nav.mode === 'auto' && N.distance(nav.points.at(-1), portOf(nav.targetPort)) > 0.01) return false;
    }
    const ids = (array, known) => Array.isArray(array) && new Set(array).size === array.length && array.every(id => known.some(item => item.id === id));
    return (s.seaClues === undefined || ids(s.seaClues, SEA_SITES))
      && (s.seaDiscoveries === undefined || (ids(s.seaDiscoveries, SEA_SITES) && s.seaDiscoveries.every(id => (s.seaClues || []).includes(id))))
      && (s.seaRumors === undefined || (ids(s.seaRumors, SEA_RUMORS) && s.seaRumors.every(id => {
        const rumor = SEA_RUMORS.find(r => r.id === id);
        return s.visited.includes(rumor.port) && rumor.requires.every(required => (s.seaStories || []).includes(required));
      })))
      && (s.seaStories === undefined || (ids(s.seaStories, SEA_RUMORS) && s.seaStories.every(id => {
        const rumor = SEA_RUMORS.find(r => r.id === id);
        return (s.seaRumors || []).includes(id) && (s.seaDiscoveries || []).includes(rumor.site);
      })))
      && ids(s.discoveries, SITES) && ids(s.contractsDone, CONTRACTS)
      && s.discoveries.every(id => { const site = SITES.find(item => item.id === id); return s.visited.includes(site.port) && site.requires.every(required => s.discoveries.includes(required)); })
      && (s.activeContract === null || CONTRACTS.some(c => c.id === s.activeContract && !s.contractsDone.includes(c.id)))
      && Number.isSafeInteger(s.reputation) && s.reputation >= 0 && typeof s.adventureWon === 'boolean';
  }
  function migrate(s) {
    if (!validBase(s)) return null;
    let next = s.version === 1 ? { ...s, ...adventureDefaults(), version: 2 } : { ...s };
    if (next.version === 2) { const p = portOf(next.port); next = { ...next, version: 3, lastPort: next.port, position: { x: p.x, y: p.y }, navigation: null, seaProgress: 0 }; }
    if (next.version === 3) next = { ...next, version: 4, screen: next.port ? 'port' : 'chart' };
    if (next.navigation) next.navigation = { ...next.navigation, running: false };
    if (!valid(next)) return null;
    next.seaClues ??= []; next.seaDiscoveries ??= [];
    next.seaRumors ??= []; next.seaStories ??= [];
    if (next.navigation) next.navigation.stopping = false;
    next.motion = { ...(next.motion || motionDefaults(next)), speed: 0, turning: false, braking: false };
    return JSON.parse(JSON.stringify(next));
  }
  const api = { GOODS, PORTS, SHIPS, SITES, SEA_SITES, SEA_RUMORS, rumorStage, MARKET_EVENTS, marketEvent, SIGHT_RANGE, SURVEY_RANGE, seaSightings, windAt, CONTRACTS, KEY, N, initial, portOf, nearbyPort, portLabel, used, price, quote, plan, passage, advance, act, valid, migrate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Windward = api;
})(typeof window !== 'undefined' ? window : globalThis);
