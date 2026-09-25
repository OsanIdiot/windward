// Offline-only synthesis of the original placeholder sounds. Never loaded by the game.
const fs = require('node:fs');
const path = require('node:path');
const config = require('./audio-config.js');
const rate = 22050;
let seed = 21042026;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const buffer = seconds => new Float32Array(Math.ceil(rate * seconds));

function filter(data, type, hz, q = .55) {
  const w = 2 * Math.PI * hz / rate, c = Math.cos(w), alpha = Math.sin(w) / (2 * q), a0 = 1 + alpha;
  const b = type === 'highpass' ? [(1 + c) / 2, -(1 + c), (1 + c) / 2]
    : type === 'lowpass' ? [(1 - c) / 2, 1 - c, (1 - c) / 2] : [alpha, 0, -alpha];
  const a1 = -2 * c / a0, a2 = (1 - alpha) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < data.length; i++) {
    const x = data[i], y = (b[0] * x + b[1] * x1 + b[2] * x2) / a0 - a1 * y1 - a2 * y2;
    data[i] = y; x2 = x1; x1 = x; y2 = y1; y1 = y;
  }
  return data;
}
function ambience(seconds, warm) {
  const overlap = Math.floor(rate * .2), data = buffer(seconds + .2);
  let previous = 0;
  for (let i = 0; i < data.length; i++) {
    const white = random() * 2 - 1;
    previous = (previous + .02 * white) / 1.02;
    data[i] = warm ? previous * 1.2 + white * .22 : white;
  }
  filter(data, 'highpass', 180, .5);
  filter(data, warm ? 'lowpass' : 'bandpass', warm ? 1800 : 950);
  for (let i = 0; i < data.length; i++) data[i] *= warm ? .2 + .014 * Math.sin(i / rate * .73 * 2 * Math.PI) : .055 + .008 * Math.sin(i / rate * .061 * 2 * Math.PI);
  for (let i = 0; i < overlap; i++) {
    const mix = i / overlap, index = data.length - overlap + i;
    data[index] = data[index] * (1 - mix) + data[i] * mix;
  }
  return data.slice(overlap);
}
function deck(wood) {
  const data = buffer(wood ? 17 : 13);
  const events = wood ? [[1.3, .42], [5.1, .3], [9.2, .55], [14.7, .34]] : [[1.8, .65], [5.6, .85], [10.4, .7]];
  for (const [start, duration] of events) {
    const pitch = 145 + random() * 65;
    let phase = 0, cloth = 0;
    for (let i = 0; i < duration * rate; i++) {
      const t = i / rate, progress = t / duration, envelope = Math.sin(Math.PI * progress) ** 2;
      phase += 2 * Math.PI * pitch * (1 + .18 * Math.sin(progress * Math.PI)) / rate;
      cloth = .78 * cloth + .22 * (random() * 2 - 1);
      data[Math.floor(start * rate) + i] += wood
        ? .075 * envelope * (Math.sin(phase) + .25 * Math.sin(phase * 2) + .1 * Math.sin(phase * 3)) * (.8 + .2 * Math.sin(t * 170))
        : .26 * envelope * cloth * (.55 + .45 * Math.sin(t * 65) ** 2);
    }
  }
  return data;
}
function gull() {
  const data = buffer(1.65);
  for (const [start, duration, pitch] of [[0, .48, 1100], [.7, .65, 990]]) {
    let phase = 0;
    for (let i = 0; i < duration * rate; i++) {
      const t = i / rate, u = t / duration;
      phase += 2 * Math.PI * (pitch * (.72 + .48 * Math.sin(Math.PI * u)) + 35 * Math.sin(t * 70)) / rate;
      data[Math.floor(start * rate) + i] += .23 * Math.sin(Math.PI * u) ** 1.5 * (Math.sin(phase) + .3 * Math.sin(phase * 2) + .12 * Math.sin(phase * 3));
    }
  }
  return data;
}
function turn(variant) {
  const data = buffer(1.25);
  for (const [start, duration, pitch] of [[0, .48, 260], [.59, .58, 315]]) {
    let phase = 0, friction = 0;
    for (let i = 0; i < duration * rate; i++) {
      const t = i / rate, u = t / duration;
      phase += 2 * Math.PI * (pitch + variant * 23) * (1 + .22 * Math.sin(Math.PI * u) - .15 * u) * (1 + .012 * Math.sin(t * 93)) / rate;
      friction = .68 * friction + .32 * (random() * 2 - 1);
      const stickSlip = .5 + .5 * Math.sin(t * (85 + variant * 11) + 1.4 * Math.sin(t * 23)) ** 2;
      data[Math.floor(start * rate) + i] += Math.sin(Math.PI * u) ** 1.2 * stickSlip * (
        .3 * Math.sin(phase) + .14 * Math.sin(phase * 2) + .09 * Math.sin(phase * 3.03) + .09 * friction);
    }
  }
  return data;
}
function bell() {
  const data = buffer(4.14);
  const partials = [[1215, .022, 2.7], [1280, .04, 2.4], [1640, .115, 3.7], [2050, .11, 3.1], [2580, .035, 2.2], [3080, .07, 2.5], [3210, .027, 1.7], [4260, .045, 1.4]];
  for (const [offset, strength, tail] of [[0, .85, .12], [.18, .9, .12], [.36, 1, 1]]) {
    for (const [hz, volume, duration] of partials) {
      const decay = duration * tail, peak = volume * strength;
      for (let i = 0; i < (decay + .03) * rate; i++) {
        const t = i / rate;
        const amplitude = t < .008 ? peak * t / .008 : t < decay
          ? peak * (.0001 / peak) ** ((t - .008) / (decay - .008)) : .0001 * Math.max(0, 1 - (t - decay) / .03);
        data[Math.round(offset * rate) + i] += amplitude * Math.sin(2 * Math.PI * hz * t);
      }
    }
  }
  return data;
}
function writeWav(name, data) {
  const peak = data.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  if (!Number.isFinite(peak) || peak >= 1 || peak === 0) throw Error(`Invalid signal: ${name}`);
  const wav = Buffer.alloc(44 + data.length * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(data.length * 2, 40);
  data.forEach((value, i) => wav.writeInt16LE(Math.round(value * 32767), 44 + i * 2));
  const output = path.resolve(__dirname, config.sfx.sounds[name].file);
  const assetRoot = path.resolve(__dirname, 'assets', 'audio') + path.sep;
  if (!output.startsWith(assetRoot) || !output.endsWith('.wav')) throw Error('Generator writes only WAVs inside assets/audio');
  fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, wav);
  console.log(`${name}: ${(data.length / rate).toFixed(2)}s, ${wav.length} bytes, peak ${peak.toFixed(3)}`);
}
function createSounds() {
  seed = 21042026;
  return { water: ambience(10, true), wind: ambience(12, false), sails: deck(false), hull: deck(true), turn1: turn(0), turn2: turn(1), turn3: turn(2), gull: gull(), bell: bell() };
}
module.exports = { createSounds, rate };
if (require.main === module) {
  if (!process.argv.includes('--force') && Object.values(config.sfx.sounds).some(sound => fs.existsSync(path.join(__dirname, sound.file)))) {
    throw Error('Audio files already exist. Use --force only to overwrite them with synthesized placeholders.');
  }
  for (const [name, data] of Object.entries(createSounds())) writeWav(name, data);
}
