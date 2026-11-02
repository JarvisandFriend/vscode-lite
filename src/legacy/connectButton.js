import { baseReady, getBase, ensureTunnel } from './tunnel.js';
import { getToken, getUser, whoami, login, logout } from './githubAuth.js';

const container = document.createElement('div');
container.id = 'shell-connect-container';
container.style.cssText =
  'position:fixed;right:12px;bottom:12px;z-index:99999;display:flex;align-items:center;gap:6px;' +
  'background:#252526;border:1px solid #3c3c3c;border-radius:20px;padding:3px 6px;box-shadow:0 4px 12px rgba(0,0,0,0.4);';

const btn = document.createElement('button');
btn.id = 'shell-connect-btn';
btn.style.cssText =
  'padding:6px 12px;border:0;border-radius:14px;font:12px system-ui,-apple-system,sans-serif;' +
  'color:#fff;background:#333;cursor:pointer;outline:none;display:flex;align-items:center;gap:6px;transition:background 0.2s;';

const userBadge = document.createElement('button');
userBadge.id = 'shell-user-btn';
userBadge.title = 'GitHub Account';
userBadge.style.cssText =
  'padding:4px 8px;border:0;border-radius:12px;font:11px system-ui,-apple-system,sans-serif;' +
  'color:#aaa;background:transparent;cursor:pointer;display:none;align-items:center;gap:5px;';

container.appendChild(btn);
container.appendChild(userBadge);

let busy = false;

const setStatus = (text, bg, clickable = true) => {
  btn.textContent = text;
  if (bg) btn.style.background = bg;
  btn.disabled = !clickable;
};

function updateUI() {
  const user = getUser();
  const token = getToken();

  if (user && token) {
    userBadge.style.display = 'inline-flex';
    userBadge.innerHTML = `
      ${user.avatar_url ? `<img src="${user.avatar_url}" style="width:16px;height:16px;border-radius:50%;" />` : ''}
      <span>@${user.login}</span>
    `;
    userBadge.onclick = (e) => {
      e.stopPropagation();
      if (confirm(`Signed in as @${user.login}.\n\nDo you want to sign out?`)) {
        logout();
      }
    };
  } else {
    userBadge.style.display = 'none';
  }

  if (getBase().tunnel) {
    setStatus('● Shell online', '#1f7a3a');
  } else if (!token) {
    setStatus('Sign in with GitHub', '#0e639c');
  } else {
    setStatus('○ Connect shell', '#444');
  }
}

btn.onclick = async () => {
  if (busy) return;
  busy = true;
  setStatus('Starting...', '#555', false);

  try {
    if (!getToken()) {
      await login('Sign in with GitHub to start your private cloud shell.');
      updateUI();
    }
    const ok = await ensureTunnel((msg) => setStatus(msg, '#555', false));
    if (ok) {
      window.dispatchEvent(new Event('tunnel-ready'));
      busy = false;
      updateUI();
      return;
    }
    setStatus('Timed out · Retry', '#a33');
  } catch (e) {
    console.error('[tunnel] connect error:', e);
    setStatus('Error: ' + (e.message || 'failed'), '#a33');
  }
  busy = false;
  btn.disabled = false;
};

document.body.appendChild(container);
setStatus('...', '#444', false);

// Check current user if token exists
if (getToken()) {
  whoami().catch(() => {}).finally(() => {
    updateUI();
  });
}

baseReady.then(() => {
  updateUI();
});

window.addEventListener('github-auth-change', updateUI);
