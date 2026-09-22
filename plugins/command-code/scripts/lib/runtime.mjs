import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

export const WRITE_WORDS = /\b(fix|apply|change|modify|edit|write|implement|update|patch|repair|refactor|create|delete|remove|rename|migrate|replace)\b/i;
export const EFFORTS = new Set(['low','medium','high','xhigh','max']);

export function homeDir(){ return os.homedir(); }
export function dataDir(){ return process.env.COMMAND_CODE_COMPANION_DATA || path.join(homeDir(), '.commandcode-plugin-cc'); }
export function configPath(){ return path.join(dataDir(),'config.json'); }
export function workspaceKey(cwd=process.cwd()){
  let real=cwd; try{real=fs.realpathSync(cwd)}catch{}
  return crypto.createHash('sha256').update(real).digest('hex').slice(0,16);
}
export function workspaceDir(cwd=process.cwd()){ return path.join(dataDir(),'workspaces',workspaceKey(cwd)); }
export function jobsDir(cwd=process.cwd()){ return path.join(workspaceDir(cwd),'jobs'); }
export function sessionPath(cwd=process.cwd()){ return path.join(workspaceDir(cwd),'session.json'); }
export function latestPath(cwd=process.cwd()){ return path.join(workspaceDir(cwd),'latest.json'); }
export function ensureDirs(cwd=process.cwd()){
  fs.mkdirSync(jobsDir(cwd),{recursive:true});
  fs.mkdirSync(dataDir(),{recursive:true});
}
export function loadConfig(){
  const defaults={defaultModel:null,defaultEffort:null,reviewGate:false,maxTurns:100};
  try{ return {...defaults,...JSON.parse(fs.readFileSync(configPath(),'utf8'))}; }catch{return defaults;}
}
export function saveConfig(cfg){ fs.mkdirSync(dataDir(),{recursive:true}); fs.writeFileSync(configPath(),JSON.stringify(cfg,null,2)+'\n'); }
export function readSession(cwd=process.cwd()){ try{return JSON.parse(fs.readFileSync(sessionPath(cwd),'utf8'))}catch{return null;} }
export function writeSession(obj,cwd=process.cwd()){ fs.mkdirSync(workspaceDir(cwd),{recursive:true}); fs.writeFileSync(sessionPath(cwd),JSON.stringify(obj,null,2)+'\n'); }
export function writeLatest(obj,cwd=process.cwd()){ fs.mkdirSync(workspaceDir(cwd),{recursive:true}); fs.writeFileSync(latestPath(cwd),JSON.stringify(obj,null,2)+'\n'); }
export function readLatest(cwd=process.cwd()){ try{return JSON.parse(fs.readFileSync(latestPath(cwd),'utf8'))}catch{return null;} }

function fileExists(p){ try{return fs.statSync(p).isFile()}catch{return false;} }
function isWin(){return process.platform==='win32'}
function splitPathEnv(){return String(process.env.PATH||'').split(path.delimiter).filter(Boolean)}
function directCandidates(){ return isWin() ? ['command-code.exe','commandcode.exe','cmdc.exe','command-code.cmd','commandcode.cmd','cmdc.cmd'] : ['command-code','commandcode','cmdc','cmd']; }

function npmGlobalEntry(){
  const override=process.env.COMMAND_CODE_NODE_ENTRY;
  if(override && fileExists(override)) return override;
  const npm=spawnSync(isWin()?'npm.cmd':'npm',['root','-g'],{encoding:'utf8',windowsHide:true});
  if(npm.status!==0) return null;
  const root=(npm.stdout||'').trim(); if(!root) return null;
  const pkg=path.join(root,'command-code','package.json'); if(!fileExists(pkg)) return null;
  try{
    const meta=JSON.parse(fs.readFileSync(pkg,'utf8'));
    const bin=meta.bin;
    let rel=null;
    if(typeof bin==='string') rel=bin;
    else if(bin && typeof bin==='object') rel=bin['command-code']||bin.commandcode||bin.cmdc||bin.cmd||Object.values(bin)[0];
    if(!rel) return null;
    const entry=path.resolve(path.dirname(pkg),rel);
    return fileExists(entry)?entry:null;
  }catch{return null;}
}

