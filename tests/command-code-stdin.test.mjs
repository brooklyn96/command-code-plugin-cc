import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildReviewPrompt } from '../plugins/command-code/scripts/lib/git.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const COMPANION = path.join(REPO, 'plugins', 'command-code', 'scripts', 'command-code-companion.mjs');
const FAKE = path.join(HERE, 'fake-cli.mjs');
const FAKE_EXIT = path.join(HERE, 'fake-cli-exit-early.mjs');
const isWin = process.platform === 'win32';

const tmpDirs = [];
function makeTmp(tag) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `cc-r4-${tag}-`));
  tmpDirs.push(dir);
  return dir;
}
// T9: one after() removes every temp directory created, after all background jobs ended.
test.after(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});

function baseEnv(cwd) {
  const e = { ...process.env };
  for (const k of Object.keys(e)) {
    const u = k.toUpperCase();
    if (u === 'COMMAND_CODE_BIN' || u === 'COMMAND_CODE_NODE_ENTRY' || u === 'FAKE_EXIT_CODE') delete e[k];
  }
  delete e.FAKE_CLI_CAPTURE;
  return {
    ...e,
    COMMAND_CODE_COMPANION_DATA: path.join(cwd, '.data'),
    FAKE_CLI_CAPTURE: path.join(cwd, 'fake-capture.json'),
    USERPROFILE: path.join(cwd, '.home'),
    HOME: path.join(cwd, '.home'),
  };
}

function runCompanion(args, { cwd, stdin = '', over = {}, entry = FAKE, timeout = 60000 } = {}) {
  const capture = over.FAKE_CLI_CAPTURE || path.join(cwd, 'fake-capture.json');
  const env = baseEnv(cwd);
  if (entry === null) delete env.COMMAND_CODE_NODE_ENTRY; else env.COMMAND_CODE_NODE_ENTRY = entry;
  Object.assign(env, over);
  const r = spawnSync(process.execPath, [COMPANION, ...args], {
    cwd, encoding: 'utf8', input: stdin, timeout, windowsHide: true, env, maxBuffer: 64 * 1024 * 1024,
  });
  let captured = null;
  try { captured = JSON.parse(fs.readFileSync(capture, 'utf8')); } catch {}
  return { status: r.status, signal: r.signal, stdout: r.stdout || '', stderr: r.stderr || '', captured, capture };
}

const argValue = (argv, flag) => { const i = argv.indexOf(flag); return i < 0 ? null : argv[i + 1]; };
const jobKey = (cwd) => crypto.createHash('sha256').update(fs.realpathSync(cwd)).digest('hex').slice(0, 16);

function seedJob(cwd, { id = 'task-123' } = {}) {
  const jobs = path.join(cwd, '.data', 'workspaces', jobKey(cwd), 'jobs');
  fs.mkdirSync(jobs, { recursive: true });
  const outPath = path.join(jobs, `${id}.out.json`);
  const errPath = path.join(jobs, `${id}.err.log`);
  const meta = { id, kind: 'rescue', status: 'completed', cwd, startedAt: 1, pid: null, model: 'fake-model', effort: null, outPath, errPath };
  fs.writeFileSync(path.join(jobs, `${id}.json`), JSON.stringify(meta, null, 2) + '\n');
  fs.writeFileSync(outPath, JSON.stringify({ jobId: id, text: 'STORED TEXT', usage: { inputTokens: { total: 5 } }, exitCode: 0, model: 'fake-model', endedAt: 1 }, null, 2) + '\n');
  return { id, jobs, outPath };
}

