// ============================================================
//  Categorized Content Copier — VS Code Extension  (v2.0)
//  Token-efficient • Markdown-ready • Comment-free output
// ============================================================

const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

// ─── Config ─────────────────────────────────────────────────
const CATEGORY_FOLDER = "categorization-of-content";

const CATEGORY_FILE_EXTS = [
  ".txt",
  ".md",
  ".json",
  ".yaml",
  ".yml",
  ".eml",
  ".list",
];

// File extension → Markdown language hint (code block mein use hoga)
const EXT_TO_LANG = {
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".jsx": "jsx",
  ".ts": "typescript",
  ".mts": "typescript",
  ".tsx": "tsx",
  ".html": "html",
  ".htm": "html",
  ".css": "css",
  ".scss": "scss",
  ".sass": "sass",
  ".less": "less",
  ".php": "php",
  ".phtml": "php",
  ".py": "python",
  ".pyw": "python",
  ".java": "java",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".hpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".cs": "csharp",
  ".go": "go",
  ".rs": "rust",
  ".rb": "ruby",
  ".erb": "erb",
  ".swift": "swift",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".scala": "scala",
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "zsh",
  ".sql": "sql",
  ".json": "json",
  ".jsonc": "jsonc",
  ".xml": "xml",
  ".svg": "xml",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
  ".md": "markdown",
  ".lua": "lua",
  ".dart": "dart",
  ".vue": "vue",
  ".r": "r",
  ".R": "r",
  ".pl": "perl",
  ".pm": "perl",
  ".ex": "elixir",
  ".exs": "elixir",
};

// ─── Comment Stripping Profiles ─────────────────────────────
// Har language family ka apna config — strings track karta hai
// taa ke string ke andar comment syntax strip na ho
const COMMENT_CONFIGS = {
  "c-like": {
    singleLine: ["//"],
    multiLine: [{ start: "/*", end: "*/" }],
    strings: ['"', "'", "`"],
  },
  html: {
    singleLine: [],
    multiLine: [{ start: "<!--", end: "-->" }],
    strings: ['"', "'"],
  },
  css: {
    singleLine: [],
    multiLine: [{ start: "/*", end: "*/" }],
    strings: ['"', "'"],
  },
  python: {
    singleLine: ["#"],
    multiLine: [],
    strings: ['"', "'"],
  },
  hash: {
    singleLine: ["#"],
    multiLine: [],
    strings: ['"', "'"],
  },
  ruby: {
    singleLine: ["#"],
    multiLine: [{ start: "=begin", end: "=end" }],
    strings: ['"', "'"],
  },
  sql: {
    singleLine: ["--"],
    multiLine: [{ start: "/*", end: "*/" }],
    strings: ["'"],
  },
  lua: {
    singleLine: ["--"],
    multiLine: [{ start: "--[[", end: "]]" }],
    strings: ['"', "'"],
  },
};

// File extension → comment config key
// PHP ka apna dedicated stripper hai (stripPhpComments), yahan nahi hai
const EXT_TO_COMMENT = {
  ".js": "c-like",
  ".mjs": "c-like",
  ".cjs": "c-like",
  ".jsx": "c-like",
  ".ts": "c-like",
  ".mts": "c-like",
  ".tsx": "c-like",
  ".java": "c-like",
  ".c": "c-like",
  ".h": "c-like",
  ".cpp": "c-like",
  ".hpp": "c-like",
  ".cc": "c-like",
  ".cxx": "c-like",
  ".cs": "c-like",
  ".go": "c-like",
  ".rs": "c-like",
  ".swift": "c-like",
  ".kt": "c-like",
  ".kts": "c-like",
  ".scala": "c-like",
  ".scss": "c-like",
  ".less": "c-like",
  ".dart": "c-like",
  ".jsonc": "c-like",
  ".html": "html",
  ".htm": "html",
  ".xml": "html",
  ".svg": "html",
  ".vue": "html",
  ".css": "css",
  ".py": "python",
  ".pyw": "python",
  ".sh": "hash",
  ".bash": "hash",
  ".zsh": "hash",
  ".yaml": "hash",
  ".yml": "hash",
  ".toml": "hash",
  ".r": "hash",
  ".R": "hash",
  ".pl": "hash",
  ".pm": "hash",
  ".ex": "hash",
  ".exs": "hash",
  ".rb": "ruby",
  ".sql": "sql",
  ".lua": "lua",
};

// ─── Activate ───────────────────────────────────────────────
function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "categorizedContentCopier.copyContent",
      async () => {
        try {
          await runWorkflow();
        } catch (err) {
          vscode.window.showErrorMessage(`Error: ${err.message}`);
        }
      },
    ),
  );
}

