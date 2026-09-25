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
    assert.ok(w.factor >= .8 && w.factor <= 1);
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
