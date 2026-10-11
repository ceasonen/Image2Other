import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
async function mask(){const file=new URL('../src/ocr-mask.js',import.meta.url);assert.ok(existsSync(file),'Reviewed erase masks must be implemented');return import(file);}
test('a protect stroke keeps a thin crossing, while the rest of the box is erased',async()=>{
  const {createEraseMask}=await mask();
  const out=createEraseMask({width:40,height:20},[{mode:'keep',radius:.5,points:[{x:0,y:2},{x:39,y:2}]}]);
  for(let x=0;x<40;x++)assert.equal(out[2*40+x],0);
  assert.equal(out[10*40+20],1);
});
test('diagonal protection uses continuous segments, not separated pointer samples',async()=>{
  const {createEraseMask}=await mask();
  const out=createEraseMask({width:40,height:20},[{mode:'keep',radius:.6,points:[{x:0,y:0},{x:39,y:19}]}]);
  for(let x=0;x<40;x++)assert.equal(out[Math.round(x*19/39)*40+x],0);
});
test('erase brush can reverse earlier protection; strokes apply in order',async()=>{
  const {createEraseMask}=await mask();
  const out=createEraseMask({width:40,height:20},[{mode:'keep',radius:2,points:[{x:10,y:10}]},{mode:'erase',radius:.5,points:[{x:10,y:10}]}]);
  assert.equal(out[10*40+10],1);assert.equal(out[10*40+11],0);
});
test('mask work and geometry are bounded; malformed instructions are rejected',async()=>{
  const {createEraseMask}=await mask();
  for(const b of [{width:0,height:10},{width:NaN,height:10},{width:1024,height:1024}])assert.throws(()=>createEraseMask(b,[]));
  for(const s of [{mode:'keep',radius:NaN,points:[{x:1,y:1}]},{mode:'keep',radius:2,points:[{x:-1,y:1}]},{mode:'guess',radius:2,points:[{x:1,y:1}]},{mode:'keep',radius:2,points:[]}])assert.throws(()=>createEraseMask({width:10,height:10},[s]));
  assert.throws(()=>createEraseMask({width:10,height:10},Array(65).fill({mode:'keep',radius:1,points:[{x:1,y:1}]})));
});
test('component proposal protects a boundary-connected stroke, without retaining isolated glyphs',async()=>{
  const {proposeProtectedRuns,createEraseMask}=await mask();assert.equal(typeof proposeProtectedRuns,'function');
  const data=new Uint8ClampedArray(100*50*4).fill(255);
  const dot=(x,y)=>data.set([20,20,20,255],(y*100+x)*4);
  for(let x=0;x<100;x++)dot(x,12);for(let y=18;y<26;y++)for(let x=20;x<35;x++)dot(x,y);
  const box={x:10,y:10,width:40,height:20};
  const proposal=proposeProtectedRuns({width:100,height:50,data},{box,background:'#ffffff'});
  const out=createEraseMask(box,[],proposal.runs);
  for(let x=0;x<40;x++)assert.equal(out[2*40+x],0);
  assert.equal(out[10*40+15],1);assert.equal(proposal.protectedComponents,1);
});
test('component proposal preserves connected text too, rather than pretending an overlap was disentangled',async()=>{
  const {proposeProtectedRuns,createEraseMask}=await mask();assert.equal(typeof proposeProtectedRuns,'function');
  const data=new Uint8ClampedArray(100*50*4).fill(255);const dot=(x,y)=>data.set([20,20,20,255],(y*100+x)*4);
  for(let x=0;x<100;x++)dot(x,20);for(let y=18;y<26;y++)for(let x=20;x<35;x++)dot(x,y);
  const box={x:10,y:10,width:40,height:20},p=proposeProtectedRuns({width:100,height:50,data},{box,background:'#ffffff'});
  assert.equal(createEraseMask(box,[],p.runs)[14*40+15],0,'Joined glyph is not magically recovered');
  assert.ok(p.ambiguousComponents>0);
});
test('reviewed seed runs remain bounded and brush overrides work on the proposal',async()=>{
  const {createEraseMask}=await mask();
  assert.equal(createEraseMask({width:10,height:10},[],[{y:3,x0:1,x1:8}])[3*10+4],0);
  assert.equal(createEraseMask({width:10,height:10},[{mode:'erase',radius:.5,points:[{x:4,y:3}]}],[{y:3,x0:1,x1:8}])[3*10+4],1);
  assert.throws(()=>createEraseMask({width:10,height:10},[],[{y:3,x0:-1,x1:8}]));
  assert.throws(()=>createEraseMask({width:10,height:10},[],[{y:3,x0:8,x1:1}]));
});
