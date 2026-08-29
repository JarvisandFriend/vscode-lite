import { useEffect } from 'react';
import { bootApp } from './legacy/appLogic.js';

/**
 * This markup is a direct JSX port of the original VS Code Lite index.html.
 * It is intentionally left as one large component: all interactive behavior
 * still lives in src/legacy/*.js (ported from the original app.js /
 * editor.js / terminal.js) and is wired up imperatively via getElementById,
 * exactly as it was before. bootApp() runs once, after this markup has
 * mounted, so every element it looks up already exists in the DOM.
 *
 * See README.md for why it was kept this way instead of a full rewrite
 * into idiomatic React components.
 */
export default function App() {
  useEffect(() => {
    bootApp();
  }, []);

  return (
<>
  <div id="app">
      {/* Title Bar */}
      <header className="titlebar">
        <div className="titlebar-left">
          <button className="nav-arrow-btn" id="btn-hamburger" title="Toggle Primary Side Bar"><i className="codicon codicon-menu"></i></button>
          <button className="nav-arrow-btn" id="btn-nav-back" title="Go Back"><i className="codicon codicon-arrow-left"></i></button>
          <button className="nav-arrow-btn" id="btn-nav-forward" title="Go Forward"><i className="codicon codicon-arrow-right"></i></button>
        </div>

        <div className="titlebar-center" id="titlebar-search" title="Quick Open Files (Ctrl+P) / Command Palette (Ctrl+Shift+P)">
          <span className="titlebar-center-text" id="titlebar-workspace-display">VS Code Lite</span>
          <div className="titlebar-center-actions">
            <i className="codicon codicon-search search-icon"></i>
          </div>
        </div>

        <div className="titlebar-right">
          <button className="titlebar-action-btn" id="btn-quick-run" title="Run Current File (F5)"><i className="codicon codicon-play" style={{ color: '#23d18b' }}></i></button>
          <button className="titlebar-action-btn" id="btn-quick-save" title="Save File (Ctrl+S)"><i className="codicon codicon-save"></i></button>
          <button className="titlebar-action-btn" id="btn-command-palette-trigger" title="Command Palette (Ctrl+Shift+P)"><i className="codicon codicon-terminal"></i></button>
          <button className="titlebar-action-btn" id="btn-toggle-sidebar" title="Toggle Primary Side Bar"><i className="codicon codicon-layout-sidebar-left"></i></button>
          <button className="titlebar-action-btn active" id="btn-toggle-panel" title="Toggle Terminal Panel (Ctrl+`)"><i className="codicon codicon-layout-panel"></i></button>
          <button className="titlebar-action-btn" id="btn-toggle-aux-sidebar" title="Settings & Themes"><i className="codicon codicon-settings-gear"></i></button>
        </div>
      </header>

      {/* Main Workspace Container */}
      <div className="main-container">
        {/* Activity Bar (Leftmost) */}
        <aside className="activitybar" id="activitybar">
          <div className="activitybar-top">
            <div className="activity-item active" data-panel="explorer" title="Explorer (Ctrl+Shift+E)">
              <i className="codicon codicon-files"></i>
            </div>
            <div className="activity-item" data-panel="search" title="Search Workspace (Ctrl+Shift+F)">
              <i className="codicon codicon-search"></i>
            </div>
            <div className="activity-item" data-panel="git" title="Source Control (Ctrl+Shift+G)">
              <i className="codicon codicon-source-control"></i>
              <span className="badge git-badge" id="git-badge" style={{ display: 'none' }}>0</span>
            </div>
            <div className="activity-item" data-panel="debug" title="Run & Execute (Ctrl+Shift+D)">
              <i className="codicon codicon-debug-alt"></i>
            </div>
            <div className="activity-item" data-panel="extensions" title="Installed Runtimes">
              <i className="codicon codicon-extensions"></i>
            </div>
            <div className="activity-item" data-panel="github" title="Branches & Remote">
              <i className="codicon codicon-git-branch"></i>
            </div>
            <div className="activity-item" id="btn-mobile-keyboard-toggle" title="Toggle Mobile Keypad">
              <i className="codicon codicon-keyboard"></i>
            </div>
          </div>
          <div className="activitybar-bottom">
            <div className="activity-item" id="btn-settings" title="Settings & Themes">
              <i className="codicon codicon-settings-gear"></i>
            </div>
          </div>
        </aside>

        {/* Sidebar Overlay for Mobile */}
        <div className="sidebar-backdrop" id="sidebar-backdrop"></div>

        {/* Primary Sidebar */}
        <aside className="sidebar" id="sidebar">
          {/* Explorer Panel */}
          <div className="sidebar-panel active" id="panel-explorer">
            <div className="sidebar-header">
              <span className="sidebar-title">Explorer</span>
              <div className="sidebar-actions">
                <button className="action-btn" id="btn-new-file" title="New File"><i className="codicon codicon-new-file"></i></button>
                <button className="action-btn" id="btn-new-folder" title="New Folder"><i className="codicon codicon-new-folder"></i></button>
                <button className="action-btn" id="btn-upload-file" title="Upload Files"><i className="codicon codicon-cloud-upload"></i></button>
                <button className="action-btn" id="btn-refresh-tree" title="Refresh Explorer"><i className="codicon codicon-refresh"></i></button>
                <button className="action-btn" id="btn-collapse-all" title="Collapse All Folders"><i className="codicon codicon-collapse-all"></i></button>
              </div>
            </div>

            <div className="sidebar-section-header" id="explorer-workspace-header">
              <div className="section-title-wrap">
                <i className="codicon codicon-chevron-down section-chevron"></i>
                <span className="section-title" id="sidebar-workspace-name">WORKSPACE</span>
              </div>
              <div className="section-actions">
                <input type="file" id="hidden-file-input" multiple style={{ display: 'none' }} />
              </div>
            </div>

            <div className="sidebar-content" id="explorer-tree-container">
              <div id="explorer-tree"></div>
            </div>

            {/* Secondary Collapsible Sections */}
            <div className="sidebar-collapsible-section" id="section-outline">
              <div className="collapsible-header" id="btn-toggle-outline">
                <i className="codicon codicon-chevron-right section-chevron" id="chevron-outline"></i>
                <span>Outline (Code Symbols)</span>
              </div>
              <div className="collapsible-content" id="outline-content" style={{ display: 'none' }}></div>
            </div>

            <div className="sidebar-collapsible-section" id="section-timeline">
              <div className="collapsible-header" id="btn-toggle-timeline">
                <i className="codicon codicon-chevron-right section-chevron" id="chevron-timeline"></i>
                <span>Timeline (Git History)</span>
              </div>
              <div className="collapsible-content" id="timeline-content" style={{ display: 'none' }}></div>
            </div>
          </div>

          {/* Search Panel */}
          <div className="sidebar-panel" id="panel-search">
            <div className="sidebar-header">
              <span className="sidebar-title">Search & Replace</span>
              <div className="sidebar-actions">
                <button className="action-btn" id="btn-toggle-replace-box" title="Toggle Replace"><i className="codicon codicon-replace"></i></button>
                <button className="action-btn" id="btn-clear-search" title="Clear Search"><i className="codicon codicon-clear-all"></i></button>
              </div>
            </div>
            <div className="sidebar-content search-panel">
              <div className="search-input-box">
                <input type="text" id="search-input" placeholder="Search (Press Enter)" />
                <button className="search-opt-btn" id="btn-search-case" title="Match Case (Alt+C)">Aa</button>
                <button className="search-opt-btn" id="btn-search-word" title="Match Whole Word (Alt+W)">\b</button>
                <button className="search-opt-btn" id="btn-search-regex" title="Use Regular Expression (Alt+R)">.*</button>
              </div>
              <div className="search-input-box" id="replace-input-box" style={{ display: 'none' }}>
                <input type="text" id="replace-input" placeholder="Replace with..." />
                <button className="search-opt-btn" id="btn-exec-replace-all" title="Replace All Across Files"><i className="codicon codicon-replace-all"></i></button>
              </div>
              <div className="search-filter-box">
                <input type="text" id="search-files-filter" placeholder="files to include/exclude (e.g. *.ts, !*.spec.ts)" />
              </div>
              <div className="search-status-bar" id="search-status-text"></div>
              <div id="search-results" className="search-results-list"></div>
            </div>
          </div>

          {/* Git Source Control Panel */}
          <div className="sidebar-panel" id="panel-git">
            <div className="sidebar-header">
              <span className="sidebar-title">Source Control</span>
              <div className="sidebar-actions">
                <button className="action-btn" id="btn-git-stage-all" title="Stage All Changes"><i className="codicon codicon-add"></i></button>
                <button className="action-btn" id="btn-git-unstage-all" title="Unstage All Changes"><i className="codicon codicon-remove"></i></button>
                <button className="action-btn" id="btn-git-refresh-status" title="Refresh Git Status"><i className="codicon codicon-refresh"></i></button>
              </div>
            </div>
            <div className="sidebar-content git-panel">
              <div className="git-commit-box">
                <textarea className="git-input" id="git-commit-message" placeholder="Commit message (Ctrl+Enter to commit)"></textarea>
                <div className="git-btn-row">
                  <button className="btn-primary" id="btn-git-commit" style={{ flex: '1' }}>
                    <i className="codicon codicon-check"></i> Commit
                  </button>
                  <button className="btn-secondary" id="btn-git-sync" title="Sync / Push">
                    <i className="codicon codicon-sync"></i> Sync
                  </button>
                </div>
              </div>

              <div className="git-section-header">
                <span>Staged Changes</span>
                <span className="git-count-badge" id="git-staged-count">0</span>
              </div>
              <div id="git-staged-list" className="git-list-box"></div>

              <div className="git-section-header">
                <span>Changes</span>
                <span className="git-count-badge" id="git-changes-count">0</span>
              </div>
              <div id="git-changes-list" className="git-list-box"></div>
            </div>
          </div>

          {/* Run & Debug Panel */}
          <div className="sidebar-panel" id="panel-debug">
            <div className="sidebar-header">
              <span className="sidebar-title">Run & Execute</span>
            </div>
            <div className="sidebar-content placeholder-panel">
              <button className="btn-primary" id="btn-run-script-panel" style={{ width: '100%', justifyContent: 'center' }}>
                <i className="codicon codicon-play"></i> Run Current File (F5)
              </button>
              <div style={{ marginTop: '14px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Custom Command Runner</div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <input type="text" className="git-input" id="custom-exec-input" placeholder="e.g. pytest %f or node %f" style={{ minHeight: '32px', height: '32px', padding: '4px 8px' }} />
                <button className="btn-secondary" id="btn-custom-exec" style={{ padding: '4px 10px' }}>Run</button>
              </div>
              <div style={{ marginTop: '14px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                <code>%f</code> will be automatically replaced with the active file path.
              </div>
            </div>
          </div>

          {/* Extensions & Runtimes Panel */}
          <div className="sidebar-panel" id="panel-extensions">
            <div className="sidebar-header">
              <span className="sidebar-title">Installed Runtimes</span>
              <div className="sidebar-actions">
                <button className="action-btn" id="btn-refresh-runtimes" title="Refresh"><i className="codicon codicon-refresh"></i></button>
              </div>
            </div>
            <div className="sidebar-content placeholder-panel" id="runtimes-list">
              <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Detecting installed compilers & interpreters...</div>
            </div>
          </div>

          {/* GitHub / Branches Panel */}
          <div className="sidebar-panel" id="panel-github">
            <div className="sidebar-header">
              <span className="sidebar-title">Branches & Remote</span>
              <div className="sidebar-actions">
                <button className="action-btn" id="btn-git-fetch" title="Fetch Remote"><i className="codicon codicon-cloud-download"></i></button>
              </div>
            </div>
            <div className="sidebar-content placeholder-panel">
              <div id="github-info-box" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Current Branch: <b id="github-branch-display" style={{ color: 'var(--text-bright)' }}>main</b></div>
                <button className="btn-secondary" id="btn-open-branch-modal"><i className="codicon codicon-git-branch"></i> Switch Branch...</button>
                <button className="btn-secondary" id="btn-git-new-branch"><i className="codicon codicon-add"></i> Create New Branch...</button>
                <button className="btn-secondary" id="btn-git-pull"><i className="codicon codicon-cloud-download"></i> Pull from Origin</button>
                <button className="btn-secondary" id="btn-git-push"><i className="codicon codicon-cloud-upload"></i> Push to Origin</button>
              </div>
            </div>
          </div>
        </aside>

        {/* Horizontal Splitter */}
        <div className="splitter-h" id="splitter-h"></div>

        {/* Workbench Body (Tabs + Breadcrumbs + Editor + Panel) */}
        <main className="workbench-body">
          {/* Tabs Header Bar */}
          <div className="editor-header-bar">
            <div className="tabs-bar" id="tabs-bar"></div>
            <div className="tabs-actions">
              <button className="action-btn" id="btn-toggle-preview" title="Toggle Preview (Markdown / HTML)" style={{ display: 'none' }}><i className="codicon codicon-preview"></i></button>
              <button className="action-btn" id="btn-run-file" title="Run Current File in Terminal (F5)"><i className="codicon codicon-play" style={{ color: '#23d18b' }}></i></button>
              <button className="action-btn" id="btn-split-editor" title="Split / Diff View"><i className="codicon codicon-split-horizontal"></i></button>
              <button className="action-btn" id="btn-editor-more" title="More Editor Actions..."><i className="codicon codicon-more"></i></button>
            </div>
          </div>

          {/* Breadcrumbs Bar */}
          <div className="breadcrumbs-bar" id="breadcrumbs-bar">
            <span className="breadcrumb-item" id="breadcrumb-current-file">
              <i className="codicon codicon-file"></i>
              <span id="breadcrumb-text">No file open</span>
            </span>
          </div>

          {/* Editor Container */}
          <div className="editor-container">
            <div id="monaco-editor"></div>
            <div id="monaco-diff-editor" style={{ display: 'none' }}></div>

            {/* Markdown Preview Container */}
            <div id="markdown-preview-container" style={{ display: 'none' }}>
              <div className="preview-header-bar">
                <span className="preview-title"><i className="codicon codicon-markdown"></i> Markdown Preview</span>
                <div className="preview-actions">
                  <button className="btn-secondary" id="btn-markdown-edit" style={{ padding: '2px 8px', fontSize: '11px' }}><i className="codicon codicon-edit"></i> Edit Source</button>
                </div>
              </div>
              <div className="markdown-preview-scroll">
                <div className="markdown-body" id="markdown-preview-body"></div>
              </div>
            </div>

            {/* HTML Live Preview Container */}
            <div id="html-preview-container" style={{ display: 'none' }}>
              <div className="preview-header-bar">
                <span className="preview-title"><i className="codicon codicon-browser"></i> HTML Live Preview</span>
                <div className="preview-actions">
                  <button className="btn-secondary" id="btn-html-refresh" style={{ padding: '2px 8px', fontSize: '11px' }}><i className="codicon codicon-refresh"></i> Refresh</button>
                  <button className="btn-secondary" id="btn-html-external" style={{ padding: '2px 8px', fontSize: '11px' }}><i className="codicon codicon-link-external"></i> New Tab</button>
                  <button className="btn-secondary" id="btn-html-edit" style={{ padding: '2px 8px', fontSize: '11px' }}><i className="codicon codicon-edit"></i> Edit Source</button>
                </div>
              </div>
              <iframe id="html-preview-iframe" className="html-preview-frame" sandbox="allow-scripts allow-same-origin allow-forms allow-modals"></iframe>
            </div>

            {/* Image & Media Preview Viewer */}
            <div id="media-preview-container" style={{ display: 'none' }}>
              <div className="media-preview-content">
                <img id="media-preview-img" src="" alt="Media Preview" style={{ display: 'none' }} />
                <div id="media-preview-info" className="media-preview-info"></div>
              </div>
            </div>

            {/* Empty Editor Watermark */}
            <div className="empty-editor-watermark" id="editor-watermark">
              <i className="codicon codicon-vscode"></i>
              <div className="shortcuts-list">
                <div className="shortcut-item"><span>Command Palette</span> <kbd>Ctrl + Shift + P</kbd></div>
                <div className="shortcut-item"><span>Quick Open File</span> <kbd>Ctrl + P</kbd></div>
                <div className="shortcut-item"><span>Run File in Terminal</span> <kbd>F5</kbd></div>
                <div className="shortcut-item"><span>Toggle Terminal Panel</span> <kbd>Ctrl + `</kbd></div>
                <div className="shortcut-item"><span>Save File</span> <kbd>Ctrl + S</kbd></div>
                <div className="shortcut-item"><span>Find in File</span> <kbd>Ctrl + F</kbd></div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                <button className="btn-primary" id="btn-watermark-new-file">
                  <i className="codicon codicon-new-file"></i> New File
                </button>
                <button className="btn-secondary" id="btn-watermark-open-file">
                  <i className="codicon codicon-search"></i> Open File
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Touch Accessory Bar — Editor Symbols (shown in Editor view) */}
          <div className="mobile-touch-bar" id="mobile-touch-bar-editor">
            <button className="touch-key" data-key="Tab">Tab</button>
            <button className="touch-key" data-key="Esc">Esc</button>
            <button className="touch-key" data-insert="{">{'{'}</button>
            <button className="touch-key" data-insert="}">{'}'}</button>
            <button className="touch-key" data-insert="(">(</button>
            <button className="touch-key" data-insert=")">)</button>
            <button className="touch-key" data-insert="[">[</button>
            <button className="touch-key" data-insert="]">]</button>
            <button className="touch-key" data-insert="=">=</button>
            <button className="touch-key" data-insert=":">:</button>
            <button className="touch-key" data-insert=";">;</button>
            <button className="touch-key" data-insert="'">'</button>
            <button className="touch-key" data-insert='"'>"</button>
            <button className="touch-key" data-insert="`">`</button>
            <button className="touch-key" data-insert="|">|</button>
            <button className="touch-key" data-insert="~">~</button>
            <button className="touch-key" data-insert="&">&</button>
            <button className="touch-key" data-insert="-">-</button>
            <button className="touch-key" data-insert="_">_</button>
            <button className="touch-key" data-insert="/">/</button>
            <button className="touch-key" data-insert="\">\</button>
            <button className="touch-key touch-action-save" id="btn-touch-save"><i className="codicon codicon-save"></i> Save</button>
            <button className="touch-key touch-action-run" id="btn-touch-run"><i className="codicon codicon-play"></i> Run</button>
          </div>

          {/* Mobile View Switch (Editor <-> Terminal) */}
          <div className="mobile-view-switch" id="mobile-view-switch">
            <button className="mobile-view-switch-btn active" id="btn-mobile-view-editor">
              <i className="codicon codicon-file-code"></i> Editor
            </button>
            <button className="mobile-view-switch-btn" id="btn-mobile-view-terminal">
              <i className="codicon codicon-terminal"></i> Terminal
            </button>
          </div>

          {/* Vertical Splitter */}
          <div className="splitter-v" id="splitter-v"></div>

          {/* Bottom Panel (Terminal / Problems / Output / Ports) */}
          <div className="panel" id="bottom-panel">
            <div className="panel-header">
              <div className="panel-tabs">
                <div className="panel-tab" data-target="problems">Problems <span className="tab-badge" id="badge-problems" style={{ display: 'none', background: '#f14c4c' }}>0</span></div>
                <div className="panel-tab" data-target="output">Output</div>
                <div className="panel-tab" data-target="debug">Debug Console</div>
                <div className="panel-tab active" data-target="terminal">Terminal</div>
                <div className="panel-tab" data-target="ports">Ports <span className="tab-badge" id="ports-count">1</span></div>
              </div>

              {/* Terminal Session Tabs Switcher */}
              <div className="terminal-tab-group" id="terminal-session-tabs"></div>

              <div className="panel-actions">
                <div className="terminal-shell-badge" id="terminal-shell-name">
                  <i className="codicon codicon-terminal-bash"></i>
                  <span>bash</span>
                </div>
                <button className="action-btn" id="btn-add-terminal" title="New Terminal (Ctrl+Shift+`)"><i className="codicon codicon-add"></i></button>
                <button className="action-btn" id="btn-clear-terminal" title="Clear Terminal"><i className="codicon codicon-clear-all"></i></button>
                <button className="action-btn" id="btn-kill-terminal" title="Kill Terminal Session"><i className="codicon codicon-trash"></i></button>
                <div className="panel-actions-separator"></div>
                <button className="action-btn" id="btn-maximize-panel" title="Toggle Maximize Panel"><i className="codicon codicon-chevron-up"></i></button>
                <button className="action-btn" id="btn-close-panel" title="Close Panel"><i className="codicon codicon-close"></i></button>
              </div>
            </div>
            <div className="panel-content">
              <div className="terminal-container" id="terminal-container"></div>
              <div className="panel-view-content" id="view-problems" style={{ display: 'none', padding: '8px', overflowY: 'auto', height: '100%' }}>
                <div id="problems-list" style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                  <div style={{ color: 'var(--text-muted)', padding: '6px' }}>No problems detected in open files.</div>
                </div>
              </div>
              <div className="panel-view-content" id="view-output" style={{ display: 'none', padding: '12px', fontFamily: 'var(--font-code)', fontSize: '12px', color: 'var(--text-main)', overflowY: 'auto', height: '100%' }}>
                <pre id="output-log-text">[VS Code Lite Backend] Ready and monitoring workspace.</pre>
              </div>
              <div className="panel-view-content" id="view-debug" style={{ display: 'none', padding: '12px', color: 'var(--text-muted)' }}>
                <div>Interactive evaluation terminal ready. Press <b>Run Current File</b> (<kbd>F5</kbd>) or type commands below.</div>
              </div>
              <div className="panel-view-content" id="view-ports" style={{ display: 'none', padding: '12px', overflowY: 'auto', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: '600', fontSize: '12px' }}>Active Listening Ports</span>
                  <button className="btn-secondary" id="btn-refresh-ports" style={{ padding: '2px 8px', fontSize: '11px' }}><i className="codicon codicon-refresh"></i> Refresh</button>
                </div>
                <table style={{ width: '100%', textAlign: 'left', fontSize: '12px', borderCollapse: 'collapse' }} id="ports-table">
                  <thead>
                    <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '4px 8px' }}>Port</th>
                      <th style={{ padding: '4px 8px' }}>Protocol</th>
                      <th style={{ padding: '4px 8px' }}>Local Address</th>
                    </tr>
                  </thead>
                  <tbody id="ports-tbody"></tbody>
                </table>
              </div>
            </div>

            {/* Mobile Touch Accessory Bar — Terminal Controls (shown in Terminal view) */}
            <div className="mobile-touch-bar" id="mobile-touch-bar-terminal">
              <button className="touch-key touch-key-ctrl" id="btn-term-ctrl" data-term-mod="ctrl">Ctrl</button>
              <button className="touch-key" data-term-key="Tab">Tab</button>
              <button className="touch-key" data-term-key="Esc">Esc</button>
              <button className="touch-key" data-term-key="Left"><i className="codicon codicon-arrow-left"></i></button>
              <button className="touch-key" data-term-key="Up"><i className="codicon codicon-arrow-up"></i></button>
              <button className="touch-key" data-term-key="Down"><i className="codicon codicon-arrow-down"></i></button>
              <button className="touch-key" data-term-key="Right"><i className="codicon codicon-arrow-right"></i></button>
              <button className="touch-key" data-term-key="Ctrl-C">^C</button>
              <button className="touch-key" data-term-key="Ctrl-D">^D</button>
              <button className="touch-key" data-term-key="Ctrl-Z">^Z</button>
              <button className="touch-key" data-term-key="Ctrl-L">^L</button>
              <button className="touch-key" data-term-insert="-">-</button>
              <button className="touch-key" data-term-insert="/">/</button>
              <button className="touch-key" data-term-insert="|">|</button>
              <button className="touch-key" data-term-insert="~">~</button>
              <button className="touch-key" data-term-key="Enter">⏎ Enter</button>
            </div>
          </div>
        </main>
      </div>

      {/* Status Bar */}
      <footer className="statusbar">
        <div className="statusbar-left">
          <div className="status-item status-remote-badge" id="status-remote" title="Remote Linux Environment">
            <i className="codicon codicon-remote"></i>
            <span id="remote-badge-text">Local</span>
          </div>
          <div className="status-item" id="status-git-branch" title="Click to Switch Branch">
            <i className="codicon codicon-git-branch"></i>
            <span id="status-branch-name">main</span>
          </div>
          <div className="status-item status-diagnostics" id="status-diagnostics" title="Click to View Problems">
            <i className="codicon codicon-error" id="status-err-icon"></i> <span id="status-err-count">0</span>
            <i className="codicon codicon-warning" id="status-warn-icon"></i> <span id="status-warn-count">0</span>
          </div>
          <div className="status-item" id="status-broadcast" title="Click to View Active Ports">
            <i className="codicon codicon-radio-tower"></i> <span id="status-ports-count">1</span>
          </div>
        </div>

        <div className="statusbar-right">
          <div className="status-item" id="status-cursor" title="Click to Go to Line">Ln 1, Col 1</div>
          <div className="status-item" id="status-indent" title="Click to Change Indentation">Spaces: 4</div>
          <div className="status-item" id="status-encoding">UTF-8</div>
          <div className="status-item" id="status-eol">LF</div>
          <div className="status-item" id="status-language" title="Click to Change Language Mode">
            <i className="codicon codicon-symbol-misc" style={{ fontSize: '12px' }}></i>
            <span id="status-language-text">Plain Text</span>
          </div>
          <div className="status-item" id="status-notifications" title="Notifications">
            <i className="codicon codicon-bell"></i>
          </div>
        </div>
      </footer>

      {/* Command Palette Modal (Ctrl+Shift+P / F1) */}
      <div className="modal-overlay hidden" id="command-palette-modal">
        <div className="quick-open-modal">
          <div className="quick-open-header">
            <span className="quick-prefix">{'>'}</span>
            <input type="text" className="quick-open-input no-margin" id="command-palette-input" placeholder="Type a command to run..." />
          </div>
          <div className="quick-open-results" id="command-palette-results"></div>
        </div>
      </div>

      {/* Quick Open Modal (Ctrl+P) */}
      <div className="modal-overlay hidden" id="quick-open-modal">
        <div className="quick-open-modal">
          <input type="text" className="quick-open-input" id="quick-open-input" placeholder="Type the name of a file to open..." />
          <div className="quick-open-results" id="quick-open-results"></div>
        </div>
      </div>

      {/* Branch Switcher Modal */}
      <div className="modal-overlay hidden" id="branch-modal">
        <div className="quick-open-modal">
          <div style={{ padding: '10px 14px', fontWeight: '600', fontSize: '12px', borderBottom: '1px solid var(--border-color)' }}>
            Select a branch or create a new branch
          </div>
          <input type="text" className="quick-open-input" id="branch-input" placeholder="Filter branches or type new branch name..." />
          <div className="quick-open-results" id="branch-results"></div>
        </div>
      </div>

      {/* Settings / Theme Modal */}
      <div className="modal-overlay hidden" id="settings-modal">
        <div className="quick-open-modal settings-modal-box">
          <div className="settings-modal-header">
            <span style={{ fontWeight: '600', fontSize: '14px' }}>Workbench Settings & Themes</span>
            <i className="codicon codicon-close" id="btn-close-settings" style={{ cursor: 'pointer' }}></i>
          </div>
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
            <div>
              <div style={{ fontWeight: '600', fontSize: '12px', marginBottom: '6px' }}>Color Theme</div>
              <div className="theme-options-list">
                <div className="theme-option active" data-theme="theme-dark-modern">Obsidian Aurora (Default)</div>
                <div className="theme-option" data-theme="theme-dark-plus">Dark+ (Classic Dark)</div>
                <div className="theme-option" data-theme="theme-light-modern">Light Modern</div>
                <div className="theme-option" data-theme="theme-monokai">Monokai</div>
                <div className="theme-option" data-theme="theme-dracula">Dracula</div>
                <div className="theme-option" data-theme="theme-high-contrast">Dark High Contrast</div>
              </div>
            </div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '12px', marginBottom: '6px' }}>Editor Font Size</div>
              <select id="select-font-size" className="git-input" defaultValue="13" style={{ height: '32px', padding: '4px 8px' }}>
                <option value="11">11px</option>
                <option value="12">12px</option>
                <option value="13">13px (Default)</option>
                <option value="14">14px</option>
                <option value="15">15px</option>
                <option value="16">16px</option>
                <option value="18">18px</option>
              </select>
            </div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '12px', marginBottom: '6px' }}>Tab Indentation Size</div>
              <select id="select-tab-size" className="git-input" defaultValue="4" style={{ height: '32px', padding: '4px 8px' }}>
                <option value="2">2 Spaces</option>
                <option value="4">4 Spaces</option>
                <option value="8">8 Spaces</option>
              </select>
            </div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '12px', marginBottom: '6px' }}>Word Wrap</div>
              <select id="select-word-wrap" className="git-input" defaultValue="off" style={{ height: '32px', padding: '4px 8px' }}>
                <option value="off">Off</option>
                <option value="on">On</option>
              </select>
            </div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '12px', marginBottom: '6px' }}>Auto Save</div>
              <select id="select-auto-save" className="git-input" defaultValue="off" style={{ height: '32px', padding: '4px 8px' }}>
                <option value="off">Off (Manual Save with Ctrl+S)</option>
                <option value="afterDelay">After 1 Second Delay</option>
                <option value="onFocusChange">On Window Focus Change</option>
              </select>
            </div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '12px', marginBottom: '6px' }}>Bracket Pair Guides (Connecting Lines)</div>
              <select id="select-bracket-guides" className="git-input" defaultValue="false" style={{ height: '32px', padding: '4px 8px' }}>
                <option value="false">Disabled / Off (No lines)</option>
                <option value="active">Active Only (Lines on cursor bracket)</option>
                <option value="true">Always On (All matching brackets)</option>
              </select>
            </div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '12px', marginBottom: '6px' }}>Bracket Pair Colorization</div>
              <select id="select-bracket-colorization" className="git-input" defaultValue="true" style={{ height: '32px', padding: '4px 8px' }}>
                <option value="true">Enabled (Colorize matching brackets)</option>
                <option value="false">Disabled (Standard bracket color)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Generic Confirmation Modal */}
      <div className="modal-overlay hidden" id="confirm-modal">
        <div className="quick-open-modal" style={{ width: '420px', padding: '18px' }}>
          <div id="confirm-modal-title" style={{ fontWeight: '600', fontSize: '14px', marginBottom: '8px' }}>Confirmation</div>
          <div id="confirm-modal-message" style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Are you sure?</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button className="btn-secondary" id="btn-confirm-cancel">Cancel</button>
            <button className="btn-primary" id="btn-confirm-ok" style={{ background: '#f14c4c' }}>Delete</button>
          </div>
        </div>
      </div>

      {/* Explorer Context Menu */}
      <div className="context-menu hidden" id="explorer-context-menu">
        <div className="context-item" id="ctx-exp-run"><i className="codicon codicon-play" style={{ color: '#23d18b' }}></i> Run in Terminal</div>
        <div className="context-separator"></div>
        <div className="context-item" id="ctx-exp-new-file"><i className="codicon codicon-new-file"></i> New File</div>
        <div className="context-item" id="ctx-exp-new-folder"><i className="codicon codicon-new-folder"></i> New Folder</div>
        <div className="context-separator"></div>
        <div className="context-item" id="ctx-exp-rename"><i className="codicon codicon-edit"></i> Rename...</div>
        <div className="context-item" id="ctx-exp-duplicate"><i className="codicon codicon-files"></i> Duplicate</div>
        <div className="context-item" id="ctx-exp-copy-path"><i className="codicon codicon-copy"></i> Copy Path</div>
        <div className="context-item" id="ctx-exp-download"><i className="codicon codicon-cloud-download"></i> Download File</div>
        <div className="context-separator"></div>
        <div className="context-item" id="ctx-exp-delete" style={{ color: '#f14c4c' }}><i className="codicon codicon-trash"></i> Delete</div>
      </div>

      {/* Tab Context Menu */}
      <div className="context-menu hidden" id="tab-context-menu">
        <div className="context-item" id="ctx-tab-close"><i className="codicon codicon-close"></i> Close</div>
        <div className="context-item" id="ctx-tab-close-others"><i className="codicon codicon-close-all"></i> Close Others</div>
        <div className="context-item" id="ctx-tab-close-right"><i className="codicon codicon-arrow-right"></i> Close to the Right</div>
        <div className="context-item" id="ctx-tab-close-all"><i className="codicon codicon-trash"></i> Close All</div>
        <div className="context-separator"></div>
        <div className="context-item" id="ctx-tab-copy-path"><i className="codicon codicon-copy"></i> Copy Path</div>
      </div>

      {/* Toast Notifications Area */}
      <div className="notifications-container" id="notifications-container"></div>
    </div>
</>
  );
}
