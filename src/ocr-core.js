import {validateScene,MAX_NODES} from './scene.js';
import {createEraseMask,validateMaskStrokes,validateProtectedRuns,reviewedMask} from './ocr-mask.js';
import {cropReviewForWord} from './ocr-candidates.js';
export const OCR_THRESHOLD=85; // A review heuristic, not a calibrated accuracy probability.
export function ocrWords(data,width,height){
  const words=[];
  for(const block of data?.blocks??[])for(const paragraph of block.paragraphs??[])for(const line of paragraph.lines??[]){
   const candidates=line.bbox&&line.text?.trim()?[{...line,confidence:Math.min(Number(line.confidence??100),...(line.words??[]).map(w=>Number(w.confidence??0)))}]:line.words??[];
   for(const word of candidates){
    const b=word.bbox,text=String(word.text??'').trim().replace(/(?<=[\u3400-\u9fff]) +(?=[\u3400-\u9fff])/g,''),confidence=Number(word.confidence);
    if(!text||text.length>500||!b||![b.x0,b.y0,b.x1,b.y1,confidence].every(Number.isFinite)||b.x1<=b.x0||b.y1<=b.y0)continue;
    const x=Math.max(0,Math.floor(b.x0)),y=Math.max(0,Math.floor(b.y0));
    const right=Math.min(width,Math.ceil(b.x1)),bottom=Math.min(height,Math.ceil(b.y1));
    if(right<=x||bottom<=y)continue;
    words.push({id:`word-${words.length}`,originalText:text,text,confidence:Math.max(0,Math.min(100,confidence)),box:{x,y,width:right-x,height:bottom-y},selected:false});
    if(words.length>=500)return words;
   }
  }
  return words;
}
const rgbHex=rgb=>'#'+rgb.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
const distance=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
function pixel(image,x,y){const i=(y*image.width+x)*4,a=image.data[i+3]/255;return [...image.data.slice(i,i+3)].map(v=>Math.round(v*a+255*(1-a)));}
// Conservative axis-aligned stroke check, not connector/semantic recovery.
// A flat perimeter alone can miss a one-pixel line passing through a label.
function crossingStroke(image,b,bg,neighbors){
  const ink=(x,y)=>x>=0&&y>=0&&x<image.width&&y<image.height&&
    !neighbors.some(w=>x>=w.box.x&&x<w.box.x+w.box.width&&y>=w.box.y&&y<w.box.y+w.box.height)&&distance(pixel(image,x,y),bg)>70;
  for(let y=b.y;y<b.y+b.height;y++)if(ink(b.x-2,y)&&ink(b.x-1,y)&&ink(b.x+b.width,y)&&ink(b.x+b.width+1,y)&&
    [.25,.5,.75].every(f=>ink(b.x+Math.floor((b.width-1)*f),y)))return true;
  for(let x=b.x;x<b.x+b.width;x++)if(ink(x,b.y-2)&&ink(x,b.y-1)&&ink(x,b.y+b.height)&&ink(x,b.y+b.height+1)&&
    [.25,.5,.75].every(f=>ink(x,b.y+Math.floor((b.height-1)*f))))return true;
  return false;
}
export function prepareWords(words,image){
  return words.map(word=>{
    const b=word.box,edge=[],alphas=[],bins=new Map();
    const neighbors=words.filter(other=>other!==word&&other.box.x<b.x+b.width+2&&other.box.x+other.box.width>b.x-2&&other.box.y<b.y+b.height+2&&other.box.y+other.box.height>b.y-2);
    for(let y=Math.max(0,b.y-2);y<Math.min(image.height,b.y+b.height+2);y++)for(let x=Math.max(0,b.x-2);x<Math.min(image.width,b.x+b.width+2);x++){
      if(x>=b.x&&x<b.x+b.width&&y>=b.y&&y<b.y+b.height)continue;
      if(neighbors.some(w=>x>=w.box.x&&x<w.box.x+w.box.width&&y>=w.box.y&&y<w.box.y+w.box.height))continue;
      const rgb=pixel(image,x,y),key=rgb.map(v=>Math.round(v/24)).join(',');edge.push(rgb);alphas.push(image.data[(y*image.width+x)*4+3]);
      const bin=bins.get(key)??[];bin.push(rgb);bins.set(key,bin);
    }
    const dominant=[...bins.values()].sort((a,b)=>b.length-a.length)[0]??[[255,255,255]];
    const bg=[0,1,2].map(i=>dominant.reduce((s,c)=>s+c[i],0)/dominant.length);
    const backgroundAlpha=alphas.sort((a,b)=>a-b)[Math.floor(alphas.length/2)]??255;
    const flatness=edge.length?edge.filter(c=>distance(c,bg)<32).length/edge.length:0;
    const safeBackground=flatness>=.9&&alphas.filter(a=>Math.abs(a-backgroundAlpha)<24).length/Math.max(1,alphas.length)>=.9;
    const replacementBlock=!safeBackground?'mixed-background':crossingStroke(image,b,bg,neighbors)?'crossing-stroke':null;
    const ink=[],step=Math.max(1,Math.ceil(Math.sqrt(b.width*b.height/4096)));
    for(let y=b.y;y<b.y+b.height;y+=step)for(let x=b.x;x<b.x+b.width;x+=step){const c=pixel(image,x,y);if(distance(c,bg)>70)ink.push(c);}
    const fg=ink.length?[0,1,2].map(i=>ink.map(c=>c[i]).sort((a,b)=>a-b)[Math.floor(ink.length/2)]):[32,36,54];
    // B/8, I/1 and similar one-character identifiers can be confidently wrong.
    // This is a conservative review heuristic, never an automatic correction.
    const reviewReason=/^(?:[A-Za-z0-9]|\(\s*[A-Za-z0-9]\s*\)|\[\s*[A-Za-z0-9]\s*\])$/.test(word.text.trim())?'short-identifier':null;
    return {...word,background:rgbHex(bg),backgroundAlpha,fill:rgbHex(fg),flatness,safeBackground,replacementBlock,reviewReason,selected:word.confidence>=OCR_THRESHOLD&&!replacementBlock&&!reviewReason};
  });
}
export function canReplaceWord(word){return !!word?.safeBackground&&(!word.replacementBlock||reviewedMask(word));}
export function reviewEraseMask(word,strokes,protectedRuns=[]){
  if(!word.safeBackground)throw Error('Mixed backgrounds need a different reconstruction route.');
  const safe=validateMaskStrokes(word.box,strokes),runs=validateProtectedRuns(word.box,protectedRuns);createEraseMask(word.box,safe,runs); // Also bound work before approval.
  return {...word,selected:true,maskReview:{version:1,userConfirmed:true,box:{...word.box},strokes:safe,protectedRuns:runs}};
}
function replacements(words){return words.filter(w=>w.selected&&canReplaceWord(w)&&w.text.trim());}
export function maskWords(image,words){
  const out={width:image.width,height:image.height,data:new Uint8ClampedArray(image.data)};
  const active=replacements(words);let protectedPixels=null;
  // Protection is global across active labels: an overlapping box must not clear it later.
  // Process one crop at a time rather than retain all crop masks in memory.
  for(const word of active)if(reviewedMask(word)){
    protectedPixels??=new Uint8Array(image.width*image.height);
    const b=word.box,mask=createEraseMask(b,word.maskReview.strokes,word.maskReview.protectedRuns);
    for(let y=0;y<b.height;y++)for(let x=0;x<b.width;x++)if(!mask[y*b.width+x])protectedPixels[(y+b.y)*image.width+x+b.x]=1;
  }
  for(const word of active){
    const b=word.box,rgb=word.background.match(/[a-f\d]{2}/gi).map(v=>parseInt(v,16));
    const mask=reviewedMask(word)?createEraseMask(b,word.maskReview.strokes,word.maskReview.protectedRuns):null;
    for(let y=b.y;y<b.y+b.height;y++)for(let x=b.x;x<b.x+b.width;x++){
      if(protectedPixels?.[y*image.width+x]||(mask&&!mask[(y-b.y)*b.width+x-b.x]))continue;
      const i=(y*image.width+x)*4;out.data.set([...rgb,word.backgroundAlpha??255],i);
    }
  }
  return out;
}
export function appendOcrText(scene,words,width,height){
  const sx=scene.width/width,sy=scene.height/height;
  const text=replacements(words).map(word=>({type:'text',name:`OCR: ${word.text}`,text:word.text,
    x:word.box.x*sx,y:word.box.y*sy,width:word.box.width*sx,height:word.box.height*sy*1.35,
    fontSize:Math.max(1,Math.min(500,word.box.height*sy*1.2)),fill:word.fill,fitWidth:true}));
  if(scene.nodes.length+text.length>MAX_NODES)throw Error('Too many layers. Trace with fewer colors or simplify detail.');
  return validateScene({...scene,engine:'ocr-trace',nodes:[...scene.nodes,...text]});
}
export function reviewData(words,width,height,language,engine='tesseract-lstm'){return {version:2,engine,language,width,height,trainedClassifier:false,annotationStatus:'unverified',
  words:words.map(w=>({originalText:w.originalText,correctedText:w.text,textChangeKind:w.text===w.originalText?'unchanged':'unspecified',confidence:w.confidence,box:w.box,flatness:w.flatness,replacementBlock:w.replacementBlock??null,reviewReason:w.reviewReason??null,cropReview:cropReviewForWord(w),maskReview:reviewedMask(w)?JSON.parse(JSON.stringify(w.maskReview)):null,replace:replacements([w]).length===1}))};}