// ─── Main Workflow ──────────────────────────────────────────
async function runWorkflow() {
  const root = getRoot();
  if (!root) return;

  const catDir = path.join(root, CATEGORY_FOLDER);

  if (!fs.existsSync(catDir) || !fs.statSync(catDir).isDirectory()) {
    vscode.window.showWarningMessage(
      `Folder "${CATEGORY_FOLDER}" not found in project root. ` +
        `Create it and add category files (e.g. frontend.txt).`,
    );
    return;
  }

  const catFiles = fs
    .readdirSync(catDir)
    .filter((f) => CATEGORY_FILE_EXTS.includes(path.extname(f).toLowerCase()))
    .sort();

  if (!catFiles.length) {
    vscode.window.showWarningMessage(
      `No category files in "${CATEGORY_FOLDER}/". ` +
        `Add .txt / .md / .yaml files with file paths listed inside.`,
    );
    return;
  }

  const pick = await vscode.window.showQuickPick(
    catFiles.map((f) => ({
      label: f,
      description: path.join(CATEGORY_FOLDER, f),
    })),
    { placeHolder: "📂 Select a category to copy…", matchOnDescription: true },
  );
  if (!pick) return;

  const raw = fs.readFileSync(path.join(catDir, pick.label), "utf-8");
  const paths = parsePaths(raw);

  if (!paths.length) {
    vscode.window.showWarningMessage(`No valid paths in "${pick.label}".`);
    return;
  }

  const res = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Copying from "${pick.label}"…`,
      cancellable: false,
    },
    (progress) => aggregate(root, paths, progress),
  );

  if (!res.count) {
    vscode.window.showWarningMessage("No readable content found.");
    return;
  }

  await vscode.env.clipboard.writeText(res.content);
  vscode.window.showInformationMessage(
    `✅ Copied ${res.count} file(s)` +
      (res.skip ? ` | ⚠️ ${res.skip} skipped` : ""),
  );
}

// ─── Workspace Root ─────────────────────────────────────────
function getRoot() {
  const wf = vscode.workspace.workspaceFolders;
  if (!wf || !wf.length) {
    vscode.window.showErrorMessage("No workspace/folder is open.");
    return null;
  }
  return wf[0].uri.fsPath;
}

// ─── Parse Paths from Category File ─────────────────────────
function parsePaths(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

// ─── Aggregate All Files ────────────────────────────────────
async function aggregate(root, paths, progress) {
  let out = "";
  let count = 0;
  let skip = 0;
  const total = paths.length;

  for (let i = 0; i < total; i++) {
    const norm = paths[i].replace(/\\/g, "/");
    const abs = path.resolve(root, norm);

    if (!abs.startsWith(root)) {
      skip++;
      continue;
    }

    progress.report({
      message: `${i + 1}/${total}: ${norm}`,
      increment: 100 / total,
    });

    if (!fs.existsSync(abs)) {
      out += `⚠️ NOT FOUND: \`${norm}\`\n\n`;
      skip++;
      continue;
    }

    const stat = fs.statSync(abs);

    if (stat.isFile()) {
      const r = formatFile(abs, root);
      if (r) {
        out += r;
        count++;
      } else {
        skip++;
      }
    } else if (stat.isDirectory()) {
      for (const fp of listFilesRecursive(abs)) {
        const r = formatFile(fp, root);
        if (r) {
          out += r;
          count++;
        }
      }
    }
  }

  return { content: out.trim(), count, skip };
}

