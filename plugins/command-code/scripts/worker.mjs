#!/usr/bin/env node
import fs from 'node:fs';
import { readJob, updateJob } from './lib/jobs.mjs';
import { runCli, parseJsonStream, writeSession, writeLatest } from './lib/runtime.mjs';

const id=process.argv[2];
if(!id) process.exit(2);
let meta;
try{meta=readJob(id)}catch(e){console.error(e.message);process.exit(2)}
updateJob(id,{status:'running',pid:process.pid,startedAt:meta.startedAt||Date.now()});
try{
  const r=await runCli(meta.cliArgs,{cwd:meta.cwd});
  const {result}=parseJsonStream(r.stdout);
  const text=typeof result?.finalText==='string'?result.finalText:(r.stdout.trim()||r.stderr.trim());
  const run={jobId:id,text,usage:result?.usage||null,sessionId:result?.sessionId||null,exitCode:r.code,stderr:r.stderr,model:meta.model||null,effort:meta.effort||null,endedAt:Date.now()};
  if(run.sessionId) writeSession({sessionId:run.sessionId,updatedAt:Date.now(),model:meta.model||null},meta.cwd);
  writeLatest(run,meta.cwd);
  fs.writeFileSync(meta.outPath,JSON.stringify(run,null,2)+'\n');
  updateJob(id,{status:r.code===0?'completed':'failed',exitCode:r.code,endedAt:Date.now(),sessionId:run.sessionId,usage:run.usage,pid:process.pid});
  process.exitCode=r.code===0?0:1;
}catch(e){
  fs.writeFileSync(meta.errPath,String(e?.stack||e));
  updateJob(id,{status:'failed',endedAt:Date.now(),error:String(e?.message||e)});
  process.exitCode=1;
}
