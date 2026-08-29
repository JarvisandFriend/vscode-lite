import * as monaco from 'monaco-editor';

class EditorManager {
  constructor(editorContainerId, diffContainerId) {
    this.container = document.getElementById(editorContainerId);
    this.diffContainer = document.getElementById(diffContainerId);
    this.mediaContainer = document.getElementById("media-preview-container");
    this.mediaImg = document.getElementById("media-preview-img");
    this.mediaInfo = document.getElementById("media-preview-info");
    this.markdownContainer = document.getElementById("markdown-preview-container");
    this.markdownBody = document.getElementById("markdown-preview-body");
    this.htmlContainer = document.getElementById("html-preview-container");
    this.htmlIframe = document.getElementById("html-preview-iframe");

    this.editor = null;
    this.diffEditor = null;
    this.models = new Map(); // path -> monaco.editor.ITextModel
    this.activePath = null;
    this.onSaveCallback = null;
    this.onDirtyChangeCallback = null;
    this.onProblemsChangeCallback = null;
    this.isDiffActive = false;
    this.isPreviewActive = false;
    this.previewType = null; // 'markdown' | 'html' | null
    this.isWordWrapOn = false;
    this.isMinimapOn = true;
    this.fontSize = window.innerWidth <= 768 ? 16 : 13;
    this.tabSize = 4;
    this.syntaxCheckTimeout = null;
  }

