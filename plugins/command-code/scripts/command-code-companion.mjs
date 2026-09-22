#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { parseInvocation, shellSplit } from './lib/args.mjs';
import { buildReviewPrompt } from './lib/git.mjs';
import { makeJobId, writeJob, readJob, listJobs, cancelJob } from './lib/jobs.mjs';
import {
  EFFORTS, WRITE_WORDS, configPath, ensureDirs, formatUsage,
  loadConfig, parseJsonStream, readLatest, readSession, renderRun, resolveCli,
  runCli, runSync, saveConfig, writeLatest, writeSession, jobsDir
} from './lib/runtime.mjs';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);

function readArgs(argv){
  const a=[...argv];
  const i=a.indexOf('--stdin');
  if(i<0) return a;
  a.splice(i,1);
  let s=''; try{s=fs.readFileSync(0,'utf8').trim()}catch{}
  return [...a,...(s?shellSplit(s):[])];
}

function usage(){
  console.log(`command-code-companion <action> [args]

actions:
  setup [--auth-check] [--json]
  models [filter]
  config [--model <id>|--clear-model] [--effort <level>|--clear-effort] [--review-gate on|off]
  rescue [--background] [--resume|--fresh] [--write|--read-only] [--model <id>] [--effort <level>] <task>
  review [--background] [--base <ref>] [--model <id>] [--effort <level>] [focus]
  adversarial-review [same as review]
  status [job-id]
  result <job-id>
  cancel <job-id>
  usage [job-id]`);
}

function authState(){
  const p=path.join(process.env.USERPROFILE||process.env.HOME||'', '.commandcode','auth.json');
  try{const j=JSON.parse(fs.readFileSync(p,'utf8'));return {ok:Boolean(j?.apiKey),path:p,user:j?.userName||null}}catch(e){return {ok:false,path:p,error:e.message}}
}

function setup(flags){
  const cli=resolveCli(); const auth=authState();
  let version=null,versionError=null,smoke=null;
  if(cli){const r=runSync(['--version'],{timeout:10000});version=(r.stdout||r.stderr).trim().split(/\r?\n/)[0]||null;versionError=r.status===0?null:(r.error||r.stderr||`exit ${r.status}`)}
  if(flags.authCheck && cli){
    const r=runSync(['--print','Reply with only OK','--output-format','json','--permission-mode','plan','--trust','--skip-onboarding','--max-turns','3'],{timeout:120000});
    const {result}=parseJsonStream(r.stdout); const txt=result?.finalText||r.stdout||r.stderr;
    smoke={ok:r.status===0 && /\bOK\b/.test(txt),status:r.status,error:r.status===0?null:(r.stderr||r.error)};
  }
  const payload={ready:Boolean(cli&&auth.ok&&(!flags.authCheck||smoke?.ok)),cli:cli?{display:cli.display,kind:cli.kind,version,versionError}:null,auth,smokeTest:smoke,config:loadConfig(),configPath:configPath()};
  if(flags.json) console.log(JSON.stringify(payload,null,2));
  else{
    console.log(`Command Code CLI: ${cli?`${cli.display} (${cli.kind})`:'NOT FOUND'}`);
    console.log(`Version: ${version||'unknown'}`);
    console.log(`Auth file: ${auth.ok?`ok${auth.user?` (${auth.user})`:''}`:`missing/invalid (${auth.path})`}`);
    console.log(`Smoke test: ${flags.authCheck?(smoke?.ok?'ok':`failed${smoke?.error?`: ${smoke.error}`:''}`):'skipped (use --auth-check)'}`);
    console.log(`Config: ${configPath()}`);
    console.log(`Ready: ${payload.ready}`);
  }
}

function models(flags){
  const r=runSync(['--list-models'],{timeout:30000});
  if(r.status!==0) throw new Error((r.stderr||r.error||'cmd --list-models failed').trim());
  const filter=(flags.positional.join(' ')||'').toLowerCase();
  const lines=r.stdout.split(/\r?\n/).filter(x=>!filter||x.toLowerCase().includes(filter));
  console.log(lines.join('\n').trim());
}

function configure(flags){
  const cfg=loadConfig();
  if(flags.clearModel) cfg.defaultModel=null;
  if(flags.clearEffort) cfg.defaultEffort=null;
  if(flags.model!==undefined) cfg.defaultModel=flags.model||null;
  if(flags.effort!==undefined){ if(flags.effort && !EFFORTS.has(flags.effort)) throw new Error(`unsupported effort: ${flags.effort}`); cfg.defaultEffort=flags.effort||null; }
  if(flags.reviewGate!==undefined){ const v=String(flags.reviewGate).toLowerCase(); if(!['on','off','true','false'].includes(v)) throw new Error('--review-gate must be on or off'); cfg.reviewGate=['on','true'].includes(v); }
  saveConfig(cfg); console.log(JSON.stringify(cfg,null,2));
}

function buildCliArgs({prompt,write=false,flags,keepSession=true}){
  const cfg=loadConfig();
  const args=['--print',prompt,'--output-format','json','--permission-mode',write?'auto-accept':'plan','--trust','--skip-onboarding','--max-turns',String(cfg.maxTurns||100)];
  const model=flags.model||cfg.defaultModel; const effort=flags.effort||cfg.defaultEffort;
  if(model) args.push('--model',model);
  if(effort){ if(!EFFORTS.has(effort)) throw new Error(`unsupported effort: ${effort}`); args.push('--effort',effort); }
  if(!keepSession) args.push('--no-session');
  if(flags.resume && !flags.fresh){const s=readSession();if(!s?.sessionId) throw new Error('no resumable Command Code session for this workspace');args.push('--resume',s.sessionId)}
  return {args,model,effort};
}

