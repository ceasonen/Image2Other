import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';

const [url='http://127.0.0.1:4178/Image2Other/',port='9226']=process.argv.slice(2);
const tabs=await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
let nextId=0;const pending=new Map();
ws.addEventListener('message',event=>{const reply=JSON.parse(event.data);if(reply.id){pending.get(reply.id)?.(reply);pending.delete(reply.id);}});
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++nextId;pending.set(id,reply=>reply.error?reject(Error(JSON.stringify(reply.error))):resolve(reply.result));ws.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const reply=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(reply.exceptionDetails)throw Error(JSON.stringify(reply.exceptionDetails));return reply.result.value;};
const wait=expression=>evaluate(`new Promise((resolve,reject)=>{const start=performance.now();const poll=()=>{if(${expression})return resolve();if(performance.now()-start>40000)return reject(Error('Timed out: ${expression.replaceAll("'",'')}'));setTimeout(poll,80);};poll();})`);
await fs.mkdir('.build/downloads',{recursive:true});
const downloads=await fs.mkdtemp(path.resolve('.build/downloads/feedback-'));
try{
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  await send('Page.enable');await send('Page.navigate',{url});await wait(`document.readyState==='complete'`);
  assert.equal(await evaluate(`!!document.querySelector('#feedback')`),true,'Feedback card is present');
  await evaluate(`document.querySelector('#try-sample').click()`);
  await wait(`document.querySelector('#status').textContent.includes('ready')`);
  await evaluate(`document.querySelector('#open-example').click()`);
  await wait(`document.querySelector('#feedback-mae').textContent.includes('0.00')`);
  const boxId=await evaluate(`document.querySelector('#result-svg rect[data-node-id]').dataset.nodeId`);
  await evaluate(`document.querySelector('[data-layer="${boxId}"]').click();(()=>{const x=document.querySelector('#edit-x');x.value=Number(x.value)+4;x.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await evaluate(`document.querySelector('#feedback-compare').click()`);
  await wait(`Number(document.querySelector('#feedback-mae').dataset.value)>0`);
  const before=await evaluate(`Number(document.querySelector('#feedback-mae').dataset.value)`);
  await evaluate(`document.querySelector('#feedback-refine').click()`);
  await wait(`document.querySelector('#feedback-status').textContent.includes('Accepted')`);
  const after=await evaluate(`Number(document.querySelector('#feedback-mae').dataset.value)`);
  assert.ok(after<before,`Actual browser SVG rendering must improve: ${before} → ${after}`);
  assert.ok(await evaluate(`document.querySelector('#feedback-history').textContent.includes('round')`));
  for(const width of [390,320]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true,`Feedback panel fits ${width}px`);
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await evaluate(`document.querySelector('#feedback-export').click()`);
  const filename=path.join(downloads,'research-diagram.feedback.zip');
  for(let i=0;i<100;i++){try{if((await fs.stat(filename)).size>0)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
  const zip=await JSZip.loadAsync(await fs.readFile(filename));
  for(const name of ['reference.png','rendered.png','difference.png','initial.scene.json','final.scene.json','feedback.json'])assert.ok(zip.file(name),`${name} is available locally`);
  const manifest=JSON.parse(await zip.file('feedback.json').async('string'));
  assert.equal(manifest.annotationStatus,'unverified');
  assert.equal(manifest.checks.connectionsCorrect,null);
  assert.ok(manifest.trials.length>0);
  console.log(`Feedback browser check passed: ${before.toFixed(2)} → ${after.toFixed(2)} RGB MAE; ${manifest.trials.length} candidates; local ZIP exported.`);
}finally{ws.close();}
