import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
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
  await send('Page.enable');await send('Page.navigate',{url});await wait(`document.readyState==='complete'`);
  assert.equal(await evaluate(`!!document.querySelector('#try-sample')`),true,'Diagram sample control is available');
  await evaluate(`document.querySelector('#try-sample').click()`);
  await wait(`document.querySelector('#status').textContent.includes('ready')`);
  assert.equal(await evaluate(`document.querySelector('#source-image').naturalWidth>0`),true);
  await evaluate(`document.querySelector('#convert').click()`);
  await wait(`document.querySelector('#status').textContent.includes('paths ready')`);
  assert.equal(await evaluate(`document.querySelectorAll('#result-svg path[data-node-id]').length>0`),true);
  assert.equal(await evaluate(`document.querySelectorAll('#result-svg image').length`),0);
  assert.equal(await evaluate(`document.querySelector('#export-svg').disabled`),false);
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
  await evaluate(`document.querySelector('[data-layer="${first}"]').click();document.querySelector('#edit-text').value='Edited label';document.querySelector('#edit-text').dispatchEvent(new Event('change',{bubbles:true}));`);
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
  // Extreme aspect ratios must retain a nonzero working canvas after downsampling.
  await evaluate(`(()=>{const transfer=new DataTransfer();transfer.items.add(new File(['<svg xmlns="http://www.w3.org/2000/svg" width="1" height="10000"><rect width="1" height="10000" fill="#6056d9"/></svg>'],'thin.svg',{type:'image/svg+xml'}));const input=document.querySelector('#file-input');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait(`document.querySelector('#source-meta').textContent.includes('thin.svg')`);
  await evaluate(`document.querySelector('#convert').click()`);
  await wait(`document.querySelector('#status').textContent.includes('paths ready')`);
  console.log('PASS: actual SVG/PPTX files with traced paths, editable text and Scene JSON; PNG/JPEG/WebP files; five responsive widths; thin-image tracing');
}finally{ws.close();}
