import test from 'node:test';
import assert from 'node:assert/strict';
import {pixelMetrics,refineSelection,feedbackManifest} from '../src/feedback-loop.js';

const image=(width,height,ink=[])=>{
  const data=new Uint8ClampedArray(width*height*4).fill(255);
  for(const [x,y] of ink){const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=0;}
  return {width,height,data};
};
const scene={width:20,height:12,background:'#ffffff',nodes:[
  {id:'box',type:'rect',name:'Box',x:7,y:4,width:2,height:2,fill:'#000000'},
  {id:'label',type:'text',name:'Label',x:0,y:0,width:4,height:2,text:'A',fontSize:9,fill:'#000000'}
]};
const raster=doc=>{
  const box=doc.nodes.find(n=>n.id==='box');
  return image(20,12,[[box.x,box.y],[box.x+1,box.y],[box.x,box.y+1],[box.x+1,box.y+1]]);
};

test('pixel comparison reports exact error and a localized heatmap',()=>{
  const result=pixelMetrics(image(2,1,[[0,0]]),image(2,1));
  assert.equal(result.mae,127.5);
  assert.equal(result.changedFraction,0.5);
  assert.deepEqual([...result.heatmap.slice(0,4)],[225,72,80,220]);
  assert.deepEqual([...result.heatmap.slice(4,8)],[0,0,0,0]);
  assert.throws(()=>pixelMetrics(image(2,1),image(1,2)),/same dimensions/);
});

test('bounded feedback loop accepts only lower raster error and retains unrelated layers',async()=>{
  const reference=image(20,12,[[5,4],[6,4],[5,5],[6,5]]);
  const result=await refineSelection({scene,selectedIds:['box'],reference,render:async doc=>raster(doc),steps:[2,1]});
  assert.equal(result.initial.mae>0,true);
  assert.equal(result.final.mae,0);
  assert.equal(result.scene.nodes[0].x,5);
  assert.equal(result.scene.nodes[1].id,scene.nodes[1].id);
  assert.equal(result.scene.nodes[1].x,scene.nodes[1].x);
  assert.equal(result.scene.nodes[1].text,scene.nodes[1].text);
  assert.deepEqual(result.accepted.map(x=>[x.dx,x.dy]),[[-2,0]]);
  assert.equal(result.trials.length,8);
});

test('feedback loop keeps original scene if no candidate improves and rejects invalid selection',async()=>{
  const reference=raster(scene);
  const result=await refineSelection({scene,selectedIds:['box'],reference,render:async doc=>raster(doc),steps:[2]});
  assert.equal(result.final.mae,0);
  assert.equal(result.accepted.length,0);
  assert.deepEqual(result.scene,scene);
  await assert.rejects(()=>refineSelection({scene,selectedIds:['missing'],reference,render:raster}),/Unknown layer/);
});

test('dataset manifest distinguishes automatic feedback from verified labels',()=>{
  const manifest=feedbackManifest({scene,sourceName:'figure.png',originalWidth:40,originalHeight:24,comparisonWidth:10,comparisonHeight:6,history:[{round:0,mae:10}],trials:[{step:2,dx:-2,dy:0,mae:5,accepted:true}]});
  assert.equal(manifest.annotationStatus,'unverified');
  assert.equal(manifest.reference.kind,'uploaded-image-raster');
  assert.equal(manifest.reference.width,10);
  assert.equal(manifest.scene.width,20);
  assert.equal(manifest.source.originalWidth,40);
  assert.equal(manifest.checks.textCorrect,null);
  assert.equal(manifest.checks.connectionsCorrect,null);
  assert.equal(manifest.history.length,1);
  assert.throws(()=>feedbackManifest({scene,originalWidth:20,originalHeight:12,trials:Array(81).fill({})}),/new comparison/);
});

test('attached lines must be refined through their target artwork',async()=>{
  const attached={...scene,nodes:[...scene.nodes,{id:'arrow',type:'line',x:9,y:5,x2:15,y2:5,stroke:'#000000',strokeWidth:1}],connections:[{lineId:'arrow',start:{nodeId:'box',u:1,v:.5}}]};
  await assert.rejects(()=>refineSelection({scene:attached,selectedIds:['arrow'],reference:raster(scene),render:raster}),/attached artwork/);
});
