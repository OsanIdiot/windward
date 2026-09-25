const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
test('painted ship is a small alpha WebP and is included in local and public delivery', () => {
  const image = fs.readFileSync(path.join(__dirname, 'assets/merchant-caravel.webp'));
  assert.equal(image.toString('ascii', 0, 4), 'RIFF');
  assert.equal(image.toString('ascii', 8, 12), 'WEBP');
  assert.equal(image.toString('ascii', 12, 16), 'VP8X');
  assert.ok(image[20] & 0x10, 'Alpha channel flag');
  assert.equal(image.readUIntLE(24, 3) + 1, 384);
  assert.equal(image.readUIntLE(27, 3) + 1, 576);
  assert.ok(image.length < 100 * 1024);
  assert.ok(read('server.cjs').includes("files.add('assets/merchant-caravel.webp')"));
  assert.ok(read('.github/workflows/pages.yml').includes('cp assets/merchant-caravel.webp _site/assets/'));
  assert.ok(read('assets/VISUAL-CREDITS.md').includes('Generation prompt'));
});
test('visual renderer loads before voyage UI and is deployed without changing gameplay or audio scripts', () => {
  const html = read('index.html');
  assert.ok(html.indexOf('src="voyage-art.js') < html.indexOf('src="voyage-ui.js'));
  assert.ok(read('server.cjs').includes("files.add('voyage-art.js')"));
  assert.ok(read('.github/workflows/pages.yml').includes('voyage-camera.js voyage-art.js voyage-ui.js'));
  assert.ok(html.includes('engine.js?v=0.1.9'));
  assert.ok(html.includes('audio-config.js?v=0.1.5'));
  assert.ok(html.includes('sea-ui.js?v=0.1.3'));
});
