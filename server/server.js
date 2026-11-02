import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer } from 'ws';
import pty from 'node-pty';
import { execFile } from 'child_process';
import { promisify } from 'util';

const run = promisify(execFile);
const ROOT = path.resolve(process.env.WORKSPACE || process.cwd());
// APP_TOKEN is optional; each user runs their own ephemeral backend in their own CI container.
const TOKEN = process.env.APP_TOKEN || '';

const app = express();
app.use(express.json({ limit: '100mb' }));
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type,x-token');
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use('/api', (req, res, next) => {
  if (TOKEN && req.get('x-token') !== TOKEN && req.query.token !== TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
});

const safe = p => {
  const f = path.resolve(ROOT, String(p || '').replace(/^\/+/, ''));
  if (f !== ROOT && !f.startsWith(ROOT + path.sep)) throw new Error('bad path');
  return f;
};
const rel = f => path.relative(ROOT, f).split(path.sep).join('/');
const h = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (e) { res.status(400).json({ error: (e.stderr || e.message || '').toString().trim() }); }
};
const git = async (...a) => (await run('git', a, { cwd: ROOT, maxBuffer: 50e6 })).stdout;
const SKIP = new Set(['.git', 'node_modules']);
const IMG = /\.(png|jpe?g|gif|webp|bmp|svg|ico)$/i;

app.get('/api/workspace', h((req, res) => res.json({ name: path.basename(ROOT), path: ROOT })));

app.get('/api/tree', h(async (req, res) => {
  const dir = safe(req.query.dir);
  const ents = await fs.promises.readdir(dir, { withFileTypes: true });
  const tree = ents.filter(e => !SKIP.has(e.name)).map(e => {
    const d = e.isDirectory();
    return { name: e.name, path: rel(path.join(dir, e.name)), type: d ? 'directory' : 'file',
             isDirectory: d, hasChildren: d, children: d ? [] : undefined };   // GUESS: field names
  }).sort((a, b) => (b.isDirectory - a.isDirectory) || a.name.localeCompare(b.name));
  res.json({ tree });
}));

app.get('/api/files/all', h(async (req, res) => {
  const out = [];
  const walk = async d => {
    for (const e of await fs.promises.readdir(d, { withFileTypes: true })) {
      if (SKIP.has(e.name) || out.length > 5000) continue;
      const f = path.join(d, e.name);
      e.isDirectory() ? await walk(f) : out.push(rel(f));
    }
  };
  await walk(ROOT);
  res.json({ files: out });                                     // GUESS: array of strings
}));

app.get('/api/file', h(async (req, res) => {
  const f = safe(req.query.path);
  const st = await fs.promises.stat(f);
  const buf = await fs.promises.readFile(f);
  const isBinary = buf.subarray(0, 8000).includes(0);
  if (isBinary) return res.json({ isBinary: true, isImage: IMG.test(f), size: st.size });
  res.json({ content: buf.toString('utf8'), isBinary: false, size: st.size });
}));

app.post('/api/file', h(async (req, res) => {
  const f = safe(req.body.path);
  await fs.promises.mkdir(path.dirname(f), { recursive: true });
  await fs.promises.writeFile(f, req.body.content ?? '');
  res.json({ ok: true });
}));

app.get('/api/raw', h((req, res) => res.sendFile(safe(req.query.path))));

app.post('/api/rename', h(async (req, res) => {
  const to = safe(req.body.newPath);
  await fs.promises.mkdir(path.dirname(to), { recursive: true });
  await fs.promises.rename(safe(req.body.oldPath), to);
  res.json({ ok: true });
}));

app.post('/api/duplicate', h(async (req, res) => {
  const src = safe(req.body.path);
  const p = path.parse(src);
  let n = 1, dst;
  do { dst = path.join(p.dir, `${p.name} copy${n > 1 ? ' ' + n : ''}${p.ext}`); n++; }
  while (fs.existsSync(dst));
  await fs.promises.cp(src, dst, { recursive: true });
  res.json({ ok: true, path: rel(dst) });
}));

