const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('playwright');

const sources = [
  'voicebosch-creaking-wood-199971.mp3',
  'dragon-studio-creaking-401724.mp3',
  'tanweraman-creaking-wood-hq-257176.mp3',
  'freesound_community-creaking-wood-46095.mp3'
];
const recipes = [
  { file: 'hull-recorded.wav', seconds: 18, peak: .25, rms: .025, lowpass: 2300, segments: [
    { at: .8, offset: .4, duration: 2.6, rate: .88, level: .8 },
    { at: 6.5, offset: 13.5, duration: 4.5, rate: .9, level: .6 },
    { at: 13.4, offset: 24.4, duration: 2.2, rate: .84, level: 1 }
  ] },
  { file: 'turn-recorded-1.wav', seconds: 2.9, peak: .5, rms: .08, lowpass: 2200, segments: [{ at: .03, offset: .12, duration: 2.25, rate: .82, level: 1 }] },
  { file: 'turn-recorded-2.wav', seconds: 2.8, peak: .5, rms: .08, lowpass: 3100, segments: [{ at: .03, offset: .05, duration: 2.35, rate: .9, level: 1 }] },
  { file: 'turn-recorded-3.wav', seconds: 2.3, peak: .5, rms: .08, lowpass: 2700, segments: [{ at: .03, offset: .03, duration: 1.9, rate: .88, level: 1 }] }
];

function wav(pcm, rate) {
  const header = Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(pcm.length + 36, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

(async () => {
  const dir = process.argv.find(a => a.startsWith('--source-dir='))?.slice(13);
  if (!dir) throw Error('Pass --source-dir=PATH containing the four licensed source MP3 files. Originals are never modified.');
  const inspect = process.argv.includes('--inspect');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage(); const report = [];
    for (const [i, name] of sources.entries()) {
      const bytes = fs.readFileSync(path.join(dir, name)), recipe = recipes[i];
      const result = await page.evaluate(async ({ base64, recipe, inspect }) => {
        const rate = 32000;
        const decode = new OfflineAudioContext(1, 1, rate);
        const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        const buffer = await decode.decodeAudioData(bytes.buffer);
        const data = buffer.getChannelData(0), envelope = [];
        for (let start = 0; start < data.length; start += rate / 2) {
          const block = data.subarray(start, start + rate / 2);
          envelope.push(+Math.sqrt(block.reduce((sum, x) => sum + x * x, 0) / block.length).toFixed(4));
        }
        const source = { seconds: buffer.duration, channels: buffer.numberOfChannels, envelope };
        if (inspect) return source;
        const ctx = new OfflineAudioContext(1, Math.round(recipe.seconds * rate), rate);
        const hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 85; hp.Q.value = .707;
        lp.type = 'lowpass'; lp.frequency.value = recipe.lowpass; lp.Q.value = .707;
        hp.connect(lp); lp.connect(ctx.destination);
        for (const seg of recipe.segments) {
          if (seg.offset + seg.duration > buffer.duration) throw Error('Source segment exceeds recording length');
          const source = ctx.createBufferSource(), gain = ctx.createGain();
          source.buffer = buffer; source.playbackRate.value = seg.rate;
          const length = seg.duration / seg.rate, end = seg.at + length;
          if (end > recipe.seconds - .04) throw Error('Output segment exceeds file length');
          gain.gain.setValueAtTime(0, seg.at);
          gain.gain.linearRampToValueAtTime(seg.level, seg.at + .08);
          gain.gain.setValueAtTime(seg.level, end - .24);
          gain.gain.linearRampToValueAtTime(0, end);
          source.connect(gain); gain.connect(hp); source.start(seg.at, seg.offset, seg.duration);
        }
        const rendered = await ctx.startRendering(), samples = rendered.getChannelData(0);
        let peak = 0, sum = 0;
        for (const x of samples) { peak = Math.max(peak, Math.abs(x)); sum += x * x; }
        if (peak < .00001) throw Error('Silent recording selection');
        const rms = Math.sqrt(sum / samples.length), scale = Math.min(recipe.peak / peak, recipe.rms / rms);
        const pcm = new Uint8Array(samples.length * 2), view = new DataView(pcm.buffer);
        for (let n = 0; n < samples.length; n++) view.setInt16(n * 2, Math.round(samples[n] * scale * 32767), true);
        let binary = '';
        for (let n = 0; n < pcm.length; n += 8192) binary += String.fromCharCode(...pcm.subarray(n, n + 8192));
        return { source, rate, seconds: rendered.duration, peak: peak * scale, rms: rms * scale, pcm: btoa(binary) };
      }, { base64: bytes.toString('base64'), recipe, inspect });
      if (!inspect) {
        const destination = path.join(__dirname, 'assets/audio', recipe.file);
        if (fs.existsSync(destination) && !process.argv.includes('--force')) throw Error('Output exists; pass --force to rebuild: ' + recipe.file);
        fs.writeFileSync(destination, wav(Buffer.from(result.pcm, 'base64'), result.rate));
        delete result.pcm;
      }
      report.push({ source: name, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), recipe, result });
    }
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
