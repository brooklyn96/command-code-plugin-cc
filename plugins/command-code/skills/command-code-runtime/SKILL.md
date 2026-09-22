# Command Code runtime

Use this skill when Claude should delegate substantial coding work to Command Code's native CLI harness.

## Native harness first

The companion launches the official local Command Code CLI in headless mode instead of calling the Provider API directly. This preserves Command Code's own session, tools, skills, taste/memory behavior, and prompt serialization.

## Commands

- Setup: `command-code-companion setup --auth-check`
- Models: `command-code-companion models`
- Rescue: `command-code-companion rescue [--resume|--fresh] [--write|--read-only] [--model <id>] [--effort <level>] <task>`
- Review: `command-code-companion review [--base <ref>] [--model <id>] [--effort <level>]`
- Jobs: `status`, `result`, `cancel`
- Cache telemetry: `usage [job-id]`

## Safety

Read-only work uses `--permission-mode plan`. Write-capable rescue uses `--permission-mode auto-accept`; read-only work uses plan mode. The plugin never adds `--yolo`. Prefer `--read-only` for diagnosis-only requests.

## Sessions

Fresh runs capture Command Code's native `sessionId`. `--resume` replays it with `--resume <id>`, allowing the Command Code harness to maintain native continuity and improving the chance that stable prompt prefixes remain cacheable.
