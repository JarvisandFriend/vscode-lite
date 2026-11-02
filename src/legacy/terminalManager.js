import { Terminal } from '@xterm/xterm';
import { getBase } from './tunnel.js';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

class TerminalManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.tabsContainer = document.getElementById("terminal-session-tabs");
    this.terminals = new Map(); // id -> Terminal
    this.fitAddons = new Map();  // id -> FitAddon
    this.sockets = new Map();    // id -> WebSocket
    this.activeId = null;
    this.terminalNames = new Map(); // id -> string
    this.counter = 0;
    this.currentTheme = localStorage.getItem("vscode-lite-theme") || "theme-dark-modern";
  }

  getThemeColors(themeName) {
    if (themeName === "theme-light-modern") {
      return {
        background: "#ffffff",
        foreground: "#333333",
        cursor: "#000000",
        cursorAccent: "#ffffff",
        selectionBackground: "rgba(0, 120, 212, 0.25)",
        black: "#000000",
        red: "#cd3131",
        green: "#00bc00",
        yellow: "#949800",
        blue: "#0451a5",
        magenta: "#bc05bc",
        cyan: "#0598bc",
        white: "#555555",
        brightBlack: "#666666",
        brightRed: "#cd3131",
        brightGreen: "#14ce14",
        brightYellow: "#b5ba00",
        brightBlue: "#0451a5",
        brightMagenta: "#bc05bc",
        brightCyan: "#0598bc",
        brightWhite: "#a5a5a5"
      };
    } else if (themeName === "theme-monokai") {
      return {
        background: "#272822",
        foreground: "#f8f8f2",
        cursor: "#f8f8f0",
        cursorAccent: "#272822",
        selectionBackground: "rgba(73, 72, 62, 0.5)",
        black: "#333333",
        red: "#f92672",
        green: "#a6e22e",
        yellow: "#e6db74",
        blue: "#66d9ef",
        magenta: "#ae81ff",
        cyan: "#66d9ef",
        white: "#f8f8f2",
        brightBlack: "#75715e",
        brightRed: "#f92672",
        brightGreen: "#a6e22e",
        brightYellow: "#e6db74",
        brightBlue: "#66d9ef",
        brightMagenta: "#ae81ff",
        brightCyan: "#66d9ef",
        brightWhite: "#f8f8f2"
      };
    } else if (themeName === "theme-dracula") {
      return {
        background: "#282a36",
        foreground: "#f8f8f2",
        cursor: "#f8f8f2",
        cursorAccent: "#282a36",
        selectionBackground: "rgba(68, 71, 90, 0.5)",
        black: "#21222c",
        red: "#ff5555",
        green: "#50fa7b",
        yellow: "#f1fa8c",
        blue: "#bd93f9",
        magenta: "#ff79c6",
        cyan: "#8be9fd",
        white: "#f8f8f2",
        brightBlack: "#6272a4",
        brightRed: "#ff6e6e",
        brightGreen: "#69ff94",
        brightYellow: "#ffffa5",
        brightBlue: "#d6acff",
        brightMagenta: "#ff92df",
        brightCyan: "#a4ffff",
        brightWhite: "#ffffff"
      };
    } else if (themeName === "theme-high-contrast") {
      return {
        background: "#000000",
        foreground: "#ffffff",
        cursor: "#ffffff",
        cursorAccent: "#000000",
        selectionBackground: "rgba(255, 255, 255, 0.4)",
        black: "#000000",
        red: "#cd3131",
        green: "#0dbc79",
        yellow: "#e5e510",
        blue: "#2472c8",
        magenta: "#bc3fbc",
        cyan: "#11a8cd",
        white: "#e5e5e5",
        brightBlack: "#666666",
        brightRed: "#f14c4c",
        brightGreen: "#23d18b",
        brightYellow: "#f5f543",
        brightBlue: "#3b8eea",
        brightMagenta: "#d670d6",
        brightCyan: "#29b8db",
        brightWhite: "#ffffff"
      };
    } else if (themeName === "theme-dark-plus") {
      return {
        background: "#1e1e1e",
        foreground: "#cccccc",
        cursor: "#ffffff",
        cursorAccent: "#1e1e1e",
        selectionBackground: "rgba(255, 255, 255, 0.2)",
        black: "#000000",
        red: "#cd3131",
        green: "#0dbc79",
        yellow: "#e5e510",
        blue: "#2472c8",
        magenta: "#bc3fbc",
        cyan: "#11a8cd",
        white: "#e5e5e5",
        brightBlack: "#666666",
        brightRed: "#f14c4c",
        brightGreen: "#23d18b",
        brightYellow: "#f5f543",
        brightBlue: "#3b8eea",
        brightMagenta: "#d670d6",
        brightCyan: "#29b8db",
        brightWhite: "#ffffff"
      };
    } else {
      // Default: Obsidian Aurora
      return {
        background: "#0c1018",
        foreground: "#cbd5e1",
        cursor: "#a78bfa",
        cursorAccent: "#0c1018",
        selectionBackground: "rgba(99, 102, 241, 0.3)",
        black: "#0d1117",
        red: "#f87171",
        green: "#34d399",
        yellow: "#fbbf24",
        blue: "#60a5fa",
        magenta: "#c084fc",
        cyan: "#22d3ee",
        white: "#e2e8f0",
        brightBlack: "#526078",
        brightRed: "#fca5a5",
        brightGreen: "#6ee7b7",
        brightYellow: "#fde68a",
        brightBlue: "#93c5fd",
        brightMagenta: "#d8b4fe",
        brightCyan: "#67e8f9",
        brightWhite: "#f8fafc"
      };
    }
  }

  setTheme(themeName) {
    this.currentTheme = themeName;
    const colors = this.getThemeColors(themeName);
    this.terminals.forEach(term => {
      term.options.theme = colors;
    });
  }

  createTerminal() {
    this.counter++;
    const id = `term-${this.counter}`;
    const defaultName = `${this.counter}: bash`;
    this.terminalNames.set(id, defaultName);

    const termDiv = document.createElement("div");
    termDiv.id = id;
    termDiv.className = "terminal-instance";
    termDiv.style.width = "100%";
    termDiv.style.height = "100%";
    termDiv.style.display = "none";
    this.container.appendChild(termDiv);

    const term = new Terminal({
      theme: this.getThemeColors(this.currentTheme),
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
      fontSize: window.innerWidth <= 768 ? 15 : 13,
      fontWeight: window.innerWidth <= 768 ? "700" : "normal",
      fontWeightBold: "bold",
      lineHeight: 1.25,
      cursorBlink: true,
      cursorStyle: "block",
      allowTransparency: true
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(termDiv);
    this.terminals.set(id, term);
    this.fitAddons.set(id, fitAddon);

    // Setup WebSocket
    const wsBase = getBase().ws || (() => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${window.location.host}`;
    })();
    const wsUrl = `${wsBase.replace(/\/$/, "")}/ws/terminal?token=${encodeURIComponent(import.meta.env.VITE_TOKEN || "")}`;
    const socket = new WebSocket(wsUrl);
    console.log('[term] ws', wsUrl.replace(/token=[^&]*/, 'token=***'), 'tunnel:', getBase().tunnel);
    socket.addEventListener('open', () => console.log('[term] open'));
    socket.addEventListener('close', (e) => console.log('[term] close', e.code));
    socket.addEventListener('error', () => console.log('[term] error'));
    this.sockets.set(id, socket);
    const dbg = (m) => term.write('\r\n\x1b[33m[dbg] ' + m + '\x1b[0m\r\n');
    dbg('url ' + wsUrl.replace(/token=[^&]*/, 'token=***') + ' tunnel=' + getBase().tunnel);
    socket.addEventListener('open', () => dbg('open'));
    socket.addEventListener('error', () => dbg('error'));
    socket.addEventListener('close', (e) => dbg('close ' + e.code));
    let n = 0;
    socket.addEventListener('message', () => { n++; if (n <= 3) dbg('msg #' + n); });

    socket.onopen = () => {
      setTimeout(() => {
        fitAddon.fit();
        const { cols, rows } = term;
        socket.send(JSON.stringify({ type: "resize", cols, rows }));
      }, 100);
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "output") {
          term.write(msg.data);
        } else if (msg.type === "session") {
          const shellName = msg.shell || "bash";
          this.terminalNames.set(id, `${this.counter}: ${shellName}`);
          this.updateTerminalTabName(id, shellName);
          this.renderTabs();
        } else if (msg.type === "exit") {
          term.write("\r\n\x1b[90m[Process completed]\x1b[0m\r\n");
        }
      } catch (e) {
        term.write(event.data);
      }
    };

    term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "input", data }));
      }
    });

    term.onResize(({ cols, rows }) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "resize", cols, rows }));
      }
    });

    this.switchTo(id);
    this.renderTabs();
    return id;
  }

  renderTabs() {
    if (!this.tabsContainer) return;
    this.tabsContainer.innerHTML = "";

    this.terminals.forEach((term, id) => {
      const tabEl = document.createElement("div");
      tabEl.className = `terminal-tab-item ${id === this.activeId ? "active" : ""}`;
      const name = this.terminalNames.get(id) || id;

      tabEl.innerHTML = `
        <i class="codicon codicon-terminal" style="font-size:12px;"></i>
        <span>${name}</span>
      `;
      tabEl.addEventListener("click", () => this.switchTo(id));
      this.tabsContainer.appendChild(tabEl);
    });
  }

  switchTo(id) {
    if (!this.terminals.has(id)) return;
    this.activeId = id;

    this.container.querySelectorAll(".terminal-instance").forEach(el => {
      el.style.display = (el.id === id) ? "block" : "none";
    });

    const fitAddon = this.fitAddons.get(id);
    if (fitAddon) {
      setTimeout(() => fitAddon.fit(), 50);
    }
    const term = this.terminals.get(id);
    if (term) {
      term.focus();
    }
    this.renderTabs();
  }

  sendCommand(cmd) {
    if (!this.activeId || !this.sockets.has(this.activeId)) {
      this.createTerminal();
    }
    const socket = this.sockets.get(this.activeId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "input", data: cmd + "\n" }));
    } else {
      setTimeout(() => {
        const s = this.sockets.get(this.activeId);
        if (s && s.readyState === WebSocket.OPEN) {
          s.send(JSON.stringify({ type: "input", data: cmd + "\n" }));
        }
      }, 300);
    }
    this.switchTo(this.activeId);
  }

  sendKey(key) {
    if (!this.activeId || !this.sockets.has(this.activeId)) return;
    const socket = this.sockets.get(this.activeId);
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    let data = key;
    if (key === "Tab") data = "\t";
    else if (key === "Esc") data = "\x1b";
    else if (key === "Enter") data = "\r";
    else if (key === "Ctrl-C") data = "\x03";
    else if (key === "Ctrl-D") data = "\x04";
    else if (key === "Ctrl-L") data = "\x0c";
    else if (key === "Ctrl-Z") data = "\x1a";
    else if (key === "Up") data = "\x1b[A";
    else if (key === "Down") data = "\x1b[B";
    else if (key === "Right") data = "\x1b[C";
    else if (key === "Left") data = "\x1b[D";

    socket.send(JSON.stringify({ type: "input", data }));
  }

  // Sends a real Ctrl+<letter> combo (e.g. "a" -> Ctrl-A, ASCII 0x01) to the
  // active terminal, matching what a physical keyboard's Ctrl key would send.
  sendCtrlCombo(letter) {
    if (!this.activeId || !this.sockets.has(this.activeId)) return;
    const socket = this.sockets.get(this.activeId);
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (!letter || letter.length !== 1) return;

    const code = letter.toUpperCase().charCodeAt(0) - 64; // A=1 .. Z=26
    if (code < 1 || code > 26) return;
    const data = String.fromCharCode(code);
    socket.send(JSON.stringify({ type: "input", data }));
  }

  fitActive() {
    if (this.activeId) {
      const fitAddon = this.fitAddons.get(this.activeId);
      if (fitAddon) {
        try { fitAddon.fit(); } catch (e) {}
      }
    }
  }

  clearActive() {
    if (this.activeId) {
      const term = this.terminals.get(this.activeId);
      if (term) term.clear();
    }
  }

  killActive() {
    if (!this.activeId) return;
    const id = this.activeId;
    const term = this.terminals.get(id);
    if (term) term.dispose();
    this.terminals.delete(id);
    this.fitAddons.delete(id);
    this.terminalNames.delete(id);

    const socket = this.sockets.get(id);
    if (socket) {
      try {
        socket.close();
      } catch (e) {}
      this.sockets.delete(id);
    }

    const el = document.getElementById(id);
    if (el) el.remove();

    const remaining = Array.from(this.terminals.keys());
    if (remaining.length > 0) {
      this.switchTo(remaining[remaining.length - 1]);
    } else {
      this.createTerminal();
    }
  }

  updateTerminalTabName(id, name) {
    const badge = document.getElementById("terminal-shell-name");
    if (badge) {
      const cleanName = name.split("/").pop();
      badge.innerHTML = `<i class="codicon codicon-terminal-bash"></i> <span>${cleanName}</span>`;
    }
  }
}

export { TerminalManager };
