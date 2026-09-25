const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('playwright');

// Keep the recording's three distinct strikes, with a shorter ship-bell cadence.
const recipe = {
  seconds: 2.4, rate: 32000, playbackRate: .94, peak: .55, rms: .105,
  strikes: [
    { at: .02, offset: .12, duration: .235, level: .84 },
    { at: .20, offset: .36, duration: .235, level: .78 },
    { at: .38, offset: .60, duration: .576, level: 1 }
  ]
};

(async () => {
  const sourcePath = process.argv.find(a => a.startsWith('--source='))?.slice(9);
  if (!sourcePath) throw Error('Pass --source=PATH to the licensed Opening Bell MP3. The original is never modified.');
  const destination = path.join(__dirname, 'assets/audio/arrival-bell-recorded.wav');
  if (fs.existsSync(destination) && !process.argv.includes('--force')) throw Error('Output exists; pass --force to rebuild.');
  const input = fs.readFileSync(sourcePath);
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const result = await page.evaluate(async ({ base64, recipe }) => {
      const { rate, seconds } = recipe;
      const ctx = new OfflineAudioContext(1, Math.round(seconds * rate), rate);
      const recording = await ctx.decodeAudioData(Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer);
      const hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 140; hp.Q.value = .707;
      lp.type = 'lowpass'; lp.frequency.value = 6200; lp.Q.value = .707;
      hp.connect(lp); lp.connect(ctx.destination);

      // A low-level, offline room tail on only the last strike, not another bell.
      const impulse = ctx.createBuffer(1, Math.round(1.4 * rate), rate);
      const tail = impulse.getChannelData(0);
      let seed = 421471;
      for (let i = 0; i < tail.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const t = i / rate;
        tail[i] = (seed / 2147483648 - 1) * Math.min(1, t / .015) * Math.exp(-5 * t);
      }
      const reverb = ctx.createConvolver(), wet = ctx.createGain(), soft = ctx.createBiquadFilter();
      reverb.buffer = impulse; wet.gain.value = .11;
      soft.type = 'lowpass'; soft.frequency.value = 3500;
      reverb.connect(wet); wet.connect(soft); soft.connect(ctx.destination);
      for (const [i, strike] of recipe.strikes.entries()) {
        if (strike.offset + strike.duration > recording.duration + .001) throw Error('Recording is shorter than the selected strike');
        const source = ctx.createBufferSource(), gain = ctx.createGain();
        source.buffer = recording; source.playbackRate.value = recipe.playbackRate;
        const end = strike.at + strike.duration / recipe.playbackRate;
        gain.gain.setValueAtTime(0, strike.at);
        gain.gain.linearRampToValueAtTime(strike.level, strike.at + .004);
        gain.gain.setValueAtTime(strike.level, end - (i === 2 ? .12 : .055));
        gain.gain.linearRampToValueAtTime(0, end);
        source.connect(gain); gain.connect(hp);
        if (i === 2) gain.connect(reverb);
        source.start(strike.at, strike.offset, strike.duration);
      }
      const samples = (await ctx.startRendering()).getChannelData(0);
      let peak = 0, sum = 0;
      for (let i = 0; i < samples.length; i++) {
        const remaining = (samples.length - 1 - i) / rate;
        samples[i] *= Math.min(1, Math.max(0, (remaining - .02) / .10));
        peak = Math.max(peak, Math.abs(samples[i])); sum += samples[i] ** 2;
      }
      if (peak < .001) throw Error('Silent bell');
      const rms = Math.sqrt(sum / samples.length), scale = Math.min(recipe.peak / peak, recipe.rms / rms);
      const pcm = new Uint8Array(samples.length * 2), view = new DataView(pcm.buffer);
      for (let i = 0; i < samples.length; i++) view.setInt16(i * 2, Math.round(samples[i] * scale * 32767), true);
      let binary = '';
      for (let i = 0; i < pcm.length; i += 8192) binary += String.fromCharCode(...pcm.subarray(i, i + 8192));
      return { pcm: btoa(binary), sourceSeconds: recording.duration, peak: peak * scale, rms: rms * scale };
    }, { base64: input.toString('base64'), recipe });
    const pcm = Buffer.from(result.pcm, 'base64'), header = Buffer.alloc(44);
    header.write('RIFF'); header.writeUInt32LE(pcm.length + 36, 4); header.write('WAVEfmt ', 8);
    header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
    header.writeUInt32LE(recipe.rate, 24); header.writeUInt32LE(recipe.rate * 2, 28);
    header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
    fs.writeFileSync(destination, Buffer.concat([header, pcm]));
    delete result.pcm;
    console.log(JSON.stringify({ destination, source: path.basename(sourcePath), sha256: crypto.createHash('sha256').update(input).digest('hex'), recipe, ...result }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
