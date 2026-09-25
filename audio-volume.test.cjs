const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const config = require('./audio-config.js');
function player(saved, fail = false) {
  let written;
  const root = { WindwardAudio: config, AudioContext: class {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('./audio.js'), 'utf8'), {
    window: root, localStorage: { getItem: key => key === 'windward-audio-volumes' ? saved : 'off', setItem: (key, value) => { if (fail) throw Error('blocked'); written = value; } }
  });
  return { audio: root.createSeaAudio(), saved: () => JSON.parse(written) };
}
test('volume settings default safely and keep valid zero values', () => {
  for (const value of [null, 'invalid', 'null', '{"master":-1,"water":"0.3","bell":2}']) {
    const { audio } = player(value);
    assert.equal(JSON.stringify(audio.getVolumes()), '{"master":1,"water":1,"bell":1}');
  }
  const { audio } = player('{"master":0,"water":0.4,"bell":0.2}');
  assert.equal(audio.getVolumes().master, 0); assert.equal(audio.getVolumes().water, .4);
  assert.equal(audio.enabled(), false);
});
test('volume updates persist, do not mutate defaults or expose state, and reject invalid input', () => {
  const { audio, saved } = player(null);
  assert.equal(audio.setVolumes({ master: .5, water: .2, bell: 0 }), true);
  assert.deepEqual(saved(), { master: .5, water: .2, bell: 0 });
  audio.setVolumes({ master: NaN, water: -1, bell: Infinity, wind: .3 });
  assert.deepEqual(saved(), { master: .5, water: .2, bell: 0 });
  audio.getVolumes().master = 1;
  assert.equal(audio.getVolumes().master, .5);
  assert.equal(config.master, .45); assert.equal(config.sfx.sounds.water.gain, .75);
});
test('blocked storage keeps the live setting and reports failure without unmuting', () => {
  const { audio } = player(null, true);
  assert.equal(audio.setVolumes({ water: .15 }), false);
  assert.equal(audio.getVolumes().water, .15); assert.equal(audio.enabled(), false);
});
