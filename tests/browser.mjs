import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import {PDFDocument,StandardFonts,rgb} from '../src/vendor/pdf-lib/pdf-lib.esm.min.js';
const [url='http://127.0.0.1:5178/Image2Other/',port='9226']=process.argv.slice(2);
const tabs=await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
let id=0; const pending=new Map();
ws.addEventListener('message',event=>{const r=JSON.parse(event.data);if(r.id){pending.get(r.id)?.(r);pending.delete(r.id);}});
const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,r=>r.error?reject(r.error):resolve(r.result));ws.send(JSON.stringify({id:n,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=expression=>evaluate(`new Promise((resolve,reject)=>{const start=performance.now();const poll=()=>{if(${expression})return resolve();if(performance.now()-start>30000)return reject(new Error('Timed out'));setTimeout(poll,80);};poll();})`);
await fs.mkdir('.build/preview',{recursive:true});
await fs.mkdir('.build/downloads',{recursive:true});
const downloadDir=await fs.mkdtemp(path.resolve('.build/downloads/run-'));
try{
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});
  await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
  await send('Page.enable');await send('Page.navigate',{url});await wait(`document.readyState==='complete'`);
  assert.equal(await evaluate(`!!document.querySelector('#try-sample')`),true,'Diagram sample control is available');
  assert.equal(await evaluate(`!!document.querySelector('#files-input')`),true,'Local PDF tools are available');
  await evaluate(`document.querySelector('#try-sample').click()`);
  await wait(`document.querySelector('#status').textContent.includes('ready')`);
  assert.equal(await evaluate(`document.querySelector('#source-image').naturalWidth>0`),true);
  await evaluate(`document.querySelector('[data-mode="trace"]').click();document.querySelector('#convert').click()`);
  await wait(`document.querySelector('#status').textContent.includes('paths ready')`);
  assert.equal(await evaluate(`document.querySelectorAll('#result-svg path[data-node-id]').length>0`),true);
  assert.equal(await evaluate(`document.querySelectorAll('#result-svg image').length`),0);
  assert.equal(await evaluate(`document.querySelector('#export-svg').disabled`),false);
  const pathId=await evaluate(`document.querySelector('#result-svg path[data-node-id]').dataset.nodeId`);
  const originalPath=await evaluate(`document.querySelector('#result-svg path[data-node-id="${pathId}"]').getAttribute('d')`);
  await evaluate(`document.querySelector('[data-layer="${pathId}"]').click()`);
  assert.equal(await evaluate(`!!document.querySelector('#edit-x')&&!!document.querySelector('#edit-y')`),true,'Actual traced paths need position editing');
  await evaluate(`(()=>{const x=document.querySelector('#edit-x');x.value=Number(x.value)+12;x.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  assert.notEqual(await evaluate(`document.querySelector('#result-svg path[data-node-id="${pathId}"]').getAttribute('d')`),originalPath);
  await evaluate(`document.querySelector('#undo').click()`);
  assert.equal(await evaluate(`document.querySelector('#result-svg path[data-node-id="${pathId}"]').getAttribute('d')`),originalPath,'Undo restores all original curve coordinates');
  await evaluate(`document.querySelector('#export-svg').click()`);
  await wait(`document.querySelector('#status').textContent.includes('SVG downloaded')`);
  await evaluate(`document.querySelector('#export-pptx').click()`);
  await wait(`document.querySelector('#status').textContent.includes('PPTX downloaded')`);
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await evaluate(`scrollTo(0,0)`);
  const traceShot=await send('Page.captureScreenshot');await fs.writeFile('.build/preview/studio-trace.png',Buffer.from(traceShot.data,'base64'));
  // Preserve the actual traced exports before the editable-example export replaces the same name.
  for(const extension of ['svg','pptx']){
    const filename=path.join(downloadDir,'research-diagram.'+extension);
    for(let attempt=0;attempt<50;attempt++){
      try{const data=await fs.readFile(filename);await fs.writeFile('.build/preview/traced-diagram.'+extension,data);break;}
      catch(error){if(attempt===49)throw error;await new Promise(resolve=>setTimeout(resolve,100));}
    }
  }
  const tracedSvg=await fs.readFile('.build/preview/traced-diagram.svg','utf8');
  assert.match(tracedSvg,/<path /);assert.doesNotMatch(tracedSvg,/<image/);
  const tracedZip=await JSZip.loadAsync(await fs.readFile('.build/preview/traced-diagram.pptx'));
  const tracedXml=await tracedZip.file('ppt/slides/slide1.xml').async('string');
  assert.match(tracedXml,/<a:custGeom>/);assert.doesNotMatch(tracedXml,/<p:pic>/);
  await evaluate(`document.querySelector('#open-example').click()`);
  await wait(`document.querySelectorAll('#result-svg text').length>0`);
  const first=await evaluate(`document.querySelector('#result-svg text').getAttribute('data-node-id')`);
  assert.equal(await evaluate(`document.querySelector('#result-svg text').getAttribute('font-family')`),'Times New Roman, Times, serif');
  assert.equal(await evaluate(`!!document.querySelector('#multi-select')`),true);
  const boxId=await evaluate(`document.querySelector('#result-svg rect[data-node-id]').dataset.nodeId`);
  const lineId=await evaluate(`document.querySelector('#result-svg line[data-node-id]').dataset.nodeId`);
  const targetId=await evaluate(`document.querySelectorAll('#result-svg rect[data-node-id]')[1].dataset.nodeId`);
  await evaluate(`document.querySelector('[data-layer="${lineId}"]').click()`);
  assert.equal(await evaluate(`!!document.querySelector('#attach-start-target')`),true,'Line endpoints need explicit attachment controls');
  await evaluate(`document.querySelector('#attach-start-target').value='${boxId}';document.querySelector('#attach-start-target').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#attach-end-target').value='${targetId}';document.querySelector('#attach-end-target').dispatchEvent(new Event('change',{bubbles:true}));`);
  assert.equal(await evaluate(`document.querySelector('#edit-x').disabled`),true,'Bound lines move through their targets');
  const lineX=await evaluate(`Number(document.querySelector('#result-svg line[data-node-id="${lineId}"]').getAttribute('x1'))`);
  const lineX2=await evaluate(`Number(document.querySelector('#result-svg line[data-node-id="${lineId}"]').getAttribute('x2'))`);
  const labelId=await evaluate(`[...document.querySelectorAll('#result-svg text')].find(x=>x.textContent==='Visual input').dataset.nodeId`);
  const boxX=await evaluate(`Number(document.querySelector('#result-svg rect[data-node-id="${boxId}"]').getAttribute('x'))`);
  const labelX=await evaluate(`Number(document.querySelector('#result-svg text[data-node-id="${labelId}"]').getAttribute('x'))`);
  await evaluate(`document.querySelector('[data-layer="${boxId}"]').click();document.querySelector('[data-layer="${labelId}"]').dispatchEvent(new MouseEvent('click',{bubbles:true,shiftKey:true}));`);
  assert.match(await evaluate(`document.querySelector('#inspector').textContent`),/2 layers/);
  await evaluate(`(()=>{const x=document.querySelector('#edit-x');x.value=Number(x.value)+35;x.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  assert.equal(await evaluate(`Number(document.querySelector('#result-svg rect[data-node-id="${boxId}"]').getAttribute('x'))`),boxX+35);
  assert.equal(await evaluate(`Number(document.querySelector('#result-svg text[data-node-id="${labelId}"]').getAttribute('x'))`),labelX+35);
  assert.equal(await evaluate(`Number(document.querySelector('#result-svg line[data-node-id="${lineId}"]').getAttribute('x1'))`),lineX+35,'Attached endpoint follows the module');
  assert.equal(await evaluate(`Number(document.querySelector('#result-svg line[data-node-id="${lineId}"]').getAttribute('x2'))`),lineX2,'Other endpoint stays on its own target');
  await evaluate(`document.querySelector('#layer-editor').scrollIntoView({block:'center'})`);
  const geometryShot=await send('Page.captureScreenshot');await fs.writeFile('.build/preview/svg-geometry-editor.png',Buffer.from(geometryShot.data,'base64'));
  await evaluate(`document.querySelector('#undo').click()`);
  await evaluate(`document.querySelector('[data-layer="${first}"]').click();document.querySelector('#edit-text').value='Edited label';document.querySelector('#edit-text').dispatchEvent(new Event('change',{bubbles:true}));`);
  assert.equal(await evaluate(`document.querySelector('#edit-font-face').value`),'Times New Roman');
  await evaluate(`document.querySelector('#edit-font-face').value='Arial';document.querySelector('#edit-font-face').dispatchEvent(new Event('change',{bubbles:true}));`);
  assert.equal(await evaluate(`document.querySelector('#result-svg').textContent.includes('Edited label')`),true);
  await evaluate(`document.querySelector('#export-json').click()`);await wait(`document.querySelector('#status').textContent.includes('Scene JSON downloaded')`);
  await evaluate(`document.querySelector('#export-pptx').click()`);await wait(`document.querySelector('#status').textContent.includes('PPTX downloaded')`);
  for(const format of ['png','jpeg','webp']){
    await evaluate(`document.querySelector('[data-mode="raster"]').click();document.querySelector('#raster-format').value='${format}';document.querySelector('#export-raster').click()`);
    await wait(`document.querySelector('#status').textContent.includes('${format.toUpperCase()} downloaded')`);
  }
  for(const width of [1440,1024,768,390,320]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true,`No horizontal overflow at ${width}`);
  }
  for(const width of [1440,390]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:width===1440?1100:844,deviceScaleFactor:1,mobile:width<600});
    await evaluate(`document.querySelector('[data-mode="trace"]').click();scrollTo(0,0)`);
    const shot=await send('Page.captureScreenshot');await fs.writeFile(`.build/preview/studio-${width}.png`,Buffer.from(shot.data,'base64'));
  }
  for(const extension of ['json','pptx','png','jpg','webp']){
    const filename=path.join(downloadDir,'research-diagram.'+extension);
    for(let attempt=0;attempt<50;attempt++){
      try{assert.ok((await fs.stat(filename)).size>0);break;}
      catch(error){if(attempt===49)throw error;await new Promise(resolve=>setTimeout(resolve,100));}
    }
  }
  const json=JSON.parse(await fs.readFile(path.join(downloadDir,'research-diagram.json'),'utf8'));
  assert.ok(json.nodes.some(n=>n.text==='Edited label'));
  assert.equal(json.connections[0].start.nodeId,boxId);assert.equal(json.connections[0].end.nodeId,targetId);
  // Extreme aspect ratios must retain a nonzero working canvas after downsampling.
  await evaluate(`(()=>{const transfer=new DataTransfer();transfer.items.add(new File(['<svg xmlns="http://www.w3.org/2000/svg" width="1" height="10000"><rect width="1" height="10000" fill="#6056d9"/></svg>'],'thin.svg',{type:'image/svg+xml'}));const input=document.querySelector('#file-input');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait(`document.querySelector('#source-meta').textContent.includes('thin.svg')`);
  await evaluate(`document.querySelector('#convert').click()`);
  await wait(`document.querySelector('#status').textContent.includes('paths ready')`);
  const fixture=await PDFDocument.create();const font=await fixture.embedFont(StandardFonts.Helvetica);
  for(let p=0;p<2;p++){const page=fixture.addPage([600,400]);page.drawRectangle({x:50,y:60,width:160,height:100,color:rgb(.4,.6,.8)});page.drawText('Native label '+(p+1),{x:50,y:260,size:24,font});}
  const encoded=Buffer.from(await fixture.save()).toString('base64');
  await evaluate(`(()=>{const transfer=new DataTransfer();transfer.items.add(new File([Uint8Array.from(atob('${encoded}'),c=>c.charCodeAt(0))],'test.pdf',{type:'application/pdf'}));const input=document.querySelector('#files-input');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait(`document.querySelector('#files-status').textContent.includes('ready')`);
  await evaluate(`document.querySelector('#files-pages').value='All'`);
  for(const tool of ['extract','split','rotate','png','text','pptx-text','pptx-image']){
    await evaluate(`document.querySelector('[data-file-tool="${tool}"]').click();document.querySelector('#files-run').click()`);
    await wait(`document.querySelector('#files-status').textContent.includes('downloaded')&&!document.querySelector('#files-run').disabled`);
    if(tool==='pptx-text'||tool==='pptx-image'){
      const dark=await evaluate(`(()=>{const c=document.querySelector('#files-preview canvas'),d=c.getContext('2d').getImageData(0,150,400,80).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]<80&&d[i+1]<80&&d[i+2]<80)n++;return n})()`);
      assert.ok(tool==='pptx-text'?dark===0:dark>0,'Editable-text slide background removes original PDF glyphs');
    }
  }
  async function readDownload(name){for(let n=0;n<100;n++){try{return await fs.readFile(path.join(downloadDir,name));}catch(e){if(n===99)throw e;await new Promise(r=>setTimeout(r,100));}}}
  assert.equal((await PDFDocument.load(await readDownload('test-selected.pdf'))).getPageCount(),2);
  assert.equal((await PDFDocument.load(await readDownload('test-rotated.pdf'))).getPage(0).getRotation().angle,90);
  assert.ok((await JSZip.loadAsync(await readDownload('test-pages.zip'))).file('page-1.pdf'));
  assert.match((await readDownload('test.txt')).toString(),/Native label 2/);
  const native=await JSZip.loadAsync(await readDownload('test-text.pptx'));
  assert.match(await native.file('ppt/slides/slide1.xml').async('string'),/<a:t>Native label 1<\/a:t>/);
  assert.ok(native.file('ppt/slides/slide2.xml'));
  // PDF page bridge uses the real renderer and forwards one page to tracing.
  await evaluate(`document.querySelector('[data-file-tool="figure"]').click();document.querySelector('#files-pages').value='2';document.querySelector('#files-run').click()`);
  await wait(`document.querySelector('#files-status').textContent.includes('Page opened')&&!document.querySelector('#files-run').disabled`);
  assert.match(await evaluate(`document.querySelector('#source-meta').textContent`),/test-page-2.png/);
  await evaluate(`document.querySelector('#files-pages').value='';document.querySelector('#files-clear').click();(()=>{const transfer=new DataTransfer();for(const name of ['first.pdf','second.pdf'])transfer.items.add(new File([Uint8Array.from(atob('${encoded}'),c=>c.charCodeAt(0))],name,{type:'application/pdf'}));const input=document.querySelector('#files-input');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await evaluate(`document.querySelector('[data-file-tool="merge"]').click();document.querySelector('#files-run').click()`);
  await wait(`document.querySelector('#files-status').textContent.includes('downloaded')&&!document.querySelector('#files-run').disabled`);
  assert.equal((await PDFDocument.load(await readDownload('merged.pdf'))).getPageCount(),4);
  const pptxEncoded=(await readDownload('test-text.pptx')).toString('base64');
  await evaluate(`document.querySelector('#files-clear').click();(()=>{const transfer=new DataTransfer();transfer.items.add(new File([Uint8Array.from(atob('${pptxEncoded}'),c=>c.charCodeAt(0))],'roundtrip.pptx',{type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}));const input=document.querySelector('#files-input');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  for(const tool of ['slides-text','slides-images']){
    await evaluate(`document.querySelector('[data-file-tool="${tool}"]').click();document.querySelector('#files-run').click()`);
    await wait(`document.querySelector('#files-status').textContent.includes('downloaded')&&!document.querySelector('#files-run').disabled`);
  }
  assert.match((await readDownload('roundtrip-slides.txt')).toString(),/Native label 1[\s\S]*Native label 2/);
  assert.equal(Object.values((await JSZip.loadAsync(await readDownload('roundtrip-media.zip'))).files).filter(f=>!f.dir).length,2);
  await evaluate(`(()=>{const c=document.createElement('canvas');c.width=100;c.height=80;const ctx=c.getContext('2d');ctx.fillStyle='#627ddd';ctx.fillRect(0,0,100,80);c.toBlob(b=>{const transfer=new DataTransfer();transfer.items.add(new File([b],'image.png',{type:'image/png'}));document.querySelector('#files-clear').click();const input=document.querySelector('#files-input');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));},'image/png');})()`);
  await wait(`document.querySelector('#files-list').textContent.includes('image.png')`);
  await evaluate(`document.querySelector('[data-file-tool="images-pdf"]').click();document.querySelector('#files-run').click()`);
  await wait(`!document.querySelector('#files-run').disabled`);
  assert.match(await evaluate(`document.querySelector('#files-status').textContent`),/downloaded/,'Image queue produces a real PDF');
  assert.equal((await PDFDocument.load(await readDownload('image-images.pdf'))).getPageCount(),1);
  await evaluate(`document.querySelector('[data-file-tool="images-pptx"]').click();document.querySelector('#files-run').click()`);
  await wait(`!document.querySelector('#files-run').disabled`);
  assert.match(await evaluate(`document.querySelector('#files-status').textContent`),/downloaded/);
  assert.ok((await JSZip.loadAsync(await readDownload('image-images.pptx'))).file('ppt/slides/slide1.xml'));
  for(const width of [1440,390,320]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true,`PDF tools fit ${width}`);
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await evaluate(`document.querySelector('#files').scrollIntoView()`);
  const filesShot=await send('Page.captureScreenshot');await fs.writeFile('.build/preview/files.png',Buffer.from(filesShot.data,'base64'));
  console.log('PASS: SVG/PPTX vectors, editable text; image formats; responsive layouts; 13 document tools including PDF/PowerPoint roundtrips, merge and figure bridge');
}finally{ws.close();}
