import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { exportPptx } from '../src/export.js';
test('PowerPoint contains native text, shapes and vector curves, without raster images', async () => {
  const scene = {width:400,height:200,background:'#ffffff',nodes:[
    {id:'r',type:'rect',x:10,y:10,width:100,height:40,fill:'#334455'},
    {id:'t',type:'text',x:20,y:20,width:80,height:25,text:'Editable label',fontSize:16,fill:'#ffffff'},
    {id:'p',type:'path',d:'M 0 0 L 20 0 Q 30 10 20 20 Z M 3 3 L 8 3 L 8 8 Z',fill:'#6688aa'}
  ]};
  const data = await exportPptx(scene, 'arraybuffer');
  const zip = await JSZip.loadAsync(data);
  const xml = await zip.file('ppt/slides/slide1.xml').async('string');
  assert.match(xml, /Editable label/); assert.match(xml, /<a:custGeom>/);
  assert.match(xml,/typeface="Times New Roman"/,'SVG and native PPTX text must share the default font');
  assert.equal((xml.match(/<a:moveTo>/g)||[]).length, 2);
  assert.match(xml, /<a:quadBezTo>/); assert.doesNotMatch(xml, /<p:pic>/);
  assert.equal(Object.keys(zip.files).filter(k => k.startsWith('ppt/media/') && !zip.files[k].dir).length, 0);
});
