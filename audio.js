(function (root) {
  'use strict';
  root.createSeaAudio = function ({ changed = () => {}, notify = () => {} } = {}) {
    const key = 'windward-audio-enabled', config = root.WindwardAudio;
    const effects = config?.sfx?.sounds;
    const AudioContext = root.AudioContext || root.webkitAudioContext;
    const loops = new Map(), buffers = new Map(), pending = new Map(), voices = new Set();
    let enabled = true, context, master, failed = !AudioContext || !effects, resuming = false, resumeAttempt = 0;
    let scene = { active: false, sea: false, moving: false }, signature = '';
    let nextGullAt = 0, nextCreakAt = 0, bellRequest = 0, loadWarning = false;
    try { enabled = localStorage.getItem(key) !== 'off'; } catch (_) {}

    function report() {
      changed({ enabled, supported: !failed, waiting: enabled && !!context && scene.active && context.state !== 'running' });
    }
    function fade(param, value, seconds = .6) {
      param.cancelScheduledValues(context.currentTime);
      param.setTargetAtTime(value, context.currentTime, seconds / 3);
    }
    function load(name) {
      if (pending.has(name)) return pending.get(name);
      const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12000);
      const promise = (async () => {
        try {
          const url = new URL(effects[name].file, document.baseURI);
          url.searchParams.set('v', config.version);
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) throw Error(`Audio HTTP ${response.status}`);
          const buffer = await context.decodeAudioData(await response.arrayBuffer());
          buffers.set(name, buffer);
          sync();
          return buffer;
        } catch (_) {
          if (!loadWarning) { loadWarning = true; notify('일부 소리 파일을 불러오지 못했습니다. 게임은 계속할 수 있습니다.'); }
          return null;
        } finally { clearTimeout(timeout); }
      })();
      pending.set(name, promise);
      return promise;
    }
    function initialize() {
      if (context || failed) return;
      try {
        context = new AudioContext();
        master = context.createGain(); master.gain.value = 0; master.connect(context.destination);
        for (const [name, sound] of Object.entries(effects)) {
          if (sound.loop) {
            const gain = context.createGain(); gain.gain.value = 0; gain.connect(master);
            loops.set(name, { gain, source: null });
          }
        }
        context.onstatechange = () => {
          if (context.state === 'running' && (!enabled || !scene.active)) sync();
          else report();
        };
        for (const name of Object.keys(effects)) load(name);
      } catch (_) {
        failed = true;
        context?.close().catch(() => {}); context = null;
      }
      report();
    }
    function stop(group, immediate = true) {
      if (!group || group === 'bell') bellRequest++;
      for (const voice of voices) {
        if (group && voice.group !== group) continue;
        if (!immediate && voice.stopping) continue;
        voice.stopping = true;
        const now = context.currentTime;
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(immediate ? 0 : voice.gain.gain.value, now);
        if (!immediate) voice.gain.gain.linearRampToValueAtTime(0, now + .16);
        try { voice.source.stop(immediate ? now : now + .17); } catch (_) {}
      }
    }
    function play(name, group, volume = 1, rate = 1, panValue = 0) {
      if (!buffers.has(name) || !enabled || !scene.active || context.state !== 'running') return;
      const source = context.createBufferSource(), gain = context.createGain();
      const pan = context.createStereoPanner ? context.createStereoPanner() : null;
      source.buffer = buffers.get(name); source.playbackRate.value = rate;
      gain.gain.value = config.sfx.gain * effects[name].gain * volume;
      source.connect(gain);
      if (pan) { pan.pan.value = panValue; gain.connect(pan); pan.connect(master); }
      else gain.connect(master);
      const voice = { source, gain, group, stopping: false };
      voices.add(voice);
      source.onended = () => { source.disconnect(); gain.disconnect(); pan?.disconnect(); voices.delete(voice); };
      source.start();
    }
    function sync(fromGesture = false) {
      if (!context || failed) return;
      if (!enabled || !scene.active) {
        master.gain.cancelScheduledValues(context.currentTime); master.gain.setValueAtTime(0, context.currentTime);
        stop(); nextGullAt = 0; nextCreakAt = 0;
        if (context.state === 'running') context.suspend().then(() => { if (enabled && scene.active) sync(); }).catch(() => {});
        report(); return;
      }
      fade(master.gain, config.master);
      const speed = scene.moving ? scene.speed : 0;
      const levels = { water: .08 + .92 * speed, wind: .4 + .6 * speed, sails: speed, hull: speed };
      for (const [name, loop] of loops) {
        if (!loop.source && buffers.has(name)) {
          loop.source = context.createBufferSource(); loop.source.buffer = buffers.get(name);
          loop.source.loop = true; loop.source.connect(loop.gain); loop.source.start();
        }
        fade(loop.gain.gain, scene.sea ? config.sfx.gain * (levels[name] ?? speed) * effects[name].gain : 0, name === 'wind' ? 1.5 : .9);
      }
      if (!scene.sea) { stop('gull'); nextGullAt = 0; }
      else stop('bell');
      if (!scene.sea || !scene.moving) { stop('turn'); nextCreakAt = 0; }
      else if (!scene.turning) stop('turn', false);
      if (context.state !== 'running' && (!resuming || fromGesture)) {
        // A blocked resume promise can stay pending; a later gesture must retry it.
        const attempt = ++resumeAttempt;
        resuming = true;
        context.resume().then(() => {
          if (attempt !== resumeAttempt) return;
          resuming = false;
          if (!enabled || !scene.active) sync();
          report();
        }).catch(() => { if (attempt === resumeAttempt) { resuming = false; report(); } });
      }
      report();
    }
    function updateEffects() {
      if (!enabled || !scene.active || !scene.sea || !context || context.state !== 'running') return;
      const now = context.currentTime;
      if (buffers.has('gull')) {
        if (!nextGullAt) nextGullAt = now + 10 + Math.random() * 6;
        else if (now >= nextGullAt) {
          play('gull', 'gull', 1, .92 + Math.random() * .16, Math.random() * 1.2 - .6);
          nextGullAt = now + 22 + Math.random() * 18;
        }
      }
      if (!scene.moving || !scene.turning || scene.speed < .08 || now < nextCreakAt || [...voices].some(v => v.group === 'turn')) return;
      const available = ['turn1', 'turn2', 'turn3'].filter(name => buffers.has(name));
      if (!available.length) return;
      play(available[Math.floor(Math.random() * available.length)], 'turn', .16 + scene.speed * .14, .94 + Math.random() * .12, Math.random() * .4 - .2);
      nextCreakAt = now + 1.7 + Math.random() * .6;
    }
    function update(next) {
      const speed = Number.isFinite(next.speed) ? Math.round(Math.max(0, Math.min(1, next.speed)) * 10) / 10 : next.moving ? 1 : 0;
      const nextSignature = `${next.active}/${next.sea}/${next.moving}/${speed}/${!!next.turning}`;
      scene = { ...next, speed };
      if (signature !== nextSignature) { signature = nextSignature; sync(); }
      updateEffects();
    }
    function unlock() { if (!enabled || failed) return; initialize(); sync(true); }
    function toggle() {
      if (failed) { notify('이 브라우저에서는 항해 소리를 사용할 수 없습니다.'); return; }
      if (enabled && scene.active && context && context.state !== 'running') { unlock(); return; }
      enabled = !enabled;
      try { localStorage.setItem(key, enabled ? 'on' : 'off'); } catch (_) {}
      if (enabled && scene.active) unlock(); else sync();
      report();
    }
    async function arrival() {
      if (!enabled || !scene.active || scene.sea || !context || context.state !== 'running') return;
      stop('bell');
      const request = bellRequest, requestedAt = performance.now();
      const buffer = await load('bell');
      // Never replay a stale arrival after slow loading, leaving port or toggling sound.
      if (buffer && request === bellRequest && !scene.sea && performance.now() - requestedAt < 1500) play('bell', 'bell');
    }
    report();
    return { update, unlock, toggle, arrival, enabled: () => enabled && !failed, ready: () => enabled && scene.active && context?.state === 'running' };
  };
})(window);
