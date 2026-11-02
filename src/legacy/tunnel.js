import { getToken, getUser, whoami, login } from './githubAuth.js';

const UPSTREAM_OWNER = 'engineermarcus';
const REPO = 'vscode-lite';
const WF = 'backend.yml';
const RE = /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/;
const FALLBACK_GIST = 'https://gist.githubusercontent.com/engineermarcus/862321431bac372752a422b9cca2fe01/raw/tunnel.json';

const state = { http: '', ws: '', tunnel: false, owner: UPSTREAM_OWNER, repo: REPO };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function getTargetRepo() {
  const user = getUser();
  const owner = user?.login || UPSTREAM_OWNER;
  return { owner, repo: REPO };
}

async function alive(u) {
  if (!u || !RE.test(u)) return false;
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 4000);
  try {
    const r = await fetch(u + '/', { signal: c.signal, cache: 'no-store' });
    return r.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

async function ghFetch(path, init = {}, owner = null, repo = null) {
  const target = owner || getTargetRepo().owner;
  const targetRepo = repo || REPO;
  const token = getToken();
  return fetch(`https://api.github.com/repos/${target}/${targetRepo}${path}`, {
    ...init,
    headers: {
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...((init && init.headers) || {}),
    },
  });
}

/**
 * Checks for published tunnel URL from:
 * 1. The repo's 'tunnel' branch (raw.githubusercontent.com)
 * 2. The repo's 'tunnel' branch via GitHub API (for private repos)
 * 3. Fallback gist (for upstream owner)
 */
async function fetchTunnelUrl(owner, repo) {
  // 1. Raw GitHub user content
  try {
    const r = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/tunnel/tunnel.json?t=${Date.now()}`,
      { cache: 'no-store' }
    );
    if (r.ok) {
      const j = await r.json();
      const u = String(j?.url || '').replace(/\/$/, '');
      if (RE.test(u)) return u;
    }
  } catch {}

  // 2. GitHub API (handles private repos via user token)
  if (getToken()) {
    try {
      const r = await ghFetch('/contents/tunnel.json?ref=tunnel', {}, owner, repo);
      if (r.ok) {
        const j = await r.json();
        if (j.content) {
          const raw = atob(j.content.replace(/\s+/g, ''));
          const parsed = JSON.parse(raw);
          const u = String(parsed?.url || '').replace(/\/$/, '');
          if (RE.test(u)) return u;
        }
      }
    } catch {}
  }

  // 3. Fallback to upstream gist if checking upstream
  if (owner === UPSTREAM_OWNER) {
    try {
      const r = await fetch(FALLBACK_GIST + '?t=' + Date.now(), { cache: 'no-store' });
      if (r.ok) {
        const j = await r.json();
        const u = String(j?.url || '').replace(/\/$/, '');
        if (RE.test(u)) return u;
      }
    } catch {}
  }

  return null;
}

function apply(u, owner = UPSTREAM_OWNER) {
  state.http = u;
  state.ws = u.replace(/^https:/, 'wss:');
  state.tunnel = true;
  state.owner = owner;
  state.repo = REPO;
}

export const baseReady = (async () => {
  const { owner, repo } = getTargetRepo();
  const u = await fetchTunnelUrl(owner, repo);
  if (u && (await alive(u))) {
    apply(u, owner);
    console.log('[tunnel] using', u);
  } else {
    console.log('[tunnel] shell offline');
  }
  return state;
})();

export const getBase = () => state;

async function runActive(owner, repo) {
  try {
    const r = await ghFetch('/actions/workflows/' + WF + '/runs?per_page=1', {}, owner, repo);
    if (!r.ok) return false;
    const j = await r.json();
    const s = j.workflow_runs?.[0]?.status;
    return ['queued', 'in_progress', 'waiting', 'pending', 'requested'].includes(s);
  } catch {
    return false;
  }
}

/**
 * Ensures the user has a fork of vscode-lite in their own GitHub account.
 * If not present, forks the upstream repo.
 */
async function ensureFork(userLogin, onProgress) {
  if (userLogin.toLowerCase() === UPSTREAM_OWNER.toLowerCase()) {
    return true;
  }

  onProgress('Checking repository in your account...');
  const check = await fetch(`https://api.github.com/repos/${userLogin}/${REPO}`, {
    headers: { Authorization: 'Bearer ' + getToken(), Accept: 'application/vnd.github+json' },
  });

  if (check.ok) return true;

  onProgress(`Forking ${UPSTREAM_OWNER}/${REPO} to your account...`);
  const forkRes = await fetch(`https://api.github.com/repos/${UPSTREAM_OWNER}/${REPO}/forks`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + getToken(),
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ default_branch_only: true }),
  });

  if (!forkRes.ok && forkRes.status !== 202) {
    const err = await forkRes.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to fork repository to your account.');
  }

  // Poll for fork creation to finish
  for (let i = 1; i <= 15; i++) {
    onProgress(`Creating fork (${i * 2}s)...`);
    await sleep(2000);
    const r = await fetch(`https://api.github.com/repos/${userLogin}/${REPO}`, {
      headers: { Authorization: 'Bearer ' + getToken(), Accept: 'application/vnd.github+json' },
    });
    if (r.ok) {
      // Enable Actions on the new fork
      try {
        await fetch(`https://api.github.com/repos/${userLogin}/${REPO}/actions/permissions`, {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer ' + getToken(),
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ enabled: true }),
        });
      } catch {}
      return true;
    }
  }
  return true;
}

export async function ensureTunnel(onProgress) {
  onProgress('Checking existing tunnel...');
  let { owner, repo } = getTargetRepo();
  let u = await fetchTunnelUrl(owner, repo);
  if (u && (await alive(u))) {
    apply(u, owner);
    return true;
  }

  // Ensure user is authenticated
  if (!getToken()) {
    onProgress('Authentication required...');
    await login('Sign in with GitHub to start your private cloud shell.');
  }

  const user = await whoami();
  if (!user?.login) {
    throw new Error('Unable to verify GitHub account.');
  }
  owner = user.login;

  // Make sure repository exists in the user's account
  await ensureFork(owner, onProgress);

  // Check if CI is already starting or running
  if (await runActive(owner, repo)) {
    onProgress('CI already starting on ' + owner + '...');
  } else {
    onProgress('Dispatching backend workflow in ' + owner + '/' + repo + '...');
    const r = await ghFetch(
      '/actions/workflows/' + WF + '/dispatches',
      {
        method: 'POST',
        body: JSON.stringify({ ref: 'main' }),
      },
      owner,
      repo
    );
    if (r.status !== 204) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.message || 'Workflow dispatch failed (' + r.status + ')');
    }
  }

  // Poll until tunnel URL is published and alive
  for (let i = 1; i <= 60; i++) {
    onProgress(`Starting cloud shell... (${i * 3}s)`);
    await sleep(3000);
    u = await fetchTunnelUrl(owner, repo);
    if (u && (await alive(u))) {
      apply(u, owner);
      return true;
    }
  }

  return false;
}
