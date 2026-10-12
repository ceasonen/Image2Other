export async function readLocalPaddle({endpoint,token,image,consent=false,signal,fetcher=fetch}){
  if(!consent)throw Error('Allow sending this working image to your local Python service first.');
  const url=new URL(endpoint);
  if(url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname)||url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname))throw Error('Use a loopback-only URL, for example http://127.0.0.1:8766.');
  if(typeof token!=='string'||! /^[A-Za-z0-9_-]{32,128}$/.test(token))throw Error('Paste the session token printed by your local service.');
  if(typeof image!=='string'||!image.startsWith('data:image/png;base64,')||image.length>8e6-100)throw Error('Use a PNG working image smaller than 8 MB.');
  const response=await fetcher(new URL('/ocr',url).href,{method:'POST',headers:{'Content-Type':'application/json','X-Image2Other-Token':token},body:JSON.stringify({version:1,image}),redirect:'error',credentials:'omit',cache:'no-store',signal});
  const raw=await response.text();if(raw.length>4e6)throw Error('Local OCR response is too large.');
  let data;try{data=JSON.parse(raw);}catch{throw Error('Local service returned invalid JSON.');}
  if(!response.ok)throw Error(data.error??`Local OCR failed (${response.status}).`);
  if(data.version!==1||!Number.isInteger(data.width)||!Number.isInteger(data.height)||!data.res)throw Error('Unexpected local OCR response.');
  return data;
}
