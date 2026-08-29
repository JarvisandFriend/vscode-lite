# VS Code Lite — Mobile (React + Capacitor)

This is the original "VS Code Lite" front end (Monaco editor, xterm.js
terminal, file explorer, git panel) ported into a **Vite + React** project
that builds into a **native Android/iOS app via Capacitor**.

## What changed vs. the original zip, and why

The original `public/` was a static HTML page with three global `<script>`
files (`app.js`, `editor.js`, `terminal.js`) that talk to a backend over
`fetch("/api/...")` and a `/ws/terminal` WebSocket, and load Monaco/xterm
from `/node_modules/...` served by that backend.

That backend is **not included** in the zip you gave me — only the front
end was. Per your answers: nothing was stripped, and the app still expects
a real backend (yours) for the terminal, git, and filesystem operations —
just reachable via a URL from `.env` instead of a relative path, since a
packaged mobile app has no local server to call `/api/...` against.

**Architecture choice:** rather than rewriting ~3,000 lines of tightly
DOM-coupled imperative code into idiomatic React components (a much larger,
riskier rewrite that risks introducing behavioral bugs), I kept the three
files' logic almost byte-for-byte intact and gave the project a real React
entry point:

- `src/App.jsx` — a direct JSX port of `index.html`'s body. Same markup,
  same element `id`s, nothing redesigned.
- `src/legacy/appLogic.js`, `editorManager.js`, `terminalManager.js` — the
  original `app.js` / `editor.js` / `terminal.js`, converted from
  browser globals to ES modules, with three functional changes:
  1. Monaco is now `import * as monaco from 'monaco-editor'` (bundled by
     Vite) instead of loaded via the AMD `window.require` loader pointed
     at `/node_modules/...`.
  2. xterm and its addons are now `import`ed from `@xterm/xterm` /
     `@xterm/addon-fit` / `@xterm/addon-web-links` instead of relying on
     global `Terminal`/`FitAddon`/`WebLinksAddon`.
  3. Every relative `/api/...` request and the terminal WebSocket URL are
     rewritten at runtime to `VITE_API_URL` / `VITE_WS_URL` from `.env`
     (see below) instead of the current page's own origin.
- `src/main.jsx` mounts `<App />` and imports the codicon/xterm/app CSS.
  `App.jsx` calls the original boot sequence once, in a `useEffect`, after
  its markup exists in the DOM — so every `document.getElementById(...)`
  call in the legacy files still resolves exactly as before.

Everything else — every button, panel, shortcut, and API call — is the
same code that shipped in the zip.

If you'd like this refactored further into real per-feature React
components (`<Sidebar />`, `<GitPanel />`, `<Terminal />`, state via hooks
instead of module-level variables and manual DOM writes) later, that's a
good incremental follow-up once this is confirmed working end-to-end
against your backend — just say the word.

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` and point it at your backend:

```
VITE_API_URL=https://your-backend-host.example.com
VITE_WS_URL=wss://your-backend-host.example.com
```

Your backend needs CORS enabled for the app's origin (and, on Android in
dev, `capacitor.config.ts` already sets `cleartext: true` so `http://`
works — tighten that once you're on `https://`).

## Run in the browser (fastest way to sanity-check it)

```bash
npm run dev
```

## Build the web bundle

```bash
npm run build     # outputs to dist/
```

## Package as a native mobile app (Capacitor)

One-time setup (adds the native projects):

```bash
npx cap add android
npx cap add ios       # macOS + Xcode only
```

Every time you change the app:

```bash
npm run cap:android   # builds dist/, syncs it into android/, opens Android Studio
npm run cap:ios       # same, opens Xcode (macOS only)
```

From Android Studio / Xcode, run on a device/emulator or build a signed
release the normal native way.

Before your first real build, open `capacitor.config.ts` and change
`appId` from `com.yourcompany.vscodelite` to your own reverse-domain app
ID — this is baked into the native project at `cap add` time.

## Known constraints (inherent to "mobile app calling a backend", not this port)

- The terminal is a real remote shell running on your backend, streamed
  over WebSocket — there is no on-device shell. That's unavoidable on iOS
  and stock Android without root.
- Git operations (`/api/git/*`) run on your backend against whatever
  workspace it has checked out — same as the original.
- Monaco's language workers are bundled into the app via
  `vite-plugin-monaco-editor-esm` so they work offline from the app
  bundle; only the `/api/*` and terminal calls need network/your backend.
