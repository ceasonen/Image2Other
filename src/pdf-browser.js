import {getDocument,GlobalWorkerOptions,Util,OPS} from './vendor/pdfjs/pdf.min.mjs';
import workerUrl from './vendor/pdfjs/pdf.worker.min.mjs?url';
import {PDF_LIMITS,parsePages} from './pdf-core.js';
GlobalWorkerOptions.workerSrc=workerUrl;
export async function openPdf(bytes){
  const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  if(data.length>PDF_LIMITS.bytes)throw Error('PDF exceeds 50 MB.');
  const task=getDocument({data:data.slice(),isEvalSupported:false,enableXfa:false,useSystemFonts:true,stopAtErrors:true});
  task.onPassword=()=>{task.destroy();};
  let doc;try{doc=await task.promise;}catch{throw Error('Cannot open this PDF. Encrypted or damaged files are unsupported.');}
  if(doc.numPages>PDF_LIMITS.pages){await doc.destroy();throw Error('PDF exceeds 200 pages.');}
  return doc;
}
export async function renderPdfPage(doc,number,{scale=1.5,withoutText=false}={}){
  const page=await doc.getPage(number),original=page.getViewport({scale:1});
  const bounded=Math.min(scale,Math.sqrt(PDF_LIMITS.pixels/(original.width*original.height)));
  const viewport=page.getViewport({scale:bounded});
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
  const context=canvas.getContext('2d');
  const options={canvasContext:context,viewport,background:'white',annotationMode:0};
  if(withoutText){
    const ops=await page.getOperatorList({intent:'display',annotationMode:0});
    const textOps=new Set(['showText','showSpacedText','nextLineShowText','nextLineSetSpacingShowText'].map(n=>OPS[n]).filter(n=>n!==undefined));
    options.operationsFilter=index=>!textOps.has(ops.fnArray[index]);
  }
  await page.render(options).promise;
  const content=await page.getTextContent();
  const text=content.items.filter(i=>typeof i.str==='string'&&i.str.trim()).map(item=>{
    const t=Util.transform(viewport.transform,item.transform);
    const fontSize=Math.hypot(t[2],t[3]);
    return {text:item.str,x:t[4],y:t[5]-fontSize*.82,width:Math.max(1,item.width*bounded),height:fontSize*1.2,fontSize,rotate:-Math.atan2(t[1],t[0])*180/Math.PI};
  });
  return {canvas,width:canvas.width,height:canvas.height,text,image:canvas.toDataURL('image/png')};
}
export async function pdfText(doc,selection){
  const pages=parsePages(selection,doc.numPages),results=[];
  for(const index of pages){const page=await doc.getPage(index+1),content=await page.getTextContent();results.push(content.items.map(i=>i.str??'').join(' '));}
  if(!results.some(t=>t.trim()))throw Error('No selectable text found. Scanned PDFs require OCR; OCR is not included in this local tool.');
  return results.join('\n\n');
}
