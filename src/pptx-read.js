import JSZip from 'jszip';
async function archive(input){
  if(!input.byteLength||input.byteLength>50*1024*1024)throw Error('Choose a PowerPoint file smaller than 50 MB.');
  let zip;try{zip=await JSZip.loadAsync(input,{checkCRC32:false});}catch{throw Error('Cannot read this PowerPoint file. Use unencrypted .pptx, not legacy .ppt.');}
  if(!zip.file('ppt/presentation.xml')||!zip.file('[Content_Types].xml'))throw Error('This ZIP is not a PowerPoint presentation.');
  const entries=Object.values(zip.files).filter(f=>!f.dir);
  if(entries.length>1000||entries.reduce((n,f)=>n+(f._data?.uncompressedSize??Infinity),0)>100*1024*1024)throw Error('PowerPoint expanded contents exceed the local safety limit.');
  return zip;
}
function decodeXml(text){return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,name)=>{
  if(name.startsWith('#')){const n=name[1].toLowerCase()==='x'?parseInt(name.slice(2),16):Number(name.slice(1));return n>=0&&n<=0x10ffff?String.fromCodePoint(n):'�';}
  return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[name.toLowerCase()];
});}
const attrs=tag=>Object.fromEntries([...tag.matchAll(/([:\w.-]+)\s*=\s*(['"])(.*?)\2/g)].map(m=>[m[1],decodeXml(m[3])]));
async function smallXml(zip,name){const f=zip.file(name);if(!f||f._data.uncompressedSize>1024*1024)throw Error('Missing or oversized PowerPoint XML part.');const xml=await f.async('string');if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('Presentation contains unsupported active XML.');return xml;}
export async function pptxText(input){
  const zip=await archive(input);let slides=Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a,b)=>Number(a.match(/slide(\d+)/)[1])-Number(b.match(/slide(\d+)/)[1]));
  const presentation=await smallXml(zip,'ppt/presentation.xml'),ids=[...presentation.matchAll(/<p:sldId\b[^>]*>/g)].map(m=>attrs(m[0])['r:id']);
  if(ids.length){const relXml=await smallXml(zip,'ppt/_rels/presentation.xml.rels'),rels=new Map([...relXml.matchAll(/<Relationship\b[^>]*>/g)].map(m=>{const a=attrs(m[0]);if(a.TargetMode==='External')return[a.Id,null];const target=a.Target?.replace(/^\/ppt\//,'').replace(/^\.\//,'');return[a.Id,/^slides\/slide\d+\.xml$/.test(target)?'ppt/'+target:null];}));slides=ids.map(id=>{const n=rels.get(id);if(!n||!zip.file(n))throw Error('Unsupported PowerPoint slide relationship.');return n;});}
  if(!slides.length||slides.length>200)throw Error('Choose a PowerPoint presentation with 1–200 slides.');
  const output=[];
  for(let i=0;i<slides.length;i++){
    const f=zip.file(slides[i]);if(f._data.uncompressedSize>1024*1024)throw Error('Slide text exceeds the local limit.');
    const xml=await f.async('string');if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('Slides contain unsupported active XML.');
    const strings=[...xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map(m=>decodeXml(m[1]));
    output.push(`Slide ${i+1}\n${strings.join('\n')}`);
  }
  return output.join('\n\n');
}
export async function pptxImages(input){
  const zip=await archive(input),names=Object.keys(zip.files).filter(n=>/^ppt\/media\/[^/]+\.(png|jpe?g|webp|gif)$/i.test(n));
  if(!names.length)throw Error('No embedded PNG, JPEG, WebP or GIF images found. Vector artwork and linked images are not extracted.');
  return Promise.all(names.map(async n=>({name:n.split('/').at(-1).replace(/[^a-z0-9._-]/gi,'-'),bytes:await zip.file(n).async('uint8array')})));
}
