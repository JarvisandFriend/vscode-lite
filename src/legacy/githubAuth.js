import { Capacitor, CapacitorHttp } from '@capacitor/core';

const CLIENT_ID = 'Iv23li0rcM30ANY7BgWG';
const KEY = 'gh_token';
const native = Capacitor.isNativePlatform();
// github.com sends no CORS headers: native app uses Capacitor HTTP, browser uses the Vite dev proxy
const BASE = native ? 'https://github.com' : '/gh-oauth';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(path, data) {
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (native) {
    const r = await CapacitorHttp.post({ url: BASE + path, headers, data });
    return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
  }
  const r = await fetch(BASE + path, { method: 'POST', headers, body: JSON.stringify(data) });
  return r.json();
}

export const getToken = () => {
  try {
    return localStorage.getItem(KEY) || import.meta.env.VITE_GH_TOKEN || '';
  } catch {
    return import.meta.env.VITE_GH_TOKEN || '';
  }
};
export const logout = () => { try { localStorage.removeItem(KEY); } catch {} };

export async function whoami() {
  const t = getToken();
  if (!t) return null;
  const r = await fetch('https://api.github.com/user', { headers: { Authorization: 'Bearer ' + t } });
  if (!r.ok) { if (r.status === 401) logout(); return null; }
  return (await r.json()).login;
}

export async function login(onCode) {
  const d = await post('/login/device/code', { client_id: CLIENT_ID, scope: 'public_repo workflow' });
  if (!d.user_code) throw new Error(d.error_description || d.error || 'device code failed');
  onCode(d.user_code, d.verification_uri);
  let wait = (d.interval || 5) * 1000;
  const end = Date.now() + d.expires_in * 1000;
  while (Date.now() < end) {
    await sleep(wait);
    const t = await post('/login/oauth/access_token', {
      client_id: CLIENT_ID,
      device_code: d.device_code,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });
    if (t.access_token) { localStorage.setItem(KEY, t.access_token); return t.access_token; }
    if (t.error === 'slow_down') wait += 5000;
    else if (t.error && t.error !== 'authorization_pending') throw new Error(t.error_description || t.error);
  }
  throw new Error('login expired');
}
