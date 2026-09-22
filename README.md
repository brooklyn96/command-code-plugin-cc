# command-code-plugin-cc

Use the **native Command Code CLI harness from inside Claude Code** for code review, debugging, implementation, background jobs, session resume, model selection, and cache/usage telemetry.

This project is designed for the Claude Code IDE extension and CLI. Claude remains the orchestrator; substantial tasks can be handed to Command Code without replacing Claude Code's UI.

## Why native CLI instead of Provider API?

The plugin launches Command Code itself:

```text
Claude Code Extension
        ↓
command-code-plugin-cc
        ↓
Command Code CLI
        ↓
Command Code native harness
        ↓
DeepSeek / Kimi / Qwen / other Command Code models
```

That preserves Command Code's native sessions, tools, skills, taste/memory behavior, and prompt serialization. The plugin records the `usage` object returned by Command Code so you can inspect cache-read/cache-write telemetry when the CLI exposes it.

## Features

- `/command-code:setup` — binary/auth check and optional live smoke test
- `/command-code:models` — live model list from `--list-models`
- `/command-code:rescue` — delegated coding work
- `/command-code:review` — read-only review
- `/command-code:adversarial-review` — design/challenge review
- `/command-code:status`, `/result`, `/cancel` — background jobs
- `/command-code:config` — default model/effort and review gate
- `/command-code:usage` — usage/cache telemetry from the latest run or a job
- native session resume with `--resume`
- Windows-aware CLI discovery (`command-code`, `commandcode`, `cmdc`; avoids accidentally launching Windows `cmd.exe`)
- npm-global package detection that can execute the Command Code JS entry directly with Node

## Install

First install and sign in to Command Code:

```bash
npm install -g command-code
command-code login
```

Then in Claude Code:

```text
/plugin marketplace add brooklyn96/command-code-plugin-cc
/plugin install command-code@brooklyn96-command-code-plugin-cc
/reload-plugins
/command-code:setup --auth-check
```

For a local clone:

```text
/plugin marketplace add .
/plugin install command-code@brooklyn96-command-code-plugin-cc
/reload-plugins
```

## DeepSeek V4.1 Flash default

List the exact model id reported by your installed Command Code:

```text
/command-code:models deepseek
```

Then set it as the default, for example:

```text
/command-code:config --model deepseek/deepseek-v4.1-flash
```

Optional effort:

```text
/command-code:config --effort high
```

Now a normal delegated task is simply:

```text
/command-code:rescue fix the failing API tests and keep the patch minimal
```

## Sessions and cache-friendly continuity

A completed native run returns a Command Code `sessionId`. The companion stores it per workspace. Continue it with:

```text
/command-code:rescue --resume continue the previous investigation and implement the top fix
```

Force a new native session with `--fresh`.

Use:

```text
/command-code:usage
```

to inspect the latest returned `usage` object. The plugin does **not** invent a cache-hit percentage; it displays the telemetry returned by Command Code.

## Read-only vs write

`review` and `adversarial-review` always use `--permission-mode plan`.

`rescue` auto-detects common write verbs such as `fix`, `implement`, `edit`, `refactor`, and `create`. Override explicitly with:

```text
--write
--read-only
```

## Windows

Command Code's package may expose several launchers. Native Windows also has `cmd.exe`, so this plugin deliberately does **not** use bare `cmd` on Windows. It prefers:

```text
command-code
commandcode
cmdc
```

and, when installed through npm, can locate the package's JS entry and run it with the current Node executable. Override discovery with:

```powershell
$env:COMMAND_CODE_BIN="C:\\path\\to\\command-code.exe"
```

or point directly at a JavaScript entry:

```powershell
$env:COMMAND_CODE_NODE_ENTRY="C:\\...\\node_modules\\command-code\\dist\\cli.js"
```

## Configuration

Stored at:

```text
~/.commandcode-plugin-cc/config.json
```

Supported settings:

```json
{
  "defaultModel": null,
  "defaultEffort": null,
  "reviewGate": false,
  "maxTurns": 100
}
```

## Attribution

Inspired by `openai/codex-plugin-cc`, `tasict/opencode-plugin-cc`, `udeope/command-code-plugin-cc`, and `aashahin/codex-commandcode-orchestrator`. See `NOTICE`.

## License

Apache-2.0.
