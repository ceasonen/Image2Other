import {moveSelection,selectionBounds} from './geometry-edit.js';
import {validateScene} from './scene.js';

const MAX_PIXELS=1_048_576;
function pixels(image){
  const {width,height,data}=image??{};
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>MAX_PIXELS||data?.length!==width*height*4)throw Error('Comparison needs a bounded RGBA image.');
  return {width,height,data};
}
export function pixelMetrics(reference,candidate){
  const a=pixels(reference),b=pixels(candidate);
  if(a.width!==b.width||a.height!==b.height)throw Error('Comparison images need the same dimensions.');
  let error=0,changed=0;
  const heatmap=new Uint8ClampedArray(a.data.length);
  for(let i=0;i<a.data.length;i+=4){
    const difference=(Math.abs(a.data[i]-b.data[i])+Math.abs(a.data[i+1]-b.data[i+1])+Math.abs(a.data[i+2]-b.data[i+2]))/3;
    error+=difference;
    if(difference>24){changed++;heatmap.set([225,72,80,Math.min(220,Math.max(70,Math.round(difference*1.3)))],i);}
  }
  return {mae:error/(a.width*a.height),changedFraction:changed/(a.width*a.height),heatmap};
}

export async function refineSelection({scene,selectedIds,reference,render,steps=[4,2,1],signal}){
  validateScene(scene);pixels(reference);
  if(typeof render!=='function')throw Error('A scene renderer is required.');
  const ids=Array.isArray(selectedIds)?selectedIds:[];
  selectionBounds(scene,ids);
  if(scene.connections?.some(connection=>ids.includes(connection.lineId)))throw Error('Refine an attached line through its attached artwork.');
  if(steps.length<1||steps.length>4||steps.some(step=>!Number.isInteger(step)||step<1||step>16))throw Error('Use at most four bounded pixel steps.');
  const check=()=>{if(signal?.aborted)throw new DOMException('Feedback stopped.','AbortError');};
  check();
  let current=scene,initial=pixelMetrics(reference,await render(scene)),best=initial;
  const trials=[],accepted=[];
  for(const step of steps){
    const offsets=[[-step,0],[step,0],[0,-step],[0,step]];
    let winner=null;
    for(const [dx,dy] of offsets){
      check();
      let candidate;
      try{const bounds=selectionBounds(current,ids);candidate=moveSelection(current,ids,{x:bounds.x+dx,y:bounds.y+dy});}
      catch(error){trials.push({step,dx,dy,skipped:error.message});continue;}
      const measurement=pixelMetrics(reference,await render(candidate));check();
      const trial={step,dx,dy,mae:measurement.mae,changedFraction:measurement.changedFraction,accepted:false};
      trials.push(trial);
      if(measurement.mae+1e-8<best.mae&&(!winner||measurement.mae+1e-8<winner.measurement.mae))winner={candidate,measurement,trial};
    }
    if(winner){winner.trial.accepted=true;current=winner.candidate;best=winner.measurement;accepted.push({step,dx:winner.trial.dx,dy:winner.trial.dy,mae:best.mae});}
  }
  return {scene:current,initial,final:best,trials,accepted};
}

export function feedbackManifest({scene,sourceName,originalWidth,originalHeight,comparisonWidth,comparisonHeight,history=[],trials=[]}){
  const valid=validateScene(scene);
  if(!Number.isInteger(originalWidth)||!Number.isInteger(originalHeight)||originalWidth<1||originalHeight<1)throw Error('Original source dimensions are required.');
  const compareWidth=comparisonWidth??valid.width,compareHeight=comparisonHeight??valid.height;
  if(!Number.isInteger(compareWidth)||!Number.isInteger(compareHeight)||compareWidth<1||compareHeight<1||compareWidth*compareHeight>MAX_PIXELS)throw Error('Comparison dimensions are invalid.');
  if(!Array.isArray(history)||!Array.isArray(trials)||history.length>20||trials.length>80)throw Error('Feedback log is full. Start a new comparison.');
  return {format:'image2other-feedback-v1',annotationStatus:'unverified',
    source:{name:String(sourceName??'').slice(0,160),originalWidth,originalHeight},
    scene:{width:valid.width,height:valid.height},
    reference:{kind:'uploaded-image-raster',width:compareWidth,height:compareHeight,background:'#ffffff'},
    metric:{name:'RGB mean absolute error',range:[0,255],lowerIsBetter:true,comparison:'same bounded canvas; white compositing'},
    checks:{textCorrect:null,connectionsCorrect:null,editBehaviorCorrect:null,sourceLicense:null},
    history,trials};
}