  async init() {
        // 1. Obsidian Aurora (Default Rebrand)
        monaco.editor.defineTheme("vscode-dark-modern", {
          base: "vs-dark",
          inherit: true,
          rules: [
            { token: "keyword", foreground: "a78bfa" },
            { token: "keyword.control", foreground: "a78bfa" },
            { token: "comment", foreground: "546e8a", fontStyle: "italic" },
            { token: "string", foreground: "86efac" },
            { token: "number", foreground: "fbbf24" },
            { token: "type", foreground: "67e8f9" },
            { token: "type.identifier", foreground: "67e8f9" },
            { token: "function", foreground: "f9a8d4" },
            { token: "entity.name.function", foreground: "f9a8d4" },
            { token: "variable", foreground: "93c5fd" },
            { token: "variable.parameter", foreground: "93c5fd" },
            { token: "delimiter", foreground: "94a3b8" },
            { token: "operator", foreground: "f472b6" },
            { token: "tag", foreground: "818cf8" },
            { token: "attribute.name", foreground: "67e8f9" },
            { token: "attribute.value", foreground: "86efac" }
          ],
          colors: {
            "editor.background": "#111622",
            "editor.foreground": "#cbd5e1",
            "editor.lineHighlightBackground": "#161d2e",
            "editorLineNumber.foreground": "#4a5568",
            "editorLineNumber.activeForeground": "#94a3b8",
            "editorCursor.foreground": "#a78bfa",
            "editorWhitespace.foreground": "#1e293b",
            "editorIndentGuide.background1": "#1e293b",
            "editorIndentGuide.activeBackground1": "#475569",
            "editor.selectionBackground": "#2e1e6b55",
            "editor.inactiveSelectionBackground": "#1e293b",
            "minimap.background": "#0e131d",
            "editorBracketMatch.background": "#4f46e533",
            "editorBracketMatch.border": "#6366f1"
          }
        });

        // 2. Light Modern
        monaco.editor.defineTheme("vscode-light-modern", {
          base: "vs",
          inherit: true,
          rules: [],
          colors: {
            "editor.background": "#ffffff",
            "editor.foreground": "#000000",
            "editor.lineHighlightBackground": "#f5f5f5",
            "editorLineNumber.foreground": "#747474"
          }
        });

        // 3. Monokai
        monaco.editor.defineTheme("vscode-monokai", {
          base: "vs-dark",
          inherit: true,
          rules: [
            { token: "keyword", foreground: "F92672" },
            { token: "string", foreground: "E6DB74" },
            { token: "function", foreground: "A6E22E" },
            { token: "comment", foreground: "75715E", fontStyle: "italic" },
            { token: "number", foreground: "AE81FF" },
            { token: "type", foreground: "66D9EF" }
          ],
          colors: {
            "editor.background": "#272822",
            "editor.foreground": "#F8F8F2",
            "editor.lineHighlightBackground": "#3E3D32",
            "editor.selectionBackground": "#49483E"
          }
        });

        // 4. Dracula
        monaco.editor.defineTheme("vscode-dracula", {
          base: "vs-dark",
          inherit: true,
          rules: [
            { token: "keyword", foreground: "FF79C6" },
            { token: "string", foreground: "F1FA8C" },
            { token: "function", foreground: "50FA7B" },
            { token: "comment", foreground: "6272A4", fontStyle: "italic" },
            { token: "number", foreground: "BD93F9" },
            { token: "type", foreground: "8BE9FD" }
          ],
          colors: {
            "editor.background": "#282a36",
            "editor.foreground": "#f8f8f2",
            "editor.lineHighlightBackground": "#44475a",
            "editor.selectionBackground": "#44475a"
          }
        });

        // Bracket Pair Guides & Colorization Preferences
        const savedGuides = localStorage.getItem("vscode-lite-bracket-guides") || "false";
        let bracketPairsVal = false;
        if (savedGuides === "true") bracketPairsVal = true;
        else if (savedGuides === "active") bracketPairsVal = "active";

        const savedColorization = localStorage.getItem("vscode-lite-bracket-colorization") !== "false";

        // Create Main Monaco Editor
        this.editor = monaco.editor.create(this.container, {
          theme: "vscode-dark-modern",
          automaticLayout: true,
          fontSize: this.fontSize,
          fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
          fontWeight: window.innerWidth <= 768 ? "600" : "normal",
          fontLigatures: true,
          lineHeight: 20,
          minimap: { enabled: this.isMinimapOn, side: "right" },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          renderLineHighlight: "all",
          bracketPairColorization: { enabled: savedColorization },
          guides: {
            bracketPairs: bracketPairsVal,
            bracketPairsHorizontal: bracketPairsVal,
            indentation: true
          },
          formatOnPaste: true,
          tabSize: this.tabSize,
          insertSpaces: true,
          wordWrap: this.isWordWrapOn ? "on" : "off",
          readOnly: false,
          folding: true,
          contextmenu: true
        });

        // Create Monaco Diff Editor
        this.diffEditor = monaco.editor.createDiffEditor(this.diffContainer, {
          theme: "vscode-dark-modern",
          automaticLayout: true,
          fontSize: this.fontSize,
          fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
          fontWeight: window.innerWidth <= 768 ? "600" : "normal",
          readOnly: true,
          renderSideBySide: true,
          scrollBeyondLastLine: false
        });

        // Listen for cursor position changes (Status Bar update)
        this.editor.onDidChangeCursorPosition((e) => {
          const pos = e.position;
          const statusEl = document.getElementById("status-cursor-pos");
          if (statusEl) {
            statusEl.textContent = `Ln ${pos.lineNumber}, Col ${pos.column}`;
          }
        });

        // Listen for content changes (dirty flag, auto preview update & syntax check)
        this.editor.onDidChangeModelContent(() => {
          if (this.activePath && this.onDirtyChangeCallback) {
            this.onDirtyChangeCallback(this.activePath, true);
          }
          if (this.isPreviewActive) {
            if (this.previewDebounceTimeout) clearTimeout(this.previewDebounceTimeout);
            this.previewDebounceTimeout = setTimeout(() => {
              if (this.previewType === "markdown") {
                this.renderMarkdown(this.editor.getValue());
              } else if (this.previewType === "html") {
                this.renderHtmlDoc(this.editor.getValue());
              }
            }, 150);
          }
          if (this.syntaxCheckTimeout) clearTimeout(this.syntaxCheckTimeout);
          this.syntaxCheckTimeout = setTimeout(() => {
            if (this.activePath && this.editor) {
              this.checkSyntaxForModel(this.editor.getModel(), this.activePath);
            }
          }, 350);
        });

        // Listen for diagnostics markers (Problems)
        monaco.editor.onDidChangeMarkers(() => {
          if (this.onProblemsChangeCallback) {
            const markers = monaco.editor.getModelMarkers({});
            this.onProblemsChangeCallback(markers);
          }
        });

        // Shortcut: Ctrl+S (Save)
        this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
          if (this.activePath && this.onSaveCallback) {
            this.onSaveCallback(this.activePath, this.editor.getValue());
          }
        });

        // Shortcut: F5 (Run)
        this.editor.addCommand(monaco.KeyCode.F5, () => {
          const runBtn = document.getElementById("btn-run-file");
          if (runBtn) runBtn.click();
        });

        // Shortcut: Ctrl+Shift+P (Command Palette)
        this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP, () => {
          const trigger = document.getElementById("btn-command-palette-trigger");
          if (trigger) trigger.click();
        });

  }

  async checkSyntaxForModel(model, filePath) {
    if (!model || !filePath || !monaco) return;
    const content = model.getValue();
    const ext = (filePath || "").split(".").pop().toLowerCase();
    if (["py", "python", "pyw", "sh", "bash", "zsh", "json", "jsonc"].includes(ext)) {
      try {
        const res = await fetch("/api/check-syntax", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: filePath, content, language: ext })
        });
        const data = await res.json();
        if (data && data.markers && monaco) {
          monaco.editor.setModelMarkers(model, "syntax-pipeline", data.markers);
        }
      } catch (e) {}
    }
  }

  setTheme(themeName) {
    if (!monaco || !monaco.editor) return;
    if (themeName === "theme-light-modern") {
      monaco.editor.setTheme("vscode-light-modern");
    } else if (themeName === "theme-monokai") {
      monaco.editor.setTheme("vscode-monokai");
    } else if (themeName === "theme-dracula") {
      monaco.editor.setTheme("vscode-dracula");
    } else if (themeName === "theme-high-contrast") {
      monaco.editor.setTheme("hc-black");
    } else if (themeName === "theme-dark-plus") {
      monaco.editor.setTheme("vs-dark");
    } else {
      monaco.editor.setTheme("vscode-dark-modern");
    }
  }

  getLanguageFromPath(filePath) {
    const ext = (filePath || "").split(".").pop().toLowerCase();
    const map = {
      js: "javascript", mjs: "javascript", cjs: "javascript",
      ts: "typescript", mts: "typescript", cts: "typescript",
      jsx: "javascript", tsx: "typescript",
      html: "html", htm: "html",
      css: "css", scss: "scss", less: "less",
      json: "json", jsonc: "json",
      py: "python", pyw: "python",
      sh: "shell", bash: "shell", zsh: "shell",
      c: "c", h: "c", cpp: "cpp", hpp: "cpp", cc: "cpp",
      rs: "rust",
      go: "go",
      java: "java",
      md: "markdown", markdown: "markdown",
      yml: "yaml", yaml: "yaml",
      xml: "xml", svg: "xml",
      sql: "sql",
      dockerfile: "dockerfile",
      env: "ini", ini: "ini",
      php: "php",
      rb: "ruby"
    };
    return map[ext] || "plaintext";
  }

  openFile(filePath, content, initialPreview = false) {
    this.hideDiff();
    this.hideMedia();
    this.hidePreviews();
    this.activePath = filePath;

    let model = this.models.get(filePath);
    if (!model) {
      const language = this.getLanguageFromPath(filePath);
      const uri = monaco.Uri.file(filePath);
      model = monaco.editor.getModel(uri) || monaco.editor.createModel(content || "", language, uri);
      this.models.set(filePath, model);
    } else if (content !== undefined && model.getValue() !== content) {
      model.setValue(content);
    }

    this.editor.setModel(model);
    const fileText = content !== undefined ? content : model.getValue();
    const ext = (filePath || "").split(".").pop().toLowerCase();

    // Trigger syntax check
    this.checkSyntaxForModel(model, filePath);

    // Auto preview on initial opening for markdown & html
    const previewBtn = document.getElementById("btn-toggle-preview");
    if (["md", "markdown"].includes(ext)) {
      if (previewBtn) {
        previewBtn.style.display = "inline-flex";
        previewBtn.title = "Toggle Markdown Preview";
      }
      if (initialPreview) {
        this.showMarkdownPreview(filePath, fileText);
        return;
      }
    } else if (["html", "htm"].includes(ext)) {
      if (previewBtn) {
        previewBtn.style.display = "inline-flex";
        previewBtn.title = "Toggle HTML Live Preview";
      }
      if (initialPreview) {
        this.showHtmlPreview(filePath, fileText);
        return;
      }
    } else {
      if (previewBtn) previewBtn.style.display = "none";
    }

    this.container.style.display = "block";
    this.editor.layout();
    this.editor.focus();

    // Update status bar language
    const lang = model.getLanguageId();
    const langEl = document.getElementById("status-language-text");
    if (langEl) {
      langEl.textContent = lang === "python" ? "Python" : lang.charAt(0).toUpperCase() + lang.slice(1);
    }

    // Hide watermark
    const watermark = document.getElementById("editor-watermark");
    if (watermark) watermark.style.display = "none";
  }

  showMarkdownPreview(filePath, content) {
    this.hideDiff();
    this.hideMedia();
    this.isPreviewActive = true;
    this.previewType = "markdown";
    this.container.style.display = "none";

    if (this.htmlContainer) this.htmlContainer.style.display = "none";
    if (this.markdownContainer) {
      this.markdownContainer.style.display = "flex";
      this.renderMarkdown(content || this.editor?.getValue() || "");
    }
    const watermark = document.getElementById("editor-watermark");
    if (watermark) watermark.style.display = "none";
  }

  showHtmlPreview(filePath, content) {
    this.hideDiff();
    this.hideMedia();
    this.isPreviewActive = true;
    this.previewType = "html";
    this.container.style.display = "none";

    if (this.markdownContainer) this.markdownContainer.style.display = "none";
    if (this.htmlContainer) {
      this.htmlContainer.style.display = "flex";
      this.renderHtmlDoc(content || this.editor?.getValue() || "");
    }
    const watermark = document.getElementById("editor-watermark");
    if (watermark) watermark.style.display = "none";
  }

  renderHtmlDoc(htmlContent) {
    if (this.htmlIframe) {
      this.htmlIframe.srcdoc = htmlContent || "";
    }
  }

  colorizeCode(code, lang) {
    if (!code) return "";
    const language = (lang || "").toLowerCase();
    let escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Syntax highlighting for code blocks
    if (["js", "javascript", "ts", "typescript", "jsx", "tsx", "json", "jsonc", "py", "python", "sh", "bash", "zsh", "html", "htm", "xml", "css", "scss", "sql", "c", "cpp", "rs", "rust", "go", "java", "yml", "yaml"].includes(language)) {
      const comments = [];
      escaped = escaped.replace(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*|<!--[\s\S]*?-->)/g, (m) => {
        const id = `__MDCOMM_${comments.length}__`;
        comments.push(`<span class="token-comment">${m}</span>`);
        return id;
      });

      const strings = [];
      escaped = escaped.replace(/("(\\"|[^"])*"|'(\\'|[^'])*'|`(\\`|[^`])*`)/g, (m) => {
        const id = `__MDSTR_${strings.length}__`;
        strings.push(`<span class="token-string">${m}</span>`);
        return id;
      });

      escaped = escaped.replace(/\b(\d+(\.\d+)?|\b0x[0-9a-fA-F]+)\b/g, '<span class="token-number">$1</span>');

      const kw = "\\b(function|def|class|return|if|else|elif|for|while|import|from|as|export|default|const|let|var|new|typeof|instanceof|this|self|async|await|try|catch|finally|throw|extends|implements|public|private|protected|interface|type|struct|enum|fn|match|pub|use|package|func|select|insert|update|delete|where|table|null|true|false|nil|None|True|False)\\b";
      escaped = escaped.replace(new RegExp(kw, "g"), '<span class="token-keyword">$1</span>');

      const types = "\\b(string|number|boolean|any|void|int|float|double|char|bool|list|dict|tuple|set|Array|Object|String|Number|Boolean|Promise|Map|Set|console|document|window|process)\\b";
      escaped = escaped.replace(new RegExp(types, "g"), '<span class="token-type">$1</span>');

      escaped = escaped.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\s*\()/g, '<span class="token-function">$1</span>');

      if (["html", "htm", "xml", "jsx", "tsx", "svg"].includes(language)) {
        escaped = escaped.replace(/(&lt;\/?)([a-zA-Z0-9_-]+)/g, '$1<span class="token-tag">$2</span>');
        escaped = escaped.replace(/([a-zA-Z0-9_-]+)=/g, '<span class="token-attr">$1</span>=');
      }

      strings.forEach((s, idx) => {
        escaped = escaped.replace(`__MDSTR_${idx}__`, s);
      });
      comments.forEach((c, idx) => {
        escaped = escaped.replace(`__MDCOMM_${idx}__`, c);
      });
    }

    return escaped;
  }

  renderMarkdown(markdownText) {
    if (!this.markdownBody) return;
    let html = markdownText || "";

    // Syntax-highlighted code blocks
    const codeBlocks = [];
    html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const highlighted = this.colorizeCode(code, lang);
      const idx = codeBlocks.length;
      codeBlocks.push(`<div class="md-code-block"><div class="md-code-lang">${lang || "code"}</div><pre><code class="language-${lang || "text"}">${highlighted}</code></pre></div>`);
      return `@@@CODEBLOCK_${idx}@@@`;
    });

    // Inline code
    const inlineCodes = [];
    html = html.replace(/`([^`]+)`/g, (match, code) => {
      const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const idx = inlineCodes.length;
      inlineCodes.push(`<code>${escaped}</code>`);
      return `@@@INLINECODE_${idx}@@@`;
    });

    // Headings
    html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

    // Blockquotes
    html = html.replace(/^\>\s+(.+)$/gm, '<blockquote>$1</blockquote>');

    // Horizontal Rule
    html = html.replace(/^---$/gm, '<hr>');

    // Bold, Italic, Strikethrough
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)*/g, '<em>$1</em>');
    html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');

    // Links & Images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%; border-radius:4px;">');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Tables
    html = html.replace(/((?:\|[^\n]+\|\r?\n)+)/g, (match) => {
      const rows = match.trim().split('\n').map(r => r.trim()).filter(Boolean);
      if (rows.length < 2) return match;
      let tableHtml = '<div class="md-table-wrap"><table class="md-table">';
      rows.forEach((row, rIdx) => {
        if (rIdx === 1 && row.includes('---')) return; // separator
        const cells = row.split('|').slice(1, -1).map(c => c.trim());
        const tag = rIdx === 0 ? 'th' : 'td';
        tableHtml += '<tr>' + cells.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
      });
      tableHtml += '</table></div>';
      return tableHtml;
    });

    // Unordered Lists
    html = html.replace(/^[-*]\s+\[ \]\s+(.+)$/gm, '<li class="task-item"><input type="checkbox" disabled> $1</li>');
    html = html.replace(/^[-*]\s+\[x\]\s+(.+)$/gm, '<li class="task-item"><input type="checkbox" checked disabled> $1</li>');
    html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');

    // Ordered Lists
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

    // Wrap continuous li in ul
    html = html.replace(/((?:<li[\s\S]*?<\/li>\s*)+)/g, '<ul>$1</ul>');

    // Paragraphs
    html = html.split('\n\n').map(p => {
      p = p.trim();
      if (!p) return '';
      if (p.startsWith('<h') || p.startsWith('<pre') || p.startsWith('<div') || p.startsWith('<ul') || p.startsWith('<blockquote') || p.startsWith('<hr')) {
        return p;
      }
      return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');

    // Restore code blocks & inline codes
    inlineCodes.forEach((code, idx) => {
      html = html.replace(`@@@INLINECODE_${idx}@@@`, code);
    });
    codeBlocks.forEach((code, idx) => {
      html = html.replace(`@@@CODEBLOCK_${idx}@@@`, code);
    });

    this.markdownBody.innerHTML = html;
  }

  togglePreview() {
    if (this.isPreviewActive) {
      this.hidePreviews();
      this.container.style.display = "block";
      this.editor.layout();
      this.editor.focus();
    } else {
      if (!this.activePath) return;
      const ext = (this.activePath || "").split(".").pop().toLowerCase();
      if (["md", "markdown"].includes(ext)) {
        this.showMarkdownPreview(this.activePath, this.editor.getValue());
      } else if (["html", "htm"].includes(ext)) {
        this.showHtmlPreview(this.activePath, this.editor.getValue());
      }
    }
  }

  hidePreviews() {
    this.isPreviewActive = false;
    this.previewType = null;
    if (this.markdownContainer) this.markdownContainer.style.display = "none";
    if (this.htmlContainer) this.htmlContainer.style.display = "none";
  }

  showMediaPreview(filePath, isImage, size) {
    this.hideDiff();
    this.hidePreviews();
    this.activePath = filePath;
    this.container.style.display = "none";
    if (this.mediaContainer) {
      this.mediaContainer.style.display = "flex";
      if (isImage && this.mediaImg) {
        this.mediaImg.src = `/api/raw?path=${encodeURIComponent(filePath)}&t=${Date.now()}`;
        this.mediaImg.style.display = "block";
      }
      if (this.mediaInfo) {
        const sizeKb = (size / 1024).toFixed(1);
        this.mediaInfo.textContent = `${filePath} (${sizeKb} KB)`;
      }
    }
    const watermark = document.getElementById("editor-watermark");
    if (watermark) watermark.style.display = "none";
  }

  hideMedia() {
    if (this.mediaContainer) {
      this.mediaContainer.style.display = "none";
      if (this.mediaImg) this.mediaImg.src = "";
    }
  }

  goToLine(lineNumber) {
    if (this.isPreviewActive) {
      this.hidePreviews();
      this.container.style.display = "block";
      this.editor.layout();
    }
    if (this.editor && lineNumber > 0) {
      this.editor.revealLineInCenter(lineNumber);
      this.editor.setPosition({ lineNumber, column: 1 });
      this.editor.focus();
    }
  }

  setLanguage(lang) {
    if (this.editor && this.editor.getModel()) {
      monaco.editor.setModelLanguage(this.editor.getModel(), lang);
      const langEl = document.getElementById("status-language-text");
      if (langEl) langEl.textContent = lang.charAt(0).toUpperCase() + lang.slice(1);
    }
  }

  setTabSize(tabSize) {
    this.tabSize = parseInt(tabSize, 10);
    if (this.editor && this.editor.getModel()) {
      this.editor.getModel().updateOptions({ tabSize: this.tabSize });
      const indentEl = document.getElementById("status-indent");
      if (indentEl) indentEl.textContent = `Spaces: ${this.tabSize}`;
    }
  }

  setFontSize(size) {
    this.fontSize = parseInt(size, 10);
    if (this.editor) {
      this.editor.updateOptions({ fontSize: this.fontSize });
    }
    if (this.diffEditor) {
      this.diffEditor.updateOptions({ fontSize: this.fontSize });
    }
  }

  toggleWordWrap() {
    this.isWordWrapOn = !this.isWordWrapOn;
    if (this.editor) {
      this.editor.updateOptions({ wordWrap: this.isWordWrapOn ? "on" : "off" });
    }
    return this.isWordWrapOn;
  }

  setWordWrap(wrapMode) {
    this.isWordWrapOn = wrapMode === "on";
    if (this.editor) {
      this.editor.updateOptions({ wordWrap: wrapMode });
    }
  }

  setBracketGuides(mode) {
    let val = false;
    if (mode === true || mode === "true") val = true;
    else if (mode === "active") val = "active";
    if (this.editor) {
      this.editor.updateOptions({
        guides: {
          bracketPairs: val,
          bracketPairsHorizontal: val,
          indentation: true
        }
      });
    }
  }

  setBracketColorization(enabled) {
    const val = enabled === true || enabled === "true";
    if (this.editor) {
      this.editor.updateOptions({
        bracketPairColorization: { enabled: val }
      });
    }
  }

  toggleMinimap() {
    this.isMinimapOn = !this.isMinimapOn;
    if (this.editor) {
      this.editor.updateOptions({ minimap: { enabled: this.isMinimapOn } });
    }
    return this.isMinimapOn;
  }

  formatDocument() {
    if (this.editor) {
      this.editor.getAction("editor.action.formatDocument")?.run();
    }
  }

  insertText(text) {
    if (!this.editor) return;
    const selection = this.editor.getSelection();
    const op = { range: selection, text: text, forceMoveMarkers: true };
    this.editor.executeEdits("mobile-insert", [op]);
    this.editor.focus();
  }

  getOutlineSymbols() {
    if (!this.editor || !this.editor.getModel()) return [];
    const text = this.editor.getValue();
    const lines = text.split("\n");
    const symbols = [];

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const pyFunc = line.match(/^\s*(?:async\s+)?def\s+([a-zA-Z0-9_]+)\s*\(/);
      const pyClass = line.match(/^\s*class\s+([a-zA-Z0-9_]+)/);
      const jsFunc = line.match(/^\s*(?:async\s+)?function\s+([a-zA-Z0-9_]+)/);
      const jsClass = line.match(/^\s*class\s+([a-zA-Z0-9_]+)/);
      const jsConstFunc = line.match(/^\s*(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>)/);
      const goFunc = line.match(/^\s*func\s+(?:\([^)]+\)\s+)?([a-zA-Z0-9_]+)\s*\(/);
      const rustFn = line.match(/^\s*(?:pub\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)/);
      const mdHeading = line.match(/^(#{1,4})\s+(.+)$/);

      if (pyClass || jsClass) {
        const name = (pyClass || jsClass)[1];
        symbols.push({ name, line: lineNum, type: "class", icon: "codicon-symbol-class" });
      } else if (pyFunc || jsFunc || jsConstFunc || goFunc || rustFn) {
        const name = (pyFunc || jsFunc || jsConstFunc || goFunc || rustFn)[1];
        symbols.push({ name, line: lineNum, type: "function", icon: "codicon-symbol-method" });
      } else if (mdHeading) {
        symbols.push({ name: mdHeading[2], line: lineNum, type: "heading", icon: "codicon-markdown" });
      }
    });

    return symbols;
  }

  showDiff(file, originalContent, currentContent) {
    this.isDiffActive = true;
    this.hideMedia();
    this.hidePreviews();
    this.container.style.display = "none";
    this.diffContainer.style.display = "block";

    const lang = this.getLanguageFromPath(file);
    const originalModel = monaco.editor.createModel(originalContent || "", lang);
    const currentModel = monaco.editor.createModel(currentContent || "", lang);

    this.diffEditor.setModel({
      original: originalModel,
      modified: currentModel
    });

    const watermark = document.getElementById("editor-watermark");
    if (watermark) watermark.style.display = "none";
  }

  hideDiff() {
    if (this.isDiffActive) {
      this.isDiffActive = false;
      this.diffContainer.style.display = "none";
      this.container.style.display = "block";
      this.editor.layout();
    }
  }

  closeFile(filePath) {
    const model = this.models.get(filePath);
    if (model) {
      model.dispose();
      this.models.delete(filePath);
    }
    if (this.activePath === filePath) {
      this.activePath = null;
      this.editor.setModel(null);
      this.hideMedia();
      this.hidePreviews();
      const watermark = document.getElementById("editor-watermark");
      if (watermark) watermark.style.display = "flex";
      const breadcrumb = document.getElementById("breadcrumb-text");
      if (breadcrumb) breadcrumb.textContent = "No file open";
    }
  }

  getValue() {
    return this.editor ? this.editor.getValue() : "";
  }

  layout() {
    if (this.editor) this.editor.layout();
    if (this.diffEditor) this.diffEditor.layout();
  }
}

export { EditorManager };