app.post('/api/delete', h(async (req, res) => {
  await fs.promises.rm(safe(req.body.path), { recursive: true, force: true });
  res.json({ ok: true });
}));

app.post('/api/create-file', h(async (req, res) => {
  const f = safe(req.body.path);
  await fs.promises.mkdir(path.dirname(f), { recursive: true });
  await fs.promises.writeFile(f, '', { flag: 'wx' });
  res.json({ ok: true });
}));

app.post('/api/create-folder', h(async (req, res) => {
  await fs.promises.mkdir(safe(req.body.path), { recursive: true });
  res.json({ ok: true });
}));

app.post('/api/upload', h(async (req, res) => {                 // GUESS: {path|name, content, base64?}
  for (const f of req.body.files || []) {
    const t = safe(f.path || f.name);
    await fs.promises.mkdir(path.dirname(t), { recursive: true });
    await fs.promises.writeFile(t, Buffer.from(f.content || '', (f.base64 || f.encoding === 'base64') ? 'base64' : 'utf8'));
  }
  res.json({ ok: true });
}));

app.get('/api/search', h(async (req, res) => {                  // GUESS: results = {file: [{line,text}]}
  const q = String(req.query.q || '');
  if (!q) return res.json({ results: {}, totalCount: 0 });
  let out = '';
  try {
    out = (await run('grep', ['-rnIiF', '--exclude-dir=.git', '--exclude-dir=node_modules', '--', q, '.'],
      { cwd: ROOT, maxBuffer: 50e6 })).stdout;
  } catch (e) { out = e.stdout || ''; }
  const results = {}; let total = 0;
  for (const l of out.split('\n').filter(Boolean).slice(0, 2000)) {
    const m = l.match(/^\.\/(.*?):(\d+):(.*)$/); if (!m) continue;
    (results[m[1]] ||= []).push({ line: +m[2], text: m[3].slice(0, 300) }); total++;
  }
  res.json({ results, totalCount: total });
}));

