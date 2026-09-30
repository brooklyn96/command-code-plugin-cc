import test from 'node:test';
import assert from 'node:assert/strict';
import { splitStdinInvocation } from '../plugins/command-code/scripts/lib/args.mjs';

test('splitStdinInvocation parses only leading options and returns source slices', () => {
  assert.deepEqual(splitStdinInvocation('--write --model m1\nDo it\n'), { argv: ['--write', '--model', 'm1'], rest: 'Do it\n' });
  assert.deepEqual(splitStdinInvocation('look at --model x\n'), { argv: [], rest: 'look at --model x\n' });
  assert.deepEqual(splitStdinInvocation('--\n--write is body\n'), { argv: [], rest: '--write is body\n' });
  assert.deepEqual(splitStdinInvocation('  raw body  \n'), { argv: [], rest: '  raw body  \n' });
  assert.deepEqual(splitStdinInvocation('--read-only\r\nline one\r\n  line two\r\n'), { argv: ['--read-only'], rest: 'line one\r\n  line two\r\n' });
  assert.deepEqual(splitStdinInvocation('--model "a b"\nbody\n'), { argv: ['--model', 'a b'], rest: 'body\n' });
  assert.deepEqual(splitStdinInvocation(''), { argv: [], rest: '' });
});

test('R5: leading tokens keep the HEAD escaping rules and the separator keeps body bytes', () => {
  assert.deepEqual(splitStdinInvocation('--model "a\\"b" the body\n'), { argv: ['--model', 'a"b'], rest: 'the body\n' });
  assert.deepEqual(splitStdinInvocation("--model 'a\\b' body\n"), { argv: ['--model', 'a\\b'], rest: 'body\n' });
  assert.deepEqual(splitStdinInvocation('--read-only\n    indented\n  second\n'), { argv: ['--read-only'], rest: '    indented\n  second\n' });
  assert.deepEqual(splitStdinInvocation('--\n\n  body\n'), { argv: [], rest: '\n  body\n' });
  assert.deepEqual(splitStdinInvocation('--read-only   explain\n'), { argv: ['--read-only'], rest: 'explain\n' });
});
