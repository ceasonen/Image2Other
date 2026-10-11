// Reviewable local brush geometry, not a learned text/graphics segmentation model.
export const MAX_MASK_PIXELS=262144;
export function validateMaskStrokes(box,strokes){
  const {width,height}=box??{};
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>MAX_MASK_PIXELS)throw Error('Mask crop is too large. Use a smaller label region.');
  if(!Array.isArray(strokes)||strokes.length>64)throw Error('Keep masks to 64 strokes or fewer.');
  let points=0;
  return strokes.map(s=>{
    if(!['keep','erase'].includes(s?.mode)||!Number.isFinite(s.radius)||s.radius<.5||s.radius>32||!Array.isArray(s.points)||!s.points.length)throw Error('Invalid mask brush.');
    points+=s.points.length;if(points>2048)throw Error('Mask is too detailed. Undo or reset some strokes.');
    return {mode:s.mode,radius:s.radius,points:s.points.map(p=>{
      if(!p||![p.x,p.y].every(Number.isFinite)||p.x<0||p.y<0||p.x>width-1||p.y>height-1)throw Error('Mask point is outside the label.');
      return {x:p.x,y:p.y};
    })};
  });
}
export function validateProtectedRuns(box,runs=[]){
  validateMaskStrokes(box,[]);
  if(!Array.isArray(runs)||runs.length>8192)throw Error('Protection proposal is too detailed. Review manually.');
  return runs.map(r=>{
    if(!r||![r.y,r.x0,r.x1].every(Number.isInteger)||r.y<0||r.y>=box.height||r.x0<0||r.x1<r.x0||r.x1>=box.width)throw Error('Invalid protected pixel run.');
    return {y:r.y,x0:r.x0,x1:r.x1};
  });
}
export function createEraseMask(box,strokes,protectedRuns=[]){
  const validated=validateMaskStrokes(box,strokes),{width,height}=box,mask=new Uint8Array(width*height).fill(1);
  for(const r of validateProtectedRuns(box,protectedRuns))mask.fill(0,r.y*width+r.x0,r.y*width+r.x1+1);
  let work=0;
  for(const stroke of validated)for(let n=0;n<Math.max(1,stroke.points.length-1);n++){
    const a=stroke.points[n],b=stroke.points[n+1]??a,r=stroke.radius;
    const left=Math.max(0,Math.floor(Math.min(a.x,b.x)-r)),right=Math.min(width-1,Math.ceil(Math.max(a.x,b.x)+r));
    const top=Math.max(0,Math.floor(Math.min(a.y,b.y)-r)),bottom=Math.min(height-1,Math.ceil(Math.max(a.y,b.y)+r));
    work+=(right-left+1)*(bottom-top+1);if(work>16e6)throw Error('Mask is too complex. Undo or use fewer strokes.');
    const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
    for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
      const t=length?Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/length)):0;
      if((x-a.x-t*dx)**2+(y-a.y-t*dy)**2<=r*r)mask[y*width+x]=stroke.mode==='keep'?0:1;
    }
  }
  return mask;
}
export function proposeProtectedRuns(image,word){
  validateMaskStrokes(word.box,[]);const b=word.box;
  if(!Number.isInteger(image.width)||!Number.isInteger(image.height)||!image.data||image.data.length!==image.width*image.height*4||b.x<0||b.y<0||b.x+b.width>image.width||b.y+b.height>image.height)throw Error('Invalid source crop.');
  const left=Math.max(0,b.x-3),top=Math.max(0,b.y-3),right=Math.min(image.width,b.x+b.width+3),bottom=Math.min(image.height,b.y+b.height+3);
  const width=right-left,height=bottom-top,foreground=new Uint8Array(width*height),seen=new Uint8Array(width*height),protectedPixels=new Uint8Array(b.width*b.height);
  const bg=word.background.match(/[a-f\d]{2}/gi).map(v=>parseInt(v,16));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=((y+top)*image.width+x+left)*4,a=image.data[i+3]/255;
    foreground[y*width+x]=Number(bg.some((v,c)=>Math.abs(image.data[i+c]*a+255*(1-a)-v)>48));
  }
  let protectedComponents=0,ambiguousComponents=0;
  for(let start=0;start<foreground.length;start++)if(foreground[start]&&!seen[start]){
    const component=[start];seen[start]=1;let minX=width,maxX=0,minY=height,maxY=0,external=false;
    for(let n=0;n<component.length;n++){
      const p=component[n],x=p%width,y=Math.floor(p/width),sx=x+left,sy=y+top;
      minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      if(sx<b.x||sx>=b.x+b.width||sy<b.y||sy>=b.y+b.height)external=true;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const nx=x+dx,ny=y+dy,q=ny*width+nx;
        if(nx>=0&&ny>=0&&nx<width&&ny<height&&foreground[q]&&!seen[q]){seen[q]=1;component.push(q);}
      }
    }
    const cw=maxX-minX+1,ch=maxY-minY+1;
    const thin=Math.max(cw,ch)>=Math.max(16,b.height*1.5)&&Math.min(cw,ch)<=Math.max(3,b.height*.12);
    if(!external&&!thin)continue;let inside=false;
    for(const p of component){const x=p%width+left-b.x,y=Math.floor(p/width)+top-b.y;if(x>=0&&y>=0&&x<b.width&&y<b.height){protectedPixels[y*b.width+x]=1;inside=true;}}
    if(inside){protectedComponents++;if(external&&Math.min(cw,ch)>3)ambiguousComponents++;}
  }
  const runs=[];
  for(let y=0;y<b.height;y++)for(let x=0;x<b.width;x++)if(protectedPixels[y*b.width+x]){
    const x0=x;while(x+1<b.width&&protectedPixels[y*b.width+x+1])x++;runs.push({y,x0,x1:x});
  }
  return {runs:validateProtectedRuns(b,runs),protectedComponents,ambiguousComponents,method:'connected-components-heuristic',automaticAccuracyClaim:false};
}
export function reviewedMask(word){
  const review=word.maskReview;
  if(review?.version!==1||review.userConfirmed!==true||!['x','y','width','height'].every(k=>review.box?.[k]===word.box?.[k]))return false;
  try{validateMaskStrokes(word.box,review.strokes);validateProtectedRuns(word.box,review.protectedRuns);return true;}catch{return false;}
}
