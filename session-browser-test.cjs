const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  const errors = [], url = process.env.BASE_URL || 'http://127.0.0.1:4173/?v=30';
  try {
    const context = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    const page = async (address=url) => { const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(address);return p; };
    const start = async p => { await p.locator('#start-button').tap();await p.locator('#game-screen').waitFor({state:'visible'}); };
    const saved = p => p.evaluate(()=>JSON.parse(localStorage.getItem(Windward.KEY)));
    const buy = async (p,qty) => {
      await p.locator('[data-service="market"]').tap();await p.locator('#qty-grain').fill(String(qty));await p.locator('[data-trade="grain"]').tap();
      await p.locator('#close-service').tap();
    };
    const a=await page();await start(a);
    const stale=await page();await buy(a,2);
    await stale.reload();assert.equal((await saved(a)).cargo.grain,2,'Idle entry reload cannot overwrite purchases');
    await start(stale);
    await a.locator('#entry-screen').waitFor({state:'visible'});
    assert.match(await a.locator('#session-notice').innerText(),/다른 탭에서 진행 중/);
    assert.match(await stale.locator('#gold').innerText(),/668/,'Takeover loads latest save');
    await buy(stale,1);
    await a.reload();assert.equal((await saved(stale)).cargo.grain,3,'Superseded tab reload cannot save stale state');
    await start(a);await stale.locator('#entry-screen').waitFor({state:'visible'});
    assert.equal((await saved(a)).cargo.grain,3,'Taking back ownership preserves cargo');
    // Handoff while sailing must flush and pause before the new tab reads the save.
    await a.locator('#harbor-button').tap();await a.locator('#voyage-canvas').focus();await a.keyboard.press('ArrowDown');
    await a.waitForFunction(()=>JSON.parse(localStorage.getItem(Windward.KEY)).navigation?.running);
    await start(stale);await a.locator('#entry-screen').waitFor({state:'visible'});
    const stopped=await saved(stale);assert.equal(stopped.navigation.running,false);
    await stale.waitForTimeout(900);assert.deepEqual(await saved(stale),stopped,'Former writer cannot advance or autosave');
    await a.close();assert.deepEqual(await saved(stale),stopped,'Closing old tab preserves latest state');
    // Reset requires a new claim, even from an idle tab with old progress.
    const resetter=await page();await resetter.locator('#reset-button').tap();await resetter.locator('#confirm-reset').tap();
    await resetter.locator('#game-screen').waitFor({state:'visible'});await stale.locator('#entry-screen').waitFor({state:'visible'});
    assert.equal((await saved(resetter)).gold,700);assert.equal((await saved(resetter)).cargo.grain,0);
    await stale.reload();assert.equal((await saved(resetter)).cargo.grain,0,'Old tab cannot undo reset');
    // Normal and test mode use different writer locks and different saves.
    const testUrl=new URL(url);testUrl.searchParams.set('test','1');const test=await page(testUrl.href);await start(test);
    assert.equal(await resetter.locator('#game-screen').isVisible(),true,'Test mode does not evict normal mode');
    await buy(resetter,2);assert.equal((await saved(resetter)).cargo.grain,2);
    // Near-simultaneous requests converge on exactly one active writer.
    const racers=[await page(),await page(),await page()];
    const pending=[];
    for(const p of racers) pending.push(p.evaluate(()=>document.getElementById('start-button').click()));
    for(const request of pending) await request;
    for(const p of racers) await p.waitForFunction(()=>!document.getElementById('start-button').disabled);
    await resetter.locator('#entry-screen').waitFor({state:'visible'});
    const owners=[];for(const p of racers) if(await p.locator('#game-screen').isVisible()) owners.push(p);
    assert.equal(owners.length,1,'Exactly one normal-mode tab can play');
    const owner=owners[0];assert.equal((await saved(owner)).cargo.grain,2);
    await owner.reload();await start(owner);assert.equal((await saved(owner)).cargo.grain,2,'Owner reload can reclaim safely');
    await owner.locator('#return-menu-button').tap();const idleSnapshot=await saved(owner);await owner.reload();assert.deepEqual(await saved(owner),idleSnapshot);
    assert.deepEqual(errors,[]);
    await context.close();
    for (const unsupported of ['locks','storage']) {
      const c=await browser.newContext();
      await c.addInitScript(kind=>{
        if(kind==='locks') Object.defineProperty(navigator,'locks',{value:undefined});
        else Storage.prototype.setItem=function(){throw new DOMException('quota','QuotaExceededError')};
      },unsupported);
      const p=await c.newPage();await p.goto(url);await p.locator('#start-button').click();
      await p.waitForFunction(()=>!document.getElementById('start-button').disabled);
      assert.equal(await p.locator('#game-screen').isVisible(),false,'Unsafe ownership fails closed');
      assert.equal(await p.locator('#session-notice').isVisible(),true);
      await c.close();
    }
    console.log('PASS: stale entry reload, takeover/latest save, stopped old writer, reset, mode isolation, simultaneous claims, reload/release and safe unsupported/storage failures.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
