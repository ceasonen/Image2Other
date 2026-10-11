import PptxGenJS from 'pptxgenjs';
import {validateScene,pathToPoints} from './scene.js';

export async function exportPptx(input, outputType='blob') {
  const scene=validateScene(input), pptx=new PptxGenJS();
  const scale=10/Math.max(scene.width,scene.height);
  pptx.defineLayout({name:'IMAGE',width:scene.width*scale,height:scene.height*scale}); pptx.layout='IMAGE';
  pptx.author='Image2Other'; pptx.title='Editable image reconstruction'; pptx.subject='Native editable text and vector shapes';
  pptx.lang='en-US'; pptx.theme={headFontFace:'Arial',bodyFontFace:'Arial',lang:'en-US'};
  const slide=pptx.addSlide();
  if(scene.background!=='none') slide.background={color:scene.background.slice(1)};
  for(const node of scene.nodes) {
    const options={shapeName:node.name,fill:node.fill==='none'?{color:'FFFFFF',transparency:100}:{color:node.fill.slice(1),transparency:(1-node.opacity)*100},
      line:node.stroke==='none'?{color:'FFFFFF',transparency:100}:{color:node.stroke.slice(1),width:node.strokeWidth*scale*72,transparency:(1-node.opacity)*100}};
    if(node.type==='text') {
      slide.addText(node.text,{x:node.x*scale,y:node.y*scale,w:node.width*scale,h:node.height*scale,fontFace:'Arial',fontSize:node.fontSize*scale*72,
        color:node.fill==='none'?'111111':node.fill.slice(1),bold:node.bold,align:node.align,margin:0,breakLine:false,valign:'top',shapeName:node.name,...(node.fitWidth?{fit:'resize'}:{})}); continue;
    }
    if(node.type==='path') {
      const points=pathToPoints(node.d,scale);
      const coords=points.flatMap(p=>p.close?[]:[{x:p.x,y:p.y},...(p.curve?[{x:p.curve.x1,y:p.curve.y1},...(p.curve.type==='cubic'?[{x:p.curve.x2,y:p.curve.y2}]:[])]:[])]);
      const x=Math.min(...coords.map(p=>p.x)),y=Math.min(...coords.map(p=>p.y));
      const w=Math.max(...coords.map(p=>p.x))-x,h=Math.max(...coords.map(p=>p.y))-y;
      const local=points.map(p=>p.close?p:{...p,x:p.x-x,y:p.y-y,...(p.curve?{curve:{...p.curve,x1:p.curve.x1-x,y1:p.curve.y1-y,...(p.curve.type==='cubic'?{x2:p.curve.x2-x,y2:p.curve.y2-y}:{})}}:{})});
      slide.addShape(pptx.ShapeType.custGeom,{...options,x,y,w:Math.max(w,.001),h:Math.max(h,.001),points:local}); continue;
    }
    if(node.type==='line') {
      slide.addShape(pptx.ShapeType.line,{...options,x:Math.min(node.x,node.x2)*scale,y:Math.min(node.y,node.y2)*scale,w:Math.abs(node.x2-node.x)*scale,h:Math.abs(node.y2-node.y)*scale,
        flipH:node.x2<node.x,flipV:node.y2<node.y,line:{...options.line,...(node.arrow?{endArrowType:'triangle'}:{})}}); continue;
    }
    slide.addShape(node.type==='ellipse'?pptx.ShapeType.ellipse:node.radius?pptx.ShapeType.roundRect:pptx.ShapeType.rect,
      {...options,x:node.x*scale,y:node.y*scale,w:node.width*scale,h:node.height*scale,...(node.radius?{radius:node.radius*scale}:{})});
  }
  slide.addNotes('Image2Other exports native editable objects. Automatic reconstructions can change geometry or text; check the source image before publication.');
  return pptx.write({outputType});
}
