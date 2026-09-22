import { spawnSync } from 'node:child_process';
function git(args,{max=200000}={}){
  const r=spawnSync('git',args,{encoding:'utf8',maxBuffer:max,windowsHide:true});
  return r.status===0?(r.stdout||'').trim():'';
}
export function reviewContext(base){
  const status=git(['status','--short']);
  const staged=git(['diff','--cached']);
  const unstaged=git(['diff']);
  const against=base?git(['diff',`${base}...HEAD`]):'';
  return {status,staged,unstaged,against,base:base||null};
}
export function buildReviewPrompt({adversarial=false,base=null,focus=''}){
  const c=reviewContext(base);
  const mode=adversarial
    ? 'Perform an adversarial code/design review. Challenge assumptions and search for concrete failure modes.'
    : 'Perform a senior code review. Focus on correctness, regressions, security, data loss, concurrency, and missing tests.';
  return `${mode}\nDo not modify files.\n${focus?`Extra focus: ${focus}\n`:''}\nGit status:\n${c.status||'(clean)'}\n\n${base?`Diff against ${base}:\n${c.against||'(none)'}\n\n`:''}Staged diff:\n${c.staged||'(none)'}\n\nUnstaged diff:\n${c.unstaged||'(none)'}\n`;
}
