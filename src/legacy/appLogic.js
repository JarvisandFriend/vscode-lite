import { EditorManager } from './editorManager.js';
import { TerminalManager } from './terminalManager.js';

// Backend base URL, injected at build time from .env (see .env.example).
// Relative "/api/..." calls made anywhere below are transparently rewritten
// to point at this host, since a packaged mobile app has no local server to
// call a relative path against.
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const _fetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  if (typeof input === 'string' && input.startsWith('/api/')) {
    input = API_BASE + input;
    init = { ...(init || {}), headers: { ...((init && init.headers) || {}), 'x-token': import.meta.env.VITE_TOKEN || '' } };
  }
  return _fetch(input, init);
};

export async function bootApp() {
  // Initialize Core Managers
  const editorManager = new EditorManager("monaco-editor", "monaco-diff-editor");
  await editorManager.init();

  const terminalManager = new TerminalManager("terminal-container");
  terminalManager.createTerminal();

  // State
  let workspace = { path: "", name: "", gitBranch: "", isGit: false };
  let openTabs = []; // [{ path, name, dirty, gitStatus }]
  let activeTabPath = null;
  let fileTreeData = [];
  let allFilesList = []; // for Quick Open
  let gitData = { isGit: false, branch: "main", ahead: 0, behind: 0, staged: [], unstaged: [], untracked: [] };
  let autoSaveMode = localStorage.getItem("vscode-lite-autosave") || "off";
  let autoSaveTimer = null;
  let contextTarget = { path: null, isDir: false };

  // Toast Notification Helper
  function showToast(message, type = "info", duration = 3500) {
    const container = document.getElementById("notifications-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `notification-toast toast-${type}`;
    let iconClass = "codicon-info";
    if (type === "success") iconClass = "codicon-check";
    if (type === "error") iconClass = "codicon-error";
    if (type === "warning") iconClass = "codicon-warning";

    toast.innerHTML = `
      <i class="codicon ${iconClass}"></i>
      <div class="toast-message">${escapeHtml(message)}</div>
      <i class="codicon codicon-close toast-close"></i>
    `;
    toast.querySelector(".toast-close").addEventListener("click", () => toast.remove());
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("fade-out");
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // Theme Management
  const currentTheme = localStorage.getItem("vscode-lite-theme") || "theme-dark-modern";
  applyTheme(currentTheme);

  function applyTheme(themeName) {
    document.body.className = themeName;
    localStorage.setItem("vscode-lite-theme", themeName);
    editorManager.setTheme(themeName);
    terminalManager.setTheme(themeName);
    document.querySelectorAll(".theme-option").forEach(opt => {
      opt.classList.toggle("active", opt.dataset.theme === themeName);
    });
  }

  // File Icons Helper
  function getFileIconHtml(fileName, isDir) {
    if (isDir) {
      return '<i class="codicon node-icon codicon-folder"></i>';
    }
    const lower = (fileName || "").toLowerCase();
    const ext = lower.split(".").pop();

    if (lower === ".gitignore" || lower.startsWith(".git")) {
      return '<span class="custom-file-icon icon-git"><i class="codicon codicon-git-branch"></i></span>';
    }
    if (ext === "py" || ext === "pyw") {
      return '<span class="custom-file-icon icon-py">Py</span>';
    }
    if (["sh", "bash", "zsh"].includes(ext)) {
      return '<span class="custom-file-icon icon-sh">$</span>';
    }
    if (ext === "json" || ext === "jsonc") {
      return '<span class="custom-file-icon icon-json">{}</span>';
    }
    if (ext === "md" || ext === "markdown") {
      return '<span class="custom-file-icon icon-md"><i class="codicon codicon-markdown"></i></span>';
    }
    if (["zip", "tar", "gz", "tgz", "rar", "7z"].includes(ext)) {
      return '<span class="custom-file-icon icon-zip"><i class="codicon codicon-file-zip"></i></span>';
    }
    if (["png", "jpg", "jpeg", "gif", "webp", "svg", "ico"].includes(ext)) {
      return '<span class="custom-file-icon icon-img"><i class="codicon codicon-file-media"></i></span>';
    }
    if (["txt", "env", "conf", "config", "yml", "yaml", "toml", "ini"].includes(ext) || lower === "requirements.txt") {
      return '<span class="custom-file-icon icon-txt">=</span>';
    }
    if (["js", "ts", "jsx", "tsx", "c", "cpp", "h", "hpp", "rs", "go", "java", "html", "css", "scss", "sql", "php", "rb"].includes(ext)) {
      return '<i class="codicon node-icon codicon-file-code"></i>';
    }
    return '<i class="codicon node-icon codicon-file"></i>';
  }

  // Load Workspace Info
  async function loadWorkspace() {
    try {
      const res = await fetch("/api/workspace");
      workspace = await res.json();
      const wsName = workspace.name || "workspace";

      document.title = `${wsName} - VS Code Lite`;

      const titleDisplay = document.getElementById("titlebar-workspace-display");
      if (titleDisplay) {
        titleDisplay.textContent = `${wsName} - VS Code Lite`;
      }

      const sidebarName = document.getElementById("sidebar-workspace-name");
      if (sidebarName) {
        sidebarName.textContent = wsName.toUpperCase();
      }

      const remoteBadge = document.getElementById("remote-badge-text");
      if (remoteBadge) {
        remoteBadge.textContent = "Linux";
      }

      const branchName = document.getElementById("status-branch-name");
      if (branchName) {
        branchName.textContent = workspace.gitBranch ? workspace.gitBranch : "main";
      }

      const githubBranch = document.getElementById("github-branch-display");
      if (githubBranch) {
        githubBranch.textContent = workspace.gitBranch ? workspace.gitBranch : "main";
      }
    } catch (e) {
      console.error("Failed to load workspace info:", e);
    }
  }

  // File Tree Operations
  async function loadTree() {
    try {
      const res = await fetch("/api/tree");
      const data = await res.json();
      fileTreeData = data.tree || [];
      const container = document.getElementById("explorer-tree");
      if (container) {
        // Save open folders before re-render
        const openPaths = new Set();
        container.querySelectorAll(".tree-node:not(.collapsed)").forEach(el => {
          if (el.dataset.path) openPaths.add(el.dataset.path);
        });
        container.innerHTML = "";
        renderTree(fileTreeData, container, 0);
        // Restore open folders
        container.querySelectorAll(".tree-node").forEach(el => {
          if (el.dataset.path && openPaths.has(el.dataset.path)) {
            el.classList.remove("collapsed");
            const arrow = el.querySelector(".arrow");
            if (arrow) { arrow.classList.remove("codicon-chevron-right"); arrow.classList.add("codicon-chevron-down"); }
          }
        });
        updateFileDecorations();
      }
      // Background scan flat list for Quick Open
      loadAllFilesIndex();
    } catch (e) {
      console.error("Failed to load file tree:", e);
    }
  }

  async function loadAllFilesIndex() {
    try {
      const res = await fetch("/api/files/all");
      const data = await res.json();
      allFilesList = data.files || [];
    } catch (e) {
      console.error("Failed to index files:", e);
    }
  }

  function renderTree(nodes, parentEl, level) {
    for (const node of nodes) {
      const nodeEl = document.createElement("div");
      nodeEl.className = "tree-node";
      nodeEl.style.paddingLeft = `${level * 14 + 10}px`;
      nodeEl.dataset.path = node.path;
      nodeEl.dataset.isDir = node.isDirectory;

      const arrow = document.createElement("i");
      arrow.className = `codicon arrow ${node.isDirectory ? "codicon-chevron-right" : ""}`;
      if (!node.isDirectory) arrow.style.visibility = "hidden";

      const iconSpan = document.createElement("span");
      iconSpan.innerHTML = getFileIconHtml(node.name, node.isDirectory);

      const name = document.createElement("span");
      name.className = "node-name";
      name.textContent = node.name;

      nodeEl.appendChild(arrow);
      nodeEl.appendChild(iconSpan);
      nodeEl.appendChild(name);

      if (gitData.isGit) {
        const gitModified = (gitData.unstaged || []).find(u => u.file === node.path || u.file.endsWith("/" + node.name)) ||
                            (gitData.staged || []).find(s => s.file === node.path || s.file.endsWith("/" + node.name)) ||
                            (gitData.untracked || []).find(t => t.file === node.path || t.file.endsWith("/" + node.name));
        if (gitModified) {
          nodeEl.classList.add(`git-${gitModified.status}`);
          const badge = document.createElement("span");
          badge.className = `node-git-badge status-${gitModified.status}`;
          badge.textContent = gitModified.status;
          nodeEl.appendChild(badge);
        }
      }

      parentEl.appendChild(nodeEl);

      if (node.isDirectory) {
        const childrenContainer = document.createElement("div");
        childrenContainer.className = "tree-children";
        nodeEl.classList.add("collapsed");
        nodeEl.appendChild(childrenContainer);

        if (node.children && node.children.length > 0) {
          renderTree(node.children, childrenContainer, level + 1);
        }

        nodeEl.addEventListener("click", async (e) => {
          e.stopPropagation();
          nodeEl.classList.toggle("collapsed");
          const isCollapsed = nodeEl.classList.contains("collapsed");
          const arrow = nodeEl.querySelector(".arrow");
          if (arrow) { arrow.classList.toggle("codicon-chevron-right", isCollapsed); arrow.classList.toggle("codicon-chevron-down", !isCollapsed); }

          // Lazy load subtree if empty
          if (!isCollapsed && childrenContainer.children.length === 0 && node.hasChildren) {
            try {
              const res = await fetch(`/api/tree?dir=${encodeURIComponent(node.path)}`);
              const data = await res.json();
              renderTree(data.tree || [], childrenContainer, level + 1);
            } catch (err) {}
          }

          childrenContainer.style.display = isCollapsed ? "none" : "block";
          const folderIcon = nodeEl.querySelector(".node-icon");
          if (folderIcon) {
            folderIcon.className = `codicon node-icon ${isCollapsed ? "codicon-folder" : "codicon-folder-opened"}`;
          }
        });
      } else {
        nodeEl.addEventListener("click", () => {
          openFileTab(node.path, node.name);
          closeMobileSidebar();
        });
      }

      // Context menu
      nodeEl.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        showExplorerContextMenu(e.clientX, e.clientY, node.path, node.isDirectory);
      });
    }
  }

  // Tabs Management
  async function openFileTab(filePath, fileName) {
    let tab = openTabs.find(t => t.path === filePath);
    if (!tab) {
      const gitModified = gitData.isGit ?
        ((gitData.unstaged || []).find(u => u.file === filePath || u.file.endsWith("/" + (fileName || filePath))) ||
         (gitData.staged || []).find(s => s.file === filePath || s.file.endsWith("/" + (fileName || filePath)))) : null;
      tab = {
        path: filePath,
        name: fileName || filePath.split("/").pop(),
        dirty: false,
        gitStatus: gitModified ? gitModified.status : ""
      };
      openTabs.push(tab);
    }
    await switchTab(filePath);
  }

  async function switchTab(filePath) {
    activeTabPath = filePath;
    const tab = openTabs.find(t => t.path === filePath);
    if (!tab) return;

    try {
      const res = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();

      if (data.isBinary) {
        if (data.isImage) {
          editorManager.showMediaPreview(filePath, true, data.size || 0);
        } else {
          editorManager.showMediaPreview(filePath, false, data.size || 0);
        }
      } else {
        editorManager.openFile(filePath, data.content || "", true);
      }
    } catch (e) {
      console.error("Failed to read file:", e);
    }

    renderTabs();
    highlightActiveTreeNode(filePath);
    updateBreadcrumb(tab.name, filePath);
    updateOutlineView();
    updateTimelineView();
  }

  function updateBreadcrumb(name, filePath) {
    const item = document.getElementById("breadcrumb-current-file");
    if (!item) return;
    item.innerHTML = `${getFileIconHtml(name, false)} <span id="breadcrumb-text">${filePath}</span>`;
  }

  function closeTab(filePath, e) {
    if (e) e.stopPropagation();
    const index = openTabs.findIndex(t => t.path === filePath);
    if (index === -1) return;

    const tab = openTabs[index];
    if (tab.dirty) {
      const confirmClose = confirm(`Save changes to ${tab.name} before closing?`);
      if (confirmClose) {
        editorManager.onSaveCallback(filePath, editorManager.getValue());
      }
    }

    editorManager.closeFile(filePath);
    openTabs.splice(index, 1);

    if (activeTabPath === filePath) {
      if (openTabs.length > 0) {
        const nextTab = openTabs[Math.max(0, index - 1)];
        switchTab(nextTab.path);
      } else {
        activeTabPath = null;
        renderTabs();
        highlightActiveTreeNode(null);
        updateOutlineView();
        updateTimelineView();
      }
    } else {
      renderTabs();
    }
  }

  function closeOtherTabs(keepPath) {
    const toClose = openTabs.filter(t => t.path !== keepPath);
    toClose.forEach(t => editorManager.closeFile(t.path));
    openTabs = openTabs.filter(t => t.path === keepPath);
    switchTab(keepPath);
  }

  function closeTabsToRight(fromPath) {
    const idx = openTabs.findIndex(t => t.path === fromPath);
    if (idx === -1) return;
    const toClose = openTabs.slice(idx + 1);
    toClose.forEach(t => editorManager.closeFile(t.path));
    openTabs = openTabs.slice(0, idx + 1);
    if (!openTabs.some(t => t.path === activeTabPath)) {
      switchTab(fromPath);
    } else {
      renderTabs();
    }
  }

  function closeAllTabs() {
    openTabs.forEach(t => editorManager.closeFile(t.path));
    openTabs = [];
    activeTabPath = null;
    renderTabs();
    highlightActiveTreeNode(null);
  }

  function renderTabs() {
    const tabsContainer = document.getElementById("tabs-bar");
    if (!tabsContainer) return;
    tabsContainer.innerHTML = "";

    for (const tab of openTabs) {
      const tabEl = document.createElement("div");
      tabEl.className = `tab ${tab.path === activeTabPath ? "active" : ""} ${tab.dirty ? "dirty" : ""}`;
      tabEl.dataset.path = tab.path;

      const iconSpan = document.createElement("span");
      iconSpan.innerHTML = getFileIconHtml(tab.name, false);

      const title = document.createElement("span");
      title.className = "tab-title";
      title.textContent = tab.name;

      tabEl.appendChild(iconSpan);
      tabEl.appendChild(title);

      if (tab.gitStatus) {
        const badge = document.createElement("span");
        badge.className = "tab-git-badge";
        badge.textContent = tab.gitStatus;
        tabEl.appendChild(badge);
      }

      const dirtyDot = document.createElement("div");
      dirtyDot.className = "tab-dirty-dot";

      const closeBtn = document.createElement("i");
      closeBtn.className = "codicon codicon-close tab-close";
      closeBtn.addEventListener("click", (e) => closeTab(tab.path, e));

      tabEl.appendChild(dirtyDot);
      tabEl.appendChild(closeBtn);

      tabEl.addEventListener("click", () => switchTab(tab.path));

      // Tab context menu
      tabEl.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        showTabContextMenu(e.clientX, e.clientY, tab.path);
      });

      tabsContainer.appendChild(tabEl);
    }
    updateFileDecorations();
  }

  function highlightActiveTreeNode(filePath) {
    document.querySelectorAll(".tree-node").forEach(node => {
      node.classList.toggle("active", node.dataset.path === filePath);
    });
  }

  // File explorer and tab decoration pipeline (Git status & Syntax error markers)
  let activeMarkers = [];

  function updateFileDecorations() {
    const fileProblems = new Map();
    if (activeMarkers && activeMarkers.length > 0) {
      for (const m of activeMarkers) {
        let p = "";
        if (m.resource) {
          p = m.resource.fsPath || m.resource.path || "";
        }
        if (!p && editorManager.activePath) {
          p = editorManager.activePath;
        }
        if (p.startsWith("/")) p = p.substring(1);
        if (!fileProblems.has(p)) {
          fileProblems.set(p, { errors: 0, warnings: 0 });
        }
        const stat = fileProblems.get(p);
        if (m.severity === 8) stat.errors++;
        else if (m.severity === 4) stat.warnings++;
      }
    }

    // 1. Update File Tree nodes in Explorer
    document.querySelectorAll("#explorer-tree .tree-node").forEach(nodeEl => {
      const nodePath = nodeEl.dataset.path;
      if (!nodePath) return;

      // Remove existing status classes and badges
      nodeEl.classList.remove("git-U", "git-A", "git-M", "git-D", "has-error", "has-warning");
      const existingBadge = nodeEl.querySelector(".node-git-badge");
      if (existingBadge) existingBadge.remove();
      const existingErrBadge = nodeEl.querySelector(".node-error-badge");
      if (existingErrBadge) existingErrBadge.remove();

      // Check problem errors first (Syntax errors turn file text red)
      let prob = fileProblems.get(nodePath);
      if (!prob) {
        for (const [k, v] of fileProblems.entries()) {
          if (k === nodePath || k.endsWith("/" + nodePath) || nodePath.endsWith("/" + k)) {
            prob = v;
            break;
          }
        }
      }

      if (prob && prob.errors > 0) {
        nodeEl.classList.add("has-error");
        const errBadge = document.createElement("span");
        errBadge.className = "node-error-badge";
        errBadge.title = `${prob.errors} syntax error(s)`;
        errBadge.innerHTML = `<i class="codicon codicon-error" style="font-size:11px; margin-right:2px;"></i>${prob.errors}`;
        nodeEl.appendChild(errBadge);
      } else if (prob && prob.warnings > 0) {
        nodeEl.classList.add("has-warning");
      }

      // Check Git status (U = green, M = orange/amber, A = green, D = red)
      if (gitData.isGit) {
        const gitItem = (gitData.unstaged || []).find(u => u.file === nodePath || u.file.endsWith("/" + nodePath) || nodePath.endsWith("/" + u.file)) ||
                        (gitData.staged || []).find(s => s.file === nodePath || s.file.endsWith("/" + nodePath) || nodePath.endsWith("/" + s.file)) ||
                        (gitData.untracked || []).find(t => t.file === nodePath || t.file.endsWith("/" + nodePath) || nodePath.endsWith("/" + t.file));
        if (gitItem) {
          nodeEl.classList.add(`git-${gitItem.status}`);
          if (!nodeEl.querySelector(".node-error-badge")) {
            const badge = document.createElement("span");
            badge.className = `node-git-badge status-${gitItem.status}`;
            badge.textContent = gitItem.status;
            nodeEl.appendChild(badge);
          }
        }
      }
    });

    // 2. Update Open Tabs
    document.querySelectorAll(".tab").forEach(tabEl => {
      const tabPath = tabEl.dataset.path;
      if (!tabPath) return;

      tabEl.classList.remove("git-U", "git-A", "git-M", "git-D", "has-error", "has-warning");

      let prob = fileProblems.get(tabPath);
      if (!prob) {
        for (const [k, v] of fileProblems.entries()) {
          if (k === tabPath || k.endsWith("/" + tabPath) || tabPath.endsWith("/" + k)) {
            prob = v;
            break;
          }
        }
      }

      if (prob && prob.errors > 0) {
        tabEl.classList.add("has-error");
      } else if (gitData.isGit) {
        const gitItem = (gitData.unstaged || []).find(u => u.file === tabPath || u.file.endsWith("/" + tabPath)) ||
                        (gitData.staged || []).find(s => s.file === tabPath || s.file.endsWith("/" + tabPath)) ||
                        (gitData.untracked || []).find(t => t.file === tabPath || t.file.endsWith("/" + tabPath));
        if (gitItem) {
          tabEl.classList.add(`git-${gitItem.status}`);
        }
      }
    });
  }

  // Save Callback
  editorManager.onSaveCallback = async (filePath, content) => {
    try {
      const res = await fetch("/api/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath, content })
      });
      if (res.ok) {
        const tab = openTabs.find(t => t.path === filePath);
        if (tab) tab.dirty = false;
        renderTabs();
        updateGitStatus();
        updateOutlineView();
        showToast(`Saved ${filePath}`, "success", 2000);
      }
    } catch (e) {
      showToast(`Failed to save file: ${e.message}`, "error");
    }
  };

  editorManager.onDirtyChangeCallback = (filePath, isDirty) => {
    const tab = openTabs.find(t => t.path === filePath);
    if (tab && tab.dirty !== isDirty) {
      tab.dirty = isDirty;
      renderTabs();
    }

    if (autoSaveMode === "afterDelay") {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(() => {
        if (activeTabPath) {
          editorManager.onSaveCallback(activeTabPath, editorManager.getValue());
        }
      }, 1000);
    }
  };

  window.addEventListener("blur", () => {
    if (autoSaveMode === "onFocusChange" && activeTabPath) {
      const tab = openTabs.find(t => t.path === activeTabPath);
      if (tab && tab.dirty) {
        editorManager.onSaveCallback(activeTabPath, editorManager.getValue());
      }
    }
  });

  // Diagnostics & Problems
  editorManager.onProblemsChangeCallback = (markers) => {
    activeMarkers = markers || [];
    const problemsList = document.getElementById("problems-list");
    const errCountEl = document.getElementById("status-err-count");
    const warnCountEl = document.getElementById("status-warn-count");
    const badgeProblems = document.getElementById("badge-problems");

    let errors = 0;
    let warnings = 0;

    if (problemsList) {
      problemsList.innerHTML = "";
      if (!markers || markers.length === 0) {
        problemsList.innerHTML = '<div style="color:var(--text-muted); padding:6px;">No problems detected in open files.</div>';
      } else {
        markers.forEach(m => {
          if (m.severity === 8) errors++;
          else if (m.severity === 4) warnings++;

          const item = document.createElement("div");
          item.className = "tree-node";
          item.innerHTML = `
            <i class="codicon ${m.severity === 8 ? "codicon-error" : "codicon-warning"}" style="color:${m.severity === 8 ? "#f85149" : "#cca700"}; margin-right:4px;"></i>
            <span style="flex:1;">${escapeHtml(m.message)}</span>
            <span style="color:var(--text-muted); font-size:11px;">[Ln ${m.startLineNumber}, Col ${m.startColumn}]</span>
          `;
          item.addEventListener("click", () => {
            editorManager.goToLine(m.startLineNumber);
          });
          problemsList.appendChild(item);
        });
      }
    }

    if (errCountEl) errCountEl.textContent = errors;
    if (warnCountEl) warnCountEl.textContent = warnings;
    if (badgeProblems) {
      badgeProblems.textContent = errors + warnings;
      badgeProblems.style.display = (errors + warnings) > 0 ? "inline-block" : "none";
    }

    updateFileDecorations();
  };

  // Outline View
  function updateOutlineView() {
    const outlineContent = document.getElementById("outline-content");
    if (!outlineContent || outlineContent.style.display === "none") return;

    const symbols = editorManager.getOutlineSymbols();
    outlineContent.innerHTML = "";

    if (symbols.length === 0) {
      outlineContent.innerHTML = '<div style="color:var(--text-muted); font-size:11px; padding:6px;">No symbols found in current file.</div>';
      return;
    }

    symbols.forEach(s => {
      const node = document.createElement("div");
      node.className = "tree-node";
      node.style.padding = "3px 8px";
      node.innerHTML = `
        <i class="codicon ${s.icon}" style="color:#4ec9b0; margin-right:6px;"></i>
        <span style="flex:1;">${escapeHtml(s.name)}</span>
        <span style="color:var(--text-muted); font-size:10px;">:${s.line}</span>
      `;
      node.addEventListener("click", () => {
        editorManager.goToLine(s.line);
      });
      outlineContent.appendChild(node);
    });
  }

  document.getElementById("btn-toggle-outline")?.addEventListener("click", () => {
    const content = document.getElementById("outline-content");
    const chevron = document.getElementById("chevron-outline");
    if (!content) return;
    const isHidden = content.style.display === "none";
    content.style.display = isHidden ? "block" : "none";
    if (chevron) {
      chevron.className = `codicon section-chevron ${isHidden ? "codicon-chevron-right" : "codicon-chevron-down"}`;
    }
    if (isHidden) updateOutlineView();
  });

  // Timeline (Git Log)
  async function updateTimelineView() {
    const timelineContent = document.getElementById("timeline-content");
    if (!timelineContent || timelineContent.style.display === "none") return;

    if (!activeTabPath) {
      timelineContent.innerHTML = '<div style="color:var(--text-muted); font-size:11px; padding:6px;">No file open.</div>';
      return;
    }

    try {
      const res = await fetch(`/api/git/log?file=${encodeURIComponent(activeTabPath)}`);
      const data = await res.json();
      timelineContent.innerHTML = "";

      if (!data.commits || data.commits.length === 0) {
        timelineContent.innerHTML = '<div style="color:var(--text-muted); font-size:11px; padding:6px;">No commit history for this file.</div>';
        return;
      }

      data.commits.forEach(c => {
        const item = document.createElement("div");
        item.className = "tree-node";
        item.style.padding = "4px 8px";
        item.innerHTML = `
          <i class="codicon codicon-git-commit" style="margin-right:6px; color:#3794ff;"></i>
          <div style="display:flex; flex-direction:column; overflow:hidden; flex:1;">
            <span style="font-weight:500; font-size:12px;">${escapeHtml(c.subject)}</span>
            <span style="color:var(--text-muted); font-size:10px;">${c.hash} • ${c.date} by ${c.author}</span>
          </div>
        `;
        timelineContent.appendChild(item);
      });
    } catch (e) {
      timelineContent.innerHTML = '<div style="color:var(--text-muted); font-size:11px;">Git history unavailable.</div>';
    }
  }

  document.getElementById("btn-toggle-timeline")?.addEventListener("click", () => {
    const content = document.getElementById("timeline-content");
    const chevron = document.getElementById("chevron-timeline");
    if (!content) return;
    const isHidden = content.style.display === "none";
    content.style.display = isHidden ? "block" : "none";
    if (chevron) {
      chevron.className = `codicon section-chevron ${isHidden ? "codicon-chevron-right" : "codicon-chevron-down"}`;
    }
    if (isHidden) updateTimelineView();
  });

  // Active Ports Scanner
  async function loadPorts() {
    try {
      const res = await fetch("/api/ports");
      const data = await res.json();
      const tbody = document.getElementById("ports-tbody");
      const countBadge = document.getElementById("ports-count");
      const statusPorts = document.getElementById("status-ports-count");

      if (tbody) {
        tbody.innerHTML = "";
        (data.ports || []).forEach(p => {
          const tr = document.createElement("tr");
          tr.style.borderBottom = "1px solid var(--border-subtle)";
          tr.innerHTML = `
            <td style="padding:6px 8px;"><span class="badge" style="background:#0e639c;">${p.port}</span></td>
            <td style="padding:6px 8px; color:var(--text-muted);">${p.protocol}</td>
            <td style="padding:6px 8px;"><a href="${p.address}" target="_blank" style="color:var(--accent-color); text-decoration:none;">${p.address}</a></td>
          `;
          tbody.appendChild(tr);
        });
      }

      const total = (data.ports || []).length;
      if (countBadge) countBadge.textContent = total;
      if (statusPorts) statusPorts.textContent = total;
    } catch (e) {
      console.error("Ports scan error:", e);
    }
  }

  document.getElementById("btn-refresh-ports")?.addEventListener("click", loadPorts);

  // System Runtimes
  async function loadRuntimes() {
    try {
      const res = await fetch("/api/system/info");
      const data = await res.json();
      const container = document.getElementById("runtimes-list");
      if (!container) return;

      container.innerHTML = "";
      const runtimes = [
        { name: "Python 3 Runtime", icon: "icon-py", desc: data.runtimes.python || "python3 (Active)" },
        { name: "Node.js JavaScript Runtime", icon: "codicon-file-code", desc: data.runtimes.node || "node.js" },
        { name: "Linux Native Shell", icon: "codicon-terminal", desc: data.runtimes.shell || "/usr/bin/zsh" },
        { name: "Git Source Control", icon: "codicon-git-branch", desc: data.runtimes.git || "git" }
      ];

      runtimes.forEach(r => {
        const item = document.createElement("div");
        item.className = "extension-item";
        item.innerHTML = `
          <i class="codicon ${r.icon.startsWith("icon-") ? "" : r.icon}" style="font-size:22px; color:#3794ff;"></i>
          <div>
            <div style="font-weight:600; font-size:12px;">${r.name}</div>
            <div style="color:var(--text-muted); font-size:11px;">${r.desc}</div>
          </div>
        `;
        container.appendChild(item);
      });
    } catch (e) {}
  }
  document.getElementById("btn-refresh-runtimes")?.addEventListener("click", loadRuntimes);

  // Code Execution (F5 / Run File)
  async function runCurrentFile() {
    if (!activeTabPath) {
      showToast("No active file to run. Open a file first.", "warning");
      return;
    }

    // Auto-save
    const tab = openTabs.find(t => t.path === activeTabPath);
    if (tab && tab.dirty) {
      await editorManager.onSaveCallback(activeTabPath, editorManager.getValue());
    }

    // Ensure bottom panel is open
    const bottomPanel = document.getElementById("bottom-panel");
    if (bottomPanel && bottomPanel.classList.contains("hidden")) {
      togglePanel();
    }
    const termTab = document.querySelector('.panel-tab[data-target="terminal"]');
    if (termTab) termTab.click();

    const ext = activeTabPath.split(".").pop().toLowerCase();
    let execCmd = "";

    if (ext === "py" || ext === "pyw") {
      execCmd = `python3 "${activeTabPath}"`;
    } else if (["sh", "bash", "zsh"].includes(ext)) {
      execCmd = `bash "${activeTabPath}"`;
    } else if (ext === "js" || ext === "mjs") {
      execCmd = `node "${activeTabPath}"`;
    } else if (ext === "ts") {
      execCmd = `npx ts-node "${activeTabPath}"`;
    } else if (ext === "go") {
      execCmd = `go run "${activeTabPath}"`;
    } else if (ext === "c") {
      execCmd = `gcc "${activeTabPath}" -o /tmp/a.out && /tmp/a.out`;
    } else if (ext === "cpp" || ext === "cc") {
      execCmd = `g++ "${activeTabPath}" -o /tmp/a.out && /tmp/a.out`;
    } else if (ext === "rs") {
      execCmd = `rustc "${activeTabPath}" -o /tmp/a.out && /tmp/a.out`;
    } else {
      execCmd = `./"${activeTabPath}"`;
    }

    terminalManager.sendCommand(execCmd);
    showToast(`Running ${activeTabPath} in terminal`, "info", 1500);
  }

  document.getElementById("btn-run-file")?.addEventListener("click", runCurrentFile);
  document.getElementById("btn-quick-run")?.addEventListener("click", runCurrentFile);
  document.getElementById("btn-run-script-panel")?.addEventListener("click", runCurrentFile);

  document.getElementById("btn-custom-exec")?.addEventListener("click", () => {
    const input = document.getElementById("custom-exec-input");
    const cmd = input?.value.trim();
    if (!cmd) return;
    const finalCmd = activeTabPath ? cmd.replace("%f", `"${activeTabPath}"`) : cmd;

    const termTab = document.querySelector('.panel-tab[data-target="terminal"]');
    if (termTab) termTab.click();
    if (bottomPanel.classList.contains("hidden")) togglePanel();

    terminalManager.sendCommand(finalCmd);
  });

  // Quick Save Button
  document.getElementById("btn-quick-save")?.addEventListener("click", () => {
    if (activeTabPath) {
      editorManager.onSaveCallback(activeTabPath, editorManager.getValue());
    }
  });

  // Split Diff Editor
  document.getElementById("btn-split-editor")?.addEventListener("click", async () => {
    if (activeTabPath) {
      const res = await fetch(`/api/file?path=${encodeURIComponent(activeTabPath)}`);
      const data = await res.json();
      editorManager.showDiff(activeTabPath, data.content || "", editorManager.getValue());
    }
  });

  document.getElementById("btn-editor-more")?.addEventListener("click", () => {
    showCommandPalette();
  });

  // Preview Toggle Button
  document.getElementById("btn-toggle-preview")?.addEventListener("click", () => {
    editorManager.togglePreview();
  });

  // Markdown Edit Source Button
  document.getElementById("btn-markdown-edit")?.addEventListener("click", () => {
    editorManager.hidePreviews();
    editorManager.container.style.display = "block";
    editorManager.editor.layout();
    editorManager.editor.focus();
  });

  // HTML Edit Source Button
  document.getElementById("btn-html-edit")?.addEventListener("click", () => {
    editorManager.hidePreviews();
    editorManager.container.style.display = "block";
    editorManager.editor.layout();
    editorManager.editor.focus();
  });

  // HTML Refresh Button
  document.getElementById("btn-html-refresh")?.addEventListener("click", () => {
    if (editorManager.isPreviewActive && editorManager.previewType === "html") {
      editorManager.renderHtmlDoc(editorManager.editor.getValue());
    }
  });

  // HTML Open in New Tab
  document.getElementById("btn-html-external")?.addEventListener("click", () => {
    const content = editorManager.editor?.getValue() || "";
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  });

  // Git Status & Source Control
  async function updateGitStatus() {
    try {
      const res = await fetch("/api/git/status");
      const data = await res.json();
      gitData = data;

      const badge = document.getElementById("git-badge");
      if (!data.isGit) {
        if (badge) badge.style.display = "none";
        return;
      }

      const totalChanges = (data.staged.length + data.unstaged.length + data.untracked.length);
      if (badge) {
        badge.textContent = totalChanges;
        badge.style.display = totalChanges > 0 ? "inline-block" : "none";
      }

      const stagedCount = document.getElementById("git-staged-count");
      if (stagedCount) stagedCount.textContent = data.staged.length;

      const changesCount = document.getElementById("git-changes-count");
      if (changesCount) changesCount.textContent = (data.unstaged.length + data.untracked.length);

      const branchEl = document.getElementById("status-branch-name");
      if (branchEl && data.branch) {
        branchEl.textContent = data.branch;
      }

      const githubBranch = document.getElementById("github-branch-display");
      if (githubBranch && data.branch) {
        githubBranch.textContent = data.branch;
      }

      // Render Git Panel
      const stagedList = document.getElementById("git-staged-list");
      const changesList = document.getElementById("git-changes-list");
      if (!stagedList || !changesList) return;

      stagedList.innerHTML = "";
      changesList.innerHTML = "";

      for (const item of data.staged) {
        stagedList.appendChild(createGitFileItem(item.file, item.status, true));
      }
      for (const item of [...data.unstaged, ...data.untracked]) {
        changesList.appendChild(createGitFileItem(item.file, item.status, false));
      }
      updateFileDecorations();
    } catch (e) {
      console.error("Git status error:", e);
    }
  }

  function createGitFileItem(file, status, isStaged) {
    const el = document.createElement("div");
    el.className = "git-file-item";

    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.alignItems = "center";
    left.style.gap = "6px";
    left.style.overflow = "hidden";
    left.innerHTML = `${getFileIconHtml(file, false)} <span style="white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${file}</span>`;

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.alignItems = "center";
    right.style.gap = "4px";

    const statusBadge = document.createElement("span");
    statusBadge.className = `git-file-status status-${status}`;
    statusBadge.textContent = status;

    // Discard button for unstaged
    if (!isStaged) {
      const discardBtn = document.createElement("i");
      discardBtn.className = "codicon codicon-discard action-btn";
      discardBtn.title = "Discard Changes";
      discardBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (confirm(`Discard changes in ${file}?`)) {
          await fetch("/api/git/discard", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ file })
          });
          updateGitStatus();
          if (activeTabPath === file) switchTab(file);
        }
      });
      right.appendChild(discardBtn);
    }

    const actionBtn = document.createElement("i");
    actionBtn.className = `codicon ${isStaged ? "codicon-remove" : "codicon-add"} action-btn`;
    actionBtn.title = isStaged ? "Unstage" : "Stage";
    actionBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await fetch(isStaged ? "/api/git/unstage" : "/api/git/stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: [file] })
      });
      updateGitStatus();
    });

    right.appendChild(statusBadge);
    right.appendChild(actionBtn);

    el.appendChild(left);
    el.appendChild(right);

    el.addEventListener("click", async () => {
      try {
        const res = await fetch(`/api/git/diff?file=${encodeURIComponent(file)}&staged=${isStaged}`);
        const diffData = await res.json();
        editorManager.showDiff(file, diffData.original, diffData.current);
      } catch (err) {
        console.error("Diff error:", err);
      }
    });

    return el;
  }

  // Git Panel Actions
  document.getElementById("btn-git-stage-all")?.addEventListener("click", async () => {
    await fetch("/api/git/stage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: [] })
    });
    updateGitStatus();
    showToast("Staged all changes", "info");
  });

  document.getElementById("btn-git-unstage-all")?.addEventListener("click", async () => {
    await fetch("/api/git/unstage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: [] })
    });
    updateGitStatus();
    showToast("Unstaged all changes", "info");
  });

  document.getElementById("btn-git-refresh-status")?.addEventListener("click", () => {
    updateGitStatus();
  });

  document.getElementById("btn-git-commit")?.addEventListener("click", async () => {
    const input = document.getElementById("git-commit-message");
    const message = input.value.trim();
    if (!message) {
      showToast("Please enter a commit message", "warning");
      return;
    }
    try {
      // Auto-stage all if nothing staged
      if (gitData.staged.length === 0) {
        await fetch("/api/git/stage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: [] })
        });
      }
      const res = await fetch("/api/git/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
      });
      if (res.ok) {
        input.value = "";
        updateGitStatus();
        showToast("Committed changes successfully!", "success");
      } else {
        const err = await res.json();
        showToast(`Commit failed: ${err.error}`, "error");
      }
    } catch (e) {
      showToast(`Error committing: ${e.message}`, "error");
    }
  });

  document.getElementById("btn-git-sync")?.addEventListener("click", async () => {
    showToast("Syncing with remote...", "info");
    try {
      await fetch("/api/git/pull", { method: "POST" });
      const res = await fetch("/api/git/push", { method: "POST" });
      if (res.ok) {
        showToast("Synchronized successfully with remote!", "success");
        updateGitStatus();
        loadTree();
      } else {
        const err = await res.json();
        showToast(`Sync warning: ${err.error}`, "warning");
      }
    } catch (e) {
      showToast(`Sync error: ${e.message}`, "error");
    }
  });

  document.getElementById("btn-git-push")?.addEventListener("click", async () => {
    try {
      const res = await fetch("/api/git/push", { method: "POST" });
      if (res.ok) {
        showToast("Push successful!", "success");
        updateGitStatus();
      } else {
        const data = await res.json();
        showToast(`Push failed: ${data.error}`, "error");
      }
    } catch (e) {
      showToast(`Error pushing: ${e.message}`, "error");
    }
  });

  document.getElementById("btn-git-pull")?.addEventListener("click", async () => {
    try {
      const res = await fetch("/api/git/pull", { method: "POST" });
      if (res.ok) {
        showToast("Pull successful!", "success");
        await loadTree();
        updateGitStatus();
      } else {
        const data = await res.json();
        showToast(`Pull failed: ${data.error}`, "error");
      }
    } catch (e) {
      showToast(`Error pulling: ${e.message}`, "error");
    }
  });

  // Search & Replace
  const searchInput = document.getElementById("search-input");
  const replaceInput = document.getElementById("replace-input");
  const replaceBox = document.getElementById("replace-input-box");
  const filesFilterInput = document.getElementById("search-files-filter");

  let searchOptions = { case: false, word: false, regex: false };

  document.getElementById("btn-search-case")?.addEventListener("click", function() {
    searchOptions.case = !searchOptions.case;
    this.classList.toggle("active", searchOptions.case);
    executeSearch();
  });
  document.getElementById("btn-search-word")?.addEventListener("click", function() {
    searchOptions.word = !searchOptions.word;
    this.classList.toggle("active", searchOptions.word);
    executeSearch();
  });
  document.getElementById("btn-search-regex")?.addEventListener("click", function() {
    searchOptions.regex = !searchOptions.regex;
    this.classList.toggle("active", searchOptions.regex);
    executeSearch();
  });

  document.getElementById("btn-toggle-replace-box")?.addEventListener("click", () => {
    if (replaceBox) {
      replaceBox.style.display = (replaceBox.style.display === "none") ? "flex" : "none";
    }
  });

  document.getElementById("btn-clear-search")?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    if (replaceInput) replaceInput.value = "";
    const container = document.getElementById("search-results");
    if (container) container.innerHTML = "";
    const statusText = document.getElementById("search-status-text");
    if (statusText) statusText.textContent = "";
  });

  searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") executeSearch();
  });

  async function executeSearch() {
    const q = searchInput?.value.trim();
    if (!q) return;
    const filter = filesFilterInput?.value.trim() || "";

    const params = new URLSearchParams({
      q: q,
      case: searchOptions.case ? "true" : "false",
      word: searchOptions.word ? "true" : "false",
      regex: searchOptions.regex ? "true" : "false",
      files: filter
    });

    try {
      const res = await fetch(`/api/search?${params.toString()}`);
      const data = await res.json();
      renderSearchResults(data.results, data.totalCount || 0);
    } catch (err) {
      console.error("Search error:", err);
    }
  }

  function renderSearchResults(results, totalCount) {
    const container = document.getElementById("search-results");
    const statusText = document.getElementById("search-status-text");
    container.innerHTML = "";
    const files = Object.keys(results || {});

    if (statusText) {
      statusText.textContent = `${totalCount} results in ${files.length} files`;
    }

    if (files.length === 0) {
      container.innerHTML = '<div style="padding:10px; color:#858585;">No results found.</div>';
      return;
    }

    for (const file of files) {
      const fileHeader = document.createElement("div");
      fileHeader.className = "tree-node";
      fileHeader.innerHTML = `${getFileIconHtml(file, false)} <b>${file}</b> <span style="color:var(--text-muted); font-size:11px;">(${results[file].length})</span>`;
      container.appendChild(fileHeader);

      for (const match of results[file]) {
        const matchEl = document.createElement("div");
        matchEl.className = "tree-node";
        matchEl.style.paddingLeft = "24px";
        matchEl.innerHTML = `<span style="color:#858585; margin-right:8px;">${match.line}:</span> ${escapeHtml(match.text)}`;
        matchEl.addEventListener("click", () => {
          openFileTab(file);
          setTimeout(() => editorManager.goToLine(match.line), 100);
        });
        container.appendChild(matchEl);
      }
    }
  }

  // Replace All in files
  document.getElementById("btn-exec-replace-all")?.addEventListener("click", async () => {
    const q = searchInput?.value.trim();
    const rep = replaceInput?.value || "";
    if (!q) return;

    const files = Object.keys(await (await fetch(`/api/search?q=${encodeURIComponent(q)}`)).json().then(d => d.results || {}));
    if (files.length === 0) {
      showToast("No matches to replace", "warning");
      return;
    }

    if (confirm(`Replace all occurrences of "${q}" with "${rep}" across ${files.length} files?`)) {
      const res = await fetch("/api/replace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          replacement: rep,
          files: files,
          isRegex: searchOptions.regex,
          matchCase: searchOptions.case
        })
      });
      if (res.ok) {
        showToast("Replacement complete across files!", "success");
        executeSearch();
        if (activeTabPath) switchTab(activeTabPath);
      }
    }
  });

  // Command Palette (Ctrl+Shift+P / F1)
  const commandPaletteModal = document.getElementById("command-palette-modal");
  const commandPaletteInput = document.getElementById("command-palette-input");
  const commandPaletteResults = document.getElementById("command-palette-results");

  const commandsList = [
    { title: "File: New File", icon: "codicon-new-file", action: () => promptCreateFile() },
    { title: "File: New Folder", icon: "codicon-new-folder", action: () => promptCreateFolder() },
    { title: "File: Save File", icon: "codicon-save", action: () => activeTabPath && editorManager.onSaveCallback(activeTabPath, editorManager.getValue()) },
    { title: "File: Save All Files", icon: "codicon-save-all", action: () => openTabs.forEach(t => t.dirty && editorManager.onSaveCallback(t.path, editorManager.getValue())) },
    { title: "File: Close Active Tab", icon: "codicon-close", action: () => activeTabPath && closeTab(activeTabPath) },
    { title: "File: Close All Tabs", icon: "codicon-close-all", action: () => closeAllTabs() },
    { title: "Run: Run Current File in Terminal (F5)", icon: "codicon-play", action: () => runCurrentFile() },
    { title: "Git: Stage All Changes", icon: "codicon-add", action: () => document.getElementById("btn-git-stage-all")?.click() },
    { title: "Git: Commit Changes", icon: "codicon-check", action: () => document.getElementById("btn-git-commit")?.click() },
    { title: "Git: Push to Remote", icon: "codicon-cloud-upload", action: () => document.getElementById("btn-git-push")?.click() },
    { title: "Git: Pull from Remote", icon: "codicon-cloud-download", action: () => document.getElementById("btn-git-pull")?.click() },
    { title: "Git: Switch / Create Branch", icon: "codicon-git-branch", action: () => showBranchModal() },
    { title: "Terminal: New Terminal", icon: "codicon-add", action: () => terminalManager.createTerminal() },
    { title: "Terminal: Clear Active Terminal", icon: "codicon-clear-all", action: () => terminalManager.clearActive() },
    { title: "Terminal: Kill Active Terminal", icon: "codicon-trash", action: () => terminalManager.killActive() },
    { title: "Terminal: Toggle Terminal Panel", icon: "codicon-layout-panel", action: () => togglePanel() },
    { title: "Editor: Format Document", icon: "codicon-code", action: () => editorManager.formatDocument() },
    { title: "Editor: Toggle Word Wrap", icon: "codicon-word-wrap", action: () => editorManager.toggleWordWrap() },
    { title: "Editor: Toggle Minimap", icon: "codicon-map", action: () => editorManager.toggleMinimap() },
    { title: "Editor: Split / Diff Editor", icon: "codicon-split-horizontal", action: () => document.getElementById("btn-split-editor")?.click() },
    { title: "Preferences: Color Theme & Settings", icon: "codicon-settings-gear", action: () => settingsModal.classList.remove("hidden") },
    { title: "View: Toggle Primary Side Bar", icon: "codicon-layout-sidebar-left", action: () => document.getElementById("btn-toggle-sidebar")?.click() }
  ];

  function showCommandPalette() {
    commandPaletteModal.classList.remove("hidden");
    commandPaletteInput.value = "";
    commandPaletteInput.focus();
    renderCommandPaletteResults(commandsList);
  }

  function hideCommandPalette() {
    commandPaletteModal.classList.add("hidden");
  }

  commandPaletteInput?.addEventListener("input", () => {
    const q = commandPaletteInput.value.toLowerCase().trim();
    const filtered = commandsList.filter(c => c.title.toLowerCase().includes(q));
    renderCommandPaletteResults(filtered);
  });

  function renderCommandPaletteResults(list) {
    commandPaletteResults.innerHTML = "";
    list.forEach((cmd, idx) => {
      const item = document.createElement("div");
      item.className = `quick-item ${idx === 0 ? "selected" : ""}`;
      item.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <i class="codicon ${cmd.icon}"></i>
          <span>${cmd.title}</span>
        </div>
      `;
      item.addEventListener("click", () => {
        hideCommandPalette();
        cmd.action();
      });
      commandPaletteResults.appendChild(item);
    });
  }

  commandPaletteInput?.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideCommandPalette();
    if (e.key === "Enter") {
      const selected = commandPaletteResults.querySelector(".quick-item.selected");
      if (selected) selected.click();
    }
  });

  document.getElementById("btn-command-palette-trigger")?.addEventListener("click", showCommandPalette);

  // Quick Open Modal (Ctrl+P)
  const quickModal = document.getElementById("quick-open-modal");
  const quickInput = document.getElementById("quick-open-input");
  const quickResults = document.getElementById("quick-open-results");

  function showQuickOpen() {
    quickModal.classList.remove("hidden");
    quickInput.value = "";
    quickInput.focus();
    renderQuickResults(allFilesList);
  }

  function hideQuickOpen() {
    quickModal.classList.add("hidden");
  }

  quickInput?.addEventListener("input", () => {
    const filter = quickInput.value.toLowerCase().trim();
    const filtered = allFilesList.filter(f => f.path.toLowerCase().includes(filter));
    renderQuickResults(filtered);
  });

  function renderQuickResults(files) {
    quickResults.innerHTML = "";
    files.slice(0, 30).forEach((f, idx) => {
      const item = document.createElement("div");
      item.className = `quick-item ${idx === 0 ? "selected" : ""}`;
      item.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          ${getFileIconHtml(f.name, false)}
          <span>${f.name}</span>
        </div>
        <span style="color:#858585; font-size:11px;">${f.path}</span>
      `;
      item.addEventListener("click", () => {
        openFileTab(f.path, f.name);
        hideQuickOpen();
      });
      quickResults.appendChild(item);
    });
  }

  quickInput?.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideQuickOpen();
    if (e.key === "Enter") {
      const selected = quickResults.querySelector(".quick-item.selected");
      if (selected) selected.click();
    }
  });

  document.getElementById("titlebar-search")?.addEventListener("click", showQuickOpen);
  document.getElementById("btn-watermark-open-file")?.addEventListener("click", showQuickOpen);

  // Branch Switcher Modal
  const branchModal = document.getElementById("branch-modal");
  const branchInput = document.getElementById("branch-input");
  const branchResults = document.getElementById("branch-results");

  async function showBranchModal() {
    branchModal.classList.remove("hidden");
    branchInput.value = "";
    branchInput.focus();
    try {
      const res = await fetch("/api/git/branches");
      const data = await res.json();
      renderBranchResults(data.branches || []);
    } catch (e) {
      renderBranchResults([]);
    }
  }

  function renderBranchResults(branches) {
    branchResults.innerHTML = "";
    const filter = branchInput.value.toLowerCase().trim();
    const filtered = branches.filter(b => b.toLowerCase().includes(filter));

    if (filter && !branches.includes(filter)) {
      const createNew = document.createElement("div");
      createNew.className = "quick-item";
      createNew.innerHTML = `<i class="codicon codicon-add"></i> Create new branch: <b>${escapeHtml(filter)}</b>`;
      createNew.addEventListener("click", async () => {
        await checkoutBranch(filter, true);
        branchModal.classList.add("hidden");
      });
      branchResults.appendChild(createNew);
    }

    filtered.forEach((b, idx) => {
      const item = document.createElement("div");
      item.className = `quick-item ${idx === 0 ? "selected" : ""}`;
      item.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <i class="codicon codicon-git-branch"></i>
          <span>${escapeHtml(b)}</span>
        </div>
      `;
      item.addEventListener("click", async () => {
        await checkoutBranch(b, false);
        branchModal.classList.add("hidden");
      });
      branchResults.appendChild(item);
    });
  }

  async function checkoutBranch(branchName, create) {
    try {
      const res = await fetch("/api/git/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch: branchName, create })
      });
      if (res.ok) {
        showToast(`Switched to branch ${branchName}`, "success");
        await loadWorkspace();
        await loadTree();
        await updateGitStatus();
      } else {
        const err = await res.json();
        showToast(`Branch switch failed: ${err.error}`, "error");
      }
    } catch (e) {
      showToast(`Error: ${e.message}`, "error");
    }
  }

  branchInput?.addEventListener("input", () => {
    fetch("/api/git/branches").then(r => r.json()).then(d => renderBranchResults(d.branches || []));
  });

  branchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Escape") branchModal.classList.add("hidden");
  });

  document.getElementById("status-git-branch")?.addEventListener("click", showBranchModal);
  document.getElementById("btn-open-branch-modal")?.addEventListener("click", showBranchModal);
  document.getElementById("btn-git-new-branch")?.addEventListener("click", showBranchModal);

  // Settings & Theme Modal
  const settingsModal = document.getElementById("settings-modal");
  document.getElementById("btn-settings")?.addEventListener("click", () => {
    settingsModal.classList.remove("hidden");
  });
  document.getElementById("btn-toggle-aux-sidebar")?.addEventListener("click", () => {
    settingsModal.classList.remove("hidden");
  });
  document.getElementById("btn-close-settings")?.addEventListener("click", () => {
    settingsModal.classList.add("hidden");
  });

  document.querySelectorAll(".theme-option").forEach(opt => {
    opt.addEventListener("click", () => {
      applyTheme(opt.dataset.theme);
      settingsModal.classList.add("hidden");
      showToast(`Theme changed to ${opt.textContent}`, "info", 1500);
    });
  });

  document.getElementById("select-font-size")?.addEventListener("change", (e) => {
    editorManager.setFontSize(e.target.value);
  });
  document.getElementById("select-tab-size")?.addEventListener("change", (e) => {
    editorManager.setTabSize(e.target.value);
  });
  document.getElementById("select-word-wrap")?.addEventListener("change", (e) => {
    editorManager.setWordWrap(e.target.value);
  });
  document.getElementById("select-auto-save")?.addEventListener("change", (e) => {
    autoSaveMode = e.target.value;
    localStorage.setItem("vscode-lite-autosave", autoSaveMode);
  });

  // Bracket Pair Guides (Lines connecting matching brackets / braces)
  const bracketGuidesSelect = document.getElementById("select-bracket-guides");
  if (bracketGuidesSelect) {
    const savedGuides = localStorage.getItem("vscode-lite-bracket-guides") || "false";
    bracketGuidesSelect.value = savedGuides;
    bracketGuidesSelect.addEventListener("change", (e) => {
      localStorage.setItem("vscode-lite-bracket-guides", e.target.value);
      editorManager.setBracketGuides(e.target.value);
    });
  }

  // Bracket Pair Colorization
  const bracketColorSelect = document.getElementById("select-bracket-colorization");
  if (bracketColorSelect) {
    const savedColor = localStorage.getItem("vscode-lite-bracket-colorization") !== "false" ? "true" : "false";
    bracketColorSelect.value = savedColor;
    bracketColorSelect.addEventListener("change", (e) => {
      localStorage.setItem("vscode-lite-bracket-colorization", e.target.value);
      editorManager.setBracketColorization(e.target.value);
    });
  }

  // Mobile Touch Bars & Keypad (Editor bar + Terminal bar, shown by active view)
  const mobileBarEditor = document.getElementById("mobile-touch-bar-editor");
  const mobileBarTerminal = document.getElementById("mobile-touch-bar-terminal");

  document.getElementById("btn-mobile-keyboard-toggle")?.addEventListener("click", () => {
    const workbenchBody = document.querySelector(".workbench-body");
    const showTerminal = workbenchBody?.classList.contains("show-terminal");
    const bar = showTerminal ? mobileBarTerminal : mobileBarEditor;
    if (bar) {
      bar.classList.toggle("visible");
      if (bar.classList.contains("visible")) {
        (showTerminal ? mobileBarEditor : mobileBarTerminal)?.classList.remove("visible");
      }
    }
    editorManager.layout();
    terminalManager.fitActive();
  });

  // Track the real on-screen keyboard height via visualViewport and expose
  // it as --kb-offset so the touch bars and view-switch pill sit right
  // above the keyboard instead of being hidden below it. Falls back to
  // hiding the view-switch pill whenever either touch bar is visible, in
  // case visualViewport isn't supported.
  (function setupKeyboardOffset() {
    const root = document.documentElement;
    const viewSwitch = document.getElementById("mobile-view-switch");
    const vv = window.visualViewport;

    function anyTouchBarVisible() {
      return mobileBarEditor?.classList.contains("visible") || mobileBarTerminal?.classList.contains("visible");
    }

    let rafPending = false;
    function updateOffset() {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        let kbHeight = 0;
        if (vv) {
          kbHeight = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        }
        const current = parseFloat(getComputedStyle(root).getPropertyValue("--kb-offset")) || 0;
        if (Math.abs(current - kbHeight) >= 1) {
          root.style.setProperty("--kb-offset", `${kbHeight}px`);
        }
        const keyboardVisible = kbHeight > 60; // ignore small chrome UI shifts
        viewSwitch?.classList.toggle("keyboard-visible", keyboardVisible || anyTouchBarVisible());
      });
    }

    function syncViewSwitchVisibility() {
      const current = parseFloat(getComputedStyle(root).getPropertyValue("--kb-offset")) || 0;
      const keyboardVisible = current > 60;
      viewSwitch?.classList.toggle("keyboard-visible", keyboardVisible || anyTouchBarVisible());
    }

    if (vv) {
      vv.addEventListener("resize", updateOffset);
      vv.addEventListener("scroll", updateOffset);
    }
    // Re-check whenever a touch bar toggles, since the bar itself can be
    // shown/hidden independently of the keyboard (e.g. via the icon).
    // This runs synchronously (no rAF wait) since it's a discrete click,
    // not a high-frequency viewport event.
    document.getElementById("btn-mobile-keyboard-toggle")?.addEventListener("click", syncViewSwitchVisibility);
    updateOffset();
  })();

  // Editor symbol/key bar (unchanged: inserts text or sends Tab/Esc)
  mobileBarEditor?.querySelectorAll(".touch-key[data-insert], .touch-key[data-key]").forEach(btn => {
    // Prevent the button from stealing focus on tap — a focus shift away
    // from Monaco's hidden textarea is what dismisses the on-screen
    // keyboard. mousedown/pointerdown fires before focus changes, so
    // preventDefault() there keeps focus (and the keyboard) in place.
    btn.addEventListener("pointerdown", (e) => e.preventDefault());
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const insert = btn.dataset.insert;
      const key = btn.dataset.key;

      if (insert) {
        editorManager.insertText(insert);
      } else if (key) {
        if (key === "Tab") editorManager.insertText("    ");
        else terminalManager.sendKey(key);
      }
    });
  });

  document.getElementById("btn-touch-save")?.addEventListener("click", () => {
    if (activeTabPath) editorManager.onSaveCallback(activeTabPath, editorManager.getValue());
  });
  document.getElementById("btn-touch-run")?.addEventListener("click", runCurrentFile);

  // Terminal control bar — real key/escape-sequence behavior + toggleable Ctrl modifier
  let ctrlModifierActive = false;
  const btnTermCtrl = document.getElementById("btn-term-ctrl");

  function setCtrlModifier(active) {
    ctrlModifierActive = active;
    btnTermCtrl?.classList.toggle("ctrl-active", active);
  }

  btnTermCtrl?.addEventListener("pointerdown", (e) => e.preventDefault());
  btnTermCtrl?.addEventListener("click", (e) => {
    e.preventDefault();
    setCtrlModifier(!ctrlModifierActive);
  });

  mobileBarTerminal?.querySelectorAll(".touch-key[data-term-key], .touch-key[data-term-insert]").forEach(btn => {
    btn.addEventListener("pointerdown", (e) => e.preventDefault());
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const termKey = btn.dataset.termKey;
      const termInsert = btn.dataset.termInsert;

      if (termInsert) {
        if (ctrlModifierActive) {
          // Ctrl + punctuation isn't meaningful for most of these; just send the char.
          terminalManager.sendKey(termInsert);
          setCtrlModifier(false);
        } else {
          terminalManager.sendKey(termInsert);
        }
        return;
      }

      if (termKey) {
        terminalManager.sendKey(termKey);
      }
    });
  });

  // Any letter typed while Ctrl modifier is active gets sent as a real Ctrl+<letter>
  // combo to the terminal (handles cases beyond the quick ^C/^D/^Z/^L buttons).
  document.addEventListener("keydown", (e) => {
    if (!ctrlModifierActive) return;
    const workbenchBody = document.querySelector(".workbench-body");
    if (!workbenchBody?.classList.contains("show-terminal")) return;
    if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
      e.preventDefault();
      terminalManager.sendCtrlCombo(e.key);
      setCtrlModifier(false);
    }
  });

  // Mobile Viewport Handling (Handle on-screen keyboard resizing)
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => {
      editorManager.layout();
      terminalManager.fitActive();
    });
  }

  // Sidebar Toggling & Mobile Drawer
  const sidebarEl = document.getElementById("sidebar");
  const sidebarBackdrop = document.getElementById("sidebar-backdrop");

  function toggleMobileSidebar() {
    sidebarEl.classList.toggle("mobile-open");
    sidebarBackdrop.classList.toggle("mobile-open");
  }

  function closeMobileSidebar() {
    sidebarEl.classList.remove("mobile-open");
    sidebarBackdrop.classList.remove("mobile-open");
  }

  document.getElementById("btn-hamburger")?.addEventListener("click", toggleMobileSidebar);
  sidebarBackdrop?.addEventListener("click", closeMobileSidebar);

  document.getElementById("btn-toggle-sidebar")?.addEventListener("click", () => {
    if (window.innerWidth <= 768) {
      toggleMobileSidebar();
    } else {
      sidebarEl.classList.toggle("sidebar-hidden");
      const splitter = document.getElementById("splitter-h");
      if (splitter) splitter.style.display = sidebarEl.classList.contains("sidebar-hidden") ? "none" : "block";
      editorManager.layout();
    }
    document.getElementById("btn-toggle-sidebar")?.classList.toggle("active");
  });

  // Activity Bar Switcher
  const activityItems = document.querySelectorAll(".activitybar .activity-item[data-panel]");
  activityItems.forEach(item => {
    item.addEventListener("click", () => {
      activityItems.forEach(i => i.classList.remove("active"));
      item.classList.add("active");

      const panelName = item.dataset.panel;
      document.querySelectorAll(".sidebar-panel").forEach(p => p.classList.remove("active"));
      const targetPanel = document.getElementById(`panel-${panelName}`);
      if (targetPanel) targetPanel.classList.add("active");

      if (panelName === "extensions") loadRuntimes();
      if (panelName === "git") updateGitStatus();

      if (window.innerWidth <= 768) {
        sidebarEl.classList.add("mobile-open");
        sidebarBackdrop.classList.add("mobile-open");
      }
    });
  });

  // Panel Tabs Switching
  const panelTabs = document.querySelectorAll(".panel-tab");
  panelTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      panelTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      const target = tab.dataset.target;
      const termContainer = document.getElementById("terminal-container");
      const termSessionTabs = document.getElementById("terminal-session-tabs");

      document.querySelectorAll(".panel-view-content").forEach(v => v.style.display = "none");

      if (target === "terminal") {
        if (termContainer) termContainer.style.display = "block";
        if (termSessionTabs) termSessionTabs.style.display = "flex";
        terminalManager.fitActive();
      } else {
        if (termContainer) termContainer.style.display = "none";
        if (termSessionTabs) termSessionTabs.style.display = "none";
        const view = document.getElementById(`view-${target}`);
        if (view) view.style.display = "block";
        if (target === "ports") loadPorts();
      }
    });
  });

  // Bottom Panel Toggle & Maximize
  const bottomPanel = document.getElementById("bottom-panel");
  const splitterV = document.getElementById("splitter-v");
  let isPanelMaximized = false;
  let originalPanelHeight = "240px";

  function togglePanel() {
    bottomPanel.classList.toggle("hidden");
    document.getElementById("btn-toggle-panel")?.classList.toggle("active", !bottomPanel.classList.contains("hidden"));
    if (splitterV) splitterV.style.display = bottomPanel.classList.contains("hidden") ? "none" : "block";
    editorManager.layout();
    if (!bottomPanel.classList.contains("hidden")) {
      terminalManager.fitActive();
    }
  }

  document.getElementById("btn-toggle-panel")?.classList.add("active");
  document.getElementById("btn-toggle-panel")?.addEventListener("click", togglePanel);
  document.getElementById("btn-close-panel")?.addEventListener("click", togglePanel);

  // ── Mobile Full-Screen Swipe: Editor <-> Terminal ──────────────
  (function setupMobileSwipe() {
    const workbenchBody = document.querySelector(".workbench-body");
    const viewSwitch = document.getElementById("mobile-view-switch");
    const btnEditor = document.getElementById("btn-mobile-view-editor");
    const btnTerminal = document.getElementById("btn-mobile-view-terminal");
    if (!workbenchBody) return;

    const mq = window.matchMedia("(max-width: 768px)");
    let mobileView = "editor"; // "editor" | "terminal"

    function isMobile() { return mq.matches; }

    function applyView(view, opts = {}) {
      mobileView = view;
      workbenchBody.classList.toggle("show-terminal", view === "terminal");
      btnEditor?.classList.toggle("active", view === "editor");
      btnTerminal?.classList.toggle("active", view === "terminal");
      if (bottomPanel && bottomPanel.classList.contains("hidden")) {
        bottomPanel.classList.remove("hidden");
      }
      setTimeout(() => {
        editorManager.layout();
        if (view === "terminal") terminalManager.fitActive();
      }, 300);
    }

    // Auto-focus terminal input when the terminal pane comes into view so
    // the on-screen keyboard behaves sensibly without an extra tap.
    workbenchBody.addEventListener("transitionend", (e) => {
      if (e.target !== workbenchBody.querySelector(".panel")) return;
      if (isMobile() && mobileView === "terminal") {
        terminalManager.fitActive();
      }
    });

    function syncSwipeMode() {
      if (isMobile()) {
        workbenchBody.classList.add("mobile-swipe");
        applyView(mobileView);
      } else {
        workbenchBody.classList.remove("mobile-swipe", "show-terminal");
      }
    }

    mq.addEventListener("change", syncSwipeMode);
    syncSwipeMode();

    btnEditor?.addEventListener("click", () => { if (isMobile()) applyView("editor"); });
    btnTerminal?.addEventListener("click", () => { if (isMobile()) applyView("terminal"); });

    // Swipe gesture
    let touchStartX = 0, touchStartY = 0, touchTracking = false;
    const SWIPE_THRESHOLD = 60;
    const SWIPE_RESTRAINT = 80;

    workbenchBody.addEventListener("touchstart", (e) => {
      if (!isMobile()) return;
      if (e.touches.length !== 1) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchTracking = true;
    }, { passive: true });

    workbenchBody.addEventListener("touchend", (e) => {
      if (!isMobile() || !touchTracking) return;
      touchTracking = false;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      if (Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dy) <= SWIPE_RESTRAINT) {
        if (dx < 0 && mobileView === "editor") {
          applyView("terminal");
        } else if (dx > 0 && mobileView === "terminal") {
          applyView("editor");
        }
      }
    }, { passive: true });
  })();

  document.getElementById("btn-maximize-panel")?.addEventListener("click", () => {
    isPanelMaximized = !isPanelMaximized;
    if (isPanelMaximized) {
      originalPanelHeight = bottomPanel.style.height || "240px";
      bottomPanel.style.height = "calc(100vh - 100px)";
    } else {
      bottomPanel.style.height = originalPanelHeight;
    }
    editorManager.layout();
    terminalManager.fitActive();
  });

  // Splitters Dragging
  const splitterH = document.getElementById("splitter-h");
  let isDraggingH = false;

  splitterH?.addEventListener("mousedown", () => {
    isDraggingH = true;
    splitterH.classList.add("dragging");
    document.body.style.cursor = "col-resize";
  });

  let isDraggingV = false;
  splitterV?.addEventListener("mousedown", () => {
    isDraggingV = true;
    splitterV.classList.add("dragging");
    document.body.style.cursor = "row-resize";
  });

  window.addEventListener("mousemove", (e) => {
    if (isDraggingH) {
      const newWidth = Math.max(160, Math.min(600, e.clientX - 48));
      sidebarEl.style.width = `${newWidth}px`;
      editorManager.layout();
      terminalManager.fitActive();
    }
    if (isDraggingV) {
      const newHeight = Math.max(60, Math.min(window.innerHeight - 100, window.innerHeight - e.clientY - 22));
      bottomPanel.style.height = `${newHeight}px`;
      editorManager.layout();
      terminalManager.fitActive();
    }
  });

  window.addEventListener("mouseup", () => {
    if (isDraggingH) {
      isDraggingH = false;
      splitterH.classList.remove("dragging");
      document.body.style.cursor = "default";
      editorManager.layout();
    }
    if (isDraggingV) {
      isDraggingV = false;
      splitterV.classList.remove("dragging");
      document.body.style.cursor = "default";
      editorManager.layout();
      terminalManager.fitActive();
    }
  });

  // Terminal Buttons
  document.getElementById("btn-add-terminal")?.addEventListener("click", () => {
    terminalManager.createTerminal();
  });
  document.getElementById("btn-clear-terminal")?.addEventListener("click", () => {
    terminalManager.clearActive();
  });
  document.getElementById("btn-kill-terminal")?.addEventListener("click", () => {
    terminalManager.killActive();
  });

  // Explorer Context Menu Implementation
  const expContextMenu = document.getElementById("explorer-context-menu");
  const tabContextMenu = document.getElementById("tab-context-menu");

  function hideAllContextMenus() {
    expContextMenu?.classList.add("hidden");
    tabContextMenu?.classList.add("hidden");
  }

  window.addEventListener("click", hideAllContextMenus);

  function showExplorerContextMenu(x, y, path, isDir) {
    hideAllContextMenus();
    contextTarget = { path, isDir };

    const expRun = document.getElementById("ctx-exp-run");
    if (expRun) expRun.style.display = isDir ? "none" : "flex";

    expContextMenu.style.left = `${Math.min(x, window.innerWidth - 180)}px`;
    expContextMenu.style.top = `${Math.min(y, window.innerHeight - 250)}px`;
    expContextMenu.classList.remove("hidden");
  }

  function showTabContextMenu(x, y, path) {
    hideAllContextMenus();
    contextTarget = { path, isDir: false };

    tabContextMenu.style.left = `${Math.min(x, window.innerWidth - 180)}px`;
    tabContextMenu.style.top = `${Math.min(y, window.innerHeight - 200)}px`;
    tabContextMenu.classList.remove("hidden");
  }

  // Explorer Context Menu Actions
  document.getElementById("ctx-exp-run")?.addEventListener("click", () => {
    if (contextTarget.path) {
      openFileTab(contextTarget.path);
      setTimeout(() => runCurrentFile(), 150);
    }
  });

  document.getElementById("ctx-exp-new-file")?.addEventListener("click", () => {
    const parent = contextTarget.isDir ? contextTarget.path : "";
    promptCreateFile(parent);
  });

  document.getElementById("ctx-exp-new-folder")?.addEventListener("click", () => {
    const parent = contextTarget.isDir ? contextTarget.path : "";
    promptCreateFolder(parent);
  });

  document.getElementById("ctx-exp-rename")?.addEventListener("click", async () => {
    if (!contextTarget.path) return;
    const oldName = contextTarget.path.split("/").pop();
    const newName = prompt(`Rename ${oldName} to:`, oldName);
    if (!newName || newName === oldName) return;

    const parent = contextTarget.path.includes("/") ? contextTarget.path.substring(0, contextTarget.path.lastIndexOf("/")) : "";
    const newPath = parent ? `${parent}/${newName}` : newName;

    const res = await fetch("/api/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPath: contextTarget.path, newPath })
    });
    if (res.ok) {
      // Update open tabs
      openTabs.forEach(t => {
        if (t.path === contextTarget.path) {
          t.path = newPath;
          t.name = newName;
        }
      });
      if (activeTabPath === contextTarget.path) activeTabPath = newPath;
      await loadTree();
      renderTabs();
      showToast(`Renamed to ${newName}`, "success");
    }
  });

  document.getElementById("ctx-exp-duplicate")?.addEventListener("click", async () => {
    if (!contextTarget.path) return;
    const res = await fetch("/api/duplicate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: contextTarget.path })
    });
    if (res.ok) {
      const data = await res.json();
      await loadTree();
      openFileTab(data.newPath);
      showToast(`Duplicated file`, "success");
    }
  });

  document.getElementById("ctx-exp-copy-path")?.addEventListener("click", () => {
    if (contextTarget.path) {
      navigator.clipboard.writeText(contextTarget.path);
      showToast(`Copied path to clipboard`, "info", 1500);
    }
  });

  document.getElementById("ctx-exp-download")?.addEventListener("click", () => {
    if (contextTarget.path) {
      const link = document.createElement("a");
      link.href = `${API_BASE}/api/raw?path=${encodeURIComponent(contextTarget.path)}`;
      link.download = contextTarget.path.split("/").pop();
      link.click();
    }
  });

  document.getElementById("ctx-exp-delete")?.addEventListener("click", async () => {
    if (!contextTarget.path) return;
    if (confirm(`Are you sure you want to permanently delete "${contextTarget.path}"?`)) {
      const res = await fetch("/api/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: contextTarget.path })
      });
      if (res.ok) {
        closeTab(contextTarget.path);
        await loadTree();
        updateGitStatus();
        showToast(`Deleted ${contextTarget.path}`, "info");
      }
    }
  });

  // Tab Context Menu Actions
  document.getElementById("ctx-tab-close")?.addEventListener("click", () => {
    if (contextTarget.path) closeTab(contextTarget.path);
  });
  document.getElementById("ctx-tab-close-others")?.addEventListener("click", () => {
    if (contextTarget.path) closeOtherTabs(contextTarget.path);
  });
  document.getElementById("ctx-tab-close-right")?.addEventListener("click", () => {
    if (contextTarget.path) closeTabsToRight(contextTarget.path);
  });
  document.getElementById("ctx-tab-close-all")?.addEventListener("click", () => {
    closeAllTabs();
  });
  document.getElementById("ctx-tab-copy-path")?.addEventListener("click", () => {
    if (contextTarget.path) {
      navigator.clipboard.writeText(contextTarget.path);
      showToast(`Copied path to clipboard`, "info", 1500);
    }
  });

  // File Creation Helper
  async function promptCreateFile(parentDir = "") {
    const promptMsg = parentDir ? `New file in ${parentDir} (e.g. index.ts):` : "New file path (e.g. src/app.js):";
    const name = prompt(promptMsg);
    if (!name) return;
    const finalPath = parentDir ? `${parentDir}/${name}` : name;

    const res = await fetch("/api/create-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: finalPath })
    });
    if (res.ok) {
      await loadTree();
      openFileTab(finalPath, name.split("/").pop());
      showToast(`Created ${finalPath}`, "success");
    }
  }

  async function promptCreateFolder(parentDir = "") {
    const promptMsg = parentDir ? `New folder in ${parentDir}:` : "New folder path:";
    const name = prompt(promptMsg);
    if (!name) return;
    const finalPath = parentDir ? `${parentDir}/${name}` : name;

    const res = await fetch("/api/create-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: finalPath })
    });
    if (res.ok) {
      await loadTree();
      showToast(`Created folder ${finalPath}`, "success");
    }
  }

  document.getElementById("btn-new-file")?.addEventListener("click", () => promptCreateFile());
  document.getElementById("btn-watermark-new-file")?.addEventListener("click", () => promptCreateFile());
  document.getElementById("btn-new-folder")?.addEventListener("click", () => promptCreateFolder());

  document.getElementById("btn-refresh-tree")?.addEventListener("click", () => {
    loadTree();
    updateGitStatus();
  });

  document.getElementById("btn-collapse-all")?.addEventListener("click", () => {
    document.querySelectorAll(".tree-node[data-is-dir='true']").forEach(node => {
      node.classList.add("collapsed");
      const children = node.nextElementSibling;
      if (children && children.classList.contains("tree-children")) {
        children.style.display = "none";
      }
      const icon = node.querySelector(".node-icon");
      if (icon) icon.className = "codicon node-icon codicon-folder";
    });
  });

  // File Upload via File Picker or Drag & Drop
  const fileInput = document.getElementById("hidden-file-input");
  document.getElementById("btn-upload-file")?.addEventListener("click", () => {
    fileInput?.click();
  });

  fileInput?.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    await uploadFiles(files);
    fileInput.value = "";
  });

  // Drag and Drop Upload onto explorer tree
  const treeContainer = document.getElementById("explorer-tree-container");
  treeContainer?.addEventListener("dragover", (e) => {
    e.preventDefault();
    treeContainer.classList.add("drag-over");
  });
  treeContainer?.addEventListener("dragleave", () => {
    treeContainer.classList.remove("drag-over");
  });
  treeContainer?.addEventListener("drop", async (e) => {
    e.preventDefault();
    treeContainer.classList.remove("drag-over");
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await uploadFiles(files);
    }
  });

  async function uploadFiles(files) {
    showToast(`Uploading ${files.length} file(s)...`, "info");
    const payloadFiles = [];

    for (const file of files) {
      const reader = new FileReader();
      const base64Promise = new Promise((res) => {
        reader.onload = () => {
          const b64 = reader.result.split(",")[1];
          res(b64);
        };
        reader.readAsDataURL(file);
      });
      const b64 = await base64Promise;
      payloadFiles.push({ name: file.name, base64: b64 });
    }

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: payloadFiles })
      });
      if (res.ok) {
        showToast("Files uploaded successfully!", "success");
        await loadTree();
      }
    } catch (e) {
      showToast(`Upload error: ${e.message}`, "error");
    }
  }

  // Global Keyboard Shortcuts
  window.addEventListener("keydown", (e) => {
    // Ctrl+P / Cmd+P (Quick Open)
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "p") {
      e.preventDefault();
      showQuickOpen();
    }
    // Ctrl+Shift+P / Cmd+Shift+P / F1 (Command Palette)
    if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "p") || e.key === "F1") {
      e.preventDefault();
      showCommandPalette();
    }
    // Ctrl+` (Toggle Terminal)
    if ((e.ctrlKey || e.metaKey) && e.key === "`") {
      e.preventDefault();
      togglePanel();
    }
    // Ctrl+S / Cmd+S (Save)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (activeTabPath) editorManager.onSaveCallback(activeTabPath, editorManager.getValue());
    }
    // F5 (Run)
    if (e.key === "F5") {
      e.preventDefault();
      runCurrentFile();
    }
    // Escape (Close modals)
    if (e.key === "Escape") {
      hideQuickOpen();
      hideCommandPalette();
      branchModal?.classList.add("hidden");
      settingsModal?.classList.add("hidden");
      hideAllContextMenus();
    }
  });

  // Window Resize
  window.addEventListener("resize", () => {
    editorManager.layout();
    terminalManager.fitActive();
  });

  function escapeHtml(text) {
    return (text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Initial Data Load
  await loadWorkspace();
  await loadTree();
  await updateGitStatus();
  initFileWatcher(loadTree);
  await loadPorts();

  // Auto-open first file or README.md
  if (allFilesList.some(f => f.name.toLowerCase() === "readme.md")) {
    const readme = allFilesList.find(f => f.name.toLowerCase() === "readme.md");
    openFileTab(readme.path, readme.name);
  } else if (allFilesList.length > 0) {
    openFileTab(allFilesList[0].path, allFilesList[0].name);
  }
}

function initFileWatcher(loadTree) {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const wsBase = import.meta.env.VITE_WS_URL || (proto + "://" + location.hostname + (location.port ? ":" + location.port : ""));
  const wsUrl = wsBase.replace(/\/+$/, "") + "/ws/watch";
  let ws, reconnectTimer, debounceTimer;
  function connect() {
    ws = new WebSocket(wsUrl);
    ws.onopen = () => console.log("[FileWatcher] Connected:", wsUrl);
    ws.onmessage = ({ data }) => {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      if (msg.type !== "filechange") return;
      console.log("[FileWatcher] change received:", msg);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => loadTree(), 150);
    };
    ws.onclose = () => { clearTimeout(reconnectTimer); reconnectTimer = setTimeout(connect, 3000); };
    ws.onerror = () => ws.close();
  }
  connect();
}
