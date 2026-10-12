import {validateScene,pathToPoints,nodeBounds} from './scene.js';
export {nodeBounds};
export function selectionBounds(scene,ids){
  if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length)throw Error('Select one or more distinct layers.');
  const boxes=ids.map(id=>{const n=scene.nodes.find(n=>n.id===id);if(!n)throw Error('Unknown layer.');return nodeBounds(n);});
  const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
  return{x,y,width:Math.max(...boxes.map(b=>b.x+b.width))-x,height:Math.max(...boxes.map(b=>b.y+b.height))-y};
}
function translated(node,dx,dy){
  if(node.type!=='path')return{...node,x:node.x+dx,y:node.y+dy,...(node.type==='line'?{x2:node.x2+dx,y2:node.y2+dy}:{})};
  const d=pathToPoints(node.d,1).map(p=>{
    if(p.close)return 'Z';if(!p.curve)return`${p.moveTo?'M':'L'} ${p.x+dx} ${p.y+dy}`;
    const c=p.curve;return c.type==='quadratic'?`Q ${c.x1+dx} ${c.y1+dy} ${p.x+dx} ${p.y+dy}`:`C ${c.x1+dx} ${c.y1+dy} ${c.x2+dx} ${c.y2+dy} ${p.x+dx} ${p.y+dy}`;
  }).join(' ');return{...node,d};
}
export function moveSelection(input,ids,position){
  const scene=validateScene(input),bounds=selectionBounds(scene,ids);
  if(scene.connections?.some(c=>ids.includes(c.lineId)))throw Error('Detach the line before moving it, or move its attached artwork.');
  if(!position||Object.keys(position).some(k=>!['x','y'].includes(k))||Object.values(position).some(v=>!Number.isFinite(v)))throw Error('Position must have finite X/Y coordinates.');
  const dx=(position.x??bounds.x)-bounds.x,dy=(position.y??bounds.y)-bounds.y,selected=new Set(ids);
  return validateScene({...scene,nodes:scene.nodes.map(n=>selected.has(n.id)?translated(n,dx,dy):n)});
}
export const ATTACHMENT_PORTS=[
  {name:'Top left',u:0,v:0},{name:'Top',u:.5,v:0},{name:'Top right',u:1,v:0},
  {name:'Right',u:1,v:.5},{name:'Bottom right',u:1,v:1},{name:'Bottom',u:.5,v:1},
  {name:'Bottom left',u:0,v:1},{name:'Left',u:0,v:.5}
];
export function nearestPort(node,x,y){
  const b=nodeBounds(node);
  return ATTACHMENT_PORTS.reduce((best,p)=>Math.hypot(b.x+p.u*b.width-x,b.y+p.v*b.height-y)<Math.hypot(b.x+best.u*b.width-x,b.y+best.v*b.height-y)?p:best);
}
export function setLineAttachment(input,lineId,end,anchor){
  const scene=validateScene(input);
  if(!['start','end'].includes(end)||scene.nodes.find(n=>n.id===lineId)?.type!=='line')throw Error('Choose a line endpoint.');
  const connections=(scene.connections??[]).map(c=>({...c}));
  let connection=connections.find(c=>c.lineId===lineId);
  if(!connection){connection={lineId};connections.push(connection);}
  if(anchor===null)delete connection[end];else connection[end]=anchor;
  return validateScene({...scene,connections:connections.filter(c=>c.start||c.end)});
}
export function removeLayers(input,ids){
  const scene=validateScene(input);selectionBounds(scene,ids);const removed=new Set(ids);
  const connections=(scene.connections??[]).filter(c=>!removed.has(c.lineId)).map(c=>{
    const result={lineId:c.lineId};
    for(const end of ['start','end'])if(c[end]&&!removed.has(c[end].nodeId))result[end]=c[end];
    return result;
  }).filter(c=>c.start||c.end);
  return validateScene({...scene,nodes:scene.nodes.filter(n=>!removed.has(n.id)),connections});
}