test('T1 a home-directory npm installation resolves and runs without a shell', () => {
  const home = makeTmp('home');
  const bin = path.join(home, 'AppData', 'Roaming', 'npm');
  fs.mkdirSync(bin, { recursive: true });
  if (isWin) {
    const pkg = path.join(bin, 'node_modules', 'command-code');
    fs.mkdirSync(path.join(pkg, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: 'command-code', bin: { commandcode: 'dist/index.mjs' } }));
    fs.copyFileSync(FAKE, path.join(pkg, 'dist', 'index.mjs'));
    fs.writeFileSync(path.join(bin, 'commandcode.cmd'), '@echo off\r\necho RAN>"%~dp0SHIM_RAN.txt"\r\n');
  } else {
    fs.writeFileSync(path.join(bin, 'commandcode'), `#!/bin/sh\nexec "${process.execPath}" "${FAKE}" "$@"\n`, { mode: 0o755 });
  }
  const over = { PATH: bin };
  const s = runCompanion(['setup', '--json'], { cwd: home, entry: null, over });
  assert.equal(s.status, 0, s.stderr);
  const j = JSON.parse(s.stdout);
  assert.ok(j.cli, `the home-directory install must resolve: ${s.stdout}`);
  assert.equal(j.cli.kind, isWin ? 'npm-node-entry' : 'binary');

  const body = 'from home\n';
  const r = runCompanion(['rescue', '--read-only', '--stdin'], { cwd: home, entry: null, over, stdin: body });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.captured, 'the resolved CLI must run');
  assert.equal(r.captured.stdin, body);
  assert.equal(fs.existsSync(path.join(bin, 'SHIM_RAN.txt')), false, 'the .cmd shim itself must never run');

  const inside = path.join(home, 'local-cli.mjs');
  fs.copyFileSync(FAKE, inside);
  const o = runCompanion(['rescue', '--read-only', '--stdin'], { cwd: home, entry: inside, over, stdin: 'override inside cwd\n' });
  assert.equal(o.status, 0, o.stderr);
  assert.equal(o.captured.stdin, 'override inside cwd\n');
});

test('T2 a relative PATH entry never selects or runs a cwd decoy', () => {
  const cwd = makeTmp('decoy');
  if (isWin) {
    fs.writeFileSync(path.join(cwd, 'commandcode.exe'), 'decoy');
    fs.writeFileSync(path.join(cwd, 'commandcode.cmd'), '@echo off\r\necho HIJACKED>HIJACKED.txt\r\n');
  } else {
    fs.writeFileSync(path.join(cwd, 'commandcode'), '#!/bin/sh\necho HIJACKED>HIJACKED.txt\n', { mode: 0o755 });
  }
  const r = runCompanion(['setup', '--json'], { cwd, entry: null, over: { PATH: '.' } });
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  assert.equal(j.cli, null, 'a relative PATH entry must be skipped');
  assert.equal(fs.existsSync(path.join(cwd, 'HIJACKED.txt')), false, 'the decoy must never run');
});

test('T3 overrides must be an absolute path to an existing file', () => {
  const cwd = makeTmp('override');
  const rel = runCompanion(['setup', '--json'], { cwd, over: { COMMAND_CODE_NODE_ENTRY: path.join('relative', 'cli.mjs') } });
  assert.equal(rel.status, 1);
  assert.match(rel.stderr, /COMMAND_CODE_NODE_ENTRY must be an absolute path/);

  const gone = runCompanion(['setup', '--json'], { cwd, over: { COMMAND_CODE_NODE_ENTRY: path.join(cwd, 'nope.mjs') } });
  assert.equal(gone.status, 1);
  assert.match(gone.stderr, /COMMAND_CODE_NODE_ENTRY does not exist/);

  const relBin = runCompanion(['setup', '--json'], { cwd, entry: null, over: { COMMAND_CODE_BIN: path.join('relative', 'cli.exe') } });
  assert.equal(relBin.status, 1);
  assert.match(relBin.stderr, /COMMAND_CODE_BIN must be an absolute path/);

  const goneBin = runCompanion(['setup', '--json'], { cwd, entry: null, over: { COMMAND_CODE_BIN: path.join(cwd, 'nope.exe') } });
  assert.equal(goneBin.status, 1);
  assert.match(goneBin.stderr, /COMMAND_CODE_BIN does not exist/);
});

test('T4 a lone .cmd shim fails with the COMMAND_CODE_NODE_ENTRY error', { skip: !isWin }, () => {
  const cwd = makeTmp('shim-only');
  const bin = path.join(cwd, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'commandcode.cmd'), '@echo off\r\necho RAN>"%~dp0SHIM_RAN.txt"\r\n');
  const r = runCompanion(['setup', '--json'], { cwd, entry: null, over: { PATH: bin } });
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stderr, /COMMAND_CODE_NODE_ENTRY/);
  assert.equal(fs.existsSync(path.join(bin, 'SHIM_RAN.txt')), false);
});

