// End-to-end local transport/UI test. The Python recognizer is injected, NOT a real Paddle model.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
const [url='http://127.0.0.1:4178/Image2Other/',port='9228']=process.argv.slice(2);
const result={page_index:null,model_settings:{use_doc_preprocessor:false,use_textline_orientation:false},rec_texts:['Model'],rec_scores:[.97],rec_polys:[[[49,44],[112,44],[112,69],[49,69]]]};
const python=spawn('python3',['-u','-c',`import sys;sys.path.insert(0,'scripts');from paddle_service import make_server;result=${JSON.stringify(result).replaceAll('null','None').replaceAll('false','False')};server=make_server(0,'${'a'.repeat(43)}',lambda raw:result);print(server.server_port,flush=True);server.serve_forever()`],{stdio:['ignore','pipe','pipe']});
let ws;
try{
  const localPort=await new Promise((resolve,reject)=>{let buffer='';const timer=setTimeout(()=>reject(Error('Local test service did not start')),10000);python.stdout.on('data',chunk=>{buffer+=chunk;if(buffer.includes('\n')){clearTimeout(timer);resolve(Number(buffer.trim()));}});python.once('exit',code=>{clearTimeout(timer);reject(Error('Local test service exited '+code));});});
  const tabs=await(await fetch(`http://127.0.0.1:${port}/json`)).json();ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));let id=0;const pending=new Map();
  ws.addEventListener('message',e=>{const r=JSON.parse(e.data);if(r.id){pending.get(r.id)?.(r);pending.delete(r.id);}});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,r=>r.error?reject(Error(r.error.message)):resolve(r.result));ws.send(JSON.stringify({id:n,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=expression=>evaluate(`new Promise((resolve,reject)=>{const start=performance.now();const poll=()=>{if(${expression})return resolve();if(performance.now()-start>30000)return reject(Error(document.querySelector('#status').textContent));setTimeout(poll,80);};poll();})`);
  await fs.mkdir('.build/downloads',{recursive:true});const dir=await fs.mkdtemp(path.resolve('.build/downloads/paddle-'));
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:dir});await send('Page.enable');await send('Page.navigate',{url});await wait(`document.readyState==='complete'`);
  await evaluate(`new Promise(resolve=>{const c=document.createElement('canvas');c.width=300;c.height=150;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,300,150);ctx.font='20px Times New Roman';ctx.fillStyle='black';ctx.fillText('Model',50,65);ctx.fillStyle='#6056d9';ctx.fillRect(180,40,80,45);c.toBlob(blob=>{const dt=new DataTransfer();dt.items.add(new File([blob],'paddle-test.png',{type:'image/png'}));const input=document.querySelector('#file-input');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));resolve();});})`);
  await wait(`document.querySelector('#source-meta').textContent.includes('paddle-test.png')`);
  await evaluate(`document.querySelector('[data-mode="ocr"]').click();document.querySelector('#ocr-engine').value='paddle';document.querySelector('#convert').click()`);
  assert.equal(await evaluate(`document.querySelector('#paddle-dialog').open`),true,'No service request without explicit settings/consent');
  await evaluate(`document.querySelector('#paddle-endpoint').value='http://127.0.0.1:${localPort}';document.querySelector('#paddle-token').value='${'a'.repeat(43)}';document.querySelector('#paddle-consent').checked=true;document.querySelector('#paddle-dialog').close();document.querySelector('#convert').click()`);
  await wait(`document.querySelector('#status').textContent.includes('PaddleOCR labels loaded')`);
  assert.equal(await evaluate(`document.querySelector('[data-ocr-text]').value`),'Model');assert.equal(await evaluate(`document.querySelector('[data-ocr-select]').checked`),false);
  await evaluate(`document.querySelector('[data-ocr-select]').click();document.querySelector('#ocr-build').click()`);await wait(`document.querySelector('#status').textContent.includes('editable text labels')`);
  assert.equal(await evaluate(`document.querySelectorAll('#result-svg path[data-node-id]').length>0&&document.querySelector('#result-svg text').textContent==='Model'`),true);
  assert.equal(await evaluate(`document.querySelector('#result-svg text').getAttribute('font-family')`),'Times New Roman, Times, serif');
  await evaluate(`document.querySelector('#ocr-review-export').click();document.querySelector('#export-svg').click()`);
  let review;for(let i=0;i<50;i++){try{review=JSON.parse(await fs.readFile(path.join(dir,'paddle-test.ocr-review.json'),'utf8'));break;}catch(error){if(i===49)throw error;await new Promise(r=>setTimeout(r,100));}}
  assert.equal(review.engine,'paddleocr-local');assert.equal(review.annotationStatus,'unverified');assert.equal(review.words[0].replace,true);
  // The offline file route must explicitly confirm source identity and leave replacement unchecked.
  await evaluate(`document.querySelector('#paddle-source-confirmed').checked=true;(()=>{const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(result))}],'result.json',{type:'application/json'}));const input=document.querySelector('#paddle-json-input');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait(`!document.querySelector('#convert').disabled`);assert.equal(await evaluate(`document.querySelector('[data-ocr-select]').checked`),false);
  for(const width of [1440,390,320]){await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:width<600});await evaluate(`document.querySelector('#paddle-dialog').showModal()`);assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth&&document.querySelector('#paddle-dialog').scrollWidth<=document.querySelector('#paddle-dialog').clientWidth`),true);await evaluate(`document.querySelector('#paddle-dialog').close()`);}
  console.log('PASS: local Python HTTP transport (injected recognizer) → reviewed native SVG text + paths; JSON import; consent; mobile layout. Real Paddle inference not tested.');
}finally{ws?.close();python.kill();}
