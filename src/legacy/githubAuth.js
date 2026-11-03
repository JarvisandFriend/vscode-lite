import { Capacitor, CapacitorHttp } from '@capacitor/core';

const CLIENT_ID = 'Iv23li0rcM30ANY7BgWG';
const TOKEN_KEY = 'gh_token';
const USER_KEY = 'gh_user';
const native = Capacitor.isNativePlatform();
const BASE = native ? 'https://github.com' : '/gh-oauth';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const getToken = () => {
  try {
    return (localStorage.getItem(TOKEN_KEY) || '').trim();
  } catch {
    return '';
  }
};

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token.trim());
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
  window.dispatchEvent(new CustomEvent('github-auth-change'));
};

export const getUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const logout = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {}
  window.dispatchEvent(new CustomEvent('github-auth-change'));
};

export async function whoami() {
  const token = getToken();
  if (!token) return null;
  try {
    const r = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!r.ok) {
      if (r.status === 401) logout();
      return null;
    }
    const data = await r.json();
    const info = {
      login: data.login,
      name: data.name || data.login,
      avatar_url: data.avatar_url,
    };
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(info));
    } catch {}
    return info;
  } catch {
    return getUser();
  }
}

async function postOAuth(path, data) {
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (native) {
    const r = await CapacitorHttp.post({ url: BASE + path, headers, data });
    return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
  }
  const r = await fetch(BASE + path, { method: 'POST', headers, body: JSON.stringify(data) });
  return r.json();
}

/**
 * Displays an authentication dialog allowing the user to either:
 * 1) Enter a Personal Access Token (classic with repo & workflow scopes), or
 * 2) Authorize via GitHub Device Code flow.
 */
