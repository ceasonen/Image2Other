import {PDFDocument,degrees} from './vendor/pdf-lib/pdf-lib.esm.min.js';

export const PDF_LIMITS={bytes:50*1024*1024,pages:200,files:25,renderPages:40,pixels:12_000_000};

export function parsePages(value,count){
  if(!Number.isInteger(count)||count<1||count>PDF_LIMITS.pages)throw new Error('Choose a PDF with 1–200 pages.');
  const text=String(value??'').trim().replace(/[，、]/g,',').replace(/[–—～~]/g,'-');
  if(!text||/^(all|全部)$/i.test(text))return Array.from({length:count},(_,i)=>i);
  if(text.length>2000)throw new Error('Page selection is too long.');
  const result=[];
  for(const part of text.split(',')){
    const match=part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if(!match)throw new Error('Use page numbers or ranges, for example 3,1-2.');
    const start=Number(match[1]),end=Number(match[2]??match[1]);
    if(start<1||end<start||end>count)throw new Error(`Page selection must stay within 1–${count}, with ascending ranges.`);
    if(result.length+end-start+1>PDF_LIMITS.pages)throw new Error('Select at most 200 output pages.');
    for(let page=start;page<=end;page++)result.push(page-1);
  }
  return result;
}

export async function readPdf(input,{editing=false}={}){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  if(!bytes.length||bytes.length>PDF_LIMITS.bytes)throw new Error('Choose a PDF smaller than 50 MB.');
  if(!new TextDecoder('latin1').decode(bytes.subarray(0,1024)).includes('%PDF-'))throw new Error('This file is not a PDF.');
  let doc;try{doc=await PDFDocument.load(bytes,{updateMetadata:false});}catch{throw new Error('Cannot open this PDF. Password-protected or damaged files are not supported.');}
  if(doc.getPageCount()<1||doc.getPageCount()>PDF_LIMITS.pages)throw new Error('This workspace supports at most 200 PDF pages.');
  if(editing&&doc.getForm().getFields().length)throw new Error('PDFs with form or signature fields cannot be reorganized here. Keep your original interactive document.');
  return doc;
}
const save=doc=>doc.save({useObjectStreams:true,addDefaultPage:false,updateFieldAppearances:false});
export async function selectPdf(bytes,selection=''){
  const source=await readPdf(bytes,{editing:true}),output=await PDFDocument.create();
  for(const page of await output.copyPages(source,parsePages(selection,source.getPageCount())))output.addPage(page);
  return save(output);
}
export async function mergePdfs(inputs){
  if(!inputs.length||inputs.length>PDF_LIMITS.files)throw new Error('Choose between 1 and 25 PDF files.');
  if(inputs.reduce((sum,x)=>sum+x.byteLength,0)>PDF_LIMITS.bytes)throw new Error('The file queue exceeds 50 MB.');
  const output=await PDFDocument.create();
  for(const bytes of inputs){
    const source=await readPdf(bytes,{editing:true});
    if(output.getPageCount()+source.getPageCount()>PDF_LIMITS.pages)throw new Error('The merged PDF would exceed 200 pages.');
    for(const page of await output.copyPages(source,source.getPageIndices()))output.addPage(page);
  }
  return save(output);
}
export async function rotatePdf(bytes,selection='',angle=90){
  if(![90,180,270].includes(angle))throw new Error('Rotation must be 90, 180, or 270 degrees.');
  const output=await readPdf(bytes,{editing:true});
  for(const index of new Set(parsePages(selection,output.getPageCount()))){const page=output.getPage(index);page.setRotation(degrees((page.getRotation().angle+angle)%360));}
  return save(output);
}
export async function splitPdf(bytes,selection=''){
  const source=await readPdf(bytes,{editing:true}),outputs=[];
  for(const index of parsePages(selection,source.getPageCount())){const doc=await PDFDocument.create();doc.addPage((await doc.copyPages(source,[index]))[0]);outputs.push({page:index+1,bytes:await save(doc)});}
  return outputs;
}
export async function imagesToPdf(images,{paper='original'}={}){
  if(!images.length||images.length>PDF_LIMITS.files)throw new Error('Choose between 1 and 25 images.');
  if(!['original','a4','letter'].includes(paper))throw new Error('Unsupported paper size.');
  const doc=await PDFDocument.create();
  for(const source of images){
    if(!['image/png','image/jpeg'].includes(source.type))throw new Error('PDF embedding requires PNG or JPEG pixels.');
    const image=await (source.type==='image/png'?doc.embedPng(source.bytes):doc.embedJpg(source.bytes));
    if(image.width*image.height>24_000_000)throw new Error('An image exceeds 24 megapixels.');
    const longest=Math.max(image.width,image.height),scale=Math.min(1,14400/longest);
    const size=paper==='original'?[image.width*scale,image.height*scale]:paper==='a4'?[595.28,841.89]:[612,792];
    const page=doc.addPage(size),margin=paper==='original'?0:24;
    const fit=Math.min((size[0]-2*margin)/image.width,(size[1]-2*margin)/image.height);
    page.drawImage(image,{x:(size[0]-image.width*fit)/2,y:(size[1]-image.height*fit)/2,width:image.width*fit,height:image.height*fit});
  }
  return save(doc);
}
