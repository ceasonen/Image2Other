import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {sceneToSvg} from '../src/scene.js';
const modulePath=new URL('../src/ocr-core.js',import.meta.url);
async function core(){assert.ok(existsSync(modulePath),'OCR core must be implemented');return import(modulePath);}
const result={blocks:[{paragraphs:[{lines:[{words:[
  {text:'Model',confidence:96,bbox:{x0:10,y0:10,x1:50,y1:30}},
  {text:'???',confidence:32,bbox:{x0:60,y0:10,x1:90,y1:30}},
  {text:'bad',confidence:99,bbox:{x0:NaN,y0:0,x1:40,y1:10}}
]}]}]}]};
function image(){const data=new Uint8ClampedArray(100*50*4).fill(255);for(let y=14;y<26;y++)for(let x=20;x<40;x++){const i=(y*100+x)*4;data[i]=data[i+1]=data[i+2]=20;}return {width:100,height:50,data};}
test('OCR keeps word boxes and exposes low-confidence words for review, rejecting malformed geometry',async()=>{
  const {ocrWords}=await core();const words=ocrWords(result,100,50);
  assert.equal(words.length,2);assert.equal(words[0].text,'Model');assert.equal(words[1].confidence,32);
  assert.deepEqual(words[0].box,{x:10,y:10,width:40,height:20});
});
test('replacement defaults to high-confidence text on a flat background',async()=>{
  const {ocrWords,prepareWords}=await core();const words=prepareWords(ocrWords(result,100,50),image());
  assert.equal(words[0].selected,true);assert.equal(words[1].selected,false);
  assert.equal(words[0].background,'#ffffff');assert.equal(words[0].fill,'#141414');
  const noisy=image();for(let i=0;i<noisy.data.length;i+=4){noisy.data[i]=(i/4)%2?0:255;noisy.data[i+1]=100;}
  assert.equal(prepareWords(ocrWords(result,100,50),noisy)[0].selected,false);
});
test('mask changes only reviewed boxes and leaves original pixels untouched',async()=>{
  const {ocrWords,prepareWords,maskWords}=await core();const original=image();
  const words=prepareWords(ocrWords(result,100,50),original);const masked=maskWords(original,words);
  assert.equal(original.data[(20*100+30)*4],20);assert.equal(masked.data[(20*100+30)*4],255);
  for(let y=0;y<50;y++)for(let x=0;x<100;x++)if(x<10||x>=50||y<10||y>=30){const i=(y*100+x)*4;assert.deepEqual(masked.data.slice(i,i+4),original.data.slice(i,i+4));}
});
test('OCR replacement preserves transparent artwork rather than adding white patches',async()=>{
  const {ocrWords,prepareWords,maskWords}=await core();const original=image();
  for(let i=0;i<original.data.length;i+=4)if(original.data[i]===255){original.data[i]=original.data[i+1]=original.data[i+2]=0;original.data[i+3]=0;}
  const words=prepareWords(ocrWords(result,100,50),original);
  assert.equal(words[0].fill,'#141414');assert.equal(words[0].selected,true);
  const masked=maskWords(original,words);assert.equal(masked.data[(20*100+30)*4+3],0);assert.equal(original.data[(20*100+30)*4+3],255);
});
test('reviewed corrections become native text, unselected guesses never appear as text',async()=>{
  const {ocrWords,prepareWords,appendOcrText}=await core();const words=prepareWords(ocrWords(result,100,50),image());
  words[0].text='Encoder';
  const scene=appendOcrText({width:50,height:25,background:'none',nodes:[],engine:'local-trace'},words,100,50);
  assert.equal(scene.nodes.length,1);assert.equal(scene.nodes[0].text,'Encoder');assert.equal(scene.nodes[0].x,5);
  assert.equal(scene.nodes[0].fitWidth,true);assert.match(sceneToSvg(scene),/textLength="20"/);
  assert.doesNotMatch(sceneToSvg(scene),/\?\?\?/);
});
test('review export records observations and corrections without claiming trained ML scores',async()=>{
  const {ocrWords,prepareWords,reviewData}=await core();const words=prepareWords(ocrWords(result,100,50),image());words[0].text='Encoder';
  const out=reviewData(words,100,50,'eng');assert.equal(out.words[0].originalText,'Model');assert.equal(out.words[0].correctedText,'Encoder');
  assert.equal(out.engine,'tesseract-lstm');assert.equal(out.words[1].replace,false);assert.equal(out.trainedClassifier,false);
});
test('large OCR boxes use bounded color sampling rather than sorting every pixel',async()=>{
  const {prepareWords}=await core();let samples=0;
  const data=new Proxy({slice:()=>{samples++;return [255,255,255];}},{get:(t,k)=>k==='slice'?t.slice:255});
  prepareWords([{text:'Model',confidence:95,box:{x:5,y:5,width:990,height:990}}],{width:1000,height:1000,data});
  assert.ok(samples<30000,`Sample count should stay bounded, got ${samples}`);
});
test('adjacent recognized characters do not contaminate each other’s background estimate',async()=>{
  const {prepareWords}=await core();const original=image();
  for(let y=10;y<30;y++)for(let x=10;x<50;x++){const i=(y*100+x)*4;original.data[i]=original.data[i+1]=original.data[i+2]=20;}
  const words=prepareWords([{text:'模',confidence:95,box:{x:10,y:10,width:20,height:20}},{text:'态',confidence:95,box:{x:30,y:10,width:20,height:20}}],original);
  assert.ok(words.every(w=>w.selected));assert.ok(words.every(w=>w.background==='#ffffff'));
});
test('complete label lines take precedence over clipped per-character OCR boxes',async()=>{
  const {ocrWords}=await core();
  const data={blocks:[{paragraphs:[{lines:[{text:'多 模 态 模型',confidence:94,bbox:{x0:10,y0:10,x1:90,y1:30},words:[{text:'模',confidence:92,bbox:{x0:35,y0:10,x1:45,y1:30}}]}]}]}]};
  const labels=ocrWords(data,100,50);assert.equal(labels.length,1);assert.equal(labels[0].text,'多模态模型');assert.equal(labels[0].box.width,80);assert.equal(labels[0].confidence,92);
});
for(const axis of ['horizontal','vertical'])test(`a thin ${axis} stroke crossing a flat label box is kept, not erased`,async()=>{
  const {ocrWords,prepareWords,maskWords,appendOcrText}=await core();const original=image();
  for(let n=0;n<(axis==='horizontal'?100:50);n++){
    const x=axis==='horizontal'?n:15,y=axis==='horizontal'?12:n,i=(y*100+x)*4;
    original.data[i]=original.data[i+1]=original.data[i+2]=20;
  }
  const words=prepareWords(ocrWords(result,100,50),original);
  assert.ok(words[0].flatness>=.9,'Reproduce the old flat-background heuristic accepting a thin crossing stroke');
  assert.equal(words[0].selected,false,'High OCR confidence must not authorize erasing a crossing line');
  assert.equal(words[0].replacementBlock,'crossing-stroke');
  words[0].selected=true; // Even a stale/programmatically checked checkbox must not bypass protection.
  assert.deepEqual(maskWords(original,words).data,original.data);
  assert.equal(appendOcrText({width:100,height:50,nodes:[]},words,100,50).nodes.length,0);
});
test('opposing boundary specks at different positions are not a straight crossing stroke',async()=>{
  const {ocrWords,prepareWords}=await core();const original=image();
  for(const [x,y] of [[8,12],[9,12],[50,27],[51,27]]){const i=(y*100+x)*4;original.data[i]=original.data[i+1]=original.data[i+2]=20;}
  assert.equal(prepareWords(ocrWords(result,100,50),original)[0].selected,true);
});
test('review exports label edits as unverified observations, with reasons for refused replacement',async()=>{
  const {ocrWords,prepareWords,reviewData}=await core();const original=image();
  for(let x=0;x<100;x++){const i=(12*100+x)*4;original.data[i]=original.data[i+1]=original.data[i+2]=20;}
  const words=prepareWords(ocrWords(result,100,50),original);words[0].text='Encoder';
  const out=reviewData(words,100,50,'eng');
  assert.equal(out.version,2);assert.equal(out.annotationStatus,'unverified');
  assert.equal(out.words[0].textChangeKind,'unspecified');
  assert.equal(out.words[0].replacementBlock,'crossing-stroke');assert.equal(out.words[0].replace,false);
});
test('an explicitly reviewed mask replaces text without clearing a protected crossing',async()=>{
  const {ocrWords,prepareWords,maskWords,appendOcrText,reviewEraseMask,reviewData}=await core();
  assert.equal(typeof reviewEraseMask,'function','Mask approval must be an explicit operation');
  const original=image();for(let x=0;x<100;x++){const i=(12*100+x)*4;original.data[i]=original.data[i+1]=original.data[i+2]=20;}
  const word=prepareWords(ocrWords(result,100,50),original)[0];
  const reviewed=reviewEraseMask(word,[{mode:'keep',radius:.5,points:[{x:0,y:2},{x:39,y:2}]}]);
  reviewed.text='Encoder';const masked=maskWords(original,[reviewed]);
  for(let x=0;x<100;x++)assert.equal(masked.data[(12*100+x)*4],20);
  assert.equal(masked.data[(20*100+30)*4],255,'Old glyph pixels outside the protected stroke disappear');
  assert.equal(appendOcrText({width:100,height:50,nodes:[]},[reviewed],100,50).nodes[0].text,'Encoder');
  const log=reviewData([reviewed],100,50,'eng');assert.equal(log.words[0].maskReview.userConfirmed,true);
  assert.equal(log.words[0].replacementBlock,'crossing-stroke','Keep the original diagnostic reason');
  assert.equal(log.annotationStatus,'unverified','User approval is not benchmark ground truth');
});
test('mixed backgrounds cannot become eligible merely by approving a mask',async()=>{
  const {reviewEraseMask}=await core();assert.equal(typeof reviewEraseMask,'function');
  assert.throws(()=>reviewEraseMask({safeBackground:false,box:{width:10,height:10}},[]),/background/i);
});
test('confirmed protection survives another selected label overlapping its box, in either order',async()=>{
  const {maskWords,reviewEraseMask}=await core(),original=image();
  for(let x=10;x<50;x++)original.data.set([20,20,20,255],(12*100+x)*4);
  const word={text:'Model',safeBackground:true,selected:true,background:'#ffffff',backgroundAlpha:255,box:{x:10,y:10,width:40,height:20}};
  const protectedWord=reviewEraseMask(word,[{mode:'keep',radius:.5,points:[{x:0,y:2},{x:39,y:2}]}]);
  const overlapping={...word,text:'Label',box:{x:20,y:11,width:20,height:12}};
  for(const words of [[protectedWord,overlapping],[overlapping,protectedWord]]){
    const masked=maskWords(original,words);
    for(let x=10;x<50;x++)assert.equal(masked.data[(12*100+x)*4],20,'Other selected boxes must not erase explicitly protected artwork');
    assert.equal(masked.data[(20*100+30)*4],255);
  }
  protectedWord.selected=false;
  assert.equal(maskWords(original,[protectedWord,overlapping]).data[(12*100+30)*4],255,'Unselected masks do not change the active conversion');
});
test('high-confidence short scientific identifiers require explicit checking, not guessed correction',async()=>{
  const {prepareWords,maskWords,appendOcrText,reviewData}=await core(),original=image();
  for(const text of ['(8)','[B]','A','7']){
    const words=prepareWords([{id:'label',text,originalText:text,confidence:95,box:{x:10,y:10,width:40,height:20}}],original);
    assert.equal(words[0].reviewReason,'short-identifier');assert.equal(words[0].selected,false);
    assert.equal(words[0].text,text,'Do not invent B from an ambiguous recognized 8');
    assert.deepEqual(maskWords(original,words).data,original.data);
    assert.equal(appendOcrText({width:100,height:50,nodes:[]},words,100,50).nodes.length,0);
    assert.equal(reviewData(words,100,50,'eng').words[0].reviewReason,'short-identifier');
    words[0].selected=true;
    assert.equal(appendOcrText({width:100,height:50,nodes:[]},words,100,50).nodes[0].text,text,'Manual selection remains possible');
  }
  assert.equal(prepareWords([{text:'Model',confidence:95,box:{x:10,y:10,width:40,height:20}}],original)[0].selected,true);
});
