const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');
function travel(s, id) {
  s = E.act(s, { type: 'show-chart' });
  const p = E.portOf(id);
  for (const point of E.N.route(s.position, p)) {
    if (E.N.distance(s.position, point) < 1) continue;
    s = E.act(s, { type: 'navigate', mode: 'manual', point });
    for (let i = 0; s.navigation?.running && i < 10000; i++) s = E.advance(s, .5);
  }
  s = E.act(s, { type: 'enter-port' });
  assert.equal(s.port, id, `Docked at ${id}`);
  return s;
}
const knownQuote = (s, id) => E.quote({ ...s, visited: [...new Set([...s.visited, id])] }, id);
const trade = (s, side, good, qty) => E.act(s, { type: 'trade', side, good, qty });
test('initial save is valid and trading never mutates input', () => {
  const s = E.initial();
  assert.ok(E.valid(s));
  const bought = trade(s, 'buy', 'grain', 10);
  assert.equal(s.gold, 700); assert.equal(s.cargo.grain, 0);
  assert.equal(bought.gold, 540); assert.equal(bought.cargo.grain, 10);
});
test('tutorial trade route earns money after travel expense', () => {
  let s = trade(E.initial(), 'buy', 'grain', 10);
  const q = knownQuote(s, 'cedar');
  s = travel(s, 'cedar');
  const sale = E.price(s, 'grain').sell * 10;
  s = trade(s, 'sell', 'grain', 10);
  assert.equal(s.gold, 700 - 160 - q.cost + sale);
  assert.ok(s.gold > 700); assert.equal(s.cargo.grain, 0);
  assert.deepEqual(s.visited, ['lume', 'cedar']); assert.ok(E.valid(s));
});
test('invalid transactions and excess cargo are rejected', () => {
  for (const qty of [-1, 0, 1.5, Infinity, NaN, '10']) assert.throws(() => trade(E.initial(), 'buy', 'grain', qty));
  assert.throws(() => trade(E.initial(), 'sell', 'grain', 1));
  assert.throws(() => trade(E.initial(), 'buy', 'grain', 25));
  assert.throws(() => trade(E.initial(), 'buy', 'spice', 8));
  assert.throws(() => trade(E.initial(), 'other', 'grain', 1));
  assert.throws(() => trade(E.initial(), 'buy', '__proto__', 1));
});
test('buy then sell in same port cannot create money', () => {
  for (const port of E.PORTS) for (const g of E.GOODS) {
    const s = E.initial(); s.port = port.id;
    assert.ok(trade(trade(s, 'buy', g.id, 1), 'sell', g.id, 1).gold < s.gold);
  }
});
test('ship upgrades retain cargo and improve capacity and passage time', () => {
  const s = E.initial(); s.gold = 3000; s.cargo.grain = 10;
  const next = E.act(s, { type: 'upgrade' });
  assert.equal(next.gold, 2350); assert.equal(next.cargo.grain, 10); assert.equal(next.ship, 1);
  assert.ok(knownQuote(next, 'haven').days < knownQuote(s, 'haven').days);
  let last = E.act(next, { type: 'upgrade' });
  last.gold = 50000;
  assert.equal(E.SHIPS.length, 7);
  for (let tier = 3; tier < E.SHIPS.length; tier++) {
    const before = last;
    last = E.act(last, { type: 'upgrade' });
    assert.equal(last.ship, tier);
    assert.equal(last.gold, before.gold - E.SHIPS[tier].price);
    assert.equal(last.cargo.grain, 10);
    assert.ok(E.SHIPS[tier].capacity > E.SHIPS[tier - 1].capacity);
    assert.ok(E.SHIPS[tier].speed > E.SHIPS[tier - 1].speed);
    assert.ok(E.valid(last));
    assert.equal(E.migrate(JSON.parse(JSON.stringify(last))).ship, tier);
    assert.throws(() => E.act({ ...before, gold: E.SHIPS[tier].price - 1 }, { type: 'upgrade' }));
  }
  assert.throws(() => E.act(last, { type: 'upgrade' }));
});

