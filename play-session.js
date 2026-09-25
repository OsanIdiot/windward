(function (root) {
  'use strict';
  root.createPlaySession = function ({ key, onYield }) {
    const requestKey = `${key}:play-request`;
    let owner = false, token = null, pending = null, unlock = null;
    function release() {
      owner = false; token = null; pending = null;
      const done = unlock; unlock = null; done?.();
    }
    function check() {
      if (!owner) return false;
      try { if (localStorage.getItem(requestKey) === token) return true; } catch (_) {}
      // The old tab flushes while it still holds the exclusive lock.
      try { onYield(); } finally { release(); }
      return false;
    }
    async function claim() {
      if (!navigator.locks?.request) throw Error('이 브라우저에서는 안전한 탭 전환을 지원하지 않습니다. 최신 브라우저에서 열어 주세요.');
      if (check()) return true;
      const ticket = crypto.randomUUID();
      localStorage.setItem(requestKey, ticket);
      pending = ticket;
      return new Promise((resolve, reject) => {
        navigator.locks.request(`${key}:writer`, async () => {
          // Only the most recent Start/Continue request may become the writer.
          if (pending !== ticket || localStorage.getItem(requestKey) !== ticket) { resolve(false); return; }
          const held = new Promise(done => { unlock = done; });
          owner = true; token = ticket; pending = null;
          resolve(true);
          await held;
        }).catch(reject);
      });
    }
    window.addEventListener('storage', event => {
      if (event.key === requestKey || event.key === null) check();
    });
    return { claim, check, release, canWrite: () => owner };
  };
})(window);
