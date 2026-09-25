const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const config = require('./audio-config.js');
const { createSounds, rate } = require('./build-audio.cjs');
const generated = createSounds();

test('every configured sound ships in the replaceable audio directory', () => {
  assert.equal(Object.keys(config.sfx.sounds).length, 9);
  for (const sound of Object.values(config.sfx.sounds)) {
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
    if (config.sfx.sounds[name].loop) assert.ok(Math.abs(data[0] - data.at(-1)) < .02, 'Quiet loop seam: ' + name);
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

test('edited recorded creaks are mono PCM with headroom, fades and a quiet hull loop seam', () => {
  for (const [key, seconds] of [['hull', 18], ['turn1', 2.9], ['turn2', 2.8], ['turn3', 2.3]]) {
    const data = fs.readFileSync(path.join(__dirname, config.sfx.sounds[key].file));
    assert.equal(data.readUInt16LE(20), 1);
    assert.equal(data.readUInt16LE(22), 1);
    assert.equal(data.readUInt32LE(24), 32000);
    assert.equal(data.readUInt16LE(34), 16);
    const n = (data.length - 44) / 2;
    assert.equal(n / 32000, seconds);
    let peak = 0, sum = 0;
    for (let i = 0; i < n; i++) {
      const x = data.readInt16LE(44 + i * 2) / 32768;
      peak = Math.max(peak, Math.abs(x)); sum += x * x;
      if (i < 640 || i >= n - 640) assert.equal(x, 0, key + ': quiet edge');
    }
    assert.ok(peak > .05 && peak <= (key === 'hull' ? .251 : .501), key + ': peak');
    const rms = Math.sqrt(sum / n);
    assert.ok(rms > .005 && rms <= (key === 'hull' ? .026 : .081), key + ': level');
  }
});

test('all current sounds are effects and music is a separate empty bank', () => {
  assert.deepEqual(Object.keys(config.sfx.sounds).sort(), ['bell', 'gull', 'hull', 'sails', 'turn1', 'turn2', 'turn3', 'water', 'wind']);
  assert.deepEqual(config.music.tracks, {});
  assert.equal(config.sfx.gain, 1);
  assert.equal(config.music.gain, 1);
  assert.equal(config.master, .45);
});

test('water is quieter at every speed and the arrival bell is reduced independently', () => {
  assert.equal(config.sfx.sounds.water.gain, .1125);
  assert.equal(config.sfx.sounds.bell.gain, .16);
  for (const speed of [0, .1, .5, 1]) {
    const previous = .08 + .92 * speed;
    assert.ok(Math.abs(previous * config.sfx.sounds.water.gain - previous * .75 * .15) < 1e-12);
  }
  assert.equal(config.sfx.sounds.wind.gain, 1);
  assert.equal(config.sfx.sounds.gull.gain, .085);
});

test('recorded arrival bell has three close attacks, a fading tail and safe levels', () => {
  assert.equal(config.sfx.sounds.bell.file, 'assets/audio/arrival-bell-recorded.wav');
  const bytes = fs.readFileSync(path.join(__dirname, config.sfx.sounds.bell.file));
  assert.equal(bytes.readUInt16LE(20), 1);
  assert.equal(bytes.readUInt16LE(22), 1);
  assert.equal(bytes.readUInt32LE(24), 32000);
  assert.equal(bytes.readUInt16LE(34), 16);
  const data = Array.from({ length: (bytes.length - 44) / 2 }, (_, i) => bytes.readInt16LE(44 + i * 2) / 32768);
  assert.equal(data.length / 32000, 2.4);
  assert.ok(data.reduce((max, x) => Math.max(max, Math.abs(x)), 0) <= .551);
  const rms = (start, end) => {
    const part = data.slice(Math.round(start * 32000), Math.round(end * 32000));
    return Math.sqrt(part.reduce((sum, x) => sum + x * x, 0) / part.length);
  };
  for (const at of [.04, .22, .40]) assert.ok(rms(at, at + .04) > rms(at - .04, at - .02) * 1.4);
  assert.ok(rms(.8, .9) > .01, 'Last recorded strike rings out');
  assert.ok(rms(1.04, 1.14) > .0005, 'Quiet final reverberation');
  assert.ok(rms(1.4, 1.5) < rms(1.04, 1.14), 'Tail decays');
  assert.equal(rms(0, .02), 0);
  assert.equal(rms(2.38, 2.4), 0);
});
