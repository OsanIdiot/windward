const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const config = require('./audio-config.js');
const { createSounds, rate } = require('./build-audio.cjs');
const generated = createSounds();

test('every configured sound ships in the replaceable audio directory', () => {
  assert.equal(Object.keys(config.sounds).length, 9);
  for (const sound of Object.values(config.sounds)) {
    assert.match(sound.file, /^assets\/audio\/[\w-]+\.(wav|mp3|ogg|m4a)$/);
    assert.ok(sound.gain >= 0 && sound.gain <= 1);
    const bytes = fs.readFileSync(path.join(__dirname, sound.file));
    assert.ok(bytes.length > 44, sound.file);
    if (sound.file.endsWith('.wav')) {
      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
      assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
    }
  }
});
test('offline placeholders are non-silent, unclipped and have quiet loop seams', () => {
  for (const [name, data] of Object.entries(generated)) {
    const peak = data.reduce((p, x) => Math.max(p, Math.abs(x)), 0);
    assert.ok(peak > .01 && peak < .99, name);
    if (config.sounds[name].loop) assert.ok(Math.abs(data[0] - data.at(-1)) < .02, 'Quiet loop seam: ' + name);
  }
});
test('offline bell placeholder contains three tight attacks and only a final long ring', () => {
  const data = generated.bell;
  const rms = (start, end) => {
    const part = data.slice(Math.round(start * rate), Math.round(end * rate));
    return Math.sqrt(part.reduce((sum, x) => sum + x * x, 0) / part.length);
  };
  assert.ok(rms(.01, .04) > .05);
  assert.ok(rms(.19, .22) > rms(.15, .17) * 3);
  assert.ok(rms(.37, .4) > rms(.33, .35) * 3);
  assert.ok(rms(.8, .9) > .01);
  assert.ok(rms(4.1, 4.14) < .0001);
});
test('browser playback code contains no oscillator or PCM synthesis', () => {
  const source = fs.readFileSync(path.join(__dirname, 'audio.js'), 'utf8');
  assert.doesNotMatch(source, /createOscillator|createBuffer\(|getChannelData|Math\.sin/);
  assert.match(source, /decodeAudioData/);
});
