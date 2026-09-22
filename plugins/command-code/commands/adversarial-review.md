---
description: Run a read-only adversarial design and correctness review through Command Code.
argument-hint: "[--base <ref>] [--background] [--model <id>] [--effort <level>] [focus]"
allowed-tools: Bash(node:*)
---

Run and return stdout verbatim:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/command-code-companion.mjs" adversarial-review --stdin <<'COMMAND_CODE_ARGS'
$ARGUMENTS
COMMAND_CODE_ARGS
```
