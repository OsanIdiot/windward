(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const noise = (x, y) => { const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return n - Math.floor(n); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  // Ambient life and mood are pure functions of fixed world cells and the game clock.
  // They never read or write saves, spend time, or change navigation; they only decorate.
  const CELL = 110;
  const rnd = (i, j, k) => noise(i * 7.31 + k * 1.93 + .17, j * 3.77 + k * 2.41 + .59);
  function cell(i, j, isSea) {
    const r = k => rnd(i, j, k);
    const at = k => ({ x: (i + .12 + .76 * r(k)) * CELL, y: (j + .12 + .76 * r(k + 1)) * CELL });
    const clear = (p, a, length) => [-1, -.5, 0, .5, 1].every(f => isSea({ x: p.x + Math.sin(a) * length / 2 * f, y: p.y - Math.cos(a) * length / 2 * f }));
    // Try several headings so narrow seas can still host a pass that stays entirely on water.
    const heading = (p, length, k) => { for (let t = 0; t < 8; t++) { const a = r(k + t * .37) * TAU; if (clear(p, a, length)) return a; } return null; };
    const out = { ships: [], dolphins: [], gulls: [], flotsam: [], fish: [] };
    if (r(1) < .3) {
      const p = at(2), a = heading(p, 90, 4);
      if (a !== null) out.ships.push({ p, a, len: 90, speed: .8 + r(5) * .5, phase: r(6), size: 1 + r(7) * .25, sails: r(8) > .5 ? 2 : 1 });
    }
    if (r(10) < .28) {
      const p = at(11), a = heading(p, 60, 13);
      if (a !== null) out.dolphins.push({ p, a, len: 60, speed: 2.2, phase: r(14), n: 3 + Math.floor(r(15) * 3) });
    }
    if (r(20) < .26) out.gulls.push({ p: at(21), a: r(23) * TAU, len: 130, speed: 3 + r(24), phase: r(25), n: 3 + Math.floor(r(26) * 3) });
    for (const q of [0, 1]) {
      if (r(30 + q * 5) >= (q ? .12 : .34)) continue;
      const p = at(31 + q * 5);
      if (clear(p, 0, 12) && clear(p, 1.57, 12)) out.flotsam.push({ p, kind: Math.floor(r(33 + q * 5) * 3), a: r(34 + q * 5) * TAU, phase: r(32 + q * 5) });
    }
    if (r(50) < .3) {
      const p = at(51);
      if (clear(p, 0, 10) && clear(p, 1.57, 10)) out.fish.push({ p, a: r(53) * TAU, period: 12 + r(54) * 10, phase: r(55) });
    }
    return out;
  }
  // Soft light by game day: dawn, morning, noon, golden afternoon, dusk, night, repeating every 30 days.
  const TONES = [[0, 255, 196, 160, .1], [.16, 255, 236, 200, .06], [.38, 255, 255, 255, 0], [.6, 255, 218, 150, .07], [.76, 244, 150, 126, .14], [.9, 28, 52, 104, .17], [1, 255, 196, 160, .1]];
  function tone(gameTime) {
    const t = ((gameTime / 30) % 1 + 1) % 1;
    for (let n = 1; n < TONES.length; n++) {
      if (t > TONES[n][0]) continue;
      const a = TONES[n - 1], b = TONES[n], f = smooth((t - a[0]) / (b[0] - a[0]));
      return [lerp(a[1], b[1], f), lerp(a[2], b[2], f), lerp(a[3], b[3], f), lerp(a[4], b[4], f)];
    }
    return TONES[0].slice(1);
  }
  // Occasional gentle sea mist, 0 (clear) to 1 (hazy).
  function haze(gameTime) {
    const x = gameTime / 14, i = Math.floor(x), f = smooth(x - i);
    return Math.max(0, Math.min(1, (lerp(noise(i, 3.1), noise(i + 1, 3.1), f) - .62) / .28));
  }
  const ambient = { CELL, cell, tone, haze };
  root.createVoyageArt = function (ctx) {
    const sprite = new Image();
    sprite.src = 'assets/merchant-caravel.webp?v=0.1.10';
    // Bake a seamless, world-anchored texture once. No images, network or per-frame pixel processing.
    const tile = document.createElement('canvas'); tile.width = tile.height = 384;
    const t = tile.getContext('2d');
    for (let i = 0; i < 850; i++) {
      const x = noise(i, 1) * 384, y = noise(i, 2) * 384, size = 3 + noise(i, 3) * 28;
      for (const dx of [-384, 0, 384]) for (const dy of [-384, 0, 384]) {
        const glow = t.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, size);
        glow.addColorStop(0, i % 2 ? '#042e4413' : '#87ead00c'); glow.addColorStop(1, '#164c6500');
        t.fillStyle = glow; t.fillRect(x + dx - size, y + dy - size, size * 2, size * 2);
      }
    }
    const texture = ctx.createPattern(tile, 'repeat');
    texture.setTransform(new DOMMatrix().scale(.55));
    const cloud = document.createElement('canvas'); cloud.width = 256; cloud.height = 160;
    const cc = cloud.getContext('2d');
    for (let i = 0; i < 7; i++) {
      const x = 50 + noise(i, 8) * 156, y = 45 + noise(i, 9) * 70;
      const g = cc.createRadialGradient(x, y, 0, x, y, 47);
      g.addColorStop(0, '#062f4630'); g.addColorStop(1, '#062f4600');
      cc.fillStyle = g; cc.fillRect(x - 47, y - 47, 94, 94);
    }
    const hull = new Path2D('M0 -57 C19 -43 29 -15 27 15 Q26 40 16 51 L-16 51 Q-26 40 -27 15 C-29 -15 -19 -43 0 -57Z');
    const deck = new Path2D('M0 -49 C14 -35 23 -11 21 15 Q20 34 13 43 L-13 43 Q-20 34 -21 15 C-23 -11 -14 -35 0 -49Z');
    function line(x1, y1, x2, y2, color, width = 1) {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    function water(bounds, time, wind, compact) {
      const { left, top, right, bottom } = bounds;
      ctx.fillStyle = texture; ctx.fillRect(left, top, right - left, bottom - top);
      const step = compact ? 13 : 10;
      for (let gy = Math.floor(top / 9) * 9; gy < bottom + 9; gy += 9) {
        for (let gx = Math.floor(left / step) * step; gx < right + step; gx += step) {
          const n = noise(gx, gy), x = gx + n * step, y = gy + noise(gy, gx) * 9;
          const phase = time * 1.1 + n * TAU, swell = Math.sin(phase);
          ctx.save(); ctx.translate(x, y); ctx.rotate((wind.from + 70) * Math.PI / 180);
          const length = 2 + n * 6, drift = swell * (.25 + wind.strength * .4);
          ctx.beginPath(); ctx.moveTo(-length, drift); ctx.bezierCurveTo(-length * .4, drift - 1.1, length * .3, drift + .5, length, drift - .5);
          ctx.strokeStyle = `rgba(7,53,76,${.05 + n * .06})`; ctx.lineWidth = 1.3; ctx.stroke();
          ctx.translate(0, -.5); ctx.strokeStyle = `rgba(173,235,221,${.035 + .14 * Math.max(0, swell)})`; ctx.lineWidth = .25 + n * .25; ctx.stroke();
          if (n > .68) {
            const sparkle = Math.pow(Math.max(0, Math.sin(phase + 1.4)), 6);
            line(-1, -1 + drift, 1 + n * 2, -1 + drift, `rgba(255,247,209,${sparkle * .45})`, .35);
          }
          ctx.restore();
        }
      }
    }
    function shadows(bounds, time) {
      // Fixed density and bounded drift keep clouds attached to the world in either camera mode.
      for (let y = Math.floor(bounds.top / 150) * 150 - 150; y < bounds.bottom + 150; y += 150) {
        for (let x = Math.floor(bounds.left / 190) * 190 - 190; x < bounds.right + 190; x += 190) {
          const n = noise(x, y);
          if (n < .55) continue;
          ctx.drawImage(cloud, x + Math.sin(time * .025 + n * TAU) * 18, y + n * 45, 130, 81);
        }
      }
    }
    function shipScale(width, height, x, y, bearing, tier) {
      const a = bearing * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      // Scale with the viewport like the map does, so the ship keeps the same proportion on phones and desktops.
      let scale = Math.max(.45, Math.min(.8, Math.min(width, height) / 820)) * (1 + tier * .035);
      // Fit even a fully upgraded ship in a short landscape viewport, including a rocking margin.
      for (const [px, py] of [[-65, -103], [65, -103], [-65, 62], [65, 62]]) {
        const dx = px * c - py * s, dy = px * s + py * c;
        if (Math.abs(dx) > .001) scale = Math.min(scale, (dx < 0 ? x - 16 : width - x - 16) / Math.abs(dx));
        if (Math.abs(dy) > .001) scale = Math.min(scale, (dy < 0 ? y - 16 : height - y - 16) / Math.abs(dy));
      }
      return Math.max(.1, scale);
    }
    function ship({ x, y, width, height, bearing, time, moving, tier, speed, wind, bank, reduced }) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(bearing * Math.PI / 180);
      const size = shipScale(width, height, x, y, bearing, tier); ctx.scale(size, size);
      const shadow = ctx.createRadialGradient(10, 12, 9, 10, 12, 65);
      shadow.addColorStop(0, '#032b4280'); shadow.addColorStop(1, '#032b4200');
      ctx.fillStyle = shadow; ctx.fillRect(-55, -53, 130, 135);
      if (moving && speed > .01) {
        for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
          const pulse = reduced ? .5 : .5 + .5 * Math.sin(time * 2.5 - i);
          ctx.strokeStyle = `rgba(221,254,242,${(.48 - i * .095) * speed})`; ctx.lineWidth = 3.5 - i * .7;
          ctx.beginPath(); ctx.moveTo(side * (3 + i * 2), -63 + i * 5);
          ctx.bezierCurveTo(side * (20 + i * 3), -24, side * (24 + i * 6), 28, side * (22 + i * 9 + pulse * 2), 56 + i * 9); ctx.stroke();
        }
        for (let i = 0; i < 22; i++) {
          const p = (time * .5 + i / 22) % 1, side = i % 2 ? 1 : -1;
          ctx.fillStyle = `rgba(242,255,242,${(1 - p) * speed * .48})`;
          ctx.beginPath(); ctx.ellipse(side * (10 + p * 33), -43 + p * 109, .6 + p, 1.1 + p * 1.3, side * .35, 0, TAU); ctx.fill();
        }
      }
      ctx.save();
      if (!reduced) { ctx.translate(0, Math.sin(time * 1.5) * (.5 + wind.strength + speed * .4)); ctx.rotate(Math.sin(time * 1.4) * (.01 + wind.strength * .015 + speed * .008) + bank * .035); }
      if (sprite.complete && sprite.naturalWidth) {
        if (reduced) {
          ctx.drawImage(sprite, -65, -103, 130, 165);
          ctx.restore(); ctx.restore(); return;
        }
        // A tiny continuous cloth warp keeps the painted sails alive without shifting the hull.
        const strips = 24, sourceHeight = sprite.naturalHeight / strips;
        for (let i = 0; i < strips; i++) {
          const v = i / strips;
          const cloth = v > .3 && v < .69 ? Math.sin((v - .3) / .39 * Math.PI) : 0;
          const flutter = reduced ? 0 : Math.sin(time * 2.2 + v * 8) * cloth * (.25 + wind.strength * .5);
          ctx.drawImage(sprite, 0, i * sourceHeight, sprite.naturalWidth, sourceHeight, -65 + flutter, -103 + i * 165 / strips, 130, 165 / strips + .15);
        }
        ctx.restore(); ctx.restore(); return;
      }
      // Detailed vector fallback also makes offline/failed-image starts fully playable.
      ctx.save(); ctx.translate(7, 8); ctx.fillStyle = '#042b4660'; ctx.fill(hull); ctx.restore();
      const timber = ctx.createLinearGradient(-29, 0, 29, 0);
      timber.addColorStop(0, '#302c26'); timber.addColorStop(.15, '#805536'); timber.addColorStop(.45, '#c79856'); timber.addColorStop(.75, '#81552f'); timber.addColorStop(1, '#382e25');
      ctx.fillStyle = timber; ctx.fill(hull); ctx.strokeStyle = '#e2b970'; ctx.lineWidth = 1.5; ctx.stroke(hull);
      const planks = ctx.createLinearGradient(-22, -30, 22, 35);
      planks.addColorStop(0, '#efcf8f'); planks.addColorStop(.5, '#bd915b'); planks.addColorStop(1, '#8b623b');
      ctx.fillStyle = planks; ctx.fill(deck);
      ctx.save(); ctx.clip(deck);
      for (let px = -24; px < 25; px += 4) {
        line(px, -51, px, 46, '#694a3670', .65);
        for (let py = -43; py < 46; py += 17) line(px, py + (px % 3) * 3, px + 4, py + (px % 3) * 3, '#76513365', .5);
      }
      ctx.restore();
      // Gun-free merchant deck: stern cabin, cargo hatch, barrels and a small helm.
      ctx.fillStyle = '#4e3829'; ctx.fillRect(-15, 29, 30, 16);
      ctx.fillStyle = '#c18a4b'; ctx.fillRect(-15, 26, 30, 13);
      for (let py = 28; py < 39; py += 3) line(-14, py, 14, py, '#ebc07b', .7);
      for (const px of [-9, 0, 9]) { ctx.fillStyle = '#263e3c'; ctx.fillRect(px - 2, 40, 4, 3); }
      ctx.fillStyle = '#543f2c'; ctx.fillRect(-7, 4, 14, 15); ctx.strokeStyle = '#d4b075'; ctx.lineWidth = 1; ctx.strokeRect(-7, 4, 14, 15);
      for (let px = -4; px < 7; px += 3) line(px, 5, px, 18, '#a37b4f', .7);
      for (const px of [-15, 15]) {
        ctx.fillStyle = '#765339'; ctx.beginPath(); ctx.ellipse(px, 20, 3, 4, 0, 0, TAU); ctx.fill();
        line(px - 2.5, 18, px + 2.5, 18, '#c0a378', .8); line(px - 2.5, 22, px + 2.5, 22, '#443f35', .8);
      }
      ctx.strokeStyle = '#e6c18a'; ctx.lineWidth = 1; ctx.stroke(deck);
      for (const side of [-1, 1]) for (let py = -20; py < 40; py += 8) line(side * 24, py, side * 20, py - 2, '#f1d598', 1);
      line(0, -72, 0, 30, '#503a29', 3); line(-.8, -72, -.8, 28, '#d7b37a', .8);
      // Standing rigging sits behind the cloth; running ropes remain visible at the edges.
      for (const side of [-1, 1]) {
        line(0, -62, side * 24, 18, '#3b342b99', .7);
        for (const py of [-9, 17]) for (let i = 0; i < 4; i++) line(0, py - 12, side * (19 + i), py + i * 3, '#493e3080', .5);
      }
      const sails = tier >= 3 ? [[-31, 23], [-4, 34], [24, 26]] : [[-22, 33], [14, 27]];
      for (const [sy, spread] of sails) {
        const flutter = reduced ? 0 : Math.sin(time * 2 + sy) * (.6 + wind.strength * 1.4 + Math.abs(bank));
        const belly = 8 + speed * 4 + flutter;
        const sail = new Path2D(); sail.moveTo(-spread, sy - 9); sail.quadraticCurveTo(0, sy - 17, spread, sy - 9);
        sail.lineTo(spread - 5, sy + 13); sail.bezierCurveTo(spread * .45, sy + 19 + belly, -spread * .45, sy + 19 + belly, -spread + 5, sy + 13); sail.closePath();
        ctx.save(); ctx.translate(4, 6); ctx.fillStyle = '#302f2942'; ctx.fill(sail); ctx.restore();
        const cloth = ctx.createLinearGradient(0, sy - 14, 5, sy + 28 + belly);
        cloth.addColorStop(0, '#9e8f72'); cloth.addColorStop(.17, '#e1d4b2'); cloth.addColorStop(.4, '#fff7dc'); cloth.addColorStop(.61, '#f4e5bf'); cloth.addColorStop(1, '#988667');
        ctx.fillStyle = cloth; ctx.fill(sail); ctx.strokeStyle = '#baa57e'; ctx.lineWidth = .7; ctx.stroke(sail);
        ctx.save(); ctx.clip(sail);
        for (const seam of [-.66, -.33, 0, .33, .66]) {
          ctx.strokeStyle = '#927e5738'; ctx.lineWidth = .6;
          ctx.beginPath(); ctx.moveTo(spread * seam, sy - 13); ctx.quadraticCurveTo(spread * seam * 1.15, sy + 7, spread * seam * .83, sy + 29 + belly); ctx.stroke();
        }
        ctx.restore();
        line(-spread - 2, sy - 9, spread + 2, sy - 9, '#624b33', 2.2);
        line(-spread, sy - 10, spread, sy - 10, '#e3c393', .6);
        for (const side of [-1, 1]) line(side * (spread - 5), sy + 13, side * 20, sy + 24, '#e4cca081', .7);
      }
      ctx.fillStyle = '#eee1bc'; ctx.beginPath(); ctx.moveTo(0, -67); ctx.lineTo(-18, -34); ctx.lineTo(-3, -40); ctx.closePath(); ctx.fill();
      line(0, -67, -18, -34, '#b7a782', .7);
      const flag = reduced ? 0 : Math.sin(time * 3) * 2;
      ctx.fillStyle = '#a64e35'; ctx.beginPath(); ctx.moveTo(1, -62); ctx.quadraticCurveTo(10, -66 + flag, 22, -60 + flag); ctx.lineTo(17, -56 + flag); ctx.quadraticCurveTo(9, -60, 1, -55); ctx.closePath(); ctx.fill();
      line(1, -62, 1, -51, '#e8cb8c', .8);
      ctx.restore(); ctx.restore();
    }
    // ---- Ambient life: dolphins, gulls, passing ships, flotsam and leaping fish (decoration only) ----
    const cache = new Map();
    const cellAt = (i, j, isSea) => {
      const key = i + ',' + j;
      let c = cache.get(key);
      if (!c) { if (cache.size > 600) cache.clear(); c = cell(i, j, isSea); cache.set(key, c); }
      return c;
    };
    // Position along a straight pass; fades in and out at both ends so nothing pops.
    const along = (m, time) => {
      const u = ((time * m.speed / m.len + m.phase) % 1 + 1) % 1, d = (u - .5) * m.len;
      return { x: m.p.x + Math.sin(m.a) * d, y: m.p.y - Math.cos(m.a) * d, fade: Math.min(1, u / .12, (1 - u) / .12) };
    };
    function ring(x, y, radius, alpha) {
      ctx.strokeStyle = `rgba(230,255,246,${alpha})`; ctx.lineWidth = .28;
      ctx.beginPath(); ctx.ellipse(x, y, radius, radius * .72, 0, 0, TAU); ctx.stroke();
    }
    function dolphin(x, y, a, up, alpha) {
      ring(x, y, 2.2 + (1 - up) * 3, .4 * alpha * up);
      ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(1.4, 1.4);
      ctx.fillStyle = `rgba(2,42,62,${.16 * alpha * up})`; ctx.beginPath(); ctx.ellipse(1.1, 1.3, .9, 2.3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(38,76,102,${.97 * alpha * Math.min(1, up * 1.6)})`;
      ctx.beginPath(); ctx.moveTo(0, -2.7); ctx.bezierCurveTo(1.15, -1.9, 1.25, .5, .45, 2.1); ctx.lineTo(-.45, 2.1); ctx.bezierCurveTo(-1.25, .5, -1.15, -1.9, 0, -2.7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 1.9); ctx.lineTo(1.5, 3.1); ctx.lineTo(0, 2.7); ctx.lineTo(-1.5, 3.1); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(.9, -.2); ctx.lineTo(1.9, .7); ctx.lineTo(.8, .5); ctx.moveTo(-.9, -.2); ctx.lineTo(-1.9, .7); ctx.lineTo(-.8, .5); ctx.fill();
      ctx.fillStyle = `rgba(214,236,236,${.5 * alpha * up})`; ctx.beginPath(); ctx.ellipse(0, -.1, .42, 1.5, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    function gull(x, y, a, flap, alpha) {
      ctx.save(); ctx.translate(x + 2.4, y + 3.6); ctx.rotate(a);
      ctx.fillStyle = `rgba(3,43,66,${.11 * alpha})`; ctx.beginPath(); ctx.ellipse(0, 0, 2.3, .7, 0, 0, TAU); ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      const w = 2.6 + flap * .3;
      ctx.fillStyle = `rgba(251,248,234,${alpha})`; ctx.strokeStyle = `rgba(120,128,128,${.55 * alpha})`; ctx.lineWidth = .25;
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(0, -.3); ctx.quadraticCurveTo(side * w * .5, -1.3 - flap * .5, side * w, .3 + flap * 1.1); ctx.quadraticCurveTo(side * w * .5, .2, 0, .9); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.beginPath(); ctx.ellipse(0, .1, .55, 1.1, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(224,150,70,${alpha})`; ctx.beginPath(); ctx.arc(0, -1.25, .3, 0, TAU); ctx.fill();
      ctx.restore();
    }
    function passingShip(m, x, y, fade, time, wind) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(m.a); ctx.scale(m.size, m.size); ctx.globalAlpha = fade;
      ctx.strokeStyle = 'rgba(236,255,245,.3)'; ctx.lineWidth = .4; ctx.lineCap = 'round';
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * 2.4, 3.4); ctx.quadraticCurveTo(side * 3.6, 6.5, side * (5.2 + Math.sin(time * 2) * .25), 10); ctx.stroke(); }
      ctx.fillStyle = 'rgba(236,255,245,.16)'; ctx.beginPath(); ctx.moveTo(-1.6, 6.4); ctx.lineTo(1.6, 6.4); ctx.lineTo(.5, 13); ctx.lineTo(-.5, 13); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(2,42,62,.2)'; ctx.beginPath(); ctx.ellipse(1.1, 1.3, 3.4, 7.6, 0, 0, TAU); ctx.fill();
      const hullPath = new Path2D('M0 -7 C2.6 -5 3.5 -1.5 3.2 2 Q3 5 1.8 6.5 L-1.8 6.5 Q-3 5 -3.2 2 C-3.5 -1.5 -2.6 -5 0 -7Z');
      ctx.fillStyle = '#7d5638'; ctx.fill(hullPath); ctx.strokeStyle = '#d2a468'; ctx.lineWidth = .4; ctx.stroke(hullPath);
      ctx.fillStyle = '#d9ae70'; ctx.beginPath(); ctx.moveTo(0, -5.6); ctx.bezierCurveTo(1.9, -4, 2.5, -1, 2.3, 2); ctx.lineTo(-2.3, 2); ctx.bezierCurveTo(-2.5, -1, -1.9, -4, 0, -5.6); ctx.fill();
      const relative = (((wind.from - m.a * 180 / Math.PI) % 360) + 360) % 360, lean = relative < 180 ? -1 : 1;
      ctx.strokeStyle = '#5a4230'; ctx.lineWidth = .35; ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, 3.6); ctx.stroke();
      for (let n = 0; n < m.sails + 1; n++) {
        const sy = -3.4 + n * 3.1, half = 4.8 - n * .5, flutter = Math.sin(time * 2 + n + m.phase * 9) * .25;
        ctx.fillStyle = '#fbf2d6'; ctx.strokeStyle = '#b9a47c'; ctx.lineWidth = .25;
        ctx.beginPath(); ctx.moveTo(-half, sy); ctx.quadraticCurveTo(lean * .5, sy - 1.3 + flutter, half, sy); ctx.lineTo(half - .7, sy + 1.5); ctx.quadraticCurveTo(lean * .5, sy + 2.9 + flutter, -half + .7, sy + 1.5); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = '#a64e35'; ctx.beginPath(); ctx.moveTo(0, -6.2); ctx.lineTo(1.9 + Math.sin(time * 3) * .3, -5.7); ctx.lineTo(0, -5.1); ctx.fill();
      ctx.restore();
    }
    function flotsam(m, time) {
      const x = m.p.x + Math.sin(time * .05 + m.phase * TAU) * 6, y = m.p.y + Math.cos(time * .043 + m.phase * 5) * 5, bob = Math.sin(time * 1.3 + m.phase * 9) * .25;
      ring(x, y, 2.2 + bob, .22);
      ctx.save(); ctx.translate(x, y + bob); ctx.rotate(m.a); ctx.lineWidth = .28;
      if (m.kind === 0) {
        ctx.fillStyle = '#8a6240'; ctx.strokeStyle = '#4d3a29'; ctx.beginPath(); ctx.arc(0, 0, .95, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, .5, 0, TAU); ctx.stroke();
      } else if (m.kind === 1) {
        ctx.fillStyle = '#9a7a52'; ctx.fillRect(-2, -.35, 4, .7); ctx.fillRect(-1, .9, 2.4, .6);
      } else {
        ctx.fillStyle = '#a3794a'; ctx.strokeStyle = '#5b4430'; ctx.fillRect(-.8, -.8, 1.6, 1.6); ctx.strokeRect(-.8, -.8, 1.6, 1.6);
        ctx.beginPath(); ctx.moveTo(-.8, -.8); ctx.lineTo(.8, .8); ctx.stroke();
      }
      ctx.restore();
    }
    function fish(m, time) {
      const c = ((time / m.period + m.phase) % 1 + 1) % 1;
      if (c > .4) return;
      if (c > .06) ring(m.p.x, m.p.y, (c - .06) / .34 * 6, .3 * (1 - (c - .06) / .34));
      if (c > .1) return;
      const u = c / .1, lift = Math.sin(u * Math.PI);
      ctx.save(); ctx.translate(m.p.x + Math.sin(m.a) * (u - .5) * 6, m.p.y - Math.cos(m.a) * (u - .5) * 6 - lift * 2.2); ctx.rotate(m.a + (u - .5) * .9);
      ctx.fillStyle = '#d7e6e6'; ctx.strokeStyle = '#7d9aa0'; ctx.lineWidth = .2;
      ctx.beginPath(); ctx.ellipse(0, 0, .5 * (1 + lift * .3), 1.25 * (1 + lift * .3), 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 1.1); ctx.lineTo(.6, 1.9); ctx.lineTo(-.6, 1.9); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // layer 'sea' is drawn inside the sea mask; layer 'air' (gulls) may fly over land.
    function life(bounds, time, wind, isSea, layer) {
      const margin = CELL * .65;
      for (let i = Math.floor((bounds.left - margin) / CELL); i <= Math.floor((bounds.right + margin) / CELL); i++) {
        for (let j = Math.floor((bounds.top - margin) / CELL); j <= Math.floor((bounds.bottom + margin) / CELL); j++) {
          const c = cellAt(i, j, isSea);
          if (layer === 'air') {
            for (const m of c.gulls) {
              const p = along(m, time);
              for (let k = 0; k < m.n; k++) {
                const back = k * 3.2, lateral = k ? (k % 2 ? 2.4 : -2.4) : 0;
                gull(p.x - Math.sin(m.a) * back + Math.cos(m.a) * lateral, p.y + Math.cos(m.a) * back + Math.sin(m.a) * lateral, m.a, Math.sin(time * 8 + k * 1.7 + m.phase * 9), p.fade);
              }
            }
            continue;
          }
          for (const m of c.fish) fish(m, time);
          for (const m of c.flotsam) flotsam(m, time);
          for (const m of c.dolphins) {
            const p = along(m, time);
            for (let k = 0; k < m.n; k++) {
              const side = k - (m.n - 1) / 2, s = ((time * .5 + m.phase * 3 + k * .21) % 1 + 1) % 1, up = s < .4 ? Math.sin(s / .4 * Math.PI) : 0;
              if (up < .03) continue;
              dolphin(p.x + Math.cos(m.a) * side * 3.6 + Math.sin(m.a) * (k % 2) * 2.4, p.y + Math.sin(m.a) * side * 3.6 - Math.cos(m.a) * (k % 2) * 2.4, m.a, up, p.fade);
            }
          }
          for (const m of c.ships) { const p = along(m, time); passingShip(m, p.x, p.y, p.fade, time, wind); }
        }
      }
    }
    // Soft screen-space light and occasional mist over the finished scene.
    function atmosphere(width, height, gameTime) {
      const [r, g, b, a] = tone(gameTime), h = haze(gameTime);
      if (a > .004) { ctx.fillStyle = `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a.toFixed(3)})`; ctx.fillRect(0, 0, width, height); }
      if (h > .01) {
        const cx = width / 2, cy = height * .58, mist = ctx.createRadialGradient(cx, cy, Math.min(width, height) * .25, cx, cy, Math.max(width, height) * .75);
        mist.addColorStop(0, `rgba(226,240,238,${(h * .04).toFixed(3)})`); mist.addColorStop(1, `rgba(226,240,238,${(h * .22).toFixed(3)})`);
        ctx.fillStyle = mist; ctx.fillRect(0, 0, width, height);
      }
    }
    return { water, shadows, ship, shipScale, life, atmosphere };
  };
  root.VoyageAmbient = ambient;
  if (typeof module !== 'undefined' && module.exports) module.exports = ambient;
})(typeof window !== 'undefined' ? window : globalThis);
