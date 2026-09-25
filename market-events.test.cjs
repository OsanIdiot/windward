const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');
function at(port, day = 1) {
  const s = E.initial(), p = E.portOf(port);
  s.port = s.lastPort = port; s.position = { x: p.x, y: p.y }; s.day = day;
  s.visited = [...new Set([...s.visited, port])]; return s;
}
test('three deterministic demand events last 20 days, with four quiet days and exact expiry', () => {
  for (let cycle = 0; cycle < 12; cycle++) {
    const start = cycle * 24 + 1;
    for (let offset = 0; offset < 24; offset++) {
      const event = E.marketEvent({ day: start + offset });
      if (offset >= 20) { assert.equal(event, null); continue; }
      assert.equal(event.id, E.MARKET_EVENTS[cycle % 3].id);
      assert.equal(event.startDay, start); assert.equal(event.endDay, start + 19);
      assert.equal(event.remaining, 20 - offset);
    }
  }
});
test('only the named good and port change; both quotes return to their original values at expiry', () => {
  for (const [i, event] of E.MARKET_EVENTS.entries()) for (const port of E.PORTS) for (const [g, good] of E.GOODS.entries()) {
    const base = port.prices[g], state = at(port.id, i * 24 + 1);
    const buy = port.id === event.port && good.id === event.good ? Math.ceil(base * (100 + event.percent) / 100) : base;
    assert.deepEqual(E.price(state, good.id), { buy, sell: Math.floor(buy * .9) });
    assert.deepEqual(E.price({ ...state, day: i * 24 + 21 }, good.id), { buy: base, sell: Math.floor(base * .9) });
  }
  assert.deepEqual(E.price(at('cedar'), 'grain'), { buy: 39, sell: 35 });
});
test('same-day buy/sell loops always lose money, during events and quiet periods', () => {
  for (const day of [1, 20, 21, 24, 25, 44, 45, 49, 68, 69, 73]) for (const port of E.PORTS) for (const good of E.GOODS) {
    const s = at(port.id, day), before = JSON.stringify(s);
    const bought = E.act(s, { type: 'trade', good: good.id, side: 'buy', qty: 1 });
    const sold = E.act(bought, { type: 'trade', good: good.id, side: 'sell', qty: 1 });
    assert.ok(sold.gold < s.gold); assert.equal(sold.day, s.day); assert.ok(E.valid(sold));
    assert.equal(JSON.stringify(s), before);
  }
});
test('trades use the current quote, obey funds and capacity, and never multiply contract rewards', () => {
  const s = at('cedar'); s.gold = 38;
  assert.throws(() => E.act(s, { type: 'trade', good: 'grain', side: 'buy', qty: 1 }), /금화/);
  s.gold = 10000;
  assert.throws(() => E.act(s, { type: 'trade', good: 'grain', side: 'buy', qty: 25 }), /적재/);
  s.cargo.grain = 8; s.activeContract = 'bread';
  const sold = E.act(s, { type: 'trade', good: 'grain', side: 'sell', qty: 8 });
  assert.equal(sold.gold, s.gold + 8 * 35);
  const delivered = E.act(s, { type: 'deliver' });
  assert.equal(delivered.gold, s.gold + 260);
  assert.equal(E.act({ ...s, day: 21 }, { type: 'trade', good: 'grain', side: 'sell', qty: 8 }).gold, s.gold + 8 * 27);
});
test('reading or reloading news never changes saves, currency, visits or expiry', () => {
  for (const day of [1, 20, 21, 25, 49, 75]) {
    const s = at('lume', day), before = JSON.stringify(s), event = E.marketEvent(s);
    for (let i = 0; i < 5; i++) { assert.deepEqual(E.marketEvent(E.migrate(s)), event); E.price(s, 'grain', 'cedar'); }
    assert.equal(JSON.stringify(s), before); assert.deepEqual(E.migrate(s), s);
  }
});
test('the opening trade rumor leaves plenty of time for a starter ship and an exploration detour', () => {
  const s = E.initial(), route = E.N.route(s.position, E.portOf('cedar'));
  const trip = E.passage(s, route), event = E.marketEvent(s);
  assert.ok(trip.days + 3 < event.remaining);
  let sailing = E.act(E.act(s, { type: 'trade', good: 'grain', side: 'buy', qty: 10 }), { type: 'show-chart' });
  for (const point of route) {
    if (E.N.distance(sailing.position, point) < 1) continue;
    sailing = E.act(sailing, { type: 'navigate', mode: 'manual', point });
    for (let i = 0; sailing.navigation?.running && i < 10000; i++) sailing = E.advance(sailing, .5);
  }
  sailing = E.act(sailing, { type: 'enter-port' });
  assert.ok(sailing.day <= event.endDay);
  assert.equal(E.price(sailing, 'grain').sell, 35);
  const result = E.act(sailing, { type: 'trade', good: 'grain', side: 'sell', qty: 10 });
  assert.equal(result.gold, 700 - 160 - trip.cost + 350);
});
