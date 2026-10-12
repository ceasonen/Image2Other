import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
const file=new URL('../src/paddle-import.js',import.meta.url),api=existsSync(file)?await import(file):{};
const result={input_path:'figure.png',page_index:null,model_settings:{use_doc_preprocessor:false,use_textline_orientation:false},rec_texts:['Model'],rec_scores:[.97],rec_polys:[[[20,30],[100,30],[100,50],[20,50]]]};
test('PaddleOCR saved results enter the common text/vector workflow with explicit source confirmation',()=>{
  assert.equal(typeof api.paddleWords,'function');
  assert.throws(()=>api.paddleWords(result,200,100,{width:400,height:200}),/confirm/i);
  const words=api.paddleWords({res:result},200,100,{width:400,height:200,confirmed:true});
  assert.equal(words[0].text,'Model');assert.equal(words[0].confidence,97);assert.equal(words[0].selected,false);
  assert.deepEqual(words[0].box,{x:10,y:15,width:40,height:10});
  assert.equal(words[0].recognitionSource,'paddleocr-import');assert.equal(result.rec_scores[0],.97);
});
test('Paddle import rejects transformed coordinates, mismatched arrays, rotated text and excessive inputs',()=>{
  const read=r=>api.paddleWords(r,200,100,{width:200,height:100,confirmed:true});
  for(const bad of [{...result,model_settings:{use_doc_preprocessor:true}},{...result,rec_scores:[]},{...result,rec_scores:[NaN]},{...result,rec_scores:[1.1]},{...result,rec_polys:[[[0,0],[20,5],[20,20],[0,15]]]},{...result,rec_polys:[[[0,0],[250,0],[250,20],[0,20]]]},{...result,rec_texts:['x'.repeat(501)]},{...result,page_index:1}])assert.throws(()=>read(bad));
  assert.throws(()=>read({...result,rec_texts:Array(501).fill('A'),rec_scores:Array(501).fill(.9),rec_polys:Array(501).fill(result.rec_polys[0])}));
});
test('Paddle import accepts near-horizontal polygons emitted by a real mobile detector',()=>{
  const nearHorizontal={...result,rec_texts:['Figure 1: Editable SVG'],rec_polys:[[[31,43],[489,38],[489,90],[32,95]]]};
  const words=api.paddleWords(nearHorizontal,900,280,{width:900,height:280,confirmed:true});
  assert.equal(words[0].text,'Figure 1: Editable SVG');
  assert.deepEqual(words[0].box,{x:31,y:38,width:458,height:57});
});
