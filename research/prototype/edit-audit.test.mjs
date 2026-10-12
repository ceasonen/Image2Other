import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {materialize} from './relations.mjs';
const file=new URL('./edit-audit.mjs',import.meta.url),api=existsSync(file)?await import(file):{};
const make=parent=>materialize({objects:{a:{x:10,y:20,w:80,h:40},b:{x:10,y:20,w:80,h:40},other:{x:300,y:20,w:80,h:40},label:{text:'x'}},rules:[{id:'label',type:'label',parent,u:.5,v:.5}]});
const intended={id:'parent-a',graph:make('a')},wrong={id:'parent-b',graph:make('b')};
test('candidate agreement cannot hide an omitted intended graph and a wrong edit',()=>{
  assert.equal(typeof api.auditEditDecision,'function');
  const report=api.auditEditDecision([wrong],intended,'a',{x:100});
  assert.equal(report.candidateAgreement,true);assert.equal(report.intendedRetained,false);
  assert.equal(report.executed,true);assert.equal(report.correctForSuppliedEdit,false);
  assert.deepEqual(report.mismatchedObjects,['label']);assert.equal(report.usesSuppliedTruth,true);
});
test('an empty candidate set refuses, and an ambiguous retained truth set also refuses',()=>{
  assert.equal(typeof api.auditEditDecision,'function');
  assert.equal(api.auditEditDecision([],intended,'a',{x:100}).executed,false);
  const report=api.auditEditDecision([intended,wrong],intended,'a',{x:100});
  assert.equal(report.intendedRetained,true);assert.equal(report.executed,false);
  assert.equal(report.correctForSuppliedEdit,null,'Refusal is not successful execution');
});
test('omission and requested-edit error remain separate quantities',()=>{
  assert.equal(typeof api.auditEditDecision,'function');
  const report=api.auditEditDecision([wrong],intended,'other',{x:400});
  assert.equal(report.intendedRetained,false);assert.equal(report.executed,true);
  assert.equal(report.correctForSuppliedEdit,true,'Hidden ownership does not affect this unrelated edit response');
});