test('T5 a failed delivery is never a success and keeps the CLI diagnostics', async () => {
  const small = makeTmp('early-small');
  const r3 = runCompanion(['rescue', '--read-only', '--stdin'], { cwd: small, stdin: 'y'.repeat(100), entry: FAKE_EXIT, over: { FAKE_EXIT_CODE: '3' } });
  assert.equal(r3.status, 1, r3.stderr);
  assert.match(r3.stdout, /^exit: 3$/m);
  assert.match(r3.stdout, /AUTHENTICATION FAILED/);

  const big = makeTmp('early-big');
  const r0 = runCompanion(['rescue', '--read-only', '--stdin'], { cwd: big, stdin: 'y'.repeat(8 * 1024 * 1024), entry: FAKE_EXIT, over: { FAKE_EXIT_CODE: '0' }, timeout: 120000 });
  assert.equal(r0.status, 1, r0.stderr);
  const report = r0.stdout + r0.stderr;
  assert.match(report, /AUTHENTICATION FAILED/);
  assert.match(report, /prompt was not fully delivered/);

  const bg = makeTmp('early-bg');
  const bgRun = runCompanion(['rescue', '--background', '--read-only', '--stdin'], { cwd: bg, stdin: 'y'.repeat(8 * 1024 * 1024), entry: FAKE_EXIT, over: { FAKE_EXIT_CODE: '0' } });
  assert.equal(bgRun.status, 0, bgRun.stderr);
  const id = (/## Job: (\S+)/.exec(bgRun.stdout) || [])[1];
  assert.ok(id, bgRun.stdout);
  let meta = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    const s = runCompanion(['status', id], { cwd: bg });
    try { meta = JSON.parse(s.stdout); } catch {}
    if (meta && !['queued', 'running'].includes(meta.status)) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  assert.equal(meta?.status, 'failed', JSON.stringify(meta));
  const res = runCompanion(['result', id], { cwd: bg });
  assert.match(res.stdout, /AUTHENTICATION FAILED/);
  assert.match(res.stdout, /prompt was not fully delivered/);
});

test('T6 result, status, usage and cancel --stdin keep the HEAD grammar', () => {
  const cwd = makeTmp('actions-result');
  seedJob(cwd);

  const stored = runCompanion(['result', '--stdin'], { cwd, stdin: ' "task-123" \n' });
  assert.equal(stored.status, 0, stored.stderr);
  assert.match(stored.stdout, /STORED TEXT/);

  const empty = runCompanion(['result', '--stdin'], { cwd, stdin: '\n' });
  assert.equal(empty.status, 1);
  assert.match(empty.stderr, /result requires <job-id>/);

  const blank = runCompanion(['status', '--stdin'], { cwd, stdin: '  \n' });
  assert.equal(blank.status, 0, blank.stderr);

  const one = runCompanion(['status', '--stdin'], { cwd, stdin: 'task-123\n\n' });
  assert.equal(one.status, 0, one.stderr);
  assert.match(one.stdout, /"task-123"/);

  const usage = runCompanion(['usage', '--stdin'], { cwd, stdin: " 'task-123'\n" });
  assert.equal(usage.status, 0, usage.stderr);
  assert.match(usage.stdout, /inputTokens\.total: 5/);

  const cancel = runCompanion(['cancel', '--stdin'], { cwd, stdin: ' task-123 \n' });
  assert.equal(cancel.status, 0, cancel.stderr);
});

test('T6 models --stdin applies the quoted and the spaced filter identically', () => {
  const cwd = makeTmp('actions-models');
  const quoted = runCompanion(['models', '--stdin'], { cwd, stdin: '"deepseek flash"\n' });
  const spaced = runCompanion(['models', '--stdin'], { cwd, stdin: 'deepseek   flash\n' });
  assert.equal(quoted.status, 0, quoted.stderr);
  assert.equal(spaced.status, 0, spaced.stderr);
  assert.equal(quoted.stdout, spaced.stdout);
  assert.match(quoted.stdout, /deepseek flash two/);
});

test('T6 config --stdin writes the decoded values and rejects a bad effort', () => {
  const cwd = makeTmp('actions-config');
  const ok = runCompanion(['config', '--stdin'], { cwd, stdin: '--model "a b" --effort high --review-gate on\n' });
  assert.equal(ok.status, 0, ok.stderr);
  const cfg = JSON.parse(fs.readFileSync(path.join(cwd, '.data', 'config.json'), 'utf8'));
  assert.equal(cfg.defaultModel, 'a b');
  assert.equal(cfg.defaultEffort, 'high');
  assert.equal(cfg.reviewGate, true);

  const bad = runCompanion(['config', '--stdin'], { cwd, stdin: '--effort nope\n' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /unsupported effort: nope/);
});

test('T6 review and adversarial-review --stdin keep flags written after the focus', () => {
  for (const action of ['review', 'adversarial-review']) {
    const cwd = makeTmp(`actions-${action}`);
    const r = runCompanion([action, '--stdin'], { cwd, stdin: 'the focus --model m9 --effort low\n' });
    assert.equal(r.status, 0, `${action}: ${r.stderr}`);
    assert.ok(r.captured, `${action}: the CLI must run`);
    assert.equal(argValue(r.captured.argv, '--model'), 'm9');
    assert.equal(argValue(r.captured.argv, '--effort'), 'low');
    assert.equal(argValue(r.captured.argv, '--permission-mode'), 'plan');
    assert.ok(r.captured.argv.includes('--no-session'), `${action}: review uses --no-session`);
    assert.match(r.captured.stdin, /Extra focus: the focus/);
  }
});

test('T6 setup --auth-check --json sends the smoke prompt on stdin', () => {
  const cwd = makeTmp('actions-setup');
  const r = runCompanion(['setup', '--stdin'], { cwd, stdin: '--auth-check --json\n' });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.captured, 'the smoke test must run the CLI');
  assert.equal(r.captured.stdin, 'Reply with only OK');
  assert.equal(argValue(r.captured.argv, '--print'), '--output-format');
});

test('T7 rescue delivers the raw stdin body byte for byte on the CLI stdin', () => {
  const cases = [
    { name: 'quotes', stdin: 'say "hello world" and \'goodbye\'\n', args: ['rescue', '--read-only', '--stdin'], perm: 'plan' },
    { name: 'escaped-whitespace', stdin: 'keep\\ this\\ escaped and this too\n', args: ['rescue', '--read-only', '--stdin'], perm: 'plan' },
    { name: 'crlf', stdin: 'line one\r\n  line two\r\n', args: ['rescue', '--read-only', '--stdin'], perm: 'plan' },
    { name: 'leading-trailing-whitespace', stdin: '  keep the padding  \n', args: ['rescue', '--read-only', '--stdin'], perm: 'plan' },
    { name: 'dashdash', stdin: '--\n--write stays in the body\n', body: '--write stays in the body\n', args: ['rescue', '--stdin'], perm: 'auto-accept' },
    { name: 'options-after-positionals', stdin: 'fix it --write --model x\n', args: ['rescue', '--stdin'], perm: 'auto-accept', model: null },
    { name: 'indented-after-flag', stdin: '--read-only\n    indented\n  second\n', body: '    indented\n  second\n', args: ['rescue', '--stdin'], perm: 'plan' },
    { name: 'blank-first-line', stdin: '--\n\n  body\n', body: '\n  body\n', args: ['rescue', '--stdin'], perm: 'plan' },
    { name: 'escaped-quote-model', stdin: '--model "a\\"b" the body "here" stays\n', body: 'the body "here" stays\n', args: ['rescue', '--stdin'], perm: 'plan', model: 'a"b' },
  ];
  for (const c of cases) {
    const cwd = makeTmp(c.name);
    const r = runCompanion(c.args, { cwd, stdin: c.stdin });
    const body = c.body ?? c.stdin;
    assert.equal(r.status, 0, `${c.name}: ${r.stderr}`);
    assert.ok(r.captured, `${c.name}: fake CLI must have been invoked`);
    assert.equal(r.captured.stdin, body, `${c.name}: stdin must be byte-equal`);
    assert.equal(argValue(r.captured.argv, '--print'), '--output-format', `${c.name}: prompt must not be an argv element`);
    assert.equal(argValue(r.captured.argv, '--permission-mode'), c.perm, `${c.name}: permission mode`);
    if ('model' in c) assert.equal(argValue(r.captured.argv, '--model'), c.model, `${c.name}: model`);
  }
});

test('T7 rescue parses only real leading flags; the rest is the raw body', () => {
  const cwd = makeTmp('leading');
  const body = 'Do it: --read-only is body text\n\tindented\n';
  const r = runCompanion(['rescue', '--stdin'], { cwd, stdin: '--write --model m1 --effort high\n' + body });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.captured.stdin, body);
  assert.equal(argValue(r.captured.argv, '--model'), 'm1');
  assert.equal(argValue(r.captured.argv, '--effort'), 'high');
  assert.equal(argValue(r.captured.argv, '--permission-mode'), 'auto-accept');
});

