(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const noise = (x, y) => { const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return n - Math.floor(n); };
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
    function shipScale(width, height, x, y, bearing, tier, compact) {
      const a = bearing * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      let scale = (compact ? .88 : 1.08) * (1 + tier * .035);
      // Fit even a fully upgraded ship in a short landscape viewport, including a rocking margin.
      for (const [px, py] of [[-65, -103], [65, -103], [-65, 62], [65, 62]]) {
        const dx = px * c - py * s, dy = px * s + py * c;
        if (Math.abs(dx) > .001) scale = Math.min(scale, (dx < 0 ? x - 16 : width - x - 16) / Math.abs(dx));
        if (Math.abs(dy) > .001) scale = Math.min(scale, (dy < 0 ? y - 16 : height - y - 16) / Math.abs(dy));
      }
      return Math.max(.1, scale);
    }
    function ship({ x, y, width, height, bearing, time, moving, tier, speed, wind, bank, compact, reduced }) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(bearing * Math.PI / 180);
      const size = shipScale(width, height, x, y, bearing, tier, compact); ctx.scale(size, size);
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
    return { water, shadows, ship, shipScale };
  };
})(window);