test('highest ship carries 320 units and sails faster without crossing land', () => {
  let s = E.initial(); s.ship = 6; s.gold = 50000;
  s = trade(s, 'buy', 'grain', 320);
  assert.throws(() => trade(s, 'buy', 'grain', 1));
  const q = knownQuote(s, 'cedar');
  assert.ok(q.days < knownQuote(E.initial(), 'cedar').days);
  s = travel(s, 'cedar');
  assert.equal(s.cargo.grain, 320); assert.ok(E.valid(s));
  s = trade(s, 'sell', 'grain', 320);
  assert.equal(s.cargo.grain, 0); assert.equal(s.ship, 6);
});
test('relief recovers a bankrupt save without a softlock', () => {
  const s = E.initial(); s.gold = 0;
  assert.throws(() => E.act(s, { type: 'sail', destination: 'haven' }));
  const supported = E.act(s, { type: 'relief' });
  assert.equal(supported.gold, 100); assert.equal(supported.day, 4);
  assert.ok(travel(supported, 'cedar').gold >= 0);
  assert.throws(() => E.act(E.initial(), { type: 'relief' }));
});
test('save validation rejects corrupted values', () => {
  const invalid = [null, {}, { ...E.initial(), gold: -1 }, { ...E.initial(), ship: 99 }, { ...E.initial(), port: 'missing' }, { ...E.initial(), day: '1' }, { ...E.initial(), visited: ['lume', 'lume'] }, { ...E.initial(), cargo: { grain: 999, timber: 0, cloth: 0, spice: 0 } }];
  invalid.forEach(s => assert.equal(E.valid(s), false));
  assert.ok(E.valid(JSON.parse(JSON.stringify(E.initial()))));
});
test('a complete campaign can reach the first chapter goal', () => {
  let s = E.initial();
  const visit = id => { s = travel(s, id); };
  for (let i = 0; i < 35 && !s.won; i++) {
    if (s.port !== 'lume') visit('lume');
    const qty = Math.min(E.SHIPS[s.ship].capacity, Math.floor((s.gold - knownQuote(s, 'haven').cost - 16) / 16));
    s = trade(s, 'buy', 'grain', qty); visit('haven'); s = trade(s, 'sell', 'grain', qty);
    if (s.ship === 0 && s.gold > 1300) s = E.act(s, { type: 'upgrade' });
    if (s.gold > 6000) { for (const p of E.PORTS) if (!s.visited.includes(p.id)) visit(p.id); }
  }
  assert.ok(s.won); assert.equal(s.visited.length, E.PORTS.length); assert.ok(s.gold >= 5000); assert.ok(E.valid(s));
});
test('version-one save migrates without losing money, cargo, ship, or achievements', () => {
  const old = E.initial(); old.version = 1; old.gold = 4321; old.ship = 2; old.cargo.cloth = 12; old.won = true;
  for (const key of ['discoveries', 'contractsDone', 'activeContract', 'reputation', 'adventureWon']) delete old[key];
  const restored = E.migrate(old);
  assert.equal(restored.version, 4); assert.equal(restored.gold, 4321); assert.equal(restored.ship, 2);
  assert.equal(restored.cargo.cloth, 12); assert.equal(restored.won, true); assert.deepEqual(restored.discoveries, []);
  assert.equal(old.version, 1); assert.ok(E.valid(restored)); assert.equal(E.migrate({ ...old, gold: -1 }), null);
});
test('exploration charges preparation, advances time, pays once, and unlocks cheaper voyages', () => {
  const start = E.initial();
  const before = knownQuote(start, 'cedar');
  const found = E.act(start, { type: 'explore', site: 'tide' });
  assert.equal(found.gold, 790); assert.equal(found.day, 3); assert.equal(found.reputation, 10);
  assert.equal(knownQuote(found, 'cedar').cost, before.cost - before.days);
  assert.deepEqual(start.discoveries, []); assert.ok(E.valid(found));
  assert.throws(() => E.act(found, { type: 'explore', site: 'tide' }));
  assert.throws(() => E.act({ ...start, gold: 89 }, { type: 'explore', site: 'tide' }));
  assert.throws(() => E.act(start, { type: 'explore', site: 'grove' }));
  const azure = travel(start, 'azure');
  assert.throws(() => E.act(azure, { type: 'explore', site: 'stars' }));
});
test('contracts require acceptance, destination, and cargo; reward cannot be repeated', () => {
  const start = E.initial();
  assert.throws(() => E.act(start, { type: 'accept', contract: 'loom' }));
  let s = E.act(start, { type: 'accept', contract: 'bread' });
  assert.throws(() => E.act(s, { type: 'accept', contract: 'bread' }));
  assert.throws(() => E.act(s, { type: 'deliver' }));
  s = travel(s, 'cedar');
  assert.throws(() => E.act(s, { type: 'deliver' }));
  s = trade(s, 'buy', 'grain', 8);
  const before = s.gold;
  s = E.act(s, { type: 'deliver' });
  assert.equal(s.gold, before + 260); assert.equal(s.cargo.grain, 0); assert.equal(s.reputation, 8);
  assert.equal(s.activeContract, null); assert.deepEqual(s.contractsDone, ['bread']); assert.ok(E.valid(s));
  assert.throws(() => E.act(s, { type: 'deliver' }));
  s = travel(s, 'lume');
  assert.throws(() => E.act(s, { type: 'accept', contract: 'bread' }));
});
test('contract cancellation keeps cargo and money and permits acceptance again', () => {
  let s = trade(E.initial(), 'buy', 'grain', 8);
  const before = s.gold;
  s = E.act(s, { type: 'accept', contract: 'bread' });
  s = E.act(s, { type: 'cancel-contract' });
  assert.equal(s.gold, before); assert.equal(s.cargo.grain, 8); assert.equal(s.activeContract, null);
  assert.equal(E.act(s, { type: 'accept', contract: 'bread' }).activeContract, 'bread');
});
test('all discoveries and deliveries are attainable from an ordinary new save', () => {
  let s = E.initial();
  for (let i = 0; i < 5; i++) {
    const site = E.SITES.find(site => site.port === s.port);
    s = E.act(s, { type: 'explore', site: site.id });
    assert.ok(E.valid(s));
    if (i < 4) {
      const contract = E.CONTRACTS[i];
      s = E.act(s, { type: 'accept', contract: contract.id });
      s = trade(s, 'buy', contract.good, contract.qty);
      s = travel(s, contract.to);
      s = E.act(s, { type: 'deliver' });
    }
  }
  assert.equal(s.discoveries.length, 5); assert.equal(s.contractsDone.length, 4);
  assert.ok(s.adventureWon); assert.ok(s.gold > 700); assert.ok(E.valid(s));
  assert.ok(E.valid(E.migrate(JSON.parse(JSON.stringify(s)))));
});
test('malformed adventure fields are not accepted as saved progress', () => {
  const s = E.initial();
  for (const patch of [{ discoveries: ['missing'] }, { discoveries: ['tide', 'tide'] }, { discoveries: ['stars'] }, { contractsDone: ['bread', 'bread'] }, { activeContract: 'missing' }, { reputation: -1 }, { adventureWon: 1 }, { contractsDone: ['bread'], activeContract: 'bread' }]) {
    assert.equal(E.migrate({ ...s, ...patch }), null);
  }
});
