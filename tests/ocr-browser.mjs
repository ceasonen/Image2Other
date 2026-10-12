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
  await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
  await send('Page.enable');await send('Page.navigate',{url});await wait(`document.readyState==='complete'`);
  assert.equal(await evaluate(`!!document.querySelector('[data-mode="ocr"]')`),true,'Text + vectors mode must exist');
  // Identical original PNG bytes on macOS/Linux; canvas-generated fonts differ across hosts.
  const {png}=JSON.parse(await fs.readFile(new URL('./fixtures/ocr-mixed.json',import.meta.url),'utf8'));
  await evaluate(`(()=>{const dt=new DataTransfer();dt.items.add(new File([Uint8Array.from(atob('${png}'),c=>c.charCodeAt(0))],'ocr-diagram.png',{type:'image/png'}));document.querySelector('#file-input').files=dt.files;document.querySelector('#file-input').dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait(`document.querySelector('#status').textContent.includes('ready')`);
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
  const labels=await evaluate(`[...document.querySelectorAll('[data-ocr-text]')].map(x=>({text:x.value,disabled:document.querySelector('[data-ocr-select="'+x.dataset.ocrText+'"]').disabled,score:x.parentElement.querySelector('small').textContent}))`);
  assert.equal(labels.find(x=>x.text==='Model')?.disabled,false,`Test label must be replaceable: ${JSON.stringify(labels)}`);
  const modelId=await evaluate(`[...document.querySelectorAll('[data-ocr-text]')].find(x=>x.value==='Model').dataset.ocrText`);
  assert.equal(await evaluate(`!!document.querySelector('[data-ocr-reread="${modelId}"]')`),true,'Labels need an explicit focused OCR comparison');
  await evaluate(`document.querySelector('[data-ocr-reread="${modelId}"]').click()`);
  await wait(`document.querySelector('#crop-dialog')?.open`);
  assert.equal(await evaluate(`document.querySelector('[data-ocr-text="${modelId}"]').value`),'Model','Opening comparison cannot mutate text');
  await evaluate(`document.querySelector('#crop-read').click();document.querySelector('#crop-stop').click()`);
  await wait(`!document.querySelector('#crop-read').disabled`);
  assert.equal(await evaluate(`document.querySelector('[data-ocr-text="${modelId}"]').value`),'Model','Stopping an unfinished read cannot mutate text');
  await evaluate(`document.querySelector('#crop-read').click()`);
  await wait(`!document.querySelector('#crop-read').disabled&&document.querySelectorAll('[data-crop-choice]').length>0`);
  assert.ok(await evaluate(`[...document.querySelectorAll('[data-crop-choice]')].some(x=>x.textContent.includes('Model'))`),'Real focused OCR returns the authored label');
  for(const width of [390,320]){await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth&&document.querySelector('#crop-dialog').scrollWidth<=document.querySelector('#crop-dialog').clientWidth`),true,`Crop comparison fits ${width}`);}
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await evaluate(`[...document.querySelectorAll('[data-crop-choice]')].find(x=>x.textContent.includes('Model')).click()`);
  await wait(`!document.querySelector('#crop-dialog').open`);
  assert.equal(await evaluate(`document.querySelector('[data-ocr-select="${modelId}"]').checked`),false,'Choosing a candidate must not authorize replacement');
  assert.equal(await evaluate(`!!document.querySelector('[data-ocr-mask="${modelId}"]')`),true,'Each eligible label needs a visual erase-mask review');
  await evaluate(`document.querySelector('[data-ocr-mask="${modelId}"]').click()`);
  await wait(`document.querySelector('#mask-dialog')?.open`);
  assert.equal(await evaluate(`!!document.querySelector('#mask-propose')`),true,'Mask review needs an inspectable component proposal');
  await evaluate(`document.querySelector('#mask-propose').click()`);
  assert.match(await evaluate(`document.querySelector('#mask-status').textContent`),/proposal/i);
  await evaluate(`document.querySelector('#mask-reset').click()`);
  await evaluate(`document.querySelector('#mask-paint').scrollIntoView({block:'center'})`);
  const brush=await evaluate(`(()=>{const c=document.querySelector('#mask-paint'),r=c.getBoundingClientRect();return {x:r.left+r.width*.35,y:r.top+r.height*.45,dx:r.width*.1};})()`);
  for(const mode of ['keep','erase']){
    await evaluate(`document.querySelector('#mask-brush-mode').value='${mode}'`);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',x:brush.x,y:brush.y,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:brush.x+brush.dx,y:brush.y,button:'left',buttons:1});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:brush.x+brush.dx,y:brush.y,button:'left',clickCount:1});
  }
  assert.match(await evaluate(`document.querySelector('#mask-status').textContent`),/2 strokes/);
  for(const width of [390,320]){await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth&&document.querySelector('#mask-dialog').scrollWidth<=document.querySelector('#mask-dialog').clientWidth`),true,`Mask dialog fits ${width}`);}
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  const maskShot=await send('Page.captureScreenshot');await fs.writeFile('.build/preview/mask-editor.png',Buffer.from(maskShot.data,'base64'));
  await evaluate(`document.querySelector('#mask-save').click()`);await wait(`!document.querySelector('#mask-dialog').open`);
  assert.match(await evaluate(`document.querySelector('[data-ocr-mask="${modelId}"]').closest('.ocr-word').querySelector('small').textContent`),/mask reviewed/);
  await evaluate(`document.querySelector('[data-ocr-mask="${modelId}"]').click()`);await wait(`document.querySelector('#mask-dialog').open`);
  assert.match(await evaluate(`document.querySelector('#mask-status').textContent`),/2 strokes/,'Confirmed strokes survive reopening');
  await evaluate(`document.querySelector('#mask-undo').click()`);
  assert.match(await evaluate(`document.querySelector('#mask-status').textContent`),/1 strokes/);
  await evaluate(`document.querySelector('#mask-close').click()`);await wait(`!document.querySelector('#mask-dialog').open`);
  await evaluate(`document.querySelector('[data-ocr-mask="${modelId}"]').click()`);await wait(`document.querySelector('#mask-dialog').open`);
  assert.match(await evaluate(`document.querySelector('#mask-status').textContent`),/2 strokes/,'Closing without confirmation must discard draft changes');
  await evaluate(`document.querySelector('#mask-close').click()`);await wait(`!document.querySelector('#mask-dialog').open`);
  await evaluate(`const input=[...document.querySelectorAll('[data-ocr-text]')].find(x=>x.value==='Model');input.value='Encoder';input.dispatchEvent(new Event('input',{bubbles:true}));const check=document.querySelector('[data-ocr-select="'+input.dataset.ocrText+'"]');check.checked=true;check.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#ocr-build').click()`);
  await wait(`document.querySelector('#status').textContent.includes('editable text')`);
  assert.equal(await evaluate(`document.querySelector('#result-svg').textContent.includes('Encoder')`),true);
  assert.ok(await evaluate(`document.querySelectorAll('#result-svg text').length`)>0);
  assert.ok(await evaluate(`document.querySelectorAll('#result-svg path[data-node-id]').length`)>0);
  await evaluate(`document.querySelector('#ocr-review-export').click()`);
  let review;
  for(let attempt=0;attempt<50;attempt++){try{review=JSON.parse(await fs.readFile(path.join(dir,'ocr-diagram.ocr-review.json'),'utf8'));break;}catch(e){if(attempt===49)throw e;await new Promise(r=>setTimeout(r,100));}}
  assert.ok(review.words.some(w=>w.originalText==='Model'&&w.correctedText==='Encoder'&&w.replace));
  const approved=review.words.find(w=>w.originalText==='Model').maskReview;
  assert.equal(approved.userConfirmed,true);assert.equal(approved.strokes.length,2);assert.equal(review.annotationStatus,'unverified');
  const cropReview=review.words.find(w=>w.originalText==='Model').cropReview;
  assert.equal(cropReview.choiceText,'Model');assert.equal(cropReview.correctnessVerified,false);
  await evaluate(`document.querySelector('#export-svg').click();document.querySelector('#export-pptx').click()`);
  await wait(`document.querySelector('#status').textContent.includes('PPTX downloaded')`);
  await new Promise(r=>setTimeout(r,250));
  const svg=await fs.readFile(path.join(dir,'ocr-diagram.svg'),'utf8');assert.match(svg,/<text /);assert.match(svg,/Encoder/);assert.doesNotMatch(svg,/<image /);
  assert.match(svg,/font-family="Times New Roman, Times, serif"/);
  const zip=await JSZip.loadAsync(await fs.readFile(path.join(dir,'ocr-diagram.pptx')));
  const slide=await zip.file('ppt/slides/slide1.xml').async('string');assert.match(slide,/<a:t>Encoder<\/a:t>/);assert.match(slide,/<a:custGeom>/);assert.doesNotMatch(slide,/<p:pic>/);
  assert.match(slide,/typeface="Times New Roman"/);
  for(const width of [1440,390,320]){await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:width<600});assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true,`OCR has no overflow at ${width}`);}
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await evaluate(`document.querySelector('#studio').scrollIntoView()`);
  const shot=await send('Page.captureScreenshot');await fs.writeFile('.build/preview/ocr-studio.png',Buffer.from(shot.data,'base64'));
  console.log('PASS: real OCR → visual mask review → corrected SVG/native PPTX text + vectors; consent and mobile widths');
}finally{ws.close();}
