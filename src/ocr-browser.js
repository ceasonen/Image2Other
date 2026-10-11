import {ocrWords,prepareWords} from './ocr-core.js';
export async function recognizeOcr(canvas,{language='eng',layout='11',allowDownload=false,onProgress=()=>{},signal,artwork=canvas}={}){
  if(!allowDownload)throw Error('Please allow the small OCR engine/language download first. Your image is not uploaded.');
  if(!['eng','eng+chi_sim'].includes(language)||!['11','3','6'].includes(layout))throw Error('Unsupported OCR language or layout.');
  signal?.throwIfAborted();
  const {default:Tesseract}=await import('./vendor/tesseract/tesseract.esm.min.js');
  signal?.throwIfAborted();
  let worker,settled=false;
  return new Promise((resolve,reject)=>{
    const fail=error=>{if(settled)return;settled=true;signal?.removeEventListener('abort',abort);void worker?.terminate();reject(error instanceof Error?error:Error(String(error)));};
    const abort=()=>fail(new DOMException('OCR cancelled.','AbortError'));
    signal?.addEventListener('abort',abort,{once:true});
    (async()=>{
      try{
        // API/worker/language files are self-hosted; only the small pinned core uses a CDN.
        const base=new URL(import.meta.env.BASE_URL,location.origin);
        worker=await Tesseract.createWorker(language==='eng+chi_sim'?'chi_sim+eng':language,1,{workerPath:new URL('ocr/worker.min.js',base).href,
          langPath:new URL('ocr/languages',base).href,
          corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0',
          cacheMethod:'none',
          logger:m=>{if(!settled)onProgress(`${m.status}${Number.isFinite(m.progress)?` · ${Math.round(m.progress*100)}%`:''}`);},
          errorHandler:e=>fail(Error(`OCR engine could not load or run: ${e}. Check access to jsDelivr, or try again.`))});
        if(settled||signal?.aborted)return;
        await worker.setParameters({tessedit_pageseg_mode:layout,preserve_interword_spaces:'1'});
        const {data}=await worker.recognize(canvas,{}, {text:true,blocks:true});
        if(settled)return;
        const pixels=artwork.getContext('2d',{willReadFrequently:true}).getImageData(0,0,artwork.width,artwork.height);
        const words=prepareWords(ocrWords(data,canvas.width,canvas.height),pixels);
        settled=true;signal?.removeEventListener('abort',abort);resolve(words);
      }catch(error){fail(error);}finally{void worker?.terminate();}
    })();
  });
}
