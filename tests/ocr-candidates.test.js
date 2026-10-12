import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
const file=new URL('../src/ocr-candidates.js',import.meta.url);
const api=existsSync(file)?await import(file):{};
const box={x:10,y:20,width:80,height:25};
test('focused OCR crops are padded, clipped and bounded without changing the original label box',()=>{
  assert.equal(typeof api.cropSpec,'function');
  const spec=api.cropSpec(box,300,200);assert.deepEqual(spec.source,{x:6,y:16,width:88,height:33});
  assert.equal(spec.width,200);assert.equal(spec.height,90);assert.equal(spec.padding,12);
  const edge=api.cropSpec({x:0,y:0,width:20,height:20},30,30);assert.equal(edge.source.x,0);
  assert.throws(()=>api.cropSpec({...box,x:.5},300,200));
  assert.throws(()=>api.cropSpec({...box,width:400},300,200));
  assert.throws(()=>api.cropSpec({x:0,y:0,width:1000,height:1000},1000,1000));
});
test('OCR candidates keep disagreeing observations and do not rank confidence as truth',()=>{
  assert.equal(typeof api.cropCandidates,'function');
  const result=api.cropCandidates(box,[{layout:'11',text:'(8)',confidence:90},{layout:'7',text:'(8)',confidence:73},{layout:'13',text:'(B)',confidence:45}]);
  assert.equal(result.candidates.length,2);assert.equal(result.candidates[0].text,'(8)');
  assert.equal(result.candidates[0].observations.length,2);assert.equal(result.candidates[1].text,'(B)');
  assert.equal(result.automaticChoice,false);assert.equal(result.correctnessVerified,false);
  assert.throws(()=>api.cropCandidates(box,[{layout:'99',text:'X',confidence:100}]));
  assert.equal(api.cropCandidates(box,[{layout:'7',text:'',confidence:90}]).candidates.length,0);
});
test('a crop choice changes only the text draft and still needs explicit replacement selection',()=>{
  assert.equal(typeof api.chooseCropCandidate,'function');
  const word={id:'label',box,text:'(8)',originalText:'(8)',confidence:90,selected:true};
  const result=api.cropCandidates(box,[{layout:'7',text:'(B)',confidence:73}]);
  const chosen=api.chooseCropCandidate(word,result,0);
  assert.equal(chosen.text,'(B)');assert.equal(chosen.originalText,'(8)');assert.equal(chosen.confidence,90);
  assert.equal(chosen.selected,false);assert.deepEqual(chosen.box,box);assert.equal(word.text,'(8)');
  assert.equal(chosen.cropReview.correctnessVerified,false);assert.equal(chosen.cropReview.choiceText,'(B)');
  assert.throws(()=>api.chooseCropCandidate({...word,box:{...box,x:11}},result,0),/changed/i);
  assert.throws(()=>api.chooseCropCandidate(word,result,4));
});
