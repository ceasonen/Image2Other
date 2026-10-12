// Focused re-reading is extra OCR evidence, not a correctness certificate.
const LAYOUTS=['11','7','13'];
function labelBox(box){
  if(!box||!['x','y','width','height'].every(k=>Number.isInteger(box[k]))||box.x<0||box.y<0||box.width<1||box.height<1||box.width*box.height>262144)throw Error('Invalid or oversized label crop.');
  return {x:box.x,y:box.y,width:box.width,height:box.height};
}
export function cropSpec(box,width,height){
  const b=labelBox(box);
  if(![width,height].every(n=>Number.isInteger(n)&&n>0)||b.x+b.width>width||b.y+b.height>height)throw Error('Label is outside the source image.');
  const x=Math.max(0,b.x-4),y=Math.max(0,b.y-4),right=Math.min(width,b.x+b.width+4),bottom=Math.min(height,b.y+b.height+4);
  const source={x,y,width:right-x,height:bottom-y},a=source.width*source.height,linear=24*(source.width+source.height);
  const areaScale=(-linear+Math.sqrt(linear*linear+4*a*(512000-576)))/(2*a);
  const scale=Math.min(2,1176/source.width,1176/source.height,areaScale);
  const drawWidth=Math.max(1,Math.floor(source.width*scale)),drawHeight=Math.max(1,Math.floor(source.height*scale));
  return {source,padding:12,drawWidth,drawHeight,width:drawWidth+24,height:drawHeight+24};
}
export function cropCandidates(box,observations){
  const sourceBox=labelBox(box),candidates=[];
  if(!Array.isArray(observations)||observations.length>3)throw Error('Keep focused OCR to three observations.');
  const seen=new Set();
  for(const row of observations){
    if(!LAYOUTS.includes(row?.layout)||seen.has(row.layout)||typeof row.text!=='string'||!Number.isFinite(row.confidence))throw Error('Invalid focused OCR observation.');
    seen.add(row.layout);const text=row.text.trim().replace(/\s+/g,' ').replace(/(?<=[\u3400-\u9fff]) +(?=[\u3400-\u9fff])/g,'');
    if(!text||text.length>500||/[\u0000-\u001f\u007f]/.test(text))continue;
    let candidate=candidates.find(c=>c.text===text);
    if(!candidate){candidate={text,observations:[]};candidates.push(candidate);}
    candidate.observations.push({layout:row.layout,confidence:Math.max(0,Math.min(100,row.confidence))});
  }
  return {version:1,sourceBox,candidates,automaticChoice:false,correctnessVerified:false};
}
function checkedReport(report){
  if(report?.version!==1||!Array.isArray(report.candidates)||report.candidates.length>3)throw Error('Invalid crop report.');
  return cropCandidates(report.sourceBox,report.candidates.flatMap(c=>{
    if(!Array.isArray(c.observations)||c.observations.length>3)throw Error('Invalid crop report.');
    return c.observations.map(o=>({...o,text:c.text}));
  }));
}
export function chooseCropCandidate(word,report,index){
  const safe=checkedReport(report);
  if(!['x','y','width','height'].every(k=>word.box?.[k]===safe.sourceBox[k]))throw Error('Source box changed. Read the crop again.');
  if(!Number.isInteger(index)||!safe.candidates[index])throw Error('Choose an available crop result.');
  const choiceText=safe.candidates[index].text;
  return {...word,text:choiceText,selected:false,cropReview:{...safe,choiceIndex:index,choiceText}};
}
export function cropReviewForWord(word){
  if(!word.cropReview)return null;
  try{return chooseCropCandidate(word,word.cropReview,word.cropReview.choiceIndex).cropReview;}catch{return null;}
}
