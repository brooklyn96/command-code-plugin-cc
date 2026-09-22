#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { loadConfig } from './lib/runtime.mjs';
try{fs.readFileSync(0,'utf8')}catch{}
if(!loadConfig().reviewGate) process.exit(0);
const r=spawnSync('git',['status','--porcelain'],{encoding:'utf8',timeout:5000,windowsHide:true});
if(r.status===0 && (r.stdout||'').trim()){
  process.stdout.write(JSON.stringify({systemMessage:'You have uncommitted changes. Consider running /command-code:review before wrapping up.'})+'\n');
}
