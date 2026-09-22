import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { jobsDir, ensureDirs, killPid } from './runtime.mjs';

function metaPath(id,cwd=process.cwd()){return path.join(jobsDir(cwd),`${id}.json`)}
export function makeJobId(){return `task-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`}
export function writeJob(meta,cwd=process.cwd()){ensureDirs(cwd);fs.writeFileSync(metaPath(meta.id,cwd),JSON.stringify(meta,null,2)+'\n')}
export function readJob(id,cwd=process.cwd()){try{return JSON.parse(fs.readFileSync(metaPath(id,cwd),'utf8'))}catch{throw new Error(`job not found: ${id}`)}}
export function listJobs(cwd=process.cwd()){
  ensureDirs(cwd); const out=[];
  for(const n of fs.readdirSync(jobsDir(cwd))){ if(!n.endsWith('.json'))continue; try{out.push(JSON.parse(fs.readFileSync(path.join(jobsDir(cwd),n),'utf8')))}catch{} }
  return out.sort((a,b)=>(b.startedAt||0)-(a.startedAt||0));
}
export function updateJob(id,patch,cwd=process.cwd()){const m=readJob(id,cwd);Object.assign(m,patch);writeJob(m,cwd);return m}
export function cancelJob(id,cwd=process.cwd()){const m=readJob(id,cwd);const ok=killPid(m.pid);updateJob(id,{status:ok?'cancelled':m.status,endedAt:Date.now()},cwd);return {ok,meta:readJob(id,cwd)}}
