import {createEraseMask,proposeProtectedRuns} from './ocr-mask.js';

export function mountMaskEditor({onSave,onDrop}){
  const dialog=document.createElement('dialog');dialog.id='mask-dialog';dialog.className='mask-dialog';
  dialog.innerHTML=`<div class="dialog-title"><div><span class="eyebrow">LOCAL MASK REVIEW</span><h2>Keep the lines. Replace the words.</h2></div><button class="small-button" id="mask-close" aria-label="Close mask review">Close</button></div>
    <p id="mask-label"></p><p class="mask-help">Paint over artwork you want to protect. Pink ink is cleared; green areas are kept. This is manual control, not automatic segmentation. Old glyphs inside protected areas may remain.</p>
    <div class="mask-tools"><button class="small-button" id="mask-propose">Suggest protection</button><label>Brush<select id="mask-brush-mode"><option value="keep">Protect artwork</option><option value="erase">Clear protection</option></select></label><label>Radius <input id="mask-radius" type="range" min=".5" max="16" step=".5" value="2"/><output id="mask-radius-value">2 px</output></label><button class="small-button" id="mask-undo">Undo stroke</button><button class="small-button" id="mask-reset">Reset draft</button></div>
    <div class="mask-panels"><section><h3>Source + erase map</h3><canvas id="mask-paint" role="img" aria-label="Draw protected artwork on the label crop"></canvas></section><section><h3>Artwork after removal</h3><canvas id="mask-preview" role="img" aria-label="Preview of artwork before native text is added"></canvas><p>New editable text is added when you build.</p></section></div>
    <p id="mask-status" role="status" aria-live="polite"></p><div class="dialog-actions"><button class="small-button" id="mask-drop">Remove saved mask</button><button class="primary compact" id="mask-save">Confirm mask & replace</button></div>`;
  document.body.append(dialog);const q=selector=>dialog.querySelector(selector);
  let word=null,source=null,strokes=[],active=null,protectedRuns=[],artwork=null;
  const copy=value=>JSON.parse(JSON.stringify(value));
  function render(){
    const mask=createEraseMask(word.box,strokes,protectedRuns),w=source.width,h=source.height;
    const preview=new ImageData(new Uint8ClampedArray(source.data),w,h),overlay=new ImageData(new Uint8ClampedArray(source.data),w,h);
    const bg=word.background.match(/[a-f\d]{2}/gi).map(v=>parseInt(v,16));let kept=0;
    for(let y=0;y<word.box.height;y++)for(let x=0;x<word.box.width;x++){
      const p=y*word.box.width+x,i=((y+4)*w+x+4)*4,alpha=source.data[i+3]/255;
      if(mask[p]){
        preview.data.set([...bg,word.backgroundAlpha??255],i);
        if(bg.some((v,c)=>Math.abs(source.data[i+c]*alpha+255*(1-alpha)-v)>32))overlay.data.set([230,108,138,255],i);
      }else{kept++;for(let c=0;c<3;c++)overlay.data[i+c]=Math.round(source.data[i+c]*alpha*.5+[72,172,132][c]*.5);overlay.data[i+3]=255;}
    }
    q('#mask-paint').getContext('2d').putImageData(overlay,0,0);q('#mask-preview').getContext('2d').putImageData(preview,0,0);
    q('#mask-status').textContent=`${strokes.length} strokes · ${kept} crop pixels protected. Inspect the remaining artwork before confirming.`;
    q('#mask-undo').disabled=!strokes.length;q('#mask-reset').disabled=!strokes.length&&!protectedRuns.length;
  }
  function point(event){
    const canvas=q('#mask-paint'),r=canvas.getBoundingClientRect();
    return {x:Math.max(0,Math.min(word.box.width-1,(event.clientX-r.left)*canvas.width/r.width-4)),y:Math.max(0,Math.min(word.box.height-1,(event.clientY-r.top)*canvas.height/r.height-4))};
  }
  q('#mask-paint').onpointerdown=e=>{
    if(e.button!==0||strokes.length>=64||active)return;
    active={mode:q('#mask-brush-mode').value,radius:Number(q('#mask-radius').value),points:[point(e)],pointer:e.pointerId};
    q('#mask-paint').setPointerCapture(e.pointerId);strokes.push(active);
    try{render();}catch(error){strokes.pop();active=null;q('#mask-status').textContent=error.message;}
  };
  q('#mask-paint').onpointermove=e=>{
    if(!active||active.pointer!==e.pointerId)return;const p=point(e),last=active.points.at(-1);
    if(Math.hypot(p.x-last.x,p.y-last.y)<.75||active.points.length>=256)return;
    active.points.push(p);try{render();}catch(error){active.points.pop();q('#mask-status').textContent=error.message;}
  };
  q('#mask-paint').onpointerup=q('#mask-paint').onpointercancel=e=>{if(active?.pointer===e.pointerId)active=null;};
  q('#mask-radius').oninput=()=>{q('#mask-radius-value').textContent=q('#mask-radius').value+' px';};
  q('#mask-undo').onclick=()=>{active=null;strokes.pop();render();};
  q('#mask-reset').onclick=()=>{active=null;strokes=[];protectedRuns=[];render();};
  q('#mask-propose').onclick=()=>{
    try{const p=proposeProtectedRuns(artwork,word);protectedRuns=p.runs;render();q('#mask-status').textContent+=` Component proposal: ${p.protectedComponents} protected; ${p.ambiguousComponents} may include joined glyphs. This can preserve old text too—inspect and adjust.`;q('#mask-reset').disabled=false;}
    catch(error){q('#mask-status').textContent=error.message;}
  };
  q('#mask-close').onclick=()=>dialog.close();dialog.onclose=()=>{active=null;word=null;source=null;artwork=null;strokes=[];protectedRuns=[];};
  q('#mask-save').onclick=()=>{
    try{createEraseMask(word.box,strokes,protectedRuns);onSave(word,copy(strokes.map(({mode,radius,points})=>({mode,radius,points}))),copy(protectedRuns));dialog.close();}
    catch(error){q('#mask-status').textContent=error.message;}
  };
  q('#mask-drop').onclick=()=>{try{onDrop(word);dialog.close();}catch(error){q('#mask-status').textContent=error.message;}};
  return {open(current,canvas){
    word=current;strokes=copy(word.maskReview?.strokes??[]);protectedRuns=copy(word.maskReview?.protectedRuns??[]);active=null;
    artwork=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height);
    const crop=document.createElement('canvas');crop.width=word.box.width+8;crop.height=word.box.height+8;
    const ctx=crop.getContext('2d',{willReadFrequently:true});ctx.drawImage(canvas,word.box.x-4,word.box.y-4,crop.width,crop.height,0,0,crop.width,crop.height);
    source=ctx.getImageData(0,0,crop.width,crop.height);
    for(const id of ['mask-paint','mask-preview']){q('#'+id).width=crop.width;q('#'+id).height=crop.height;}
    q('#mask-label').textContent=`Label: ${word.text}`;q('#mask-drop').disabled=!word.maskReview;render();dialog.showModal();
  }};
}
