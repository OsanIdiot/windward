const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('./voyage-art.js');
const N = require('./navigation.js');
const open = () => true, land = () => false;
const total = (isSea, size = 40) => {
  const t = { ships: 0, dolphins: 0, gulls: 0, flotsam: 0, fish: 0 };
  for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) { const c = A.cell(i, j, isSea); for (const k in t) t[k] += c[k].length; }
  return t;
};
test('ambient life is deterministic and independent of call order', () => {
  const first = JSON.stringify(A.cell(7, 3, open)), second = JSON.stringify(A.cell(7, 3, open));
  A.cell(1, 1, open);
  assert.equal(JSON.stringify(A.cell(7, 3, open)), first);
  assert.equal(first, second);
});
test('ambient life stays sparse enough to be gentle', () => {
  const t = total(open), cells = 1600;
  for (const [kind, max] of [['ships', .35], ['dolphins', .32], ['gulls', .3], ['flotsam', .55], ['fish', .35]]) {
    assert.ok(t[kind] / cells > .05 && t[kind] / cells < max, `${kind} density ${(t[kind] / cells).toFixed(3)}`);
  }
});
test('sea creatures and ships never spawn on land; only gulls may cross it', () => {
  const t = total(land);
  assert.deepEqual({ ...t, gulls: 0 }, { ships: 0, dolphins: 0, gulls: 0, flotsam: 0, fish: 0 });
});
test('real map spawns life only on water along the whole pass', () => {
  for (let i = 0; i < 14; i++) for (let j = 0; j < 7; j++) {
    const c = A.cell(i, j, N.isSea);
    for (const m of [...c.ships, ...c.dolphins]) for (const f of [-1, -.5, 0, .5, 1]) {
      assert.ok(N.isSea({ x: m.p.x + Math.sin(m.a) * m.len / 2 * f, y: m.p.y - Math.cos(m.a) * m.len / 2 * f }), `cell ${i},${j}`);
    }
    for (const m of [...c.flotsam, ...c.fish]) assert.ok(N.isSea(m.p));
  }
});
test('moving life stays within the margin scanned around the camera', () => {
  const margin = A.CELL * .65;
  for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) {
    const c = A.cell(i, j, open);
    for (const m of [...c.ships, ...c.dolphins, ...c.gulls]) assert.ok(m.len / 2 - .12 * A.CELL < margin, 'a pass never reaches farther than the scanned margin');
  }
});
test('time-of-day light is periodic, continuous and always subtle', () => {
  const a = A.tone(0), b = A.tone(30);
  for (let n = 0; n < 4; n++) assert.ok(Math.abs(a[n] - b[n]) < 1e-6);
  let previous = A.tone(0);
  for (let t = .05; t <= 60; t += .05) {
    const now = A.tone(t);
    assert.ok(now[3] >= 0 && now[3] <= .18, 'tint opacity stays subtle');
    for (let n = 0; n < 4; n++) assert.ok(Math.abs(now[n] - previous[n]) < (n < 3 ? 12 : .012), 'light changes smoothly');
    previous = now;
  }
  assert.ok(A.tone(.38 * 30)[3] < .01, 'noon is untinted');
});
test('mist is bounded, deterministic and occasional', () => {
  let hazy = 0, samples = 0;
  for (let t = 0; t < 600; t += .5) { const h = A.haze(t); assert.ok(h >= 0 && h <= 1); assert.equal(h, A.haze(t)); samples++; if (h > .05) hazy++; }
  assert.ok(hazy / samples > .03 && hazy / samples < .5, `mist fraction ${(hazy / samples).toFixed(2)}`);
});
