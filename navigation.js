(function (root) {
  'use strict';
  const G = root.SeaGeography || require('./geography.js');
  const STEP = 2, BUCKET = 24;
  const columns = Math.floor(G.width / STEP), rows = Math.floor(G.height / STEP);
  const edges = [], buckets = new Map(), scanlines = [];
  const merc = lat => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * 180 / Math.PI;
  const scale = G.width / (G.bounds.east - G.bounds.west);
  const project = (lon, lat) => ({ x: (lon - G.bounds.west) * scale, y: (merc(G.bounds.north) - merc(lat)) * scale });
  const unproject = p => ({ lon: p.x / scale + G.bounds.west, lat: (2 * Math.atan(Math.exp((merc(G.bounds.north) - p.y / scale) * Math.PI / 180)) - Math.PI / 2) * 180 / Math.PI });
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  for (const ring of G.rings) for (let i = 0; i < ring.length; i++) {
    const a = { x: ring[i][0], y: ring[i][1] }, b = { x: ring[(i + 1) % ring.length][0], y: ring[(i + 1) % ring.length][1] };
    const edge = { a, b, minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minY: Math.min(a.y, b.y), maxY: Math.max(a.y, b.y) };
    const index = edges.push(edge) - 1;
    for (let y = Math.floor(edge.minY / BUCKET); y <= Math.floor(edge.maxY / BUCKET); y++) for (let x = Math.floor(edge.minX / BUCKET); x <= Math.floor(edge.maxX / BUCKET); x++) {
      const key = `${x},${y}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(index);
    }
    for (let y = Math.max(0, Math.floor(edge.minY)); y <= Math.min(G.height, Math.ceil(edge.maxY)); y++) {
      if (!scanlines[y]) scanlines[y] = [];
      scanlines[y].push(index);
    }
  }
  function isSea(p) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 1 || p.y < 1 || p.x >= G.width - 1 || p.y >= G.height - 1) return false;
    let inside = false;
    for (const index of scanlines[Math.floor(p.y)] || []) {
      const { a, b } = edges[index];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return !inside;
  }
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  function intersects(a, b, c, d) {
    if (Math.max(a.x, b.x) < Math.min(c.x, d.x) || Math.max(c.x, d.x) < Math.min(a.x, b.x) || Math.max(a.y, b.y) < Math.min(c.y, d.y) || Math.max(c.y, d.y) < Math.min(a.y, b.y)) return false;
    return cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0;
  }
  function clear(a, b) {
    if (!isSea(a) || !isSea(b)) return false;
    const seen = new Set();
    for (let y = Math.floor(Math.min(a.y, b.y) / BUCKET); y <= Math.floor(Math.max(a.y, b.y) / BUCKET); y++) for (let x = Math.floor(Math.min(a.x, b.x) / BUCKET); x <= Math.floor(Math.max(a.x, b.x) / BUCKET); x++) {
      for (const index of buckets.get(`${x},${y}`) || []) {
        if (seen.has(index)) continue;
        seen.add(index);
        if (intersects(a, b, edges[index].a, edges[index].b)) return false;
      }
    }
    return true;
  }
  const point = id => ({ x: (id % columns) * STEP + STEP / 2, y: Math.floor(id / columns) * STEP + STEP / 2 });
  let water;
  function buildGrid() {
    if (water) return;
    water = new Uint8Array(columns * rows);
    for (let id = 0; id < water.length; id++) water[id] = isSea(point(id)) ? 1 : 0;
  }
  function closest(p, connected = false) {
    buildGrid();
    const cx = Math.round((p.x - STEP / 2) / STEP), cy = Math.round((p.y - STEP / 2) / STEP);
    for (let r = 0; r < 16; r++) {
      const candidates = [];
      for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
        if (r && Math.abs(x - cx) !== r && Math.abs(y - cy) !== r) continue;
        if (x < 0 || y < 0 || x >= columns || y >= rows) continue;
        const id = y * columns + x;
        if (water[id] && (!connected || clear(p, point(id)))) candidates.push(id);
      }
      if (candidates.length) return candidates.sort((a, b) => distance(p, point(a)) - distance(p, point(b)))[0];
    }
    throw Error('연결된 해역을 찾지 못했습니다. 다른 바다 지점을 선택해 주세요.');
  }
  class Heap {
    constructor() { this.items = []; }
    push(entry) {
      let i = this.items.length; this.items.push(entry);
      while (i > 0) { const parent = (i - 1) >> 1; if (this.items[parent].f <= entry.f) break; this.items[i] = this.items[parent]; i = parent; }
      this.items[i] = entry;
    }
    pop() {
      const result = this.items[0], last = this.items.pop();
      if (this.items.length) {
        let i = 0;
        while (i * 2 + 1 < this.items.length) {
          let child = i * 2 + 1;
          if (child + 1 < this.items.length && this.items[child + 1].f < this.items[child].f) child++;
          if (last.f <= this.items[child].f) break;
          this.items[i] = this.items[child]; i = child;
        }
        this.items[i] = last;
      }
      return result;
    }
  }
  function route(start, end) {
    if (!isSea(start) || !isSea(end)) throw Error('바다 안의 지점을 선택해 주세요.');
    if (clear(start, end)) return [{ ...end }];
    const first = closest(start, true), last = closest(end, true);
    const cost = new Float64Array(water.length).fill(Infinity), parent = new Int32Array(water.length).fill(-1), closed = new Uint8Array(water.length);
    const queue = new Heap(); cost[first] = 0; queue.push({ id: first, f: distance(point(first), end) });
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    let reached = false;
    while (queue.items.length) {
      const { id } = queue.pop();
      if (closed[id]) continue;
      if (id === last) { reached = true; break; }
      closed[id] = 1;
      const x = id % columns, y = Math.floor(id / columns), here = point(id);
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy, next = ny * columns + nx;
        if (nx < 0 || ny < 0 || nx >= columns || ny >= rows || !water[next] || closed[next]) continue;
        const value = cost[id] + STEP * Math.hypot(dx, dy);
        if (value >= cost[next] || !clear(here, point(next))) continue;
        cost[next] = value; parent[next] = id;
        queue.push({ id: next, f: value + distance(point(next), end) });
      }
    }
    if (!reached) throw Error('이어지는 항로가 없습니다. 해협 바깥의 바다를 선택해 주세요.');
    const raw = [{ ...end }];
    for (let at = last; at !== -1; at = parent[at]) raw.push(point(at));
    raw.push({ ...start }); raw.reverse();
    const result = [];
    for (let i = 0; i < raw.length - 1;) {
      let next = raw.length - 1;
      while (next > i + 1 && !clear(raw[i], raw[next])) next--;
      result.push(raw[next]); i = next;
    }
    return result;
  }
  function length(start, points) { let total = 0, previous = start; for (const p of points) { total += distance(previous, p); previous = p; } return total; }
  function headingTarget(start, heading, limit = Math.hypot(G.width, G.height)) {
    if (!isSea(start) || !Number.isFinite(heading) || !Number.isFinite(limit) || limit < 0) throw Error('조타 방향을 확인해 주세요.');
    const angle = heading * Math.PI / 180, dx = Math.sin(angle), dy = -Math.cos(angle);
    let end = { ...start };
    // Scan short segments so even narrow peninsulas cannot be skipped.
    for (let d = Math.min(2, limit); d > 0; d = Math.min(d + 2, limit)) {
      const next = { x: start.x + dx * d, y: start.y + dy * d };
      if (!clear(end, next)) break;
      end = next;
      if (d >= limit || d >= Math.hypot(G.width, G.height)) break;
    }
    return end;
  }
  const api = { G, project, unproject, isSea, clear, route, distance, length, headingTarget, nearestSea: p => isSea(p) ? p : point(closest(p)) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SeaNavigation = api;
})(typeof window !== 'undefined' ? window : globalThis);
