import ImageTracer from 'imagetracerjs';
import {traceToScene} from './scene.js';
self.onmessage=event=>{
  try {
    const {image,colors,detail}=event.data;
    const data=ImageTracer.imagedataToTracedata(image,{numberofcolors:colors,colorsampling:2,colorquantcycles:3,
      ltres:detail,qtres:detail,pathomit:8,roundcoords:2,linefilter:true});
    self.postMessage({scene:traceToScene(data)});
  } catch(error) { self.postMessage({error:error.message}); }
};