export function login(promptMsg = '', opts = {}) {
  const required = !!opts.required;
  return new Promise((resolve, reject) => {
    // If modal already exists, remove it
    const existing = document.getElementById('gh-auth-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'gh-auth-modal';
    overlay.style.cssText =
      'position:fixed;inset:0;background:' + (required ? '#0b0f19' : 'rgba(0,0,0,0.75)') + ';z-index:100000;display:flex;' +
      'align-items:center;justify-content:center;padding:16px;box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif;';

    const card = document.createElement('div');
    card.style.cssText =
      'background:#1e1e1e;color:#cccccc;border:1px solid #3c3c3c;border-radius:8px;' +
      'max-width:440px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.6);padding:24px;box-sizing:border-box;position:relative;';

    const user = getUser();

    card.innerHTML = `
      <div style="text-align:center;">
        <svg height="44" viewBox="0 0 16 16" width="44" style="fill:#ffffff;">
          <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"></path>
        </svg>
        <h1 style="margin:14px 0 4px;font-size:22px;font-weight:600;color:#ffffff;">VS Code Lite</h1>
        <div style="font-size:13px;color:#8b949e;margin-bottom:26px;">Sign in to continue</div>
      </div>

      <button id="gh-device-btn" style="display:block;width:100%;background:#238636;border:0;border-radius:8px;color:#fff;font-size:15px;font-weight:600;padding:14px 16px;cursor:pointer;">Continue with GitHub</button>
      <div id="gh-device-status" style="margin-top:14px;font-size:12px;display:none;text-align:center;"></div>

      <div style="text-align:center;margin-top:18px;">
        <a id="gh-token-toggle" href="#" style="color:#58a6ff;font-size:12px;text-decoration:none;">Use an access token instead</a>
      </div>

      <div id="gh-token-row" style="display:none;margin-top:14px;">
        <div style="display:flex;gap:8px;">
          <input id="gh-token-input" type="password" placeholder="ghp_... or github_pat_..." style="flex:1;min-width:0;background:#161b22;border:1px solid #30363d;border-radius:6px;padding:9px 10px;color:#fff;font-size:13px;outline:none;" />
          <button id="gh-token-submit" style="background:#0e639c;border:0;border-radius:6px;color:#fff;font-size:13px;font-weight:500;padding:9px 14px;cursor:pointer;white-space:nowrap;">Sign In</button>
        </div>
        <div style="margin-top:8px;font-size:11px;color:#6e7681;">
          Scopes: repo, workflow &middot;
          <a href="https://github.com/settings/tokens/new?scopes=repo,workflow&description=VSCodeLite" target="_blank" rel="noopener noreferrer" style="color:#58a6ff;text-decoration:none;">Generate ↗</a>
        </div>
      </div>

      <div id="gh-auth-error" style="display:none;margin-top:14px;padding:8px 12px;background:#5a1d1d;border:1px solid #a33;border-radius:6px;color:#ffcccc;font-size:12px;"></div>
      ${required ? '' : '<button id="gh-auth-close" style="position:absolute;top:10px;right:12px;background:transparent;border:0;color:#888;font-size:22px;cursor:pointer;padding:4px;line-height:1;">&times;</button>'}
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const close = () => {
      overlay.remove();
      reject(new Error('Authentication cancelled'));
    };

    const closeBtn = card.querySelector('#gh-auth-close');
    if (closeBtn) closeBtn.onclick = close;
    if (!required) overlay.onclick = (e) => { if (e.target === overlay) close(); };

    const tokenRow = card.querySelector('#gh-token-row');
    card.querySelector('#gh-token-toggle').onclick = (e) => {
      e.preventDefault();
      const open = tokenRow.style.display !== 'none';
      tokenRow.style.display = open ? 'none' : 'block';
      if (!open) card.querySelector('#gh-token-input').focus();
    };

    const errBox = card.querySelector('#gh-auth-error');
    const showErr = (msg) => {
      errBox.textContent = msg;
      errBox.style.display = 'block';
    };

    // Personal Access Token Handler
    const tokenInput = card.querySelector('#gh-token-input');
    const submitBtn = card.querySelector('#gh-token-submit');
    const handleTokenSubmit = async () => {
      const val = tokenInput.value.trim();
      if (!val) {
        showErr('Please enter a GitHub Personal Access Token.');
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying...';
      errBox.style.display = 'none';

      try {
        const r = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: 'Bearer ' + val,
            Accept: 'application/vnd.github+json',
          },
        });
        if (!r.ok) throw new Error('Invalid token (status ' + r.status + ')');
        const user = await r.json();
        setToken(val);
        localStorage.setItem(USER_KEY, JSON.stringify({
          login: user.login,
          name: user.name || user.login,
          avatar_url: user.avatar_url,
        }));
        overlay.remove();
        resolve(val);
      } catch (e) {
        showErr(e.message || 'Failed to verify token with GitHub');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
      }
    };

    submitBtn.onclick = handleTokenSubmit;
    tokenInput.onkeydown = (e) => { if (e.key === 'Enter') handleTokenSubmit(); };

    // Device Flow Handler
    const deviceBtn = card.querySelector('#gh-device-btn');
    const deviceStatus = card.querySelector('#gh-device-status');
    deviceBtn.onclick = async () => {
      deviceBtn.disabled = true;
      deviceBtn.textContent = 'Requesting code...';
      deviceStatus.style.display = 'block';
      deviceStatus.style.color = '#aaa';
      deviceStatus.textContent = 'Connecting to GitHub...';
      errBox.style.display = 'none';

      try {
        const d = await postOAuth('/login/device/code', {
          client_id: CLIENT_ID,
          scope: 'public_repo workflow',
        });
        if (!d.user_code) throw new Error(d.error_description || d.error || 'Device code request failed');

        const uri = d.verification_uri || 'https://github.com/login/device';
        deviceBtn.style.display = 'none';
        deviceStatus.innerHTML = `
          <div style="background:#111;padding:12px;border-radius:6px;border:1px dashed #555;margin-bottom:10px;">
            <div style="font-size:11px;color:#888;margin-bottom:4px;">Enter this code on GitHub:</div>
            <div style="font-size:22px;font-family:monospace;font-weight:700;color:#4ec9b0;letter-spacing:3px;">${d.user_code}</div>
          </div>
          <div style="display:flex;gap:8px;justify-content:center;margin-bottom:8px;">
            <button id="gh-copy-code" style="background:#2a2d2e;border:1px solid #444;color:#fff;padding:6px 12px;border-radius:4px;font-size:12px;cursor:pointer;">Copy Code</button>
            <a href="${uri}" target="_blank" rel="noopener noreferrer" style="background:#0e639c;border:0;color:#fff;padding:6px 12px;border-radius:4px;font-size:12px;text-decoration:none;display:inline-block;">Open GitHub ↗</a>
          </div>
          <div style="color:#888;font-size:11px;">Waiting for approval on GitHub...</div>
        `;

        const copyBtn = deviceStatus.querySelector('#gh-copy-code');
        if (copyBtn) {
          copyBtn.onclick = () => {
            navigator.clipboard.writeText(d.user_code);
            copyBtn.textContent = 'Copied!';
            setTimeout(() => { copyBtn.textContent = 'Copy Code'; }, 2000);
          };
        }

        // Poll for access token
        let wait = (d.interval || 5) * 1000;
        const end = Date.now() + d.expires_in * 1000;
        while (Date.now() < end) {
          await sleep(wait);
          const t = await postOAuth('/login/oauth/access_token', {
            client_id: CLIENT_ID,
            device_code: d.device_code,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          });
          if (t.access_token) {
            setToken(t.access_token);
            await whoami();
            overlay.remove();
            resolve(t.access_token);
            return;
          }
          if (t.error === 'slow_down') wait += 5000;
          else if (t.error && t.error !== 'authorization_pending') {
            throw new Error(t.error_description || t.error);
          }
        }
        throw new Error('Device code expired. Please try again.');
      } catch (e) {
        showErr(e.message || 'Device flow failed');
        deviceBtn.disabled = false;
        deviceBtn.style.display = 'block';
        deviceBtn.textContent = 'Retry Device Code Flow';
        deviceStatus.style.display = 'none';
      }
    };
  });
}
