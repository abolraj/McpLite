# 🧰 McpLite

> 🪶 A tiny, local tool-executor. Feed it a JSON array of tool calls, and it runs them in order inside a project — no daemon, no network, no SDK. Just a CLI and two files.

```text
▶ mcplite · run
  › [1/6]  Create src/greet.js        write  ✓ 1ms
  › [2/6]  Add a smoke test           write  ✓ 0ms
  › [3/6]  Change 'Hello' to 'Hi'     edit   ✓ 1ms
  › [4/6]  List JS files under src/   glob   ✓ 1ms
  › [5/6]  Run smoke test with node   bash   ✓ 42ms
  › [6/6]  Clean up generated files   bash   ✓ 2ms
  ──────────────────────────────────────────────
  ✓ 6 passed · 6/6 · 47ms
```

---

## 💡 Why

- 🧠 **LLM-friendly** — one array in, one log entry out.
- 🔍 **Auditable** — every call logged to plain-text JSON.
- 👀 **Readable** — color-coded progress view.
- 🪶 **Small** — six tools, one runner. Read it in one sitting.

## 📦 Install

```sh
npm i -g @abolweb/mcplite      # or: pnpm add -g mcplite / npx mcplite
```

Requires **Node ≥ 18**. 🖥️ macOS, Linux, Windows (bash via WSL/Git Bash).

## 🚀 Quick start

```sh
mcplite init      # scaffold guide, tasks, logs
# paste a JSON batch into mcplite-tasks.json
mcplite run       # execute
```

## ⌨️ CLI

```text
mcplite init [--root <DIR>] [--force]
mcplite run  [--root <DIR>] [--stop-on-error <BOOL>]
```

| Flag | Applies to | Description |
|---|---|---|
| `--root <DIR>` | both | Project dir. Defaults to cwd. |
| `--force` | `init` | Overwrite existing files. |
| `--stop-on-error <BOOL>` | `run` | Halt on first failure (default `true`). |

## 📋 Task format

`mcplite-tasks.json` is a JSON array:

```json
[
  {
    "id": "t1",
    "label": "Create src/greet.js",
    "tool": "write",
    "args": { "path": "src/greet.js", "content": "..." }
  }
]
```

| Field | Req | Description |
|---|---|---|
| `id` | ✅ | Unique string, echoed in the log. |
| `tool` | ✅ | `bash`, `read`, `write`, `edit`, `glob`, `grep`. |
| `args` | ✅ | Tool-specific object. |
| `label` | ❌ | Short human description. |

➡️ Calls run **sequentially**. Put risky ones last.

## 🔧 Tools

### 🐚 `bash`
Run a shell command via `sh -c`. Non-zero exits don't throw — check `exitCode`.
```json
{ "command": "cargo check", "cwd": ".", "timeout": 120000 }
```

### 📖 `read`
Read a file as UTF-8.
```json
{ "path": "Cargo.toml", "offset": 0, "limit": 40 }
```

### ✍️ `write`
Create/overwrite a file (parents auto-created).
```json
{ "path": "notes/todo.md", "content": "# TODO\n" }
```

### ✏️ `edit`
Exact string replacement — safer than `write` for small changes.
```json
{ "path": "src/main.rs", "old_string": "old", "new_string": "new", "replace_all": false }
```
🛑 Fails if `old_string` is missing, empty, or ambiguous (appears >1×).

### 🗂️ `glob`
List files matching a pattern.
```json
{ "pattern": "src/**/*.rs" }
```

### 🔎 `grep`
Regex search across files.
```json
{ "pattern": "TODO|FIXME", "glob": "**/*.rs", "ignore_case": true }
```

## 📄 Log format

Each run appends one entry to `mcplite-tasks-logs.json`:

```json
[{
  "timestamp": "1730000000",
  "total": 3,
  "ok": false,
  "results": [
    { "id": "t1", "tool": "glob", "ok": true,  "duration_ms": 3, "result": { ... } },
    { "id": "t3", "tool": "edit", "ok": false, "duration_ms": 1, "error": "old_string not found" }
  ]
}]
```

🕒 `timestamp` — Unix seconds. ✅ `ok` — true only if all results succeeded.

## 🔁 The LLM loop

1. **You** run `mcplite init` → generates `mcplite-guide.md`.
2. **You** give the guide to your model as a system prompt.
3. **Model** replies with a `json` array of tool calls.
4. **You** paste into `mcplite-tasks.json` → `mcplite run`.
5. **You** paste the newest log entry back to the model.
6. Repeat from step 3.

🧠 The model never "remembers" — **the log is the memory**.

## 🛡️ Safety

- 🛡️ **Path containment** — all paths/patterns rejected if they escape the root.
- ⚠️ **No sandbox** — `bash` runs your shell with your permissions.
- 🔒 **Sequential only** — one call at a time.
- 🧩 **Ambiguity check** — `edit` refuses multiple matches without `replace_all`.

## 🧯 Troubleshooting

| Symptom | Fix |
|---|---|
| `command not found: mcplite` | Add `npm prefix -g`/bin to `PATH`. |
| "contains no tasks" | Expected after init — paste a batch first. |
| `path escapes root` | Use relative paths; no `..` or absolute. |
| `old_string appears N times` | Pass `"replace_all": true` or be more specific. |
| `old_string not found` | `read` the file and copy verbatim (whitespace matters). |
| `invalid UTF-8` | Use `bash` for binaries. |
| Log too big | `echo '[]' > mcplite-tasks-logs.json`. |

## 📁 Layout

```text
bin/mcplite.js      – entry point
src/
  cli.js  init.js  run.js  tools.js  utils.js  ui.js
  guide.js  guide.md
```

After `init` in a project:
```text
mcplite-guide.md  mcplite-tasks.json  mcplite-tasks-logs.json
```

## 📜 License

📜 MIT — see [LICENSE](./LICENSE).