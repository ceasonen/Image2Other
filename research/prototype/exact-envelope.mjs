// Exact response disagreement for a restricted two-layer diagram grammar.
// Free modules can parent labels and straight-connector endpoints; derived objects
// cannot parent other objects. This is a local mechanism, not raster inference.
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const dimensions=object=>object&&['x','y','w','h'].every(key=>finite(object[key]))&&object.w>0&&object.h>0;
const endpoint=object=>object&&['x1','y1','x2','y2'].every(key=>finite(object[key]));

function candidates(list,modules){
  if(!Array.isArray(list)||list.length===0)throw Error('Empty candidate family');
  for(const id of list)if(id!=='null'&&!modules.has(id))throw Error('Unknown candidate parent');
  return list;
}

function extrema(values){
  const xs=values.map(value=>value.x),ys=values.map(value=>value.y);
  return Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys));
}

export function exactEditEnvelope(objects,choices,target,patch,tolerance=0){
  if(!objects||!choices||!choices.labels||!choices.connectors)throw Error('Missing candidate families');
  if(!finite(tolerance)||tolerance<0)throw Error('Invalid tolerance');
  const derived=new Set([...Object.keys(choices.labels),...Object.keys(choices.connectors)]);
  const modules=new Set(Object.keys(objects).filter(id=>!derived.has(id)&&dimensions(objects[id])));
  if(!modules.has(target))throw Error('Unknown module edit target');
  if(!patch||Object.entries(patch).some(([key,value])=>!['x','y','w','h'].includes(key)||!finite(value)))throw Error('Invalid edit patch');
  const moved={...objects[target],...patch};
  if(!dimensions(moved))throw Error('Invalid dimensions');

  let diameter=0,choicesEvaluated=0,graphsRepresented=1;
  const ambiguous=[];
  const state=id=>id===target?moved:objects[id];
  const position=(anchor,id,boundary)=>{
    if(id==='null')return anchor;
    const before=objects[id],after=state(id);
    const u=(anchor.x-before.x)/before.w,v=(anchor.y-before.y)/before.h;
    if(boundary){
      const near=value=>Math.abs(value)<=1e-9||Math.abs(value-1)<=1e-9;
      if(u<0||u>1||v<0||v>1||(!near(u)&&!near(v)))throw Error('Incompatible boundary candidate');
    }
    return{x:after.x+u*after.w,y:after.y+v*after.h};
  };
  const evaluate=(list,anchor,boundary)=>{
    const possible=candidates(list,modules).map(id=>position(anchor,id,boundary));
    choicesEvaluated+=list.length;
    graphsRepresented*=list.length;
    return extrema(possible);
  };

  for(const [id,list] of Object.entries(choices.labels)){
    const label=objects[id];
    if(!label||!finite(label.x)||!finite(label.y)||typeof label.text!=='string')throw Error('Invalid label object');
    const spread=evaluate(list,{x:label.x,y:label.y},false);
    diameter=Math.max(diameter,spread);
    if(spread>tolerance)ambiguous.push(id);
  }
  for(const [id,lists] of Object.entries(choices.connectors)){
    const connector=objects[id];
    if(!endpoint(connector))throw Error('Invalid connector object');
    const source=evaluate(lists?.source,{x:connector.x1,y:connector.y1},true);
    const sink=evaluate(lists?.target,{x:connector.x2,y:connector.y2},true);
    const spread=Math.max(source,sink);
    diameter=Math.max(diameter,spread);
    if(spread>tolerance)ambiguous.push(id);
  }
  return{safe:ambiguous.length===0,ambiguous,diameter,choicesEvaluated,graphsRepresented};
}
