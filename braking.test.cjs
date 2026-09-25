const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js'), N = E.N;

function cruise(ship = 0) {
  let s = E.act(E.initial(), { type: 'show-chart' });
  s.port = null; s.position = N.project(-12, 40); s.ship = ship;
  s.motion.speed = 1; s.motion.heading = 180;
  return E.act(s, { type: 'navigate', mode: 'manual', point: N.project(-12, 29) });
}
function stop(s, dt = .1) {
  for (let i = 0; i < 2000 && s.navigation?.running; i++) s = E.advance(s, dt);
  assert.ok(!s.navigation?.running, 'Braking eventually reaches a complete stop');
  return s;
}

test('all ships coast to a stop without freezing, overspending or losing their route', () => {
  for (let tier = 0; tier < E.SHIPS.length; tier++) {
    const original = cruise(tier), request = E.act(original, { type: 'pause' });
    assert.deepEqual(request.position, original.position);
    assert.equal(request.motion.speed, 1); assert.equal(request.navigation.stopping, true);
    let s = request, elapsed = 0;
    while (s.navigation.running && elapsed < 4) {
      const before = s; s = E.advance(s, .1); elapsed += .1;
      assert.ok(s.motion.speed <= before.motion.speed);
      assert.ok(N.distance(s.position, before.position) > 0);
      assert.ok(N.clear(before.position, s.position)); assert.ok(E.valid(s));
    }
    assert.ok(elapsed > 2 && elapsed < 2.4);
    assert.equal(s.motion.speed, 0); assert.equal(s.navigation.running, false);
    const distance = N.distance(original.position, s.position);
    assert.ok(Math.abs(distance - 15.75 * E.SHIPS[tier].speed / .9) < .01);
    assert.deepEqual(E.advance(s, 1).position, s.position);
    const passage = E.passage(original, [s.position]);
    assert.equal(s.gold, original.gold - passage.cost); assert.equal(s.day, original.day + passage.days);
    const resumed = E.advance(E.act(s, { type: 'resume' }), .1);
    assert.ok(resumed.motion.speed > 0 && resumed.motion.speed < .1);
  }
});

test('resume and new steering cancel braking without discarding momentum', () => {
  const coasting = E.advance(E.act(cruise(), { type: 'pause' }), .5);
  for (const action of [{ type: 'resume' }, { type: 'steer', heading: 180 }]) {
    const resumed = E.act(coasting, action);
    assert.equal(resumed.motion.speed, coasting.motion.speed);
    assert.equal(resumed.navigation.stopping, false);
    assert.ok(E.advance(resumed, .1).motion.speed > coasting.motion.speed);
  }
});

test('manual destinations brake before the endpoint without creeping forever or overshooting', () => {
  for (const ship of [0, 6]) {
    let s = cruise(ship);
    const target = { x: s.position.x, y: s.position.y + 100 };
    s = E.act(s, { type: 'navigate', mode: 'manual', point: target });
    let brakeFrames = 0, previousSpeed = 1;
    for (let i = 0; i < 200 && s.navigation; i++) {
      previousSpeed = s.motion.speed; s = E.advance(s, .1);
      if (s.motion.braking) { brakeFrames++; assert.ok(s.motion.speed <= previousSpeed + 1e-8); }
      assert.ok(s.position.y <= target.y + 1e-8); assert.ok(E.valid(s));
    }
    assert.equal(s.navigation, null); assert.ok(brakeFrames > 12);
    assert.ok(previousSpeed < .1, 'Final stop is from a crawl, not cruise speed');
    assert.ok(N.distance(s.position, target) < 1e-5);
  }
});

test('every port brakes for auto and manual arrivals, without entering or revealing it early', () => {
  for (const port of E.PORTS) for (const ship of [0, 6]) for (const mode of ['auto', 'manual']) {
    let s = cruise(ship), start;
    for (let heading = 0; heading < 360; heading += 15) {
      const candidate = N.headingTarget(port, heading, 100);
      if (N.distance(candidate, port) > 90) { start = candidate; break; }
    }
    assert.ok(start, port.id); s.position = start;
    s.motion.heading = (Math.atan2(port.x - start.x, start.y - port.y) * 180 / Math.PI + 360) % 360;
    if (mode === 'auto' && !s.visited.includes(port.id)) s.visited.push(port.id);
    s = E.act(s, { type: 'navigate', mode, destination: port.id, point: port });
    const visited = [...s.visited]; let braking = 0, previousSpeed = 1;
    for (let i = 0; i < 300 && s.navigation; i++) {
      previousSpeed = s.motion.speed; s = E.advance(s, .1);
      if (s.motion.braking) braking++;
      if (s.navigation?.running) assert.throws(() => E.act(s, { type: 'enter-port' }), /정지/);
      assert.ok(E.valid(s), `${port.id} ${mode} ${ship}`);
    }
    assert.equal(s.navigation, null); assert.ok(braking > 12); assert.ok(previousSpeed < .1);
    assert.equal(E.nearbyPort(s)?.id, port.id); assert.equal(s.port, null); assert.deepEqual(s.visited, visited);
    assert.equal(E.act(s, { type: 'enter-port' }).port, port.id);
  }
});

test('coast collision and lifecycle safety stops remain immediate', () => {
  const moving = cruise(), paused = E.act(moving, { type: 'pause', immediate: true });
  assert.equal(paused.motion.speed, 0); assert.equal(paused.navigation.running, false);
  assert.deepEqual(E.advance(paused, 1).position, moving.position);
  let s = E.act(moving, { type: 'steer', heading: 90 }), before;
  for (let i = 0; s.navigation?.running && i < 500; i++) { before = s; s = E.advance(s, .1); }
  assert.ok(before.motion.speed > .9, 'The coast is an abrupt safety stop, not destination braking');
  assert.equal(s.motion.speed, 0); assert.ok(N.isSea(s.position)); assert.ok(N.clear(before.position, s.position));
  const bad = cruise(); bad.navigation.points = [N.project(-3.7, 40.4)]; bad.navigation.hardEnd = true;
  const collision = stop(bad);
  assert.equal(collision.motion.speed, 0); assert.ok(N.isSea(collision.position));
  assert.match(collision.log[0], /해안/);
});

test('braking is frame-rate independent and reload cancels remaining drift safely', () => {
  const request = E.act(cruise(6), { type: 'pause' });
  const coarse = stop(request, 1), fine = stop(request, 1 / 60);
  assert.ok(N.distance(coarse.position, fine.position) < .01);
  assert.equal(coarse.gold, fine.gold); assert.equal(coarse.day, fine.day);
  const drifting = E.advance(request, .5), loaded = E.migrate(drifting);
  assert.ok(loaded); assert.equal(loaded.motion.speed, 0); assert.equal(loaded.navigation.stopping, false);
  assert.deepEqual(E.advance(loaded, 1).position, drifting.position);
  for (const patch of [{ stopping: 'yes' }, { hardEnd: 1 }, { arrivalPort: 'invalid' }]) {
    assert.equal(E.migrate({ ...drifting, navigation: { ...drifting.navigation, ...patch } }), null);
  }
});
