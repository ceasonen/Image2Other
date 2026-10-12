import {cropSpec} from './ocr-candidates.js';

export function mountCropEditor({onRead,onChoice}){
  const dialog=document.createElement('dialog');dialog.id='crop-dialog';dialog.className='crop-dialog';
  dialog.innerHTML=`<div class="dialog-title"><div><span class="eyebrow">FOCUSED OCR · LOCAL</span><h2>A second look at this label.</h2></div><button class="small-button" id="crop-close">Close</button></div><p id="crop-label"></p><canvas id="crop-source" role="img" aria-label="Source label for focused OCR"></canvas><p class="crop-help">Three layout readings of the same padded crop. Scores are engine confidence, not correctness. Even agreeing readings can be wrong. Choose a text draft only after checking the source; replacement stays unselected.</p><div class="dialog-actions"><button class="small-button" id="crop-stop" disabled>Stop read</button><button class="primary compact" id="crop-read">Read this crop</button></div><p id="crop-status" role="status" aria-live="polite">Nothing is applied automatically.</p><div id="crop-results"></div>`;
  document.body.append(dialog);const q=s=>dialog.querySelector(s),canvas=q('#crop-source');
  let word=null,report=null,controller=null,generation=0;
  const names={'11':'Sparse','7':'Single line','13':'Raw line'};
  function render(){
    q('#crop-results').replaceChildren();
    for(const [index,candidate] of (report?.candidates??[]).entries()){
      const button=document.createElement('button');button.className='crop-choice';button.dataset.cropChoice=index;
      const text=document.createElement('strong');text.textContent=candidate.text;
      const details=document.createElement('span');details.textContent=candidate.observations.map(o=>`${names[o.layout]} · score ${o.confidence.toFixed(0)}`).join(' / ');
      const action=document.createElement('small');action.textContent='Use this text draft →';button.append(text,details,action);
      button.onclick=()=>{try{if(controller)return;onChoice(word,report,index);dialog.close();}catch(error){q('#crop-status').textContent=error.message;}};
      q('#crop-results').append(button);
    }
  }
  q('#crop-read').onclick=async()=>{
    if(controller)return;const current=word,run=generation,request=new AbortController();controller=request;report=null;render();
    q('#crop-read').disabled=true;q('#crop-stop').disabled=false;q('#crop-status').textContent='Reading this crop locally…';
    const timer=setTimeout(()=>request.abort(),90000);
    try{
      const result=await onRead(current,canvas,{signal:request.signal,onProgress:message=>{if(run===generation)q('#crop-status').textContent=message;}});
      if(run!==generation||request.signal.aborted)return;report=result;render();
      q('#crop-status').textContent=result.candidates.length?'Compare with the source. Choosing does not verify correctness.':'No text found. Close and correct the label manually.';
    }catch(error){if(run===generation)q('#crop-status').textContent=error.name==='AbortError'?'Read stopped. Original text is unchanged.':error.message;}
    finally{clearTimeout(timer);if(run===generation){controller=null;q('#crop-read').disabled=false;q('#crop-stop').disabled=true;}}
  };
  q('#crop-stop').onclick=()=>controller?.abort();q('#crop-close').onclick=()=>dialog.close();
  dialog.onclose=()=>{generation++;controller?.abort();controller=null;word=null;report=null;canvas.width=canvas.height=1;q('#crop-results').replaceChildren();};
  return {open(current,source){
    const spec=cropSpec(current.box,source.width,source.height);generation++;word=current;report=null;controller=null;
    canvas.width=spec.width;canvas.height=spec.height;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
    const b=spec.source;ctx.drawImage(source,b.x,b.y,b.width,b.height,spec.padding,spec.padding,spec.drawWidth,spec.drawHeight);
    q('#crop-label').textContent=`Original OCR: ${word.originalText} · Current draft: ${word.text}`;
    q('#crop-status').textContent='Nothing is applied automatically. Formulas and handwriting are not guaranteed.';
    q('#crop-read').disabled=false;q('#crop-stop').disabled=true;render();dialog.showModal();
  }};
}
