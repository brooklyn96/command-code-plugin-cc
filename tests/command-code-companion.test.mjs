import test from 'node:test';
import assert from 'node:assert/strict';
import { shellSplit, parseInvocation } from '../plugins/command-code/scripts/lib/args.mjs';
import { formatUsage } from '../plugins/command-code/scripts/lib/runtime.mjs';

test('shellSplit preserves quoted prompt segments',()=>{
  assert.deepEqual(shellSplit('--model deepseek/x "fix api test"'),['--model','deepseek/x','fix api test']);
});

test('parseInvocation handles routing flags',()=>{
  const f=parseInvocation(['--resume','--write','--model','deepseek/v4','--effort','high','fix','it']);
  assert.equal(f.resume,true); assert.equal(f.write,true); assert.equal(f.model,'deepseek/v4'); assert.equal(f.effort,'high'); assert.deepEqual(f.positional,['fix','it']);
});

test('formatUsage exposes cache telemetry without inventing a ratio',()=>{
  const s=formatUsage({inputTokens:{total:100,cacheRead:80,cacheWrite:10},outputTokens:{total:20}});
  assert.match(s,/cacheRead: 80/); assert.match(s,/cacheWrite: 10/); assert.doesNotMatch(s,/hit rate/i);
});
