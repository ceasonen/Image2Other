import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {materialize,editDisagreement} from './relations.mjs';
const moduleFile=new URL('./exact-envelope.mjs',import.meta.url);
const exactEditEnvelope=existsSync(moduleFile)?(await import(moduleFile)).exactEditEnvelope:undefined;

const objects={
  a:{x:10,y:20,w:80,h:40},
  b:{x:10,y:20,w:80,h:40},
  c:{x:240,y:20,w:80,h:40},
  d:{x:240,y:20,w:80,h:40},
  label:{text:'L',x:50,y:40},
  edge:{x1:90,y1:40,x2:240,y2:40}
};
const choices={
  labels:{label:['a','b']},
  connectors:{edge:{source:['a','b'],target:['c','d']}}
};
const candidates=[];
for(const labelParent of choices.labels.label)
  for(const source of choices.connectors.edge.source)
    for(const target of choices.connectors.edge.target)
      candidates.push(materialize({objects,rules:[
        {id:'label',type:'label',parent:labelParent,u:.5,v:.5},
        {id:'edge',type:'connector',source,target,su:1,sv:.5,tu:0,tv:.5}
      ]}));

test('exact response envelope matches exhaustive graph comparison without constructing graphs',()=>{
  assert.equal(typeof exactEditEnvelope,'function');
  for(const [id,patch] of [['a',{x:100}],['c',{y:90}],['b',{w:120}],['d',{h:60}],['a',{x:10}]]){
    const expected=editDisagreement(candidates,id,patch,0);
    const result=exactEditEnvelope(objects,choices,id,patch);
    assert.equal(result.safe,expected.safe);
    assert.deepEqual(result.ambiguous,expected.ambiguous);
  }
});

test('the full envelope refuses when a singleton beam would falsely agree',()=>{
  const beam=editDisagreement([candidates.at(-1)],'a',{x:100},0);
  assert.equal(beam.safe,true);
  const full=exactEditEnvelope(objects,choices,'a',{x:100});
  assert.equal(full.safe,false);
  assert.deepEqual(full.ambiguous,['label','edge']);
  assert.equal(full.graphsRepresented,8);
  assert.equal(full.choicesEvaluated,6);
});

test('all compatible relations agree on an unrelated edit',()=>{
  const result=exactEditEnvelope(objects,choices,'c',{x:240});
  assert.equal(result.safe,true);
  assert.equal(result.diameter,0);
});

test('invalid candidate families refuse rather than certify safety',()=>{
  assert.throws(()=>exactEditEnvelope(objects,{labels:{label:[]},connectors:{}},'a',{x:100}),/candidate/i);
  assert.throws(()=>exactEditEnvelope(objects,choices,'unknown',{x:100}),/target/i);
  assert.throws(()=>exactEditEnvelope(objects,choices,'a',{w:-1}),/dimension/i);
});

test('diameter and tolerance match exhaustive execution for a larger product family',()=>{
  const extendedObjects={
    ...objects,
    e:{x:10,y:20,w:80,h:40},
    f:{x:240,y:20,w:80,h:40}
  };
  const localChoices={
    labels:{label:['a','b','e']},
    connectors:{edge:{source:['a','b','e'],target:['c','d','f']}}
  };
  const graphs=[];
  for(const labelParent of localChoices.labels.label)
    for(const source of localChoices.connectors.edge.source)
      for(const target of localChoices.connectors.edge.target){
        const sourceBox=extendedObjects[source],targetBox=extendedObjects[target];
        // This is an algebraic product check; not a visual-plausibility claim.
        graphs.push(materialize({objects:extendedObjects,rules:[
          {id:'label',type:'label',parent:labelParent,
            u:(extendedObjects.label.x-extendedObjects[labelParent].x)/extendedObjects[labelParent].w,
            v:(extendedObjects.label.y-extendedObjects[labelParent].y)/extendedObjects[labelParent].h},
          {id:'edge',type:'connector',source,target,
            su:(extendedObjects.edge.x1-sourceBox.x)/sourceBox.w,
            sv:(extendedObjects.edge.y1-sourceBox.y)/sourceBox.h,
            tu:(extendedObjects.edge.x2-targetBox.x)/targetBox.w,
            tv:(extendedObjects.edge.y2-targetBox.y)/targetBox.h}
        ]}));
      }
  for(const [target,patch] of [['a',{x:60}],['b',{w:120}],['c',{x:200,y:50}],['d',{h:70}]]){
    const executed=graphs.map(graph=>editDisagreement([graph],target,patch).results[0]);
    let diameter=0;
    for(const id of ['label','edge']){
      const fields=id==='label'?['x','y']:['x1','y1','x2','y2'];
      for(const field of fields){
        const values=executed.map(result=>result.objects[id][field]);
        diameter=Math.max(diameter,Math.max(...values)-Math.min(...values));
      }
    }
    const exact=exactEditEnvelope(extendedObjects,localChoices,target,patch,diameter-1e-6);
    assert.ok(Math.abs(exact.diameter-diameter)<1e-8);
    assert.equal(exact.safe,false);
    assert.equal(exactEditEnvelope(extendedObjects,localChoices,target,patch,diameter+1e-6).safe,true);
    assert.equal(exact.graphsRepresented,27);
  }
});

test('unanimous agreement under omitted intended parents is not a correctness guarantee',()=>{
  const omitted={labels:{label:['b']},connectors:{edge:{source:['b'],target:['c']}}};
  const result=exactEditEnvelope(objects,omitted,'a',{x:100});
  assert.equal(result.safe,true);
  const intended=editDisagreement([candidates[0]],'a',{x:100}).results[0];
  const reported=editDisagreement([materialize({objects,rules:[
    {id:'label',type:'label',parent:'b',u:.5,v:.5},
    {id:'edge',type:'connector',source:'b',target:'c',su:1,sv:.5,tu:0,tv:.5}
  ]})],'a',{x:100}).results[0];
  assert.notEqual(intended.objects.label.x,reported.objects.label.x);
  assert.notEqual(intended.objects.edge.x1,reported.objects.edge.x1);
});
