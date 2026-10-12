export const MAX_NODES = 2000;
export const FONT_FACES=['Times New Roman','Arial','Calibri','Georgia'];
export const escapeXml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
const number = (value, label, min = -20000, max = 20000) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be finite and within ${min}–${max}`);
  return value;
};
const color = (value, fallback) => {
  const result = value ?? fallback;
  if (result !== 'none' && !/^#[0-9a-f]{6}$/i.test(result)) throw new Error('Invalid color: use #RRGGBB or none');
  return result;
};
export function validateScene(input) {
  if (!input || !Array.isArray(input.nodes) || input.nodes.length > MAX_NODES) throw new Error(`Scene needs at most ${MAX_NODES} nodes`);
  const width = number(input.width, 'width', 1, 16000), height = number(input.height, 'height', 1, 16000);
  const reserved=new Set();
  for(const node of input.nodes)if(node?.id!==undefined){
    if(typeof node.id!=='string'||! /^[a-zA-Z0-9_-]{1,80}$/.test(node.id)||reserved.has(node.id))throw Error('Invalid or duplicate layer ID.');
    reserved.add(node.id);
  }
  const nodes = input.nodes.map((node, i) => {
    if (!node || !['rect','ellipse','line','text','path'].includes(node.type)) throw new Error('Unsupported scene node');
    let id=node.id;if(id===undefined){let index=i;while(reserved.has(`node-${index}`))index++;id=`node-${index}`;reserved.add(id);}
    const result = { id, name:String(node.name ?? node.id ?? `${node.type} ${i+1}`).slice(0,100), type:node.type,
      fill:color(node.fill, node.type === 'line' ? 'none' : '#111111'), stroke:color(node.stroke,'none'),
      strokeWidth:number(node.strokeWidth ?? 0, 'strokeWidth',0,100), opacity:number(node.opacity ?? 1,'opacity',0,1) };
    if (node.type === 'path') {
      if (typeof node.d !== 'string' || node.d.length > 200000) throw new Error('Invalid vector path');
      pathToPoints(node.d, 1); result.d=node.d;
    } else {
      result.x=number(node.x,'x'); result.y=number(node.y,'y');
      if (node.type === 'line') {
        result.x2=number(node.x2,'x2'); result.y2=number(node.y2,'y2'); result.arrow=Boolean(node.arrow);
      } else {
        result.width=number(node.width,'node width',.01,16000); result.height=number(node.height,'node height',.01,16000);
        if (node.type === 'rect') result.radius=number(node.radius ?? 0,'radius',0,1000);
        if (node.type === 'text') {
          if (typeof node.text !== 'string' || node.text.length > 5000) throw new Error('Invalid text');
          result.text=node.text; result.fontSize=number(node.fontSize ?? 16,'fontSize',1,500);
          result.bold=Boolean(node.bold); result.align=['left','center','right'].includes(node.align) ? node.align : 'left';
          result.fontFace=node.fontFace??'Times New Roman';
          if(!FONT_FACES.includes(result.fontFace))throw Error('Unsupported font family.');
          if(node.fitWidth)result.fitWidth=true;
        }
      }
    }
    return result;
  });
  const connections=[],byId=new Map(nodes.map(n=>[n.id,n])),bound=new Set();
  if(input.connections!==undefined){
    if(!Array.isArray(input.connections)||input.connections.length>MAX_NODES)throw Error('Invalid line attachments.');
    for(const connection of input.connections){
      const line=byId.get(connection?.lineId);
      if(line?.type!=='line'||bound.has(line.id))throw Error('Attachment needs a unique line.');
      const result={lineId:line.id};
      for(const end of ['start','end'])if(connection[end]!==undefined){
        const anchor=connection[end],target=byId.get(anchor?.nodeId);
        if(!target||!['rect','ellipse','path'].includes(target.type))throw Error('Attachment target must be artwork.');
        const u=number(anchor.u,'attachment u',0,1),v=number(anchor.v,'attachment v',0,1),b=nodeBounds(target);
        result[end]={nodeId:target.id,u,v};
        line[end==='start'?'x':'x2']=number(b.x+u*b.width,'attached X');
        line[end==='start'?'y':'y2']=number(b.y+v*b.height,'attached Y');
      }
      if(!result.start&&!result.end)throw Error('Attachment needs an endpoint.');
      bound.add(line.id);connections.push(result);
    }
  }
  return {width,height,background:color(input.background,'none'),nodes,engine:String(input.engine ?? 'scene').slice(0,50),...(connections.length?{connections}:{})};
}
export function sceneToSvg(input, { selected = null } = {}) {
  const scene=validateScene(input);
  const selection=new Set(Array.isArray(selected)?selected:selected?[selected]:[]);
  const elements=scene.nodes.map(node => {
    const style=`data-node-id="${node.id}" fill="${node.fill}" stroke="${node.stroke}" stroke-width="${node.strokeWidth}" opacity="${node.opacity}"`;
    let shape='';
    if(node.type==='rect') shape=`<rect ${style} x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="${node.radius}"/>`;
    if(node.type==='ellipse') shape=`<ellipse ${style} cx="${node.x+node.width/2}" cy="${node.y+node.height/2}" rx="${node.width/2}" ry="${node.height/2}"/>`;
    if(node.type==='line') {
      const connection=scene.connections?.find(c=>c.lineId===node.id);
      const metadata=['start','end'].map(end=>connection?.[end]?` data-${end}-node="${connection[end].nodeId}" data-${end}-u="${connection[end].u}" data-${end}-v="${connection[end].v}"`:'').join('');
      shape=`<line ${style}${metadata} x1="${node.x}" y1="${node.y}" x2="${node.x2}" y2="${node.y2}"${node.arrow?' marker-end="url(#arrow)"':''}/>`;
    }
    if(node.type==='path') shape=`<path ${style} d="${escapeXml(node.d)}"/>`;
    if(node.type==='text') {
      const offset=node.align==='center'?node.width/2:node.align==='right'?node.width:0;
      const anchor=node.align==='center'?'middle':node.align==='right'?'end':'start';
      const family=node.fontFace==='Times New Roman'?'Times New Roman, Times, serif':node.fontFace+', '+(node.fontFace==='Georgia'?'serif':'sans-serif');
      shape=`<text ${style} x="${node.x+offset}" y="${node.y}" font-family="${family}" font-size="${node.fontSize}" font-weight="${node.bold?700:400}" text-anchor="${anchor}" dominant-baseline="hanging">${node.text.split('\n').map((line,i)=>`<tspan x="${node.x+offset}" dy="${i?node.fontSize*1.2:0}"${node.fitWidth?` textLength="${node.width}" lengthAdjust="spacingAndGlyphs"`:''}>${escapeXml(line)}</tspan>`).join('')}</text>`;
    }
    return `<g${selection.has(node.id)?' class="selected-layer"':''}><title>${escapeXml(node.name)}</title>${shape}</g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M 0 0 L 8 4 L 0 8 Z" fill="context-stroke"/></marker></defs>${scene.background==='none'?'':`<rect width="100%" height="100%" fill="${scene.background}"/>`}${elements.join('')}</svg>`;
}
export function pathToPoints(d, scale) {
  if(typeof d!=='string' || !d.trim() || /[^MLQCZ\d\s.,+eE-]/.test(d)) throw new Error('Unsupported path commands; use absolute M, L, Q, C, Z');
  const tokens=d.match(/[MLQCZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi)??[];
  const points=[]; let i=0;
  while(i<tokens.length) {
    const command=tokens[i++];
    if(!['M','L','Q','C','Z'].includes(command)) throw new Error('Unsupported path syntax');
    if(command==='Z') { points.push({close:true}); continue; }
    const read=()=>number(Number(tokens[i++]),'path coordinate')*scale;
    if(command==='M'||command==='L') points.push({x:read(),y:read(),...(command==='M'?{moveTo:true}:{})});
    if(command==='Q') { const x1=read(),y1=read(); points.push({x:read(),y:read(),curve:{type:'quadratic',x1,y1}}); }
    if(command==='C') { const x1=read(),y1=read(),x2=read(),y2=read(); points.push({x:read(),y:read(),curve:{type:'cubic',x1,y1,x2,y2}}); }
  }
  if(!points.length || !points[0].moveTo) throw new Error('Path must start with M');
  return points;
}
const roots=(a,b,c)=>{
  if(Math.abs(a)<1e-12)return Math.abs(b)<1e-12?[]:[-c/b];
  const d=b*b-4*a*c;if(d<0)return [];return [(-b+Math.sqrt(d))/(2*a),(-b-Math.sqrt(d))/(2*a)];
};
export function nodeBounds(node){
  if(node.type==='line')return{x:Math.min(node.x,node.x2),y:Math.min(node.y,node.y2),width:Math.abs(node.x2-node.x),height:Math.abs(node.y2-node.y)};
  if(node.type!=='path')return{x:node.x,y:node.y,width:node.width,height:node.height};
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,current,start;
  const include=p=>{minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);};
  for(const p of pathToPoints(node.d,1)){
    if(p.close){current=start;continue;}
    if(p.moveTo){current=start=p;include(p);continue;}
    include(p);
    if(p.curve){
      const c=p.curve,cubic=c.type==='cubic';
      const extrema=['x','y'].flatMap(axis=>{
        const a=current[axis],b=c[axis+'1'],d=p[axis];
        return cubic?roots(-a+3*b-3*c[axis+'2']+d,2*(a-2*b+c[axis+'2']),b-a):roots(0,a-2*b+d,b-a);
      });
      for(const t of extrema.filter(t=>t>0&&t<1)){
        const u=1-t,out={};for(const axis of ['x','y'])out[axis]=cubic?u**3*current[axis]+3*u*u*t*c[axis+'1']+3*u*t*t*c[axis+'2']+t**3*p[axis]:u*u*current[axis]+2*u*t*c[axis+'1']+t*t*p[axis];include(out);
      }
    }
    current=p;
  }
  return{x:minX,y:minY,width:maxX-minX,height:maxY-minY};
}
const pathData=(path,reverse=false)=>{
  let segments=path.segments;
  if(!segments.length) return '';
  if(reverse) segments=[...segments].reverse().map(s=>s.type==='L'?{...s,x1:s.x2,y1:s.y2,x2:s.x1,y2:s.y1}:{...s,x1:s.x3,y1:s.y3,x3:s.x1,y3:s.y1});
  return `M ${segments[0].x1} ${segments[0].y1} `+segments.map(s=>s.type==='L'?`L ${s.x2} ${s.y2}`:`Q ${s.x2} ${s.y2} ${s.x3} ${s.y3}`).join(' ')+' Z';
};
export function traceToScene(data) {
  const nodes=[];
  data.layers.forEach((layer,i)=>{
    const c=data.palette[i]; if(!c || c.a===0) return;
    const fill='#'+[c.r,c.g,c.b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
    layer.forEach(path=>{
      if(path.isholepath || !path.segments.length) return;
      const d=[pathData(path),...(path.holechildren??[]).map(child=>pathData(layer[child],true))].join(' ');
      nodes.push({id:`trace-${nodes.length}`,name:`Color ${fill} / shape ${nodes.length+1}`,type:'path',d,fill,opacity:c.a/255});
    });
  });
  return validateScene({width:data.width,height:data.height,background:'none',engine:'local-trace',nodes});
}
export function outputName(name, extension) {
  const base=String(name).split(/[\\/]/).pop().replace(/\.[^.]+$/,'').replace(/[\x00-\x1f<>:"|?*]/g,'').trim() || 'image2other';
  return `${base}.${extension}`;
}
