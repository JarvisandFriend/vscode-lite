import { getToken } from './githubAuth.js';
const OWNER = 'engineermarcus', REPO = 'vscode-lite', WF = 'backend.yml';
const GIST = 'https://gist.githubusercontent.com/engineermarcus/862321431bac372752a422b9cca2fe01/raw/tunnel.json';
const RE = /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/;

const state = { http: '', ws: '', tunnel: false };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function alive(u) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 4000);
  try {
    const r = await fetch(u + '/', { signal: c.signal, cache: 'no-store' });
    return r.status < 500;
  } catch { return false; }
  finally { clearTimeout(t); }
}

async function gistUrl() {
  try {
    const r = await fetch(GIST + '?t=' + Date.now(), { cache: 'no-store' });
    const j = await r.json();
    const u = String(j.url || '').replace(/\/$/, '');
    return RE.test(u) ? u : null;
  } catch { return null; }
}

function apply(u) {
  state.http = u;
  state.ws = u.replace(/^https:/, 'wss:');
  state.tunnel = true;
}

export const baseReady = (async () => {
  const u = await gistUrl();
  if (u && await alive(u)) { apply(u); console.log('[tunnel] using', u); }
  else console.log('[tunnel] fallback');
  return state;
})();

export const getBase = () => state;

const gh = (path, init = {}) =>
  fetch('https://api.github.com/repos/' + OWNER + '/' + REPO + path, {
    ...init,
    headers: {
      Authorization: 'Bearer ' + getToken(),
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
  });

async function runActive() {
  const r = await gh('/actions/workflows/' + WF + '/runs?per_page=1');
  if (!r.ok) throw new Error('runs ' + r.status);
  const j = await r.json();
  const s = j.workflow_runs && j.workflow_runs[0] && j.workflow_runs[0].status;
  return ['queued', 'in_progress', 'waiting', 'pending', 'requested'].includes(s);
}

export async function ensureTunnel(on) {
  on('Checking tunnel...');
  let u = await gistUrl();
  if (u && await alive(u)) { apply(u); return true; }
  if (!getToken()) throw new Error('not logged in');
  if (await runActive()) on('CI already starting...');
  else {
    on('Starting CI...');
    const r = await gh('/actions/workflows/' + WF + '/dispatches', {
      method: 'POST',
      body: JSON.stringify({ ref: 'main' }),
    });
    if (r.status !== 204) throw new Error('dispatch ' + r.status);
  }
  for (let i = 1; i <= 60; i++) {
    on('Waiting for tunnel ' + i * 4 + 's...');
    await sleep(4000);
    u = await gistUrl();
    if (u && await alive(u)) { apply(u); return true; }
  }
  return false;
}