function findDirect(){
  const env=process.env.COMMAND_CODE_BIN;
  if(env && fileExists(env)) return env;
  for(const dir of splitPathEnv()){
    for(const name of directCandidates()){
      const p=path.join(dir,name);
      if(fileExists(p)) return p;
    }
  }
  const finder=isWin()?'where.exe':'which';
  for(const name of directCandidates()){
    const r=spawnSync(finder,[name.replace(/\.(exe|cmd)$/i,'')],{encoding:'utf8',windowsHide:true});
    if(r.status===0){
      for(const line of String(r.stdout||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean)){
        if(isWin() && /\\Windows\\System32\\cmd\.exe$/i.test(line)) continue;
        if(fileExists(line)) return line;
      }
    }
  }
  return null;
}

export function resolveCli(){
  const entry=npmGlobalEntry();
  if(entry) return {command:process.execPath,prefix:[entry],display:entry,kind:'npm-node-entry'};
  const direct=findDirect();
  if(direct){
    if(isWin() && /\.cmd$/i.test(direct)) return {command:process.env.ComSpec||'cmd.exe',prefix:['/d','/s','/c',direct],display:direct,kind:'cmd-shim'};
    return {command:direct,prefix:[],display:direct,kind:'binary'};
  }
  return null;
}

export function runSync(args,{cwd=process.cwd(),timeout=30000,input=null}={}){
  const cli=resolveCli(); if(!cli) return {status:127,stdout:'',stderr:'Command Code CLI not found',error:'not_found'};
  const res=spawnSync(cli.command,[...cli.prefix,...args],{cwd,encoding:'utf8',timeout,input,windowsHide:true});
  return {status:res.status??1,stdout:res.stdout||'',stderr:res.stderr||'',error:res.error?.message||null,cli};
}

export function parseJsonStream(text){
  const frames=[]; let result=null;
  for(const raw of String(text||'').split(/\r?\n/)){
    const line=raw.trim(); if(!line) continue;
    try{ const f=JSON.parse(line); frames.push(f); if(f?.type==='result') result=f; }catch{}
  }
  return {frames,result};
}

export function formatUsage(usage){
  if(!usage) return 'usage: unavailable';
  const flat=[];
  const walk=(v,p='')=>{
    if(v===null||v===undefined) return;
    if(typeof v==='number' || typeof v==='string' || typeof v==='boolean') flat.push([p,v]);
    else if(typeof v==='object') for(const [k,x] of Object.entries(v)) walk(x,p?`${p}.${k}`:k);
  };
  walk(usage);
  const interesting=flat.filter(([k])=>/token|cache|input|output|cost/i.test(k));
  const rows=interesting.length?interesting:flat;
  return rows.length ? rows.map(([k,v])=>`${k}: ${v}`).join('\n') : JSON.stringify(usage,null,2);
}

export function renderRun(run){
  const lines=[];
  if(run.jobId) lines.push(`## Job: ${run.jobId}`);
  if(run.model) lines.push(`model: ${run.model}${run.effort?` (${run.effort})`:''}`);
  if(run.sessionId) lines.push(`session: ${run.sessionId}`);
  if(run.exitCode!==undefined) lines.push(`exit: ${run.exitCode}`);
  lines.push('', '### Output', run.text?.trim()||'(no final text)');
  if(run.usage){ lines.push('', '### Usage / cache telemetry', '~~~text', formatUsage(run.usage), '~~~'); }
  if(run.stderr?.trim()){ lines.push('', '### stderr', '~~~text', run.stderr.trim().slice(0,4000), '~~~'); }
  return lines.join('\n')+'\n';
}

export async function runCli(args,{cwd=process.cwd(),onStart}={}){
  const cli=resolveCli(); if(!cli) throw new Error('Command Code CLI not found. Install it with: npm install -g command-code');
  return await new Promise((resolve,reject)=>{
    const child=spawn(cli.command,[...cli.prefix,...args],{cwd,stdio:['ignore','pipe','pipe'],windowsHide:true});
    onStart?.(child);
    let out='',err='';
    child.stdout.on('data',d=>out+=d.toString());
    child.stderr.on('data',d=>err+=d.toString());
    child.on('error',reject);
    child.on('close',code=>resolve({code:code??1,stdout:out,stderr:err,cli}));
  });
}

export function killPid(pid){
  if(!pid) return false;
  try{
    if(isWin()){
      const r=spawnSync('taskkill',['/PID',String(pid),'/T','/F'],{encoding:'utf8',windowsHide:true});
      return r.status===0;
    }
    process.kill(-pid,'SIGTERM'); return true;
  }catch{
    try{process.kill(pid,'SIGTERM'); return true;}catch{return false;}
  }
}
