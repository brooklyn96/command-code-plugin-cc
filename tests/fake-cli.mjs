// Deterministic test double for the Command Code CLI: records the exact argv
// and stdin bytes it received, then answers like the real CLI would.
import fs from 'node:fs';
let stdin = '';
try { stdin = fs.readFileSync(0, 'utf8'); } catch {}
const argv = process.argv.slice(2);
const capture = process.env.FAKE_CLI_CAPTURE;
if (capture) fs.writeFileSync(capture, JSON.stringify({ argv, stdin }));
if (argv[0] === '--version') {
  process.stdout.write('9.9.9-fake\n');
} else if (argv[0] === '--list-models') {
  process.stdout.write('deepseek/flash one\nother/model\ndeepseek flash two\n');
} else {
  process.stdout.write(JSON.stringify({ type: 'result', finalText: 'fake-final-text', sessionId: 'fake-session', usage: null }) + '\n');
}
