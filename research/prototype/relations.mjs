// Conditional executor: supplied relationships, not relationships inferred from pixels.
const parents=r=>r.type==='label'?[r.parent]:r.type==='connector'?[r.source,r.target]:(()=>{throw Error('Unsupported rule');})();
function order(graph){
  const ids=Object.keys(graph.objects),rules=new Map();
  for(const r of graph.rules){if(!ids.includes(r.id)||rules.has(r.id))throw Error('Missing object or multiple writers');rules.set(r.id,r);for(const p of parents(r))if(!ids.includes(p))throw Error('Missing parent');}
  const result=[],temporary=new Set(),visited=new Set();
  function visit(id){if(temporary.has(id))throw Error('Dependency cycle');if(visited.has(id))return;temporary.add(id);if(rules.has(id))parents(rules.get(id)).forEach(visit);temporary.delete(id);visited.add(id);result.push(id);}
  ids.forEach(visit);return {ids:result,rules};
}
function point(object,u,v){if(![object.x,object.y,object.w,object.h,u,v].every(Number.isFinite)||object.w<=0||object.h<=0)throw Error('Invalid dimensions or attachment');return{x:object.x+u*object.w,y:object.y+v*object.h};}
function derive(graph,r){
  const old=graph.objects[r.id];
  if(r.type==='label')return{...old,...point(graph.objects[r.parent],r.u,r.v)};
  const start=point(graph.objects[r.source],r.su,r.sv),end=point(graph.objects[r.target],r.tu,r.tv);
  return{...old,x1:start.x,y1:start.y,x2:end.x,y2:end.y};
}
export function materialize(input){const graph=structuredClone(input),{ids,rules}=order(graph);for(const id of ids)if(rules.has(id))graph.objects[id]=derive(graph,rules.get(id));return graph;}
export function edit(input,id,patch){
  const graph=structuredClone(input),{ids,rules}=order(graph);if(!graph.objects[id])throw Error('Unknown edit target');
  if(rules.has(id)&&Object.keys(patch).some(k=>k!=='text'))throw Error('Edit the parent module to change derived geometry.');
  if(Object.keys(patch).some(k=>!['x','y','w','h','text'].includes(k)))throw Error('Unsupported edit field');
  if(Object.entries(patch).some(([k,v])=>k==='text'?typeof v!=='string':!Number.isFinite(v)))throw Error('Invalid edit value');
  if(['w','h'].some(k=>patch[k]!==undefined&&patch[k]<=0))throw Error('Invalid dimensions');
  graph.objects[id]={...graph.objects[id],...patch};
  const affected=new Set([id]);for(const target of ids){const rule=rules.get(target);if(rule&&parents(rule).some(p=>affected.has(p))){affected.add(target);graph.objects[target]=derive(graph,rule);}}
  return {...graph,affected:[...affected]};
}
export function editDisagreement(candidates,id,patch,tolerance=1e-8){
  if(candidates.length<1)throw Error('No graph candidates');
  if(!Number.isFinite(tolerance)||tolerance<0)throw Error('Invalid agreement tolerance');
  const results=candidates.map(g=>edit(g,id,patch));
  const inventories=new Set(results.flatMap(result=>Object.keys(result.objects)));
  const ambiguous=[...inventories].filter(key=>results.slice(1).some(other=>{
    const first=results[0].objects[key],second=other.objects[key];
    if(!first||!second)return true;
    const fields=new Set([...Object.keys(first),...Object.keys(second)]);
    return [...fields].some(field=>{
      if(typeof first[field]!==typeof second[field])return true;
      if(typeof first[field]==='number')return !Number.isFinite(first[field])||!Number.isFinite(second[field])||Math.abs(first[field]-second[field])>tolerance;
      return first[field]!==second[field];
    });
  }));return{safe:ambiguous.length===0,ambiguous,results};
}
