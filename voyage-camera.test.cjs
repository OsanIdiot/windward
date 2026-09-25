const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('./voyage-camera.js');
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('heading-up puts the bow above the ship and starboard to screen right', () => {
  const position = { x: 150, y: 200 };
  for (const bearing of [0, 45, 90, 180, 225, 270, 359]) {
    const a = bearing * Math.PI / 180, view = { x: 200, y: 300, zoom: 2, bearing };
    const bow = C.project({ x: 150 + Math.sin(a) * 10, y: 200 - Math.cos(a) * 10 }, position, view);
    close(bow.x, 200); close(bow.y, 280);
    const right = C.project({ x: 150 + Math.cos(a) * 10, y: 200 + Math.sin(a) * 10 }, position, view);
    close(right.x, 220); close(right.y, 300);
    close(C.worldHeading(90, bearing), (bearing + 90) % 360);
  }
});

test('projection and inverse agree across north crossings, zoom levels and screen sizes', () => {
  for (const bearing of [0, 1, 89, 180, 270, 359, 360, -1]) for (const zoom of [.5, 2, 4]) {
    const position = { x: 300, y: 200 }, view = { x: 156, y: 290, zoom, bearing };
    for (const point of [{ x: 303, y: 217 }, { x: 280, y: 198 }]) {
      const back = C.unproject(C.project(point, position, view), position, view);
      close(back.x, point.x); close(back.y, point.y);
    }
    for (const [width, height] of [[280, 350], [1280, 500]]) {
      const bounds = C.bounds(position, view, width, height);
      for (const [x, y] of [[0, 0], [width, 0], [0, height], [width, height], [width / 2, height / 2]]) {
        const world = C.unproject({ x, y }, position, view);
        assert.ok(world.x >= bounds.left - 1e-8 && world.x <= bounds.right + 1e-8);
        assert.ok(world.y >= bounds.top - 1e-8 && world.y <= bounds.bottom + 1e-8);
      }
    }
  }
});

test('north-up preserves the original chart axes and screen steering', () => {
  const p = C.project({ x: 12, y: 23 }, { x: 10, y: 20 }, { x: 100, y: 100, zoom: 3, bearing: 0 });
  assert.deepEqual(p, { x: 106, y: 109 });
  assert.equal(C.worldHeading(-90, 0), 270); assert.equal(C.worldHeading(2, 359), 1);
});
