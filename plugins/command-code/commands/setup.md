---
description: Check the local Command Code CLI, authentication, model catalog, and optionally configure defaults.
argument-hint: "[--auth-check] [--json]"
allowed-tools: Bash(node:*), Bash(npm:*), AskUserQuestion
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/command-code-companion.mjs" setup --stdin <<'COMMAND_CODE_ARGS'
$ARGUMENTS
COMMAND_CODE_ARGS
```

If Command Code is missing, ask once whether to install it with `npm install -g command-code`. If accepted, install it and rerun setup. Present the final setup output.
