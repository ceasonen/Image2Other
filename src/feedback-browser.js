import {sceneToSvg} from './scene.js';

const canvas=(width,height)=>{const result=document.createElement('canvas');result.width=width;result.height=height;return result;};
export function comparisonSize(scene){
  const factor=Math.min(1,1024/Math.max(scene.width,scene.height),Math.sqrt(1_048_576/(scene.width*scene.height)));
  return {width:Math.max(1,Math.floor(scene.width*factor)),height:Math.max(1,Math.floor(scene.height*factor))};
}
function whiteContext(target){const ctx=target.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#ffffff';ctx.fillRect(0,0,target.width,target.height);return ctx;}
export function referenceCanvas(image,size){
  const result=canvas(size.width,size.height);whiteContext(result).drawImage(image,0,0,size.width,size.height);return result;
}
export async function renderVectorCanvas(scene,size){
  const svg=sceneToSvg(scene),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
  try{
    const image=new Image();image.src=url;await image.decode();
    const result=canvas(size.width,size.height);whiteContext(result).drawImage(image,0,0,size.width,size.height);return result;
  }finally{URL.revokeObjectURL(url);}
}
export function canvasPixels(source){return source.getContext('2d',{willReadFrequently:true}).getImageData(0,0,source.width,source.height);}
export function differenceCanvas(measurement,size){
  const result=canvas(size.width,size.height);
  result.getContext('2d').putImageData(new ImageData(measurement.heatmap,size.width,size.height),0,0);
  return result;
}
const png=source=>new Promise((resolve,reject)=>source.toBlob(blob=>blob?resolve(blob):reject(Error('PNG encoding failed.')),'image/png'));
export async function feedbackArchive({reference,rendered,difference,initialScene,finalScene,manifest}){
  const {default:JSZip}=await import('jszip');
  const zip=new JSZip();
  zip.file('reference.png',await png(reference));zip.file('rendered.png',await png(rendered));zip.file('difference.png',await png(difference));
  zip.file('initial.scene.json',JSON.stringify(initialScene,null,2));zip.file('final.scene.json',JSON.stringify(finalScene,null,2));
  zip.file('feedback.json',JSON.stringify(manifest,null,2));
  const output=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3}});
  if(output.size>12*1024*1024)throw Error('Feedback archive exceeds 12 MB. Use a smaller source figure.');
  return output;
}
