const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');
const chart = () => E.act(E.initial(), { type: 'show-chart' });
const stoppedAt = site => ({ ...chart(), port: null, position: { x: site.x, y: site.y } });

test('0.1.1 saves migrate without resetting progress; malformed sea records are rejected', () => {
  const old = E.initial(); old.gold = 1234; delete old.seaClues; delete old.seaDiscoveries;
  const copy = JSON.stringify(old), restored = E.migrate(old);
  assert.equal(restored.gold, 1234); assert.deepEqual(restored.seaClues, []); assert.deepEqual(restored.seaDiscoveries, []);
  assert.equal(JSON.stringify(old), copy);
  for (const patch of [{ seaClues: null }, { seaClues: ['fake'] }, { seaClues: ['wreck', 'wreck'] }, { seaDiscoveries: ['wreck'] }, { seaDiscoveries: 'wreck' }]) {
    assert.equal(E.migrate({ ...E.initial(), ...patch }), null);
  }
});
test('lookout only reveals nearby unobstructed clues and never port names', () => {
  assert.throws(() => E.act(E.initial(), { type: 'lookout' }));
  const before = chart(), after = E.act(before, { type: 'lookout' });
  assert.deepEqual(before.seaClues, []); assert.deepEqual(after.seaClues, ['seabirds']);
  assert.deepEqual(after.visited, before.visited); assert.deepEqual(after.discoveries, []);
  assert.equal(after.gold, before.gold);
  assert.deepEqual(E.act(after, { type: 'lookout' }).seaClues, ['seabirds']);
  for (const p of E.PORTS) {
    const s = { ...before, position: p };
    assert.ok(E.seaSightings(s).every(site => E.N.clear(p, site) && E.N.distance(p, site) <= E.SIGHT_RANGE));
  }
});
test('all discoveries are reachable, recorded once and preserved through reload', () => {
  for (const site of E.SEA_SITES) {
    assert.ok(E.N.isSea(site)); const path = E.N.route(E.PORTS[0], site);
    assert.ok(path.length); assert.ok(E.N.distance(path.at(-1), site) < .01);
    const s = E.act(stoppedAt(site), { type: 'lookout' });
    const next = E.act(s, { type: 'survey-sea', site: site.id });
    assert.equal(next.gold, s.gold + site.reward); assert.equal(next.reputation, site.fame);
    assert.deepEqual(next.seaDiscoveries, [site.id]); assert.ok(E.valid(next));
    assert.deepEqual(E.migrate(next).seaDiscoveries, [site.id]);
    assert.throws(() => E.act(next, { type: 'survey-sea', site: site.id }), /이미/);
    assert.deepEqual(s.seaDiscoveries, []);
  }
});
test('survey rejects unknown, distant, docked and moving attempts, including braking', () => {
  const site = E.SEA_SITES[0], near = E.act(stoppedAt(site), { type: 'lookout' });
  assert.throws(() => E.act(stoppedAt(site), { type: 'survey-sea', site: site.id }), /먼저/);
  assert.throws(() => E.act({ ...chart(), seaClues: [site.id] }, { type: 'survey-sea', site: site.id }), /접근/);
  assert.throws(() => E.act(near, { type: 'survey-sea', site: 'invalid' }));
  assert.throws(() => E.act({ ...near, position: E.PORTS[3] }, { type: 'survey-sea', site: site.id }), /접근/);
  assert.throws(() => E.act({ ...near, motion: { ...near.motion, speed: .1, braking: true } }, { type: 'survey-sea', site: site.id }), /완전히/);
  const underway = E.act(near, { type: 'steer', heading: 180 });
  assert.throws(() => E.act(underway, { type: 'survey-sea', site: site.id }), /완전히/);
  const scanned = E.act(underway, { type: 'lookout' });
  assert.deepEqual(scanned.navigation, underway.navigation); assert.deepEqual(scanned.motion, underway.motion);
});
test('first clue supports a real manual approach, natural stop and survey', () => {
  let s = E.act(chart(), { type: 'lookout' });
  s = E.act(s, { type: 'navigate', mode: 'manual', point: E.SEA_SITES[0] });
  for (let i = 0; s.navigation?.running && i < 2000; i++) s = E.advance(s, .1);
  assert.ok(!s.navigation?.running); assert.equal(s.motion.speed, 0);
  assert.equal(E.act(s, { type: 'survey-sea', site: 'seabirds' }).seaDiscoveries[0], 'seabirds');
});
