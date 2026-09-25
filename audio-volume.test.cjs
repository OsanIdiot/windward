const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const config = require('./audio-config.js');

test('fixed mix matches the selected 100 / 15 / 20 slider levels', () => {
  assert.equal(config.master, .45);
  assert.ok(Math.abs(config.sfx.sounds.water.gain - .75 * .15) < 1e-12);
  assert.ok(Math.abs(config.sfx.sounds.bell.gain - .8 * .2) < 1e-12);
  assert.equal(config.sfx.sounds.wind.gain, 1);
  assert.equal(config.sfx.sounds.sails.gain, .35);
  assert.equal(config.sfx.sounds.gull.gain, .085);
});
test('legacy per-browser volume settings are ignored; sound on/off is retained', () => {
  for (const enabled of ['on', 'off']) {
    const reads = [], root = { WindwardAudio: config, AudioContext: class {} };
    vm.runInNewContext(fs.readFileSync(require.resolve('./audio.js'), 'utf8'), {
      window: root, localStorage: { getItem(key) { reads.push(key); return key === 'windward-audio-enabled' ? enabled : '{"master":0,"water":0,"bell":0}'; } }
    });
    const audio = root.createSeaAudio();
    assert.equal(audio.enabled(), enabled === 'on');
    assert.equal(reads.includes('windward-audio-volumes'), false);
    assert.equal(audio.setVolumes, undefined);
    assert.equal(audio.getVolumes, undefined);
  }
});
test('volume editor UI and its event handlers are removed', () => {
  const html = fs.readFileSync(require.resolve('./index.html'), 'utf8');
  const app = fs.readFileSync(require.resolve('./app.js'), 'utf8');
  assert.doesNotMatch(html, /volume-dialog|data-volume-settings|data-volume=/);
  assert.doesNotMatch(app, /renderVolumeSettings|setVolumes|getVolumes/);
  assert.match(html, /data-sound/);
});
