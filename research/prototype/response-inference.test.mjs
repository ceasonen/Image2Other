import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {materialize,edit} from './relations.mjs';
const moduleFile=new URL('./response-inference.mjs',import.meta.url);
const inferResponseRelations=existsSync(moduleFile)?(await import(moduleFile)).inferResponseRelations:undefined;

const objects={
  a:{x:10,y:20,w:80,h:40},
  b:{x:10,y:20,w:80,h:40},
  c:{x:240,y:20,w:80,h:40},
  label:{text:'L',x:50,y:40},
  edge:{x1:90,y1:40,x2:240,y2:40}
};
const choices={labels:{label:['a','b','null']},connectors:{edge:{source:['a','b','null'],target:['c','null']}}};
const truth=materialize({objects,rules:[
  {id:'label',type:'label',parent:'a',u:.5,v:.5},
  {id:'edge',type:'connector',source:'a',target:'c',su:1,sv:.5,tu:0,tv:.5}
]});
const observation=(target,patch)=>{
  const after=edit(truth,target,patch).objects;
  return{target,patch,observed:{
    label:{x:after.label.x,y:after.label.y},
    edge:{x1:after.edge.x1,y1:after.edge.y1,x2:after.edge.x2,y2:after.edge.y2}
  }};
};

test('one real edit response identifies changed attachments without edge labels',()=>{
  assert.equal(typeof inferResponseRelations,'function');
  const inferred=inferResponseRelations(objects,choices,[observation('a',{x:100})]);
  assert.deepEqual(inferred.choices.labels.label,['a']);
  assert.deepEqual(inferred.choices.connectors.edge.source,['a']);
  assert.deepEqual(inferred.choices.connectors.edge.target,['c','null']);
  assert.deepEqual(inferred.unsupported,[]);
});

test('an unrelated edit does not invent a unique hidden relation',()=>{
  const inferred=inferResponseRelations(objects,choices,[observation('c',{x:260})]);
  assert.deepEqual(inferred.choices.labels.label,['a','b','null']);
  assert.deepEqual(inferred.choices.connectors.edge.source,['a','b','null']);
  assert.deepEqual(inferred.choices.connectors.edge.target,['c']);
});

test('identical initial geometry can yield different externally observed edits',()=>{
  const alternate=materialize({objects,rules:[
    {id:'label',type:'label',parent:'b',u:.5,v:.5},
    {id:'edge',type:'connector',source:'b',target:'c',su:1,sv:.5,tu:0,tv:.5}
  ]});
  const after=edit(alternate,'a',{x:100}).objects;
  const observed={target:'a',patch:{x:100},observed:{
    label:{x:after.label.x,y:after.label.y},
    edge:{x1:after.edge.x1,y1:after.edge.y1,x2:after.edge.x2,y2:after.edge.y2}
  }};
  const inferred=inferResponseRelations(objects,choices,[observed]);
  assert.deepEqual(inferred.choices.labels.label,['b','null']);
  assert.deepEqual(inferred.choices.connectors.edge.source,['b','null']);
  assert.deepEqual(inferred.unsupported,[]);
});

test('omitted true parent is reported as unsupported, never certified',()=>{
  const incomplete={labels:{label:['b']},connectors:{edge:{source:['b'],target:['c']}}};
  const inferred=inferResponseRelations(objects,incomplete,[observation('a',{x:100})]);
  assert.deepEqual(inferred.choices.labels.label,[]);
  assert.deepEqual(inferred.choices.connectors.edge.source,[]);
  assert.deepEqual(inferred.unsupported,['label','edge:start']);
});

test('adding observations only removes choices and preserves noiseless truth',()=>{
  const actions=[['a',{x:100}],['b',{y:75}],['c',{w:100}],['a',{w:120}]];
  let previous=choices;
  for(let count=1;count<=actions.length;count++){
    const observed=actions.slice(0,count).map(([target,patch])=>observation(target,patch));
    const current=inferResponseRelations(objects,choices,observed,{tolerance:1e-8});
    for(const [id,list] of Object.entries(current.choices.labels)){
      assert.ok(list.every(candidate=>previous.labels[id].includes(candidate)));
    }
    for(const [id,ends] of Object.entries(current.choices.connectors))
      for(const end of ['source','target'])
        assert.ok(ends[end].every(candidate=>previous.connectors[id][end].includes(candidate)));
    assert.ok(current.choices.labels.label.includes('a'));
    assert.ok(current.choices.connectors.edge.source.includes('a'));
    assert.ok(current.choices.connectors.edge.target.includes('c'));
    previous=current.choices;
  }
});

test('missing observations and invalid edits fail explicitly',()=>{
  assert.throws(()=>inferResponseRelations(objects,choices,[]),/observation/i);
  assert.throws(()=>inferResponseRelations(objects,choices,[{target:'a',patch:{x:100},observed:{}}]),/observed/i);
  assert.throws(()=>inferResponseRelations(objects,choices,[{target:'a',patch:{w:-1},observed:observation('a',{x:100}).observed}]),/dimension/i);
});
