const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js'), N = E.N;
const hear = (s, id = 'seabirds') => E.act(s, { type: 'hear-rumor', rumor: id });
const report = (s, id = 'seabirds') => E.act(s, { type: 'report-rumor', rumor: id });
function sail(s, destination) {
  if (s.screen === 'port') s = E.act(s, { type: 'show-chart' });
  for (const point of N.route(s.position, destination)) {
    if (N.distance(s.position, point) < 1) continue;
    s = E.act(s, { type: 'navigate', mode: 'manual', point });
    for (let i = 0; s.navigation?.running && i < 10000; i++) s = E.advance(s, .25);
    assert.ok(!s.navigation?.running); assert.ok(E.valid(s));
  }
  return s;
}
function discover(s, id) {
  const site = E.SEA_SITES.find(site => site.id === id);
  s = sail(s, site); s = E.act(s, { type: 'lookout' });
  return E.act(s, { type: 'survey-sea', site: id });
}
function returnTo(s, port) {
  return E.act(sail(s, E.portOf(port)), { type: 'enter-port' });
}
function firstStory() {
  return report(returnTo(discover(hear(E.initial()), 'seabirds'), 'lume'));
}
test('listening is free and records only a vague rumor, never a sea marker or visited port', () => {
  const s = E.initial(), before = JSON.stringify(s), heard = hear(s);
  assert.equal(JSON.stringify(s), before); assert.deepEqual(heard.seaRumors, ['seabirds']);
  assert.deepEqual(heard.seaClues, []); assert.deepEqual(heard.seaDiscoveries, []);
  assert.deepEqual(heard.visited, s.visited); assert.equal(heard.gold, s.gold); assert.equal(heard.day, s.day);
  assert.equal(heard.reputation, 0); assert.equal(E.rumorStage(heard, 'seabirds'), 'search');
  assert.throws(() => hear(heard), /이미/);
  assert.throws(() => hear(E.act(s, { type: 'show-chart' })), /항구/);
  assert.throws(() => hear(s, 'wreck'), /항구/); assert.throws(() => hear(s, 'invalid'));
});
test('Lisbon story follows actual sailing, investigation, return and one-time report', () => {
  let s = hear(E.initial());
  assert.throws(() => report(s), /조사/);
  s = E.act(E.act(s, { type: 'show-chart' }), { type: 'lookout' });
  assert.equal(E.rumorStage(s, 'seabirds'), 'investigate');
  s = discover(s, 'seabirds');
  assert.equal(E.rumorStage(s, 'seabirds'), 'report');
  assert.deepEqual(s.seaStories, []); assert.equal(s.reputation, 5);
  assert.throws(() => report(s), /항구/);
  s = returnTo(s, 'lume'); const before = structuredClone(s);
  s = report(s); assert.equal(E.rumorStage(s, 'seabirds'), 'complete');
  assert.deepEqual(s.seaStories, ['seabirds']); assert.deepEqual(s.visited, ['lume']);
  assert.equal(s.gold, before.gold); assert.equal(s.day, before.day); assert.equal(s.reputation, 8);
  assert.throws(() => report(s), /이미/); assert.throws(() => hear(s), /이미/);
  assert.deepEqual(E.migrate(s).seaStories, s.seaStories);
});
test('the next port rumor stays locked until Lisbon report, then has a complete playable ending', () => {
  let locked = returnTo(E.initial(), 'cedar');
  assert.equal(E.rumorStage(locked, 'wreck'), 'locked'); assert.throws(() => hear(locked, 'wreck'), /앞선/);
  let s = firstStory(); assert.equal(E.rumorStage(s, 'wreck'), 'offered');
  assert.deepEqual(s.visited, ['lume']); assert.deepEqual(s.seaClues, ['seabirds']);
  s = returnTo(s, 'cedar'); s = hear(s, 'wreck');
  assert.equal(E.rumorStage(s, 'wreck'), 'search'); assert.ok(!s.seaClues.includes('wreck'));
  s = discover(s, 'wreck'); s = returnTo(s, 'lume');
  assert.throws(() => report(s, 'wreck'), /항구/);
  s = returnTo(s, 'cedar'); const gold = s.gold;
  s = report(s, 'wreck'); assert.equal(s.gold, gold); assert.equal(s.reputation, 21);
  assert.deepEqual(s.seaStories, ['seabirds', 'wreck']); assert.ok(E.valid(s));
  assert.throws(() => report(s, 'wreck'), /이미/);
});
test('existing discoveries can be reported without a repeat survey or discovery payout', () => {
  let old = returnTo(discover(E.initial(), 'seabirds'), 'lume');
  delete old.seaRumors; delete old.seaStories;
  const original = JSON.stringify(old), s = E.migrate(old);
  assert.equal(JSON.stringify(old), original); assert.deepEqual(s.seaRumors, []); assert.deepEqual(s.seaStories, []);
  assert.deepEqual(s.seaDiscoveries, ['seabirds']); assert.equal(s.gold, old.gold);
  const heard = hear(s); assert.equal(E.rumorStage(heard, 'seabirds'), 'report');
  const done = report(heard); assert.equal(done.gold, old.gold); assert.equal(done.reputation, old.reputation + 3);
  done.log = Array.from({ length: 30 }, (_, i) => `${i + 1}일 | 항해 기록`);
  assert.deepEqual(E.migrate(done).seaStories, ['seabirds']);
});
test('malformed, duplicate and prerequisite-free story saves are rejected', () => {
  const completed = firstStory();
  for (const patch of [
    { seaRumors: null }, { seaStories: null }, { seaRumors: 'seabirds' }, { seaStories: ['unknown'] },
    { seaRumors: ['seabirds', 'seabirds'] }, { seaStories: ['seabirds', 'seabirds'] },
    { seaRumors: [] }, { seaDiscoveries: [] }, { seaRumors: ['seabirds', 'wreck'] }
  ]) assert.equal(E.migrate({ ...completed, ...patch }), null, JSON.stringify(patch));
  const initial = E.initial(); initial.visited.push('cedar');
  assert.equal(E.migrate({ ...initial, seaRumors: ['wreck'] }), null);
  assert.equal(E.migrate({ ...initial, seaStories: ['seabirds'] }), null);
});
test('hearing a rumor after spotting its clue preserves the original discovery flow', () => {
  let s = E.act(E.act(E.initial(), { type: 'show-chart' }), { type: 'lookout' });
  s = E.act(s, { type: 'enter-port' });
  const heard = hear(s); assert.equal(E.rumorStage(heard, 'seabirds'), 'investigate');
  assert.deepEqual(heard.seaClues, s.seaClues); assert.equal(heard.gold, s.gold);
});