async function foreground({kind,prompt,write,flags,keepSession=true}){
  ensureDirs(); const built=buildCliArgs({prompt,write,flags,keepSession});
  const r=await runCli(built.args,{}); const {result}=parseJsonStream(r.stdout);
  const text=typeof result?.finalText==='string'?result.finalText:(r.stdout.trim()||r.stderr.trim());
  const run={kind,text,usage:result?.usage||null,sessionId:result?.sessionId||null,exitCode:r.code,stderr:r.stderr,model:built.model||null,effort:built.effort||null,endedAt:Date.now()};
  if(run.sessionId) writeSession({sessionId:run.sessionId,updatedAt:Date.now(),model:run.model});
  writeLatest(run);
  process.stdout.write(renderRun(run));
  if(r.code!==0) process.exitCode=1;
}

function background({kind,prompt,write,flags,keepSession=true}){
  ensureDirs(); const built=buildCliArgs({prompt,write,flags,keepSession}); const id=makeJobId();
  const outPath=path.join(jobsDir(),`${id}.out.json`); const errPath=path.join(jobsDir(),`${id}.err.log`);
  const meta={id,kind,status:'queued',cwd:process.cwd(),startedAt:Date.now(),pid:null,cliArgs:built.args,model:built.model||null,effort:built.effort||null,outPath,errPath};
  writeJob(meta);
  const worker=path.join(__dirname,'worker.mjs');
  const child=spawn(process.execPath,[worker,id],{cwd:process.cwd(),detached:true,stdio:'ignore',windowsHide:true});
  meta.pid=child.pid;meta.status='running';writeJob(meta);child.unref();
  console.log(`## Job: ${id}\nstatus: running\nmodel: ${meta.model||'Command Code default'}${meta.effort?` (${meta.effort})`:''}`);
}

async function doReview(flags,adversarial=false){
  if(!resolveCli()) throw new Error('Command Code CLI not found. Install with: npm install -g command-code');
  const prompt=buildReviewPrompt({adversarial,base:flags.base,focus:flags.positional.join(' ')});
  const spec={kind:adversarial?'adversarial-review':'review',prompt,write:false,flags,keepSession:false};
  return flags.background?background(spec):foreground(spec);
}

async function rescue(flags){
  if(!resolveCli()) throw new Error('Command Code CLI not found. Install with: npm install -g command-code');
  if(flags.resume&&flags.fresh) throw new Error('choose only one of --resume or --fresh');
  const task=flags.positional.join(' ').trim();
  if(!task) throw new Error('rescue requires a task');
  const write=!flags.readOnly && (flags.write||WRITE_WORDS.test(task));
  const spec={kind:'rescue',prompt:task,write,flags,keepSession:true};
  return flags.background?background(spec):foreground(spec);
}

function status(flags){
  const id=flags.positional[0];
  if(id){const m=readJob(id);console.log(JSON.stringify(m,null,2));return}
  const jobs=listJobs(); if(!jobs.length){console.log('no jobs for this workspace');return}
  for(const m of jobs) console.log(`${m.id}\t${m.status}\t${m.kind}\t${m.model||'default'}\t${m.sessionId||''}`);
}
function result(flags){
  const id=flags.positional[0]; if(!id) throw new Error('result requires <job-id>'); const m=readJob(id);
  if(!fs.existsSync(m.outPath)){console.log(`## Job: ${id}\nstatus: ${m.status}\n(no result yet)`);return}
  const run=JSON.parse(fs.readFileSync(m.outPath,'utf8'));process.stdout.write(renderRun(run));
}
function cancel(flags){const id=flags.positional[0];if(!id) throw new Error('cancel requires <job-id>');const r=cancelJob(id);console.log(r.ok?`cancelled ${id}`:`unable to cancel ${id}`)}
function showUsage(flags){
  const id=flags.positional[0]; let run=null;
  if(id){const m=readJob(id);if(fs.existsSync(m.outPath)) run=JSON.parse(fs.readFileSync(m.outPath,'utf8'));}
  else run=readLatest();
  if(!run){console.log('no usage telemetry recorded for this workspace');return}
  console.log(`model: ${run.model||'default'}${run.effort?` (${run.effort})`:''}`); if(run.sessionId) console.log(`session: ${run.sessionId}`); console.log(formatUsage(run.usage));
}

async function main(){
  const action=process.argv[2]||'help'; const flags=parseInvocation(readArgs(process.argv.slice(3)));
  switch(action){
    case 'setup': return setup(flags);
    case 'models': return models(flags);
    case 'config': return configure(flags);
    case 'rescue':case 'task': return await rescue(flags);
    case 'review': return await doReview(flags,false);
    case 'adversarial-review': return await doReview(flags,true);
    case 'status': return status(flags);
    case 'result': return result(flags);
    case 'cancel': return cancel(flags);
    case 'usage': return showUsage(flags);
    default: return usage();
  }
}

main().catch(e=>{console.error(`command-code-companion: ${e.message}`);process.exitCode=1});
