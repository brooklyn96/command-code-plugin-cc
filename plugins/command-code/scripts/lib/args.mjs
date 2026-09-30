const valueFlags=new Set(['--model','--effort','--base','--review-gate']);
const leadingBoolFlags=new Set(['--background','--wait','--resume','--fresh','--write','--read-only','--json','--auth-check','--clear-model','--clear-effort']);
export function shellSplit(s){
  const out=[]; let cur=''; let quote=null; let esc=false;
  for(const ch of String(s||'')){
    if(esc){cur+=ch;esc=false;continue}
    if(ch==='\\' && quote!=="'"){esc=true;continue}
    if(quote){ if(ch===quote){quote=null}else cur+=ch; continue; }
    if(ch==='"'||ch==="'"){quote=ch;continue}
    if(/\s/.test(ch)){ if(cur){out.push(cur);cur=''}; continue; }
    cur+=ch;
  }
  if(cur) out.push(cur); return out;
}

function tokenAt(s,from){
  let i=from; while(i<s.length && /\s/.test(s[i])) i++;
  if(i>=s.length) return null;
  const start=i; let cur=''; let quote=null;
  while(i<s.length){
    const ch=s[i];
    if(ch==='\\' && quote!=="'"){i++;if(i<s.length){cur+=s[i];i++}continue}
    if(quote){ if(ch===quote){quote=null;i++;continue} cur+=ch;i++;continue; }
    if(ch==='"'||ch==="'"){quote=ch;i++;continue}
    if(/\s/.test(ch)) break;
    cur+=ch;i++;
  }
  return {value:cur,start,end:i};
}

export function splitStdinInvocation(text){
  const s=String(text??'');
  const argv=[];
  let i=0, sawPrefix=false;
  for(;;){
    const t=tokenAt(s,i);
    if(!t) break;
    if(t.value==='--'){sawPrefix=true;i=t.end;break}
    if(valueFlags.has(t.value)){
      argv.push(t.value); sawPrefix=true;
      const v=tokenAt(s,t.end); if(!v){i=s.length;break}
      argv.push(v.value); i=v.end; continue;
    }
    if(leadingBoolFlags.has(t.value)){argv.push(t.value);sawPrefix=true;i=t.end;continue}
    break;
  }
  // With no recognised leading option the whole stdin string is the body. Otherwise the
  // separator is the spaces/tabs after the last option (or after `--`) plus at most one
  // line break; every byte after it is the body.
  if(!sawPrefix) return {argv,rest:s};
  return {argv,rest:s.slice(i+/^[ \t]*(?:\r?\n)?/.exec(s.slice(i))[0].length)};
}

export function parseInvocation(argv){
  const a=[...argv]; const f={positional:[],background:false,wait:false,resume:false,fresh:false,write:false,readOnly:false,json:false,authCheck:false,clearModel:false,clearEffort:false};
  let flagsOpen=true;
  for(let i=0;i<a.length;i++){
    const x=a[i];
    if(flagsOpen && x==='--'){flagsOpen=false;continue}
    if(flagsOpen && valueFlags.has(x)){f[x.slice(2).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=a[++i];continue}
    if(flagsOpen && x==='--background'){f.background=true;continue}
    if(flagsOpen && x==='--wait'){f.wait=true;continue}
    if(flagsOpen && x==='--resume'){f.resume=true;continue}
    if(flagsOpen && x==='--fresh'){f.fresh=true;continue}
    if(flagsOpen && x==='--write'){f.write=true;continue}
    if(flagsOpen && x==='--read-only'){f.readOnly=true;continue}
    if(flagsOpen && x==='--json'){f.json=true;continue}
    if(flagsOpen && x==='--auth-check'){f.authCheck=true;continue}
    if(flagsOpen && x==='--clear-model'){f.clearModel=true;continue}
    if(flagsOpen && x==='--clear-effort'){f.clearEffort=true;continue}
    f.positional.push(x);
  }
  return f;
}
