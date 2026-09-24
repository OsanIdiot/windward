(function (root) {
  'use strict';
  root.createSeaAudio = function ({ changed = () => {}, notify = () => {} } = {}) {
    const key = 'windward-audio-enabled';
    const AudioContext = root.AudioContext || root.webkitAudioContext;
    let enabled = true, context, master, flow, wind, rigging, failed = !AudioContext;
    let scene = { active: false, sea: false, moving: false }, signature = '', resuming = false;
    const bells = new Set();
    const gulls = new Set();
    const creaks = new Set();
    const creakBuffers = [];
    let nextCreakAt = 0;
    let gullBuffer, nextGullAt = 0;
    try { enabled = localStorage.getItem(key) !== 'off'; } catch (_) {}

    function status() {
      return { enabled, supported: !failed, waiting: enabled && !!context && scene.active && context.state !== 'running' };
    }
    function report() { changed(status()); }
    function fade(param, value, seconds = .6) {
      const now = context.currentTime;
      param.cancelScheduledValues(now);
      param.setTargetAtTime(value, now, seconds / 3);
    }
    function noise(seconds, warm) {
      const buffer = context.createBuffer(2, Math.ceil(context.sampleRate * seconds), context.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);
        let previous = 0;
        for (let i = 0; i < data.length; i++) {
          const white = Math.random() * 2 - 1;
          previous = (previous + .02 * white) / 1.02;
          data[i] = warm ? previous * 1.2 + white * .22 : white;
        }
        // Crossfade the seam instead of fading to silence like a receding wave.
        const overlap = Math.floor(context.sampleRate * .2);
        for (let i = 0; i < overlap; i++) {
          const mix = i / overlap;
          data[data.length - overlap + i] = data[data.length - overlap + i] * (1 - mix) + data[i] * mix;
        }
      }
      const source = context.createBufferSource();
      source.buffer = buffer; source.loop = true; source.loopStart = .2;
      return source;
    }
    function layer({ seconds, warm, type, frequency, gain, swell, pace }) {
      const source = noise(seconds, warm), filter = context.createBiquadFilter();
      filter.type = type; filter.frequency.value = frequency; filter.Q.value = .55;
      const rumbleCut = context.createBiquadFilter();
      rumbleCut.type = 'highpass'; rumbleCut.frequency.value = 180; rumbleCut.Q.value = .5;
      const breathing = context.createGain(), amount = context.createGain(), output = context.createGain();
      breathing.gain.value = gain; amount.gain.value = swell; output.gain.value = 0;
      const oscillator = context.createOscillator(); oscillator.frequency.value = pace;
      oscillator.connect(amount); amount.connect(breathing.gain);
      source.connect(rumbleCut); rumbleCut.connect(filter); filter.connect(breathing); breathing.connect(output); output.connect(master);
      source.start(); oscillator.start();
      return output;
    }
    function deckSounds() {
      const rate = context.sampleRate, buffer = context.createBuffer(2, rate * 29, rate);
      const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
      const events = [[1.3, .42, true], [3.8, .65, false], [7.1, .3, true], [11.6, .85, false], [15.2, .55, true], [20.4, .7, false], [25.7, .34, true]];
      for (const [start, duration, wood] of events) {
        const pan = Math.random() * .8 - .4, pitch = 145 + Math.random() * 65;
        let phase = 0, cloth = 0;
        for (let i = 0; i < duration * rate; i++) {
          const t = i / rate, progress = t / duration, envelope = Math.sin(Math.PI * progress) ** 2;
          phase += 2 * Math.PI * pitch * (1 + .18 * Math.sin(progress * Math.PI)) / rate;
          cloth = .78 * cloth + .22 * (Math.random() * 2 - 1);
          const value = wood
            ? .075 * envelope * (Math.sin(phase) + .25 * Math.sin(phase * 2) + .1 * Math.sin(phase * 3)) * (.8 + .2 * Math.sin(t * 170))
            : .26 * envelope * cloth * (.55 + .45 * Math.sin(t * 65) ** 2);
          const index = Math.floor(start * rate) + i;
          left[index] += value * (1 - pan);
          right[index] += value * (1 + pan);
        }
      }
      const source = context.createBufferSource(), output = context.createGain();
      source.buffer = buffer; source.loop = true; output.gain.value = 0;
      source.connect(output); output.connect(master); source.start();
      return output;
    }
    function stopGulls() {
      for (const source of gulls) { try { source.stop(); } catch (_) {} }
      gulls.clear(); nextGullAt = 0;
    }
    function callGull() {
      if (!gullBuffer) {
        const rate = context.sampleRate;
        gullBuffer = context.createBuffer(1, Math.ceil(rate * 1.65), rate);
        const data = gullBuffer.getChannelData(0);
        for (const [start, duration, pitch] of [[0, .48, 1100], [.7, .65, 990]]) {
          let phase = 0;
          for (let i = 0; i < duration * rate; i++) {
            const t = i / rate, u = t / duration;
            const frequency = pitch * (.72 + .48 * Math.sin(Math.PI * u)) + 35 * Math.sin(t * 70);
            phase += 2 * Math.PI * frequency / rate;
            const envelope = Math.sin(Math.PI * u) ** 1.5;
            data[Math.floor(start * rate) + i] += .23 * envelope * (Math.sin(phase) + .3 * Math.sin(phase * 2) + .12 * Math.sin(phase * 3));
          }
        }
      }
      const source = context.createBufferSource(), gain = context.createGain();
      const pan = context.createStereoPanner ? context.createStereoPanner() : null;
      source.buffer = gullBuffer; source.playbackRate.value = .92 + Math.random() * .16;
      gain.gain.value = .085;
      source.connect(gain);
      if (pan) { pan.pan.value = Math.random() * 1.2 - .6; gain.connect(pan); pan.connect(master); }
      else gain.connect(master);
      gulls.add(source);
      source.onended = () => { source.disconnect(); gain.disconnect(); pan?.disconnect(); gulls.delete(source); };
      source.start();
    }
    function updateGulls() {
      if (!enabled || !scene.active || !scene.sea || !context || context.state !== 'running') return;
      const now = context.currentTime;
      if (!nextGullAt) nextGullAt = now + 10 + Math.random() * 6;
      else if (now >= nextGullAt) { callGull(); nextGullAt = now + 22 + Math.random() * 18; }
    }
    function creakBuffer(variant) {
      if (creakBuffers[variant]) return creakBuffers[variant];
      const rate = context.sampleRate, buffer = context.createBuffer(1, Math.ceil(rate * 1.25), rate);
      const data = buffer.getChannelData(0);
      // Uneven stick-slip pulses and pitch bends suggest loaded timber and rope.
      for (const [start, duration, pitch] of [[0, .48, 260], [.59, .58, 315]]) {
        let phase = 0, friction = 0;
        for (let i = 0; i < duration * rate; i++) {
          const t = i / rate, u = t / duration;
          const envelope = Math.sin(Math.PI * u) ** 1.2;
          const bend = 1 + .22 * Math.sin(Math.PI * u) - .15 * u;
          phase += 2 * Math.PI * (pitch + variant * 23) * bend * (1 + .012 * Math.sin(t * 93)) / rate;
          friction = .68 * friction + .32 * (Math.random() * 2 - 1);
          const stickSlip = .5 + .5 * Math.sin(t * (85 + variant * 11) + 1.4 * Math.sin(t * 23)) ** 2;
          data[Math.floor(start * rate) + i] += envelope * stickSlip * (
            .3 * Math.sin(phase) + .14 * Math.sin(phase * 2) + .09 * Math.sin(phase * 3.03) + .09 * friction);
        }
      }
      creakBuffers[variant] = buffer;
      return buffer;
    }
    function stopCreaks(immediate = true) {
      if (immediate) nextCreakAt = 0;
      for (const voice of creaks) {
        if (!immediate && voice.stopping) continue;
        voice.stopping = true;
        const now = context.currentTime;
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(immediate ? 0 : voice.gain.gain.value, now);
        if (!immediate) voice.gain.gain.linearRampToValueAtTime(0, now + .16);
        try { voice.source.stop(immediate ? now : now + .17); } catch (_) {}
      }
    }
    function updateCreaks() {
      if (!enabled || !scene.active || !scene.sea || !scene.moving || !scene.turning || scene.speed < .08 || !context || context.state !== 'running') return;
      const now = context.currentTime;
      if (now < nextCreakAt || creaks.size) return;
      nextCreakAt = now + 1.7 + Math.random() * .6;
      const source = context.createBufferSource(), gain = context.createGain();
      const pan = context.createStereoPanner ? context.createStereoPanner() : null;
      source.buffer = creakBuffer(Math.floor(Math.random() * 3));
      source.playbackRate.value = .94 + Math.random() * .12;
      gain.gain.value = .16 + scene.speed * .14;
      source.connect(gain);
      if (pan) { pan.pan.value = Math.random() * .4 - .2; gain.connect(pan); pan.connect(master); }
      else gain.connect(master);
      const voice = { source, gain, stopping: false };
      creaks.add(voice);
      source.onended = () => { source.disconnect(); gain.disconnect(); pan?.disconnect(); creaks.delete(voice); };
      source.start();
    }
    function initialize() {
      if (context || failed) return;
      try {
        context = new AudioContext();
        master = context.createGain(); master.gain.value = 0; master.connect(context.destination);
        flow = layer({ seconds: 11, warm: true, type: 'lowpass', frequency: 1800, gain: .2, swell: .014, pace: .73 });
        wind = layer({ seconds: 17, warm: false, type: 'bandpass', frequency: 950, gain: .055, swell: .008, pace: .061 });
        rigging = deckSounds();
        context.onstatechange = () => {
          if (context.state === 'running' && (!enabled || !scene.active)) sync();
          else report();
        };
      } catch (_) {
        failed = true;
        if (context) context.close().catch(() => {});
        context = null;
      }
      report();
    }
    function stopBells() {
      for (const node of bells) { try { node.stop(); } catch (_) {} }
      bells.clear();
    }
    function sync() {
      if (!context || failed) return;
      if (!enabled || !scene.active) {
        // Stop immediately on mute/background; never let a delayed resume leak sound.
        master.gain.cancelScheduledValues(context.currentTime); master.gain.setValueAtTime(0, context.currentTime);
        stopBells(); stopGulls(); stopCreaks();
        if (context.state === 'running') context.suspend().then(() => {
          if (enabled && scene.active) sync();
        }).catch(() => {});
        report(); return;
      }
      fade(master.gain, .45);
      const speed = scene.moving ? scene.speed : 0;
      fade(flow.gain, scene.sea ? .08 + .92 * speed : 0, .9);
      fade(wind.gain, scene.sea ? .4 + .6 * speed : 0, 1.5);
      fade(rigging.gain, scene.sea ? .35 * speed : 0, .7);
      if (!scene.sea) stopGulls();
      else stopBells();
      if (!scene.sea || !scene.moving) stopCreaks();
      else if (!scene.turning) stopCreaks(false);
      if (context.state !== 'running' && !resuming) {
        resuming = true;
        context.resume().then(() => {
          resuming = false;
          if (!enabled || !scene.active) sync();
          report();
        }).catch(() => { resuming = false; report(); });
      }
      report();
    }
    function update(next) {
      const speed = Number.isFinite(next.speed) ? Math.round(Math.max(0, Math.min(1, next.speed)) * 10) / 10 : next.moving ? 1 : 0;
      const nextSignature = `${next.active}/${next.sea}/${next.moving}/${speed}/${!!next.turning}`;
      scene = { ...next, speed };
      if (signature !== nextSignature) { signature = nextSignature; sync(); }
      updateGulls();
      updateCreaks();
    }
    function unlock() {
      if (!enabled || failed) return;
      initialize(); sync();
    }
    function toggle() {
      if (failed) { notify('이 브라우저에서는 항해 소리를 사용할 수 없습니다.'); return; }
      enabled = !enabled;
      try { localStorage.setItem(key, enabled ? 'on' : 'off'); } catch (_) {}
      if (enabled && scene.active) unlock(); else sync();
      report();
    }
    function arrival() {
      if (!enabled || !scene.active || !context || context.state !== 'running') return;
      stopBells();
      const now = context.currentTime;
      // Inharmonic resonances give a bright metal bell, not a musical chime.
      // These are synthesized oscillators; no samples from the reference recording.
      const strikes = [[0, .85, .65], [.4, .9, .7], [.82, 1, 1]];
      const partials = [[1215, .022, 2.7], [1280, .04, 2.4], [1640, .115, 3.7], [2050, .11, 3.1], [2580, .035, 2.2], [3080, .07, 2.5], [3210, .027, 1.7], [4260, .045, 1.4]];
      for (const [offset, strength, tail] of strikes) {
        for (const [frequency, volume, duration] of partials) {
          const note = context.createOscillator(), gain = context.createGain();
          const decay = duration * tail;
          note.frequency.value = frequency;
          gain.gain.setValueAtTime(0, now + offset);
          gain.gain.linearRampToValueAtTime(volume * strength, now + offset + .008);
          gain.gain.exponentialRampToValueAtTime(.0001, now + offset + decay);
          gain.gain.linearRampToValueAtTime(0, now + offset + decay + .03);
          note.connect(gain); gain.connect(master); bells.add(note);
          note.onended = () => { note.disconnect(); gain.disconnect(); bells.delete(note); };
          note.start(now + offset); note.stop(now + offset + decay + .04);
        }
      }
    }
    report();
    return { update, unlock, toggle, arrival };
  };
})(window);