app.post('/api/replace', h(async (req, res) => {                // GUESS: body has query, replacement, files?
  const { query, replacement = '', files } = req.body;
  let list = files;
  if (!list) {
    let out = '';
    try { out = (await run('grep', ['-rlIiF', '--exclude-dir=.git', '--exclude-dir=node_modules', '--', query, '.'],
      { cwd: ROOT })).stdout; } catch (e) { out = e.stdout || ''; }
    list = out.split('\n').filter(Boolean).map(s => s.replace(/^\.\//, ''));
  }
  for (const f of list) {
    const p = safe(f);
    const s = await fs.promises.readFile(p, 'utf8');
    await fs.promises.writeFile(p, s.split(query).join(replacement));
  }
  res.json({ ok: true, count: list.length });
}));

app.post('/api/check-syntax', (req, res) => res.json({ errors: [], diagnostics: [] })); // STUB

app.get('/api/ports', h(async (req, res) => {                   // GUESS
  let out = '';
  try { out = (await run('ss', ['-ltnH'])).stdout; } catch {}
  const ports = out.split('\n').filter(Boolean).map(l => {
    const a = l.trim().split(/\s+/)[3] || ''; return { port: +a.split(':').pop(), address: a };
  });
  res.json({ ports });
}));

app.get('/api/system/info', (req, res) =>                       // STUB
  res.json({ runtimes: [{ name: 'Node.js', version: process.version }], node: process.version }));

app.get('/api/git/status', h(async (req, res) => {              // GUESS: field names
  try { await git('rev-parse', '--git-dir'); } catch { return res.json({ isGit: false }); }
  const lines = (await git('status', '--porcelain=v1', '-b')).split('\n').filter(Boolean);
  const branch = (lines.shift() || '').replace(/^## /, '').split('...')[0];
  const staged = [], changes = [];
  for (const l of lines) {
    const x = l[0], y = l[1], file = l.slice(3);
    if (x !== ' ' && x !== '?') staged.push({ file, path: file, status: x });
    if (y !== ' ' || x === '?') changes.push({ file, path: file, status: x === '?' ? 'U' : y });
  }
  res.json({ isGit: true, branch, staged, changes, unstaged: changes });
}));

app.get('/api/git/log', h(async (req, res) => {                 // GUESS: commit fields
  const a = ['log', '-50', '--pretty=format:%H%x1f%an%x1f%ar%x1f%s'];
  if (req.query.file) a.push('--', req.query.file);
  let out = ''; try { out = await git(...a); } catch {}
  const commits = out.split('\n').filter(Boolean).map(l => {
    const [hash, author, date, message] = l.split('\x1f');
    return { hash, shortHash: hash.slice(0, 7), author, date, message };
  });
  res.json({ commits });
}));

app.get('/api/git/diff', h(async (req, res) => {
  const f = String(req.query.file), staged = req.query.staged === 'true';
  const show = async ref => { try { return await git('show', `${ref}:${f}`); } catch { return ''; } };
  if (staged) return res.json({ original: await show('HEAD'), current: await show('') });
  const idx = await show('');
  const orig = idx || await show('HEAD');
  let cur = ''; try { cur = await fs.promises.readFile(safe(f), 'utf8'); } catch {}
  res.json({ original: orig, current: cur });
}));

const files = b => (Array.isArray(b.files) ? b.files : []);
app.post('/api/git/stage', h(async (req, res) => { const f = files(req.body); await git('add', ...(f.length ? ['--', ...f] : ['-A'])); res.json({ ok: true }); }));
app.post('/api/git/unstage', h(async (req, res) => { const f = files(req.body); await git('reset', '-q', ...(f.length ? ['--', ...f] : [])); res.json({ ok: true }); }));
app.post('/api/git/discard', h(async (req, res) => {
  const f = req.body.file;
  try { await git('checkout', '--', f); } catch { await git('clean', '-f', '--', f); }
  res.json({ ok: true });
}));
app.post('/api/git/commit', h(async (req, res) => { await git('commit', '-m', req.body.message || 'update'); res.json({ ok: true }); }));
app.post('/api/git/pull', h(async (req, res) => { await git('pull', '--rebase', '--autostash'); res.json({ ok: true }); }));
app.post('/api/git/push', h(async (req, res) => { await git('push'); res.json({ ok: true }); }));
app.get('/api/git/branches', h(async (req, res) => {            // GUESS: array of strings
  const out = await git('branch', '--format=%(refname:short)');
  res.json({ branches: out.split('\n').filter(Boolean) });
}));
app.post('/api/git/checkout', h(async (req, res) => {
  await git('checkout', ...(req.body.create ? ['-b'] : []), req.body.branch);
  res.json({ ok: true });
}));

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, sock, head) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname !== '/ws/terminal') return sock.destroy();
  if (TOKEN && u.searchParams.get('token') !== TOKEN) return sock.destroy();
  wss.handleUpgrade(req, sock, head, ws => wss.emit('connection', ws));
});
wss.on('connection', ws => {
  const shell = process.env.SHELL || 'bash';
  const p = pty.spawn(shell, [], { name: 'xterm-256color', cols: 80, rows: 24, cwd: ROOT, env: process.env });
  const send = o => ws.readyState === 1 && ws.send(JSON.stringify(o));
  send({ type: 'session', shell: path.basename(shell) });
  p.onData(d => send({ type: 'output', data: d }));
  p.onExit(() => { send({ type: 'exit' }); ws.close(); });
  ws.on('message', m => {
    try {
      const j = JSON.parse(m);
      if (j.type === 'input') p.write(j.data);
      else if (j.type === 'resize') p.resize(Math.max(2, j.cols | 0), Math.max(2, j.rows | 0));
    } catch {}
  });
  ws.on('close', () => { try { p.kill(); } catch {} });
});
server.listen(3000, () => console.log('listening on 3000, root', ROOT));
