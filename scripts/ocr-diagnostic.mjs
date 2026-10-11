// Small, authored mechanism diagnostic. Supplied labels/boxes are NOT OCR results.
// No downloads, model inference, training or user files.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareWords,maskWords,appendOcrText,reviewEraseMask,OCR_THRESHOLD} from '../src/ocr-core.js';
import {proposeProtectedRuns} from '../src/ocr-mask.js';

function fixture(id){
  const width=160,height=96,data=new Uint8ClampedArray(width*height*4).fill(255);
  if(id==='transparent')data.fill(0);
  const box={x:40,y:30,width:80,height:32},glyphs=new Set(),artwork=new Set();
  const dot=(x,y,color,set)=>{const p=y*width+x;data.set([...color,255],p*4);set?.add(p);};
  // Original block-letter glyphs M, O, D, E, L. Font-independent small raster.
  const letters=['10001/11011/10101/10001/10001/10001/10001',
    '01110/10001/10001/10001/10001/10001/01110',
    '11110/10001/10001/10001/10001/10001/11110',
    '11111/10000/10000/11110/10000/10000/11111',
    '10000/10000/10000/10000/10000/10000/11111'];
  letters.forEach((letter,l)=>letter.split('/').forEach((row,y)=>[...row].forEach((v,x)=>{
    if(v==='1')for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)dot(48+l*13+x*2+dx,38+y*2+dy,[20,20,20],glyphs);
  })));
  if(id==='horizontal-crossing')for(let x=0;x<width;x++)dot(x,33,[20,20,20],artwork);
  if(id==='vertical-crossing')for(let y=0;y<height;y++)dot(43,y,[20,20,20],artwork);
  if(id==='internal-rule')for(let x=46;x<114;x++)dot(x,56,[20,20,20],artwork);
  if(id==='diagonal-crossing')for(let x=25;x<135;x++)dot(x,Math.round(30+(x-40)*.35),[20,20,20],artwork);
  if(id==='mixed-background')for(let y=25;y<68;y++)for(let x=36;x<124;x++)if(!glyphs.has(y*width+x))dot(x,y,(x+y)%2?[120,180,220]:[230,180,120],artwork);
  // Do not score shared glyph/line pixels as recoverable text-only ink.
  for(const p of artwork)glyphs.delete(p);
  const label={id:'label',originalText:id==='confident-wrong-label'?'MODEM':'MODEL',
    text:id==='confident-wrong-label'?'MODEM':'MODEL',confidence:id==='low-confidence'?40:95,box};
  return {image:{width,height,data},label,glyphs,artwork,expectedText:'MODEL'};
}
function measure(input,words){
  const masked=maskWords(input.image,words),{width,height,data}=input.image;
  const changed=p=>[0,1,2,3].some(c=>masked.data[p*4+c]!==data[p*4+c]);
  const changedCount=set=>[...set].filter(changed).length;
  let outsideBoxChangedPixels=0;const b=input.label.box;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(x<b.x||x>=b.x+b.width||y<b.y||y>=b.y+b.height)outsideBoxChangedPixels+=Number(changed(y*width+x));
  const scene=appendOcrText({width,height,nodes:[]},words,width,height),text=scene.nodes.find(n=>n.type==='text');
  const glyphRemoval=changedCount(input.glyphs)/Math.max(1,input.glyphs.size),artworkChangedPixels=changedCount(input.artwork);
  return {replaced:!!text,nativeLabelCorrect:text?text.text===input.expectedText:null,
    glyphRemoval,artworkChangedPixels,outsideBoxChangedPixels,
    // Mechanism check only: placement/font recovery and downstream relations are not scored.
    completeLabelRecovery:!!text&&text.text===input.expectedText&&glyphRemoval===1&&artworkChangedPixels===0};
}
function referenceRuns(input){
  const b=input.label.box,runs=[];
  // Known authored provenance: keep everything except recoverable text-only pixels.
  // Shared glyph/artwork pixels stay intact; this information is unavailable to the app.
  for(let y=0;y<b.height;y++)for(let x=0;x<b.width;x++)if(!input.glyphs.has((y+b.y)*input.image.width+x+b.x)){
    const x0=x;while(x+1<b.width&&!input.glyphs.has((y+b.y)*input.image.width+x+1+b.x))x++;
    runs.push({y,x0,x1:x});
  }
  return runs;
}
export function runMaskDiagnostic(){
  const ids=['clean','transparent','low-confidence','confident-wrong-label','horizontal-crossing','vertical-crossing','internal-rule','diagonal-crossing','mixed-background'];
  return {version:2,stage:'masking-with-supplied-labels',ocrInferenceRun:false,generalAccuracyClaim:false,componentCandidateApproval:'simulated-not-user-study',referenceControl:'supplied-pixel-ownership-flat-background-only',
    scope:'Nine developer-designed counterexamples, not independent samples or a held-out benchmark.',
    cases:ids.map(id=>{
      const input=fixture(id),words=prepareWords([input.label],input.image);
      // Reconstruct the prior flat-perimeter decision; same pixels/labels/threshold/export.
      const legacy=words.map(w=>({...w,replacementBlock:null,selected:w.confidence>=OCR_THRESHOLD&&w.safeBackground}));
      // Simulated approval, NOT an automatic product result or an upper bound.
      const candidate=words.map(w=>w.safeBackground&&w.confidence>=OCR_THRESHOLD?reviewEraseMask(w,[],proposeProtectedRuns(input.image,w).runs):w);
      const reference=words.map(w=>w.safeBackground&&w.confidence>=OCR_THRESHOLD?reviewEraseMask(w,[],referenceRuns(input)):w);
      return {id,flatness:words[0].flatness,replacementBlock:words[0].replacementBlock,
        legacy:measure(input,legacy),guarded:measure(input,words),componentCandidate:measure(input,candidate),referenceOwnership:measure(input,reference)};
    })};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const report=runMaskDiagnostic();
  if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));
  else{
    console.log(report.scope+' Supplied labels isolate masking; this does not test OCR.');
    console.table(report.cases.map(c=>({case:c.id,'legacy replace':c.legacy.replaced,'guard replace':c.guarded.replaced,
      'legacy artwork pixels changed':c.legacy.artworkChangedPixels,'guard artwork pixels changed':c.guarded.artworkChangedPixels,
      'candidate artwork changed':c.componentCandidate.artworkChangedPixels,'candidate glyph removal':c.componentCandidate.glyphRemoval,
      'candidate complete label':c.componentCandidate.completeLabelRecovery,'reference complete label':c.referenceOwnership.completeLabelRecovery,
      'guard native label correct':c.guarded.nativeLabelCorrect,reason:c.replacementBlock??'review'})));
    console.log('Component candidate assumes supplied labels and simulated mask approval. Reference control uses unavailable authored pixel ownership on flat backgrounds. Joined glyphs and confident wrong labels remain failures; this is not a user study or end-to-end accuracy.');
  }
}
