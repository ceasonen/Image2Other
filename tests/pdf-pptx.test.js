import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import JSZip from 'jszip';
const modulePath=new URL('../src/pdf-pptx.js',import.meta.url);
async function exporter(){assert.ok(existsSync(modulePath),'PDF to PowerPoint adapter must be implemented');return import(modulePath);}
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
test('PDF to PPTX preserves pages and creates real editable text boxes in text mode',async()=>{
  const {pdfPagesToPptx}=await exporter();
  const bytes=await pdfPagesToPptx([{width:320,height:180,image,text:[{text:'Editable & exact',x:20,y:30,width:200,height:24,fontSize:18,rotate:0}]}],'text','nodebuffer');
  const zip=await JSZip.loadAsync(bytes);const xml=await zip.file('ppt/slides/slide1.xml').async('string');
  assert.match(xml,/<a:t>Editable &amp; exact<\/a:t>/);assert.match(xml,/<p:pic>/);
  const notes=await zip.file('ppt/notesSlides/notesSlide1.xml').async('string');assert.match(notes,/raster|image/i);
});
test('page-image PPTX does not claim or include recovered text',async()=>{
  const {pdfPagesToPptx}=await exporter();const zip=await JSZip.loadAsync(await pdfPagesToPptx([{width:320,height:180,image,text:[]}],'image','nodebuffer'));
  assert.doesNotMatch(await zip.file('ppt/slides/slide1.xml').async('string'),/<a:t>/);
  await assert.rejects(()=>pdfPagesToPptx([],'image'),/page/);
  await assert.rejects(()=>pdfPagesToPptx([{width:320,height:180,image,text:[]}],'text'),/text layer/i);
});
