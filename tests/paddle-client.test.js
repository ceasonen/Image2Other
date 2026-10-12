import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
const file=new URL('../src/paddle-client.js',import.meta.url),api=existsSync(file)?await import(file):{};
test('local Paddle client requires consent, a session token and a loopback-only endpoint',async()=>{
  assert.equal(typeof api.readLocalPaddle,'function');let calls=0;
  const fetcher=async(url,options)=>{calls++;assert.equal(url,'http://127.0.0.1:8766/ocr');assert.equal(options.redirect,'error');assert.equal(options.headers['X-Image2Other-Token'],'a'.repeat(43));return{ok:true,text:async()=>JSON.stringify({version:1,width:20,height:10,res:{rec_texts:['A']}})};};
  const options={endpoint:'http://127.0.0.1:8766',token:'a'.repeat(43),image:'data:image/png;base64,aGVsbG8=',consent:true,fetcher};
  for(const patch of [{consent:false},{token:''},{endpoint:'https://example.com'},{endpoint:'http://127.0.0.1.evil.test:8766'},{endpoint:'http://user:password@localhost:8766'},{endpoint:'http://127.0.0.1:8766/?token=secret'}])await assert.rejects(api.readLocalPaddle({...options,...patch}));
  assert.equal(calls,0);assert.equal((await api.readLocalPaddle(options)).width,20);assert.equal(calls,1);
});
