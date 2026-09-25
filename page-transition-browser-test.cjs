const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const E = require('./engine.js');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const url = process.env.BASE_URL || 'http://127.0.0.1:4173/?v=33', errors = [];
  const ready = async (p, selector = '#game-screen') => {
    await p.locator(selector).waitFor({ state: 'visible' });
    await p.locator('#page-transition').waitFor({ state: 'hidden' });
  };
  const id = p => p.evaluate(() => window.documentId);
  const saved = p => p.evaluate(() => JSON.parse(localStorage.getItem(new URLSearchParams(location.search).get('test') === '1' ? Windward.KEY + '-test' : Windward.KEY)));
  const hop = async (p, button, selector) => {
    const before = await id(p);
    await p.locator(button).click(); await ready(p, selector);
    assert.equal(await id(p), before, 'Screen refresh retains the document and its audio permission');
  };
  async function context(options = {}) {
    const c = await browser.newContext({ reducedMotion: 'reduce', ...options });
    await c.addInitScript(() => {
      if (!/^https?:$/.test(location.protocol)) return;
      window.documentId = crypto.randomUUID(); localStorage.setItem('windward-audio-enabled', 'off');
    });
    c.on('page', p => p.on('pageerror', e => errors.push(e.message)));
    return c;
  }
  try {
    for (const mobile of [false, true]) {
      const c = await context({ viewport: { width: mobile ? 390 : 1280, height: 844 }, isMobile: mobile, hasTouch: mobile });
      const p = await c.newPage(); await p.goto(url);
      await hop(p, '#start-button', '#dock');
      assert.equal(new URL(p.url()).searchParams.get('screen'), 'port');
      await p.locator('[data-service="market"]').click(); await p.locator('#qty-grain').fill('2');
      await p.locator('[data-trade="grain"]').click();
      const purchased = await saved(p); assert.equal(purchased.gold, 668);
      await p.locator('#qty-grain').fill('19'); await p.locator('#close-service').click();
      await p.evaluate(() => { window.oldQuantityInput = document.getElementById('qty-grain'); });
      await hop(p, '#harbor-button', '#voyage-screen');
      assert.equal(new URL(p.url()).searchParams.get('screen'), 'sea');
      assert.equal((await saved(p)).gold, purchased.gold); assert.equal((await saved(p)).cargo.grain, 2);
      const seaId = await id(p);
      await p.locator('#open-chart-button').click(); await ready(p, '#chart-screen');
      await p.locator('#return-sea-button').click(); await ready(p, '#voyage-screen');
      assert.equal(await id(p), seaId, 'The chart remains an in-document view to preserve sailing');
      await hop(p, '#voyage-enter-port', '#dock');
      assert.equal((await saved(p)).voyages, 0, 'Viewing the home harbor twice cannot duplicate a voyage');
      await p.locator('[data-service="market"]').click(); assert.equal(await p.locator('#qty-grain').inputValue(), '1');
      assert.equal(await p.evaluate(() => oldQuantityInput.isConnected), false, 'Facility content is rebuilt, not just reopened');
      await p.locator('#close-service').click();
      for (const failedKey of ['windward-v1']) {
        const before = await saved(p), doc = await id(p);
        await p.evaluate(key => {
          window.originalSetItem = Storage.prototype.setItem;
          Storage.prototype.setItem = function (name, value) {
            if (name === key) throw new DOMException('Storage unavailable', 'QuotaExceededError');
            return originalSetItem.call(this, name, value);
          };
        }, failedKey);
        await p.locator('#harbor-button').click();
        assert.equal(await id(p), doc); assert.equal(await p.locator('#dock').isVisible(), true);
        assert.deepEqual(await saved(p), before, 'A failed save/handoff cannot discard progress or change screens');
        assert.equal(await p.evaluate(() => sessionStorage.getItem('windward-v1:page-transfer')), null);
        await p.evaluate(() => { Storage.prototype.setItem = originalSetItem; });
      }
      // Direct URLs are not permission to take over another tab or teleport to a port.
      const direct = await c.newPage(); const directUrl = new URL(url); directUrl.searchParams.set('screen', 'sea');
      await direct.goto(directUrl.href); await ready(direct, '#entry-screen');
      assert.equal(await p.locator('#dock').isVisible(), true);
      await direct.close();
      const beforeBack = await saved(p);
      await p.locator('#return-menu-button').click(); await ready(p, '#entry-screen');
      assert.deepEqual(await saved(p), beforeBack, 'Back never replays an earlier entry action');
      await hop(p, '#start-button', '#dock');
      await p.reload(); await ready(p, '#entry-screen');
      await hop(p, '#start-button', '#dock'); assert.deepEqual(await saved(p), beforeBack);
      await p.locator('#return-menu-button').click();
      await p.locator('#reset-button').click(); await hop(p, '#confirm-reset', '#dock');
      assert.equal((await saved(p)).gold, 700); assert.equal((await saved(p)).cargo.grain, 0);
      assert.equal(await p.locator('dialog[open]').count(), 0);
      const normal = await saved(p), testUrl = new URL(url); testUrl.searchParams.set('test', '1');
      const t = await c.newPage(); await t.goto(testUrl.href); await hop(t, '#start-button', '#dock');
      await t.locator('[data-service="ship"]').click(); await t.locator('#test-gold-button').click();
      await t.locator('#close-service').click(); await hop(t, '#harbor-button', '#voyage-screen');
      await hop(t, '#voyage-enter-port', '#dock');
      assert.equal(new URL(t.url()).searchParams.get('test'), '1'); assert.equal((await saved(t)).gold, 50700);
      assert.deepEqual(await saved(p), normal); assert.equal(await p.locator('#dock').isVisible(), true);
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await c.close();
    }

    // Real first entry is applied once before rebuilding the port screen.
    const c = await context();
    const arrival = E.act(E.initial(), { type: 'show-chart' });
    arrival.port = null; arrival.position = { x: E.portOf('cedar').x, y: E.portOf('cedar').y }; arrival.cargo.grain = 8;
    arrival.activeContract = 'bread';
    await c.addInitScript(s => {
      if (!/^https?:$/.test(location.protocol)) return;
      if (!sessionStorage.getItem('arrival-fixture')) {
        localStorage.setItem('windward-v1', JSON.stringify(s)); sessionStorage.setItem('arrival-fixture', '1');
      }
    }, arrival);
    const p = await c.newPage(); await p.goto(url); await hop(p, '#start-button', '#voyage-screen');
    await hop(p, '#voyage-enter-port', '#dock');
    assert.equal((await saved(p)).voyages, 1); assert.equal((await saved(p)).visited.filter(v => v === 'cedar').length, 1);
    await p.locator('[data-service="contracts"]').click(); await p.locator('#deliver-button').click();
    const delivered = await saved(p); assert.equal(delivered.gold, 960); assert.equal(delivered.cargo.grain, 0);
    await p.locator('#close-service').click(); await hop(p, '#harbor-button', '#voyage-screen');
    await hop(p, '#voyage-enter-port', '#dock');
    assert.deepEqual(await saved(p), delivered, 'Reloading the port never repeats a discovery, delivery or reward');
    await c.close();

    // Rebuilding a screen must not bypass ownership of the latest saved game.
    const race = await context(); const old = await race.newPage(); await old.goto(url); await hop(old, '#start-button', '#dock');
    await hop(old, '#harbor-button', '#voyage-screen');
    await hop(old, '#voyage-enter-port', '#dock');
    const newer = await race.newPage(); await newer.goto(url); await hop(newer, '#start-button', '#dock');
    await newer.locator('[data-service="market"]').click(); await newer.locator('#qty-grain').fill('2'); await newer.locator('[data-trade="grain"]').click();
    const latest = await saved(newer); await ready(old, '#entry-screen');
    await old.evaluate(() => document.getElementById('harbor-button').click());
    assert.match(await old.locator('#session-notice').innerText(), /다른 탭/);
    assert.deepEqual(await saved(newer), latest); assert.equal(await newer.locator('#game-screen').isVisible(), true);
    await race.close(); assert.deepEqual(errors, []);
    console.log('PASS: refreshed facility DOM, clean widgets, preserved document/audio permission and progress, failed storage, reload/reset, mode isolation, single rewards and exclusive cross-tab ownership.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
