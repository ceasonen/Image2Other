// PaddleOCR 3.x save_to_json output. Import only unchanged image coordinates.
export function paddleWords(input,width,height,{width:sourceWidth,height:sourceHeight,confirmed=false}={}){
  if(!confirmed)throw Error('Confirm that this result belongs to the same, unmodified source image.');
  if(![width,height,sourceWidth,sourceHeight].every(n=>Number.isInteger(n)&&n>0&&n<=16000)||width*height>4e6)throw Error('Invalid PaddleOCR image dimensions.');
  const result=input?.res??input,settings=result?.model_settings;
  if(settings?.use_doc_preprocessor!==false||settings?.use_textline_orientation!==false||result.page_index!==null)throw Error('Use single-image results with document preprocessing and text-line orientation disabled.');
  const texts=result.rec_texts,scores=result.rec_scores,polys=result.rec_polys;
  if(!Array.isArray(texts)||texts.length>500||!Array.isArray(scores)||!Array.isArray(polys)||texts.length!==scores.length||texts.length!==polys.length)throw Error('PaddleOCR needs matching rec_texts, rec_scores and rec_polys arrays (up to 500 labels).');
  const words=[];
  for(let i=0;i<texts.length;i++){
    const text=texts[i],confidence=scores[i],p=polys[i];
    if(typeof text!=='string'||text.length>500||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)||!Number.isFinite(confidence)||confidence<0||confidence>1)throw Error('Invalid PaddleOCR text or score.');
    if(!Array.isArray(p)||p.length!==4||p.some(v=>!Array.isArray(v)||v.length!==2||!v.every(Number.isFinite)||v[0]<0||v[0]>sourceWidth||v[1]<0||v[1]>sourceHeight))throw Error('PaddleOCR polygon is outside the source image.');
    const horizontalSpan=Math.max(...p.map(v=>v[0]))-Math.min(...p.map(v=>v[0]));
    const verticalSpan=Math.max(...p.map(v=>v[1]))-Math.min(...p.map(v=>v[1]));
    const yTolerance=Math.max(2,horizontalSpan*.035),xTolerance=Math.max(2,verticalSpan*.1);
    if(Math.abs(p[0][1]-p[1][1])>yTolerance||Math.abs(p[1][0]-p[2][0])>xTolerance||Math.abs(p[2][1]-p[3][1])>yTolerance||Math.abs(p[3][0]-p[0][0])>xTolerance)throw Error('Rotated text needs polygon-aware masking; this import supports near-horizontal labels only.');
    const x=Math.floor(Math.min(...p.map(v=>v[0]))*width/sourceWidth),y=Math.floor(Math.min(...p.map(v=>v[1]))*height/sourceHeight);
    const right=Math.ceil(Math.max(...p.map(v=>v[0]))*width/sourceWidth),bottom=Math.ceil(Math.max(...p.map(v=>v[1]))*height/sourceHeight);
    if(right<=x||bottom<=y)throw Error('Empty PaddleOCR polygon.');
    if(!text.trim())continue;
    words.push({id:`word-${words.length}`,originalText:text.trim(),text:text.trim(),confidence:confidence*100,box:{x,y,width:right-x,height:bottom-y},selected:false,recognitionSource:'paddleocr-import'});
  }
  return words;
}
