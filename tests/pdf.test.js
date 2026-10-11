import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {PDFDocument, degrees} from '../src/vendor/pdf-lib/pdf-lib.esm.min.js';

const modulePath=new URL('../src/pdf-core.js',import.meta.url);
async function core(){assert.ok(existsSync(modulePath),'PDF conversion module must be implemented');return import(modulePath);}
async function fixture(sizes=[[320,180],[400,240],[500,300]]){
  const doc=await PDFDocument.create();for(const [w,h] of sizes)doc.addPage([w,h]);return doc.save();
}

test('page selections preserve order and repetitions with inclusive ranges',async()=>{
  const {parsePages}=await core();
  assert.deepEqual(parsePages('3,1-2,3',3),[2,0,1,2]);
  assert.deepEqual(parsePages('',3),[0,1,2]);
  for(const invalid of ['0','4','2-1','1,,2','1e2','1.5','-1','all','1-1000000000'])assert.throws(()=>parsePages(invalid,3));
});
test('single-page selection round trips throughout the supported domain',async()=>{
  const {parsePages}=await core();
  for(let count=1;count<=200;count++)for(const n of [1,count,Math.ceil(count/2)])assert.deepEqual(parsePages(String(n),count),[n-1]);
  assert.throws(()=>parsePages('1',201));
});
test('PDF extraction reorders pages without rasterizing their content',async()=>{
  const {selectPdf}=await core();const source=await fixture();
  const output=await PDFDocument.load(await selectPdf(source,'3,1'));
  assert.deepEqual(output.getPages().map(p=>[p.getWidth(),p.getHeight()]),[[500,300],[320,180]]);
});
test('merge retains the selected file order',async()=>{
  const {mergePdfs}=await core();
  const output=await PDFDocument.load(await mergePdfs([await fixture([[640,360]]),await fixture([[320,180],[400,240]])]));
  assert.deepEqual(output.getPages().map(p=>p.getWidth()),[640,320,400]);
  await assert.rejects(()=>mergePdfs([]),/Choose/);
});
test('rotation is relative and only changes selected pages',async()=>{
  const {rotatePdf}=await core();const doc=await PDFDocument.create();
  doc.addPage([320,180]).setRotation(degrees(90));doc.addPage([320,180]);
  const output=await PDFDocument.load(await rotatePdf(await doc.save(),'1',90));
  assert.deepEqual(output.getPages().map(p=>p.getRotation().angle),[180,0]);
  await assert.rejects(async()=>rotatePdf(await fixture(),'1',45),/90/);
});
test('split returns one independent PDF per selected page',async()=>{
  const {splitPdf}=await core();const outputs=await splitPdf(await fixture(),'3,1');
  assert.equal(outputs.length,2);assert.deepEqual(outputs.map(x=>x.page),[3,1]);
  for(const x of outputs)assert.equal((await PDFDocument.load(x.bytes)).getPageCount(),1);
});
test('native PDF operations reject forms rather than damaging interactive fields',async()=>{
  const {selectPdf}=await core();const doc=await PDFDocument.create();const page=doc.addPage();
  doc.getForm().createTextField('name').addToPage(page);
  await assert.rejects(async()=>selectPdf(await doc.save(),'1'),/form|signature/i);
});
test('PDF input validation rejects bad bytes and too many pages',async()=>{
  const {readPdf}=await core();await assert.rejects(()=>readPdf(new Uint8Array([1,2,3])),/PDF/i);
  const doc=await PDFDocument.create();for(let i=0;i<201;i++)doc.addPage();
  await assert.rejects(async()=>readPdf(await doc.save()),/200/);
});
test('multiple image pages become a PDF without changing their order or aspect ratio',async()=>{
  const {imagesToPdf}=await core();
  const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'));
  const doc=await PDFDocument.load(await imagesToPdf([{bytes:png,type:'image/png'},{bytes:png,type:'image/png'}]));
  assert.equal(doc.getPageCount(),2);assert.equal(doc.getPage(0).getWidth(),doc.getPage(0).getHeight());
  await assert.rejects(()=>imagesToPdf([]),/Choose/);
});
