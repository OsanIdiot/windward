const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js'), N = E.N;
const delta = (a, b) => Math.abs((a - b + 540) % 360 - 180);

function sea() {
  const s = E.act(E.initial(), { type: 'show-chart' });
  s.port = null; s.position = N.project(-12, 40); s.gold = 100000;
  return s;
}
function steer(state, heading) {
  state.motion.heading = heading;
  state.motion.speed = E.windAt(state).factor;
  return E.act(state, { type: 'steer', heading });
}
test('weather is pure, deterministic, bounded and independent of camera or navigation mode', () => {
  const s = sea(), before = JSON.stringify(s), wind = E.windAt(s);
  assert.deepEqual(E.windAt(s), wind); assert.equal(JSON.stringify(s), before);
  for (let day = 1; day < 300; day += 7) for (let heading = 0; heading < 360; heading += 15) {
    const w = E.windAt({ ...s, day }, heading);
    assert.ok(w.from >= 0 && w.from < 360);
    assert.ok(w.strength >= .2 && w.strength <= 1);
    assert.ok(w.knots >= 6 && w.knots <= 14);
    assert.ok(w.factor >= .4 && w.factor <= 1);
  }
  assert.deepEqual(E.windAt({ ...s, navigation: { mode: 'auto' } }), wind);
  assert.deepEqual(E.windAt({ ...s, navigation: { mode: 'manual' } }), wind);
});
test('meteorological direction gives slower headwind, neutral crosswind and faster following wind', () => {
  const s = sea(), from = E.windAt(s).from;
  const head = E.windAt(s, from), cross = E.windAt(s, (from + 90) % 360), tail = E.windAt(s, (from + 180) % 360);
  assert.equal(head.kind, '맞바람'); assert.equal(cross.kind, '옆바람'); assert.equal(tail.kind, '순풍');
  assert.ok(head.factor < cross.factor && cross.factor < tail.factor);
  assert.ok(Math.abs(cross.factor - .9) < 1e-10);
});
test('wind changes smoothly across day boundaries and is restored from existing save fields', () => {
  const s = sea(), a = E.windAt({ ...s, day: 7, seaProgress: .99999 });
  const b = E.windAt({ ...s, day: 8, seaProgress: .00001 });
  assert.ok(delta(a.from, b.from) < .001); assert.ok(Math.abs(a.factor - b.factor) < .00001);
  const far = E.windAt({ ...s, day: 30 });
  assert.ok(delta(a.from, far.from) > 10);
  assert.deepEqual(E.windAt(E.migrate(JSON.parse(JSON.stringify(s)))), E.windAt(s));
  assert.deepEqual(Object.keys(E.migrate(s)).sort(), Object.keys(s).sort());
});
test('all seven ships move into headwind, benefit from following wind and keep the old maximum', () => {
  for (let ship = 0; ship < E.SHIPS.length; ship++) {
    const s = { ...sea(), ship }, from = E.windAt(s).from;
    const head = steer(structuredClone(s), from), tail = steer(structuredClone(s), (from + 180) % 360);
    const h = E.advance(head, .5), t = E.advance(tail, .5);
    const hd = N.distance(s.position, h.position), td = N.distance(s.position, t.position);
    assert.ok(hd > 0); assert.ok(td > hd * 1.1);
    assert.ok(td <= 15.75 * E.SHIPS[ship].speed * .5);
    assert.ok(E.valid(h) && E.valid(t));
  }
});
test('wind-limited movement remains frame-rate independent and pausing cannot reroll wind', () => {
  const s = sea(), initial = steer(s, E.windAt(s).from);
  let coarse = structuredClone(initial), fine = structuredClone(initial);
  for (let i = 0; i < 5; i++) coarse = E.advance(coarse, 1);
  for (let i = 0; i < 300; i++) fine = E.advance(fine, 1 / 60);
  assert.ok(N.distance(coarse.position, fine.position) < .1);
  assert.equal(coarse.gold, fine.gold); assert.equal(coarse.day, fine.day);
  const paused = E.act(coarse, { type: 'pause', immediate: true });
  assert.deepEqual(E.windAt(paused), E.windAt(coarse));
  assert.deepEqual(E.windAt(E.advance(paused, 1)), E.windAt(paused));
});

test('a headwind slows the ship a lot, more in a stronger wind, and speed rises steadily as the wind moves aft', () => {
  const s = sea();
  for (let day = 1; day < 120; day += 3) {
    const base = { ...s, day }, from = E.windAt(base).from;
    const speeds = [0, 30, 60, 90, 120, 150, 180].map(offset => E.windAt(base, (from + offset) % 360).factor);
    for (let i = 1; i < speeds.length; i++) assert.ok(speeds[i] > speeds[i - 1], 'each step away from the wind source is faster');
    const strength = E.windAt(base).strength;
    assert.ok(speeds[0] <= .6 + 1e-9 && speeds[0] >= .4 - 1e-9, 'headwind keeps 40-60% of the speed');
    assert.ok(Math.abs(speeds[0] - (.9 - (.25 + .25 * strength))) < 1e-9, 'a stronger headwind slows more');
    assert.ok(speeds[6] >= .92 - 1e-9 && speeds[6] <= 1 + 1e-9, 'following wind never exceeds the old maximum');
  }
});
test('a ship heading into the wind covers clearly less distance than the same ship running before it', () => {
  const distance = offset => {
    let state = sea(); const from = E.windAt(state).from;
    state.motion.heading = (from + offset) % 360; state.motion.speed = E.windAt(state, state.motion.heading).factor;
    state = E.act(state, { type: 'steer', heading: state.motion.heading });
    const start = state.position;
    for (let i = 0; i < 80 && state.navigation?.running; i++) state = E.advance(state, .1);
    return N.distance(start, state.position);
  };
  const head = distance(0), tail = distance(180);
  assert.ok(head > 5, 'sailing into the wind never stalls');
  assert.ok(head < tail * .75, `headwind ${head.toFixed(1)} vs following wind ${tail.toFixed(1)}`);
});
