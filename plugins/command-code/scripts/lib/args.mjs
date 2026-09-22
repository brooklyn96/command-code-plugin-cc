const valueFlags=new Set(['--model','--effort','--base','--review-gate']);
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
