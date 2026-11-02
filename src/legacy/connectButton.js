import { baseReady, getBase, ensureTunnel } from './tunnel.js';

const btn = document.createElement('button');
btn.style.cssText =
  'position:fixed;right:12px;bottom:12px;z-index:99999;padding:8px 12px;border:0;border-radius:18px;' +
  'font:12px system-ui;color:#fff;background:#444;opacity:.9';
let busy = false;
const set = (t, c) => { btn.textContent = t; if (c) btn.style.background = c; };

function idle() {
  getBase().tunnel ? set('● Shell online · Reconnect', '#1f7a3a') : set('○ Connect shell', '#a33');
}

btn.onclick = async () => {
  if (busy) return;
  busy = true;
  btn.disabled = true;
  try {
    const ok = await ensureTunnel((m) => set(m, '#555'));
    if (ok) { window.dispatchEvent(new Event('tunnel-ready')); idle(); busy = false; btn.disabled = false; return; }
    set('Timed out · Retry', '#a33');
  } catch (e) {
    set('Error: ' + e.message, '#a33');
  }
  busy = false;
  btn.disabled = false;
};

document.body.appendChild(btn);
set('...', '#444');
baseReady.then(idle);
