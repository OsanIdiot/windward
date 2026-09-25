(function (root) {
  'use strict';
  const radians = degrees => degrees * Math.PI / 180;
  function project(point, position, view) {
    const angle = radians(view.bearing), dx = point.x - position.x, dy = point.y - position.y;
    return { x: view.x + (dx * Math.cos(angle) + dy * Math.sin(angle)) * view.zoom,
      y: view.y + (-dx * Math.sin(angle) + dy * Math.cos(angle)) * view.zoom };
  }
  function unproject(point, position, view) {
    const angle = radians(view.bearing), dx = (point.x - view.x) / view.zoom, dy = (point.y - view.y) / view.zoom;
    return { x: position.x + dx * Math.cos(angle) - dy * Math.sin(angle),
      y: position.y + dx * Math.sin(angle) + dy * Math.cos(angle) };
  }
  function transform(context, position, view) {
    context.translate(view.x, view.y); context.rotate(-radians(view.bearing));
    context.scale(view.zoom, view.zoom); context.translate(-position.x, -position.y);
  }
  function bounds(position, view, width, height) {
    const corners = [[0, 0], [width, 0], [0, height], [width, height]]
      .map(([x, y]) => unproject({ x, y }, position, view));
    return { left: Math.min(...corners.map(p => p.x)), right: Math.max(...corners.map(p => p.x)),
      top: Math.min(...corners.map(p => p.y)), bottom: Math.max(...corners.map(p => p.y)) };
  }
  const worldHeading = (screenHeading, bearing) => ((screenHeading + bearing) % 360 + 360) % 360;
  const api = { project, unproject, transform, bounds, worldHeading };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.VoyageCamera = api;
})(typeof window !== 'undefined' ? window : globalThis);
