// Infer local attachment candidates from externally observed before/after edits.
// The edit response MUST come from an authoring source or a user's confirmation;
// self-rendering candidate edits cannot reveal which hidden relation was intended.
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const box=value=>value&&['x','y','w','h'].every(key=>finite(value[key]))&&value.w>0&&value.h>0;
const nearBoundary=value=>Math.abs(value)<=1e-9||Math.abs(value-1)<=1e-9;

export function inferResponseRelations(objects,choices,examples,{tolerance=1e-6}={}){
  if(!objects||!choices?.labels||!choices?.connectors)throw Error('Missing candidate families');
  if(!Array.isArray(examples)||examples.length===0)throw Error('At least one external edit observation is required');
  if(!finite(tolerance)||tolerance<0)throw Error('Invalid tolerance');
  const derived=new Set([...Object.keys(choices.labels),...Object.keys(choices.connectors)]);
  const modules=new Set(Object.keys(objects).filter(id=>!derived.has(id)&&box(objects[id])));
  const validList=list=>{
    if(!Array.isArray(list)||!list.length)throw Error('Empty candidate family');
    for(const parent of list)if(parent!=='null'&&!modules.has(parent))throw Error('Unknown candidate parent');
    return list;
  };
  const observations=examples.map(example=>{
    if(!modules.has(example?.target))throw Error('Unknown edit target');
    if(!example.patch||Object.entries(example.patch).some(([key,value])=>!['x','y','w','h'].includes(key)||!finite(value)))
      throw Error('Invalid edit patch');
    const after={...objects[example.target],...example.patch};
    if(!box(after))throw Error('Invalid edited dimensions');
    for(const id of Object.keys(choices.labels))
      if(!example.observed?.[id]||!['x','y'].every(key=>finite(example.observed[id][key])))throw Error('Missing observed label response');
    for(const id of Object.keys(choices.connectors))
      if(!example.observed?.[id]||!['x1','y1','x2','y2'].every(key=>finite(example.observed[id][key])))throw Error('Missing observed connector response');
    return{target:example.target,after,observed:example.observed};
  });
  const predict=(anchor,parent,example,boundary)=>{
    if(parent==='null')return anchor;
    const before=objects[parent],after=parent===example.target?example.after:before;
    const u=(anchor.x-before.x)/before.w,v=(anchor.y-before.y)/before.h;
    if(boundary&&(u<0||u>1||v<0||v>1||(!nearBoundary(u)&&!nearBoundary(v))))
      throw Error('Incompatible boundary candidate');
    return{x:after.x+u*after.w,y:after.y+v*after.h};
  };
  const retained=(list,anchor,fields,boundary)=>validList(list).filter(parent=>observations.every(example=>{
    const point=predict(anchor,parent,example,boundary);
    const observed=example.observed[fields.id];
    return Math.max(Math.abs(point.x-observed[fields.x]),Math.abs(point.y-observed[fields.y]))<=tolerance;
  }));
  const result={labels:{},connectors:{}},unsupported=[];
  for(const [id,list] of Object.entries(choices.labels)){
    const label=objects[id];
    if(!label||!finite(label.x)||!finite(label.y)||typeof label.text!=='string')throw Error('Invalid label object');
    result.labels[id]=retained(list,{x:label.x,y:label.y},{id,x:'x',y:'y'},false);
    if(!result.labels[id].length)unsupported.push(id);
  }
  for(const [id,ends] of Object.entries(choices.connectors)){
    const edge=objects[id];
    if(!edge||!['x1','y1','x2','y2'].every(key=>finite(edge[key])))throw Error('Invalid connector object');
    result.connectors[id]={
      source:retained(ends?.source,{x:edge.x1,y:edge.y1},{id,x:'x1',y:'y1'},true),
      target:retained(ends?.target,{x:edge.x2,y:edge.y2},{id,x:'x2',y:'y2'},true)
    };
    if(!result.connectors[id].source.length)unsupported.push(`${id}:start`);
    if(!result.connectors[id].target.length)unsupported.push(`${id}:end`);
  }
  return{choices:result,unsupported,observationsUsed:examples.length};
}
