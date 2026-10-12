import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {pathToPoints} from '../src/scene.js';
const file=new URL('../src/geometry-edit.js',import.meta.url),api=existsSync(file)?await import(file):{};
test('path bounds use Bezier extrema rather than the control-point rectangle',()=>{
  assert.equal(typeof api.nodeBounds,'function');
  assert.deepEqual(api.nodeBounds({type:'path',d:'M 0 0 Q 50 100 100 0'}),{x:0,y:0,width:100,height:50});
  assert.deepEqual(api.nodeBounds({type:'path',d:'M 0 0 C 0 100 100 100 100 0'}),{x:0,y:0,width:100,height:75});
});
test('moving actual path coordinates preserves curves and hole contours, not a raster or transform wrapper',()=>{
  assert.equal(typeof api.moveSelection,'function');
  const scene={width:300,height:200,nodes:[{type:'path',d:'M 0 0 Q 50 100 100 0 Z M 10 5 L 20 5 L 20 10 Z',fill:'#112233'},{type:'text',x:20,y:20,width:40,height:20,text:'Label'}]};
  const moved=api.moveSelection(scene,['node-0'],{x:30,y:40});
  assert.equal(pathToPoints(moved.nodes[0].d,1).filter(p=>p.moveTo).length,2);
  assert.deepEqual(api.nodeBounds(moved.nodes[0]),{x:30,y:40,width:100,height:50});
  assert.equal(moved.nodes[1].x,20);assert.equal(scene.nodes[0].d.startsWith('M 0 0'),true);
});
test('explicit multi-layer moves preserve relative offsets and leave unrelated geometry unchanged',()=>{
  assert.equal(typeof api.moveSelection,'function');
  const scene={width:300,height:200,nodes:[{type:'rect',x:10,y:10,width:100,height:50},{type:'text',x:20,y:20,width:40,height:20,text:'A'},{type:'line',x:120,y:30,x2:200,y2:30}]};
  const moved=api.moveSelection(scene,['node-0','node-1'],{x:60,y:70});
  assert.equal(moved.nodes[0].x,60);assert.equal(moved.nodes[1].x,70);assert.equal(moved.nodes[1].y,80);
  assert.equal(moved.nodes[2].x,120);assert.equal(moved.nodes[2].x2,200);
  const line=api.moveSelection(scene,['node-2'],{x:150,y:40});assert.equal(line.nodes[2].x2,230);
  assert.throws(()=>api.moveSelection(scene,['missing'],{x:5}));assert.throws(()=>api.moveSelection(scene,['node-0'],{x:Infinity}));
});
test('bounded curve families round-trip after forward and inverse moves without losing topology',()=>{
  const paths=['M 0 0 Q 50 100 100 0 Z','M -10 -5 C 0 100 100 -50 120 10 Z','M 3 7 L 90 7 L 90 80 Z M 12 20 Q 25 35 12 50 Z','M 0 0 C 20 0 40 0 60 0'];
  const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);
  for(const d of paths)for(const dx of [-20,0,13.5])for(const dy of [-10,0,27.25]){
    const original={width:400,height:300,nodes:[{type:'path',d}]},b=api.nodeBounds(original.nodes[0]);
    const moved=api.moveSelection(original,['node-0'],{x:b.x+dx,y:b.y+dy});
    const restored=api.moveSelection(moved,['node-0'],{x:b.x,y:b.y});
    const before=pathToPoints(d,1),after=pathToPoints(restored.nodes[0].d,1);assert.equal(after.length,before.length);
    for(let i=0;i<before.length;i++){assert.equal(after[i].close,before[i].close);assert.equal(after[i].moveTo,before[i].moveTo);if(before[i].close)continue;near(after[i].x,before[i].x);near(after[i].y,before[i].y);if(before[i].curve){assert.equal(after[i].curve.type,before[i].curve.type);for(const key of ['x1','y1',...(before[i].curve.type==='cubic'?['x2','y2']:[])])near(after[i].curve[key],before[i].curve[key]);}}
  }
});
test('moving a module updates only its attached line endpoint, with a fixed opposite module',()=>{
  const scene={width:400,height:200,nodes:[{id:'a',type:'rect',x:20,y:30,width:80,height:40},{id:'b',type:'rect',x:200,y:30,width:80,height:40},{id:'line',type:'line',x:100,y:50,x2:200,y2:50}],connections:[{lineId:'line',start:{nodeId:'a',u:1,v:.5},end:{nodeId:'b',u:0,v:.5}}]};
  const moved=api.moveSelection(scene,['a'],{x:60,y:70});
  assert.equal(moved.nodes[2].x,140);assert.equal(moved.nodes[2].y,90);
  assert.equal(moved.nodes[2].x2,200);assert.equal(moved.nodes[2].y2,50);
  assert.throws(()=>api.moveSelection(scene,['line'],{x:50}),/attach/i);
});
test('manual binding, detaching and removal preserve stable IDs without dangling constraints',()=>{
  assert.equal(typeof api.setLineAttachment,'function');assert.equal(typeof api.removeLayers,'function');
  const scene={width:300,height:200,nodes:[{id:'box',type:'rect',x:10,y:20,width:80,height:40},{id:'line',type:'line',x:95,y:40,x2:180,y2:40},{id:'label',type:'text',x:25,y:25,width:30,height:20,text:'A'}]};
  const bound=api.setLineAttachment(scene,'line','start',{nodeId:'box',u:1,v:.5});
  assert.equal(bound.nodes[1].x,90);assert.equal(bound.connections[0].start.nodeId,'box');
  const detached=api.setLineAttachment(bound,'line','start',null);assert.equal(detached.connections,undefined);assert.equal(detached.nodes[1].x,90);
  const removed=api.removeLayers(bound,['box']);assert.deepEqual(removed.nodes.map(n=>n.id),['line','label']);assert.equal(removed.connections,undefined);
  assert.equal(removed.nodes[0].x,90);assert.equal(scene.nodes[1].x,95);
  assert.throws(()=>api.setLineAttachment(scene,'line','start',{nodeId:'label',u:0,v:0}));
  assert.throws(()=>api.setLineAttachment(scene,'line','other',null));
});