// ─── Format Single File → Markdown Code Block ──────────────
function formatFile(abs, root) {
  try {
    const rel = path.relative(root, abs);
    const ext = path.extname(abs).toLowerCase();

    if (isBinary(abs)) {
      return `⏭️ BINARY: \`${rel}\`\n\n`;
    }

    let code = fs.readFileSync(abs, "utf-8");

    // Comment stripping — PHP ka apna context-aware stripper hai
    if (ext === ".php" || ext === ".phtml") {
      code = stripPhpComments(code);
    } else {
      const cfgKey = EXT_TO_COMMENT[ext];
      if (cfgKey) {
        code = stripComments(code, COMMENT_CONFIGS[cfgKey]);
      }
    }

    // Convert lines starting with exactly one '#' followed by a space into '##'
    code = code.replace(/^# (?!#)/gm, "## ");

    code = tidyLines(code);

    const lang = EXT_TO_LANG[ext] || "";
    const fence = makeFence(code);

    return `📄 \`${rel}\`\n${fence}${lang}\n${code}\n${fence}\n\n`;
  } catch {
    return null;
  }
}

// ─── Binary Detection (null-byte check) ─────────────────────
function isBinary(fp) {
  try {
    const fd = fs.openSync(fp, "r");
    const buf = Buffer.alloc(8192);
    const n = fs.readSync(fd, buf, 0, 8192, 0);
    fs.closeSync(fd);
    for (let i = 0; i < n; i++) {
      if (buf[i] === 0) return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ─── Recursive Directory Listing ────────────────────────────
function listFilesRecursive(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results.sort();
}

// ─── Dynamic Fence Generator ────────────────────────────────
// Agar content mein ``` ho to fence zyada backticks use karega
// taa ke Markdown kabhi break na ho
function makeFence(content) {
  let max = 0;
  let cur = 0;
  for (const ch of content) {
    cur = ch === "`" ? cur + 1 : 0;
    if (cur > max) max = cur;
  }
  return "`".repeat(Math.max(3, max + 1));
}

// ─── Line Cleanup ───────────────────────────────────────────
// Comment strip hone ke baad jo empty lines bachti hain,
// unko collapse karta hai (3+ blank lines → 1 blank line)
function tidyLines(text) {
  return text
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ═══════════════════════════════════════════════════════════
//  COMMENT STRIPPING ENGINE
// ═══════════════════════════════════════════════════════════

// ─── Generic Stripper ───────────────────────────────────────
// State machine: string literals ko respect karta hai,
// un ke andar comment syntax ko chhoota nahi.
// Works for: C-like, Python, Ruby, Lua, SQL, Shell, HTML, CSS
function stripComments(code, cfg) {
  const { singleLine = [], multiLine = [], strings = [] } = cfg;
  let out = "";
  let i = 0;
  const len = code.length;

  while (i < len) {
    let hit = false;

    // 1) String literal → jaise hai waise copy karo
    for (const d of strings) {
      if (code.startsWith(d, i)) {
        const end = findStringEnd(code, i + d.length, d);
        out += code.substring(i, end);
        i = end;
        hit = true;
        break;
      }
    }
    if (hit) continue;

    // 2) Multi-line comment → skip
    //    (multi PEHLE check hota hai single se, --[[ vs -- ke liye)
    for (const { start, end } of multiLine) {
      if (code.startsWith(start, i)) {
        const e = code.indexOf(end, i + start.length);
        i = e >= 0 ? e + end.length : len;
        hit = true;
        break;
      }
    }
    if (hit) continue;

    // 3) Single-line comment → skip to EOL
    for (const m of singleLine) {
      if (code.startsWith(m, i)) {
        const nl = code.indexOf("\n", i);
        i = nl >= 0 ? nl : len;
        hit = true;
        break;
      }
    }
    if (hit) continue;

    // 4) Normal character → output
    out += code[i++];
  }

  return out;
}

// ─── PHP Context-Aware Stripper ─────────────────────────────
// PHP mein HTML aur PHP modes switch hote hain (<?php ... ?>).
// HTML mode mein sirf <!-- --> strip hota hai.
// PHP mode mein //, #, /* */ strip hote hain.
// Isse CSS ke #id selectors galti se strip nahi hote.
function stripPhpComments(code) {
  let out = "";
  let i = 0;
  let inPhp = false;
  const len = code.length;
  const phpStr = ['"', "'"];

  while (i < len) {
    if (!inPhp) {
      // ── HTML MODE ──

      // PHP open tag detect karo
      const tag = code.startsWith("<?php", i)
        ? "<?php"
        : code.startsWith("<?=", i)
          ? "<?="
          : code.startsWith("<?", i)
            ? "<?"
            : null;

      if (tag) {
        out += tag;
        i += tag.length;
        inPhp = true;
        continue;
      }

      // HTML comment <!-- --> strip karo
      if (code.startsWith("<!--", i)) {
        const e = code.indexOf("-->", i + 4);
        i = e >= 0 ? e + 3 : len;
        continue;
      }

      out += code[i++];
    } else {
      // ── PHP MODE ──

      // PHP close tag → wapas HTML mode
      if (code.startsWith("?>", i)) {
        out += "?>";
        i += 2;
        inPhp = false;
        continue;
      }

      // String literal → preserve karo (comment syntax andar safe hai)
      let hit = false;
      for (const d of phpStr) {
        if (code[i] === d) {
          const end = findStringEnd(code, i + 1, d);
          out += code.substring(i, end);
          i = end;
          hit = true;
          break;
        }
      }
      if (hit) continue;

      // Multi-line comment /* */
      if (code.startsWith("/*", i)) {
        const e = code.indexOf("*/", i + 2);
        i = e >= 0 ? e + 2 : len;
        continue;
      }

      // Single-line comment: // ya #
      if (code.startsWith("//", i) || code[i] === "#") {
        const nl = code.indexOf("\n", i);
        i = nl >= 0 ? nl : len;
        continue;
      }

      out += code[i++];
    }
  }

  return out;
}

// ─── Find String End (escape-aware) ─────────────────────────
function findStringEnd(code, start, delim) {
  let i = start;
  const len = code.length;
  while (i < len) {
    if (code[i] === "\\") {
      i += 2;
      continue;
    }
    if (code.startsWith(delim, i)) return i + delim.length;
    i++;
  }
  return len;
}

// ─── Deactivate ─────────────────────────────────────────────
function deactivate() {}

module.exports = { activate, deactivate };
