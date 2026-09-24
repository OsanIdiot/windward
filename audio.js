(function (root) {
  'use strict';
  root.createSeaAudio = function ({ changed = () => {}, notify = () => {} } = {}) {
    const key = 'windward-audio-enabled';
    const AudioContext = root.AudioContext || root.webkitAudioContext;
    let enabled = true, context, master, waves, wind, failed = !AudioContext;
    let scene = { active: false, sea: false, moving: false }, signature = '', resuming = false;
    const bells = new Set();
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
    function noise(seconds, brown) {
      const buffer = context.createBuffer(2, Math.ceil(context.sampleRate * seconds), context.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);
        let previous = 0;
        for (let i = 0; i < data.length; i++) {
          const white = Math.random() * 2 - 1;
          previous = (previous + .02 * white) / 1.02;
          // Taper both ends to avoid a click at the loop boundary.
          const edge = Math.min(1, i / (context.sampleRate * .3), (data.length - 1 - i) / (context.sampleRate * .3));
          data[i] = (brown ? previous * 3.5 : white) * edge;
        }
      }
      const source = context.createBufferSource();
      source.buffer = buffer; source.loop = true;
      return source;
    }
    function layer({ seconds, brown, type, frequency, gain, swell, pace }) {
      const source = noise(seconds, brown), filter = context.createBiquadFilter();
      filter.type = type; filter.frequency.value = frequency; filter.Q.value = .55;
      const breathing = context.createGain(), amount = context.createGain(), output = context.createGain();
      breathing.gain.value = gain; amount.gain.value = swell; output.gain.value = 0;
      const oscillator = context.createOscillator(); oscillator.frequency.value = pace;
      oscillator.connect(amount); amount.connect(breathing.gain);
      source.connect(filter); filter.connect(breathing); breathing.connect(output); output.connect(master);
      source.start(); oscillator.start();
      return output;
    }
    function initialize() {
      if (context || failed) return;
      try {
        context = new AudioContext();
        master = context.createGain(); master.gain.value = 0; master.connect(context.destination);
        waves = layer({ seconds: 11, brown: true, type: 'lowpass', frequency: 1100, gain: .48, swell: .3, pace: .13 });
        wind = layer({ seconds: 13, brown: false, type: 'bandpass', frequency: 650, gain: .13, swell: .075, pace: .047 });
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
        stopBells();
        if (context.state === 'running') context.suspend().then(() => {
          if (enabled && scene.active) sync();
        }).catch(() => {});
        report(); return;
      }
      fade(master.gain, .45);
      fade(waves.gain, scene.sea ? scene.moving ? 1 : .55 : 0, 1.2);
      fade(wind.gain, scene.sea ? scene.moving ? 1 : .3 : 0, 1.5);
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
      const nextSignature = `${next.active}/${next.sea}/${next.moving}`;
      scene = next;
      if (signature === nextSignature) return;
      signature = nextSignature; sync();
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
      const now = context.currentTime;
      for (const [offset, frequency] of [[0, 523.25], [.22, 783.99]]) {
        for (const [ratio, volume] of [[1, .14], [2.01, .035]]) {
          const note = context.createOscillator(), gain = context.createGain();
          note.frequency.value = frequency * ratio;
          gain.gain.setValueAtTime(0, now + offset);
          gain.gain.linearRampToValueAtTime(volume, now + offset + .012);
          gain.gain.exponentialRampToValueAtTime(.0001, now + offset + 1.6);
          note.connect(gain); gain.connect(master); bells.add(note);
          note.onended = () => { note.disconnect(); gain.disconnect(); bells.delete(note); };
          note.start(now + offset); note.stop(now + offset + 1.65);
        }
      }
    }
    report();
    return { update, unlock, toggle, arrival };
  };
})(window);
