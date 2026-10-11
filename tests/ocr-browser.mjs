// Real OCR, not mocked recognition. Small authored raster; no user files or remote inference.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
const [url='http://127.0.0.1:4178/Image2Other/',port='9228',language='eng']=process.argv.slice(2);
const tabs=await(await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map();
ws.addEventListener('message',e=>{const r=JSON.parse(e.data);if(r.id){pending.get(r.id)?.(r);pending.delete(r.id);}});
const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,r=>r.error?reject(Error(r.error.message)):resolve(r.result));ws.send(JSON.stringify({id:n,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=expression=>evaluate(`new Promise((resolve,reject)=>{const start=performance.now();const poll=()=>{if(${expression})return resolve();if(performance.now()-start>150000)return reject(Error('OCR browser timed out: '+document.querySelector('#status')?.textContent));setTimeout(poll,100);};poll();})`);
await fs.mkdir('.build/preview',{recursive:true});await fs.mkdir('.build/downloads',{recursive:true});
const dir=await fs.mkdtemp(path.resolve('.build/downloads/ocr-'));
try{
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:dir});
  await send('Page.enable');await send('Page.navigate',{url});await wait(`document.readyState==='complete'`);
  assert.equal(await evaluate(`!!document.querySelector('[data-mode="ocr"]')`),true,'Text + vectors mode must exist');
  await evaluate(`(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=420;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,1000,420);for(const [left,color,label] of [[70,'#e2eafa','Input'],[400,'#eceafb','Model'],[730,'#e4f2eb','Output']]){x.fillStyle=color;x.fillRect(left,150,200,120);x.fillStyle='#202436';x.font='36px Arial';x.fillText(label,left+35,225);}x.strokeStyle='#606890';x.lineWidth=3;for(const left of [275,605]){x.beginPath();x.moveTo(left,210);x.lineTo(left+110,210);x.stroke();}const blob=await new Promise(r=>c.toBlob(r));const dt=new DataTransfer();dt.items.add(new File([blob],'ocr-diagram.png',{type:'image/png'}));document.querySelector('#file-input').files=dt.files;document.querySelector('#file-input').dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait(`document.querySelector('#status').textContent.includes('ready')`);
  if(language.includes('chi_sim')){
    // A small original raster fixture makes recognition independent of CI's CJK fonts.
    const {png}=JSON.parse(await fs.readFile(new URL('./fixtures/ocr-mixed.json',import.meta.url),'utf8'));
    await evaluate(`document.querySelector('#status').textContent='Loading mixed-script fixture';(()=>{const dt=new DataTransfer();dt.items.add(new File([Uint8Array.from(atob('${png}'),c=>c.charCodeAt(0))],'ocr-diagram.png',{type:'image/png'}));document.querySelector('#file-input').files=dt.files;document.querySelector('#file-input').dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await wait(`document.querySelector('#status').textContent.includes('ready')`);
  }
  await evaluate(`document.querySelector('#ocr-language').value=${JSON.stringify(language)}`);
  await evaluate(`document.querySelector('[data-mode="ocr"]').click();document.querySelector('#convert').click()`);
  assert.match(await evaluate(`document.querySelector('#status').textContent`),/allow|download/i,'OCR must need explicit runtime-download consent');
  await evaluate(`document.querySelector('#ocr-download-consent').checked=true;document.querySelector('#convert').click()`);
  await wait(`!document.querySelector('#convert').disabled`);
  assert.equal(await evaluate(`document.querySelector('#ocr-review').hidden`),false);
  const words=await evaluate(`[...document.querySelectorAll('[data-ocr-text]')].map(x=>x.value)`);
  for(const word of ['Input','Model','Output'])assert.ok(words.includes(word),`Real OCR recognizes ${word}: ${words}`);
  if(language.includes('chi_sim'))assert.ok(words.join('').includes('多模态模型'),`Chinese recognition: ${words}`);
  if(language.includes('chi_sim'))assert.equal(await evaluate(`[...document.querySelectorAll('[data-ocr-text]')].filter(x=>/[多模态型]/.test(x.value)).every(x=>document.querySelector('[data-ocr-select="'+x.dataset.ocrText+'"]').checked)`),true,'Adjacent Chinese characters stay eligible for native text');
  await evaluate(`const input=[...document.querySelectorAll('[data-ocr-text]')].find(x=>x.value==='Model');input.value='Encoder';input.dispatchEvent(new Event('input',{bubbles:true}));const check=document.querySelector('[data-ocr-select="'+input.dataset.ocrText+'"]');check.checked=true;check.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#ocr-build').click()`);
  await wait(`document.querySelector('#status').textContent.includes('editable text')`);
  assert.equal(await evaluate(`document.querySelector('#result-svg').textContent.includes('Encoder')`),true);
  assert.ok(await evaluate(`document.querySelectorAll('#result-svg text').length`)>0);
  assert.ok(await evaluate(`document.querySelectorAll('#result-svg path[data-node-id]').length`)>0);
  await evaluate(`document.querySelector('#ocr-review-export').click()`);
  let review;
  for(let attempt=0;attempt<50;attempt++){try{review=JSON.parse(await fs.readFile(path.join(dir,'ocr-diagram.ocr-review.json'),'utf8'));break;}catch(e){if(attempt===49)throw e;await new Promise(r=>setTimeout(r,100));}}
  assert.ok(review.words.some(w=>w.originalText==='Model'&&w.correctedText==='Encoder'&&w.replace));
  await evaluate(`document.querySelector('#export-svg').click();document.querySelector('#export-pptx').click()`);
  await wait(`document.querySelector('#status').textContent.includes('PPTX downloaded')`);
  await new Promise(r=>setTimeout(r,250));
  const svg=await fs.readFile(path.join(dir,'ocr-diagram.svg'),'utf8');assert.match(svg,/<text /);assert.match(svg,/Encoder/);assert.doesNotMatch(svg,/<image /);
  const zip=await JSZip.loadAsync(await fs.readFile(path.join(dir,'ocr-diagram.pptx')));
  const slide=await zip.file('ppt/slides/slide1.xml').async('string');assert.match(slide,/<a:t>Encoder<\/a:t>/);assert.match(slide,/<a:custGeom>/);assert.doesNotMatch(slide,/<p:pic>/);
  for(const width of [1440,390,320]){await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:width<600});assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true,`OCR has no overflow at ${width}`);}
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await evaluate(`document.querySelector('#studio').scrollIntoView()`);
  const shot=await send('Page.captureScreenshot');await fs.writeFile('.build/preview/ocr-studio.png',Buffer.from(shot.data,'base64'));
  console.log('PASS: real OCR → reviewed correction → SVG text + paths / native PPTX text + vectors; consent and mobile widths');
}finally{ws.close();}
