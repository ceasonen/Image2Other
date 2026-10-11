import PptxGenJS from 'pptxgenjs';

// PDF text reconstruction is deliberately separate from the strict-vector scene exporter.
export async function pdfPagesToPptx(pages,mode='image',outputType='blob'){
  if(!pages.length||pages.length>40)throw new Error('Choose 1–40 pages for PowerPoint export.');
  if(!['image','text'].includes(mode))throw new Error('Unknown PowerPoint reconstruction mode.');
  if(mode==='text'&&pages.some(p=>!p.text?.length))throw new Error('A selected page has no text layer. Use page images, or rebuild that page in the figure studio.');
  const pptx=new PptxGenJS(),scale=10/Math.max(pages[0].width,pages[0].height);
  const width=pages[0].width*scale,height=pages[0].height*scale;
  pptx.defineLayout({name:'PDF_PAGE',width,height});pptx.layout='PDF_PAGE';
  pptx.author='Image2Other';pptx.title='PDF page conversion';
  pptx.subject=mode==='text'?'Editable text with raster artwork':'PDF pages as slide images';
  for(const page of pages){
    if(!Number.isFinite(page.width)||!Number.isFinite(page.height)||page.width<=0||page.height<=0)throw new Error('Invalid PDF page dimensions.');
    const slide=pptx.addSlide(),fit=Math.min(width/page.width,height/page.height),dx=(width-page.width*fit)/2,dy=(height-page.height*fit)/2;
    slide.background={color:'FFFFFF'};
    slide.addImage({data:page.image,x:dx,y:dy,w:page.width*fit,h:page.height*fit,altText:mode==='text'?'Raster artwork, with PDF text removed':'Full PDF page image'});
    if(mode==='text')for(const item of page.text){
      if(!item.text?.trim())continue;
      slide.addText(item.text,{x:dx+item.x*fit,y:dy+item.y*fit,w:Math.max(item.width*fit,.02),h:Math.max(item.height*fit,.02),
        fontFace:'Arial',fontSize:item.fontSize*fit*72,color:'202436',rotate:item.rotate??0,margin:0,breakLine:false,valign:'top',
        shapeName:'PDF text',fit:'resize'});
    }
    slide.addNotes(mode==='text'?'Text boxes are editable. Artwork remains a raster image. Font, color, and text placement are approximate. Check this slide against the source PDF.':'This slide preserves the page as an image. Its individual words and shapes are not editable. Use the figure studio for vector or AI reconstruction.');
  }
  return pptx.write({outputType});
}