test('T7 argv words before --stdin become a prefix of the delivered task', () => {
  const cwd = makeTmp('prefix');
  const r = runCompanion(['rescue', '--read-only', 'prefix', 'words', '--stdin'], { cwd, stdin: 'body line\n' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.captured.stdin, 'prefix words body line\n');
  assert.equal(argValue(r.captured.argv, '--permission-mode'), 'plan');
});

test('T8 a 40 000-character prompt arrives byte-equal and never on argv', () => {
  const cwd = makeTmp('long');
  const body = 'review this diff: ' + 'x'.repeat(40000);
  const r = runCompanion(['rescue', '--read-only', '--stdin'], { cwd, stdin: body });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.captured.stdin, body);
  assert.equal(argValue(r.captured.argv, '--print'), '--output-format');
  assert.ok(!r.captured.argv.some(a => a.includes(body.slice(0, 64))));
});

test('T8 empty and whitespace-only rescue bodies keep the original error', () => {
  for (const stdin of ['', '   \n', '\n']) {
    const cwd = makeTmp('empty');
    const r = runCompanion(['rescue', '--read-only', '--stdin'], { cwd, stdin });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /rescue requires a task/);
  }
});

test('T8 executable path containing a space is executed without a shell', () => {
  const parent = makeTmp('space');
  const dir = path.join(parent, 'dir with space');
  const cwd = path.join(parent, 'run');
  fs.mkdirSync(dir);
  fs.mkdirSync(cwd);
  const entry = path.join(dir, 'fake cli.mjs');
  fs.copyFileSync(FAKE, entry);
  const body = 'space path body\n';
  const r = runCompanion(['rescue', '--read-only', '--stdin'], { cwd, stdin: body, entry });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.captured.stdin, body);
});

