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
