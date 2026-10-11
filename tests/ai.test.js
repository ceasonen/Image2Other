import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSceneResponse, providerUrl, rebuildImage} from '../src/ai.js';
test('AI scene accepts fenced JSON and rejects raster nodes',()=>{
  assert.equal(parseSceneResponse('```json\n{"width":100,"height":80,"nodes":[]}\n```').width,100);
  assert.throws(()=>parseSceneResponse('{"width":100,"height":80,"nodes":[{"type":"image"}]}'),/Unsupported/);
});
test('provider URL requires HTTPS except explicit loopback development',()=>{
  assert.equal(providerUrl('https://example.com/v1/'), 'https://example.com/v1/chat/completions');
  assert.equal(providerUrl('http://localhost:8000/v1'), 'http://localhost:8000/v1/chat/completions');
  assert.throws(()=>providerUrl('http://example.com/v1'),/HTTPS/);
  assert.throws(()=>providerUrl('https://user:pass@example.com/v1'),/credentials/);
});
test('image transmission requires explicit consent before any request',async()=>{
  let called=false;
  await assert.rejects(()=>rebuildImage({consent:false,fetcher:()=>{called=true;}}),/consent/);
  assert.equal(called,false);
});
test('approved request uses only the configured endpoint and validated editable response',async()=>{
  let sent;
  const scene=await rebuildImage({endpoint:'https://vision.example/v1',key:'test-key',model:'test-vision',image:'data:image/png;base64,AA==',width:200,height:100,consent:true,
    fetcher:async(url,options)=>{sent={url,options};return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({width:200,height:100,nodes:[{type:'text',x:10,y:10,width:120,height:30,text:'Model',fontSize:20,fill:'#112233'}]})}}]})};}});
  assert.equal(sent.url,'https://vision.example/v1/chat/completions');
  assert.equal(sent.options.headers.Authorization,'Bearer test-key');
  assert.equal(JSON.parse(sent.options.body).model,'test-vision');
  assert.ok(!sent.url.includes('test-key'));
  assert.equal(scene.nodes[0].type,'text');assert.equal(scene.engine,'ai-rebuild');
});
test('provider errors never import unvalidated or unexpected output',async()=>{
  const config={endpoint:'https://vision.example/v1',model:'test-vision',image:'data:image/png;base64,AA==',consent:true};
  await assert.rejects(()=>rebuildImage({...config,fetcher:async()=>({ok:false,status:503})}),/HTTP 503/);
  await assert.rejects(()=>rebuildImage({...config,fetcher:async()=>({ok:true,json:async()=>({choices:[{message:{content:[]}}]})})}),/did not return/);
});