test('T8 review and adversarial-review deliver the generated prompt byte for byte', () => {
  const makeRepo = (tag) => {
    const dir = makeTmp(tag);
    const g = (args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8', windowsHide: true });
    fs.writeFileSync(path.join(dir, 'a.txt'), 'one\n');
    g(['init', '-q']);
    g(['add', 'a.txt']);
    g(['-c', 'user.email=test@example.com', '-c', 'user.name=test', 'commit', '-q', '-m', 'init']);
    fs.writeFileSync(path.join(dir, 'a.txt'), 'two\n');
    fs.writeFileSync(path.join(dir, 'b.txt'), 'new\n');
    return dir;
  };
  const expectedFor = (repo, opts) => {
    const prev = process.cwd();
    process.chdir(repo);
    try { return buildReviewPrompt(opts); } finally { process.chdir(prev); }
  };
  for (const [action, adversarial] of [['review', false], ['adversarial-review', true]]) {
    const repo = makeRepo(action);
    const expected = expectedFor(repo, { adversarial, base: null, focus: 'the focus words' });
    const r = runCompanion([action, '--stdin'], { cwd: repo, stdin: 'the focus words\n' });
    assert.equal(r.status, 0, `${action}: ${r.stderr}`);
    assert.equal(r.captured.stdin, expected, `${action}: prompt bytes must survive transport`);
    assert.equal(argValue(r.captured.argv, '--print'), '--output-format');
  }
});

test('T8 background stores flags in cliArgs and the raw prompt in input', async () => {
  const cwd = makeTmp('bg');
  const body = 'background "body" with | pipe\n';
  const bg = runCompanion(['rescue', '--background', '--stdin'], { cwd, stdin: '--write\n' + body });
  assert.equal(bg.status, 0, bg.stderr);
  const id = (/## Job: (\S+)/.exec(bg.stdout) || [])[1];
  assert.ok(id, `job id missing: ${bg.stdout}`);
  const capture = path.join(cwd, 'fake-capture.json');
  let captured = null, meta = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    try { captured = JSON.parse(fs.readFileSync(capture, 'utf8')); } catch {}
    const s = runCompanion(['status', id], { cwd });
    try { meta = JSON.parse(s.stdout); } catch {}
    if (captured && meta && !['queued', 'running'].includes(meta.status)) break;
    await new Promise(r => setTimeout(r, 300));
  }
  assert.ok(captured, 'worker must run the CLI');
  assert.equal(captured.stdin, body);
  assert.equal(argValue(captured.argv, '--permission-mode'), 'auto-accept');
  assert.ok(meta, 'job metadata must be readable');
  assert.equal(meta.status, 'completed');
  assert.equal(meta.input, body);
  assert.deepEqual(meta.cliArgs.filter(a => a.includes('background')), []);
});
