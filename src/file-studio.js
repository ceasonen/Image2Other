import {escapeXml} from './scene.js';
const tools=[
  ['pptx-text','PDF → editable text slides','Native text boxes + raster artwork'],
  ['pptx-image','PDF → PowerPoint','One full-page image per slide'],
  ['png','PDF → images','PNG, JPEG or WebP pages'],
  ['text','PDF → text','Extract selectable text as TXT'],
  ['merge','Merge PDFs','Combine in queue order'],
  ['extract','Select / reorder pages','Keep, reorder or duplicate pages'],
  ['split','Split PDF','Separate page files in a ZIP'],
  ['rotate','Rotate PDF','Rotate only selected pages'],
  ['images-pdf','Images → PDF','Multiple images, one document'],
  ['images-pptx','Images → PowerPoint','One image per slide'],
  ['figure','PDF page → figure studio','Trace or rebuild a chosen page'],
  ['slides-text','PowerPoint → text','Extract slide text to TXT'],
  ['slides-images','PowerPoint → images','Extract embedded raster images'],
];
export function mountFileStudio(root,onFigure){
  const state={files:[],tool:'pptx-text',busy:false};
  root.innerHTML=`<div class="studio-heading"><div><div class="eyebrow">DOCUMENT WORKSPACE</div><h2>Less format friction.</h2><p>PDFs, presentations and images. Converted here, kept here.</p></div><span class="session-label">Local · no account</span></div>
  <div class="file-tool-grid">${tools.map(([id,title,note])=>`<button class="file-tool ${id===state.tool?'active':''}" data-file-tool="${id}" aria-pressed="${id===state.tool}"><strong>${title}</strong><span>${note}</span></button>`).join('')}</div>
  <div class="file-shell"><div class="file-source"><div class="file-drop" id="files-drop" role="button" tabindex="0"><span class="eyebrow">YOUR FILES</span><h3>Drop files. Pick a tool.</h3><p>PDF, PPTX or browser-supported images<br>50 MB total · up to 25 files</p><button class="small-button" id="files-add">Choose files</button></div><div id="files-list" class="files-list"></div><button class="text-button small" id="files-clear">Clear queue</button></div>
  <div class="file-controls"><h3 id="files-tool-title"></h3><p id="files-note"></p><div class="file-options"><label id="pages-option">Pages<input id="files-pages" placeholder="All · or 3,1,2-4" maxlength="2000"/></label><label id="angle-option" hidden>Rotation<select id="files-angle"><option value="90">90° clockwise</option><option value="180">180°</option><option value="270">270° clockwise</option></select></label><label id="scale-option">Resolution<select id="files-scale"><option value="1">72 DPI</option><option value="1.5" selected>108 DPI</option><option value="2">144 DPI</option></select></label><label id="image-option" hidden>Format<select id="files-format"><option value="png">PNG</option><option value="jpeg">JPEG</option><option value="webp">WebP</option></select></label><label id="paper-option" hidden>Page size<select id="files-paper"><option value="original">Match image</option><option value="a4">A4</option><option value="letter">Letter</option></select></label></div>
  <div id="files-preview" class="files-preview"><span>A page preview appears after conversion.</span></div><button class="primary compact" id="files-run" disabled>Convert & download →</button><p id="files-status" role="status" aria-live="polite">Choose files to begin.</p></div></div>
  <p class="mode-note">PDF → editable text slides uses the PDF text layer; fonts, colors and placement are approximate. Artwork remains raster. For scans, send one PDF page to the figure studio and use Text + vectors OCR. PowerPoint extraction reads .pptx text and embedded raster images, not slide rendering. Office-to-PDF, compression and encrypted-file tools are not offered by this browser-only release.</p><input id="files-input" type="file" accept="application/pdf,image/*,.pptx" multiple hidden/>`;
  const $=s=>root.querySelector(s),safeName=name=>name.replace(/\.[^.]+$/,'').replace(/[^a-z0-9._-]+/gi,'-').slice(0,100)||'document';
  function status(t){$('#files-status').textContent=t;}
  function queue(){
    $('#files-list').innerHTML=state.files.map((f,i)=>`<div class="file-row"><span>${escapeXml(f.name)}<small>${(f.size/1024).toFixed(0)} KB</small></span><div><button data-move="${i}" aria-label="Move ${escapeXml(f.name)} up" ${i===0?'disabled':''}>↑</button><button data-remove="${i}" aria-label="Remove ${escapeXml(f.name)}">×</button></div></div>`).join('');
    $('#files-run').disabled=!state.files.length||state.busy;
    root.querySelectorAll('[data-file-tool],#files-add,#files-clear,#files-pages,#files-angle,#files-scale,#files-format,#files-paper').forEach(e=>e.disabled=state.busy);
  }
  function add(files){if(state.busy)return;const next=[...state.files,...files];if(next.length>25||next.reduce((n,f)=>n+f.size,0)>50*1024*1024){status('Limit: 25 files and 50 MB total.');return;}state.files=next;queue();status(`${next.length} file${next.length===1?'':'s'} ready.`);}
  function choose(tool){if(state.busy)return;state.tool=tool;const record=tools.find(t=>t[0]===tool);$('#files-tool-title').textContent=record[1];$('#files-note').textContent=record[2];root.querySelectorAll('[data-file-tool]').forEach(b=>{b.classList.toggle('active',b.dataset.fileTool===tool);b.setAttribute('aria-pressed',b.dataset.fileTool===tool);});
    $('#pages-option').hidden=['merge','images-pdf','images-pptx','slides-text','slides-images'].includes(tool);$('#angle-option').hidden=tool!=='rotate';$('#scale-option').hidden=!['png','pptx-text','pptx-image','figure'].includes(tool);$('#image-option').hidden=tool!=='png';$('#paper-option').hidden=tool!=='images-pdf';$('#files-run').textContent=tool==='figure'?'Open in figure studio →':'Convert & download →';status(state.files.length?'Files ready.':'Choose files to begin.');}
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  async function zipped(files){const {default:JSZip}=await import('jszip'),zip=new JSZip();for(const f of files)zip.file(f.name,f.bytes);return zip.generateAsync({type:'blob'});}
  async function imagePage(file){const image=new Image(),url=URL.createObjectURL(file);try{image.src=url;await image.decode();if(image.naturalWidth*image.naturalHeight>24e6)throw Error('Image exceeds 24 megapixels.');const canvas=document.createElement('canvas');const scale=Math.min(1,4096/Math.max(image.naturalWidth,image.naturalHeight));canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);return{canvas,width:canvas.width,height:canvas.height,image:canvas.toDataURL('image/png'),text:[]};}finally{URL.revokeObjectURL(url);}}
  function preview(canvas){const target=$('#files-preview');target.replaceChildren(canvas);}
  async function run(){
    if(state.busy||!state.files.length)return;state.busy=true;queue();status('Converting locally…');let doc;
    try{
      const core=await import('./pdf-core.js'),tool=state.tool,selection=$('#files-pages').value;
      const imageTool=tool.startsWith('images-'),slidesTool=tool.startsWith('slides-');
      if(!imageTool&&!slidesTool&&state.files.some(f=>f.type!=='application/pdf'&&!/\.pdf$/i.test(f.name)))throw Error('Choose PDFs for this tool, or use an image / PowerPoint input tool.');
      if(!['merge','images-pdf','images-pptx'].includes(tool)&&state.files.length!==1)throw Error('This tool takes one file. Remove extra files or choose a batch tool.');
      const name=safeName(state.files[0].name);let blob,filename;
      if(slidesTool){
        if(!/\.pptx$/i.test(state.files[0].name))throw Error('Choose an unencrypted .pptx file. Legacy .ppt is unsupported.');
        const {pptxText,pptxImages}=await import('./pptx-read.js'),bytes=new Uint8Array(await state.files[0].arrayBuffer());
        if(tool==='slides-text'){blob=new Blob([await pptxText(bytes)],{type:'text/plain;charset=utf-8'});filename=`${name}-slides.txt`;}
        else{blob=await zipped(await pptxImages(bytes));filename=`${name}-media.zip`;}
        $('#files-preview').textContent='Slide text and embedded images only. PowerPoint slide rendering is not included.';
      }else if(imageTool){
        if(state.files.some(f=>/\.svg$/i.test(f.name)||!f.type.startsWith('image/')))throw Error('Choose raster image files for this tool. SVG belongs in the figure studio.');
        const pages=[];let pixels=0;for(const f of state.files){const p=await imagePage(f);pixels+=p.width*p.height;if(pixels>32e6)throw Error('Image batch exceeds 32 megapixels. Convert fewer images at once.');pages.push(p);}preview(pages[0].canvas);
        if(tool==='images-pdf'){const inputs=await Promise.all(pages.map(async p=>({bytes:new Uint8Array(await(await new Promise(r=>p.canvas.toBlob(r,'image/png'))).arrayBuffer()),type:'image/png'})));blob=new Blob([await core.imagesToPdf(inputs,{paper:$('#files-paper').value})],{type:'application/pdf'});filename=`${name}-images.pdf`;}
        else{const {pdfPagesToPptx}=await import('./pdf-pptx.js');blob=await pdfPagesToPptx(pages,'image');filename=`${name}-images.pptx`;}
      }else{
        const bytes=new Uint8Array(await state.files[0].arrayBuffer());
        if(tool==='merge'){blob=new Blob([await core.mergePdfs(await Promise.all(state.files.map(async f=>new Uint8Array(await f.arrayBuffer()))))],{type:'application/pdf'});filename='merged.pdf';}
        else if(tool==='extract'){blob=new Blob([await core.selectPdf(bytes,selection)],{type:'application/pdf'});filename=`${name}-selected.pdf`;}
        else if(tool==='rotate'){blob=new Blob([await core.rotatePdf(bytes,selection,Number($('#files-angle').value))],{type:'application/pdf'});filename=`${name}-rotated.pdf`;}
        else if(tool==='split'){blob=await zipped((await core.splitPdf(bytes,selection)).map((p,i)=>({name:`page-${i+1}.pdf`,bytes:p.bytes})));filename=`${name}-pages.zip`;}
        else{
          const browser=await import('./pdf-browser.js');doc=await browser.openPdf(bytes);
          if(tool==='text'){blob=new Blob([await browser.pdfText(doc,selection)],{type:'text/plain;charset=utf-8'});filename=`${name}.txt`;}
          else{
            const indexes=core.parsePages(selection,doc.numPages);if(indexes.length>40)throw Error('Render at most 40 pages per conversion. Use a page range.');
            if(tool==='figure'&&indexes.length!==1)throw Error('Choose exactly one page, for example 1.');
            const pages=[];let pixels=0;for(const i of indexes){status(`Rendering page ${i+1} (${pages.length+1}/${indexes.length})…`);const p=await browser.renderPdfPage(doc,i+1,{scale:Number($('#files-scale').value),withoutText:tool==='pptx-text'});pixels+=p.width*p.height;if(pixels>32e6)throw Error('Rendering batch exceeds 32 megapixels. Use fewer pages or a lower resolution.');pages.push(p);}preview(pages[0].canvas);
            if(tool==='figure'){const image=await new Promise(r=>pages[0].canvas.toBlob(r,'image/png'));await onFigure(new File([image],`${name}-page-${indexes[0]+1}.png`,{type:'image/png'}));status('Page opened in figure studio.');return;}
            if(tool==='png'){const format=$('#files-format').value,mime='image/'+format,ext=format==='jpeg'?'jpg':format;const files=[];for(let i=0;i<pages.length;i++){const b=await new Promise(r=>pages[i].canvas.toBlob(r,mime,.92));if(!b||b.type!==mime)throw Error('Browser cannot encode this image format. Try PNG.');files.push({name:`page-${i+1}.${ext}`,bytes:b});}blob=await zipped(files);filename=`${name}-${ext}.zip`;}
            else{const {pdfPagesToPptx}=await import('./pdf-pptx.js');blob=await pdfPagesToPptx(pages,tool==='pptx-text'?'text':'image');filename=`${name}-${tool==='pptx-text'?'text':'image'}.pptx`;}
          }
        }
      }
      download(blob,filename);status(`${filename} downloaded. ${tool==='pptx-text'?'Text boxes are editable; artwork is raster. Check against the original.':''}`);
    }catch(e){status(e.message||'Conversion failed. Try a smaller file.');}finally{state.busy=false;queue();if(doc)void doc.destroy().catch(()=>{});}
  }
  root.querySelectorAll('[data-file-tool]').forEach(b=>b.onclick=()=>choose(b.dataset.fileTool));$('#files-run').onclick=run;$('#files-add').onclick=e=>{e.stopPropagation();$('#files-input').click();};$('#files-drop').onclick=()=>$('#files-input').click();$('#files-drop').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#files-input').click();}};
  $('#files-input').onchange=e=>{add([...e.target.files]);e.target.value='';};$('#files-drop').ondragover=e=>e.preventDefault();$('#files-drop').ondrop=e=>{e.preventDefault();add([...e.dataTransfer.files]);};$('#files-clear').onclick=()=>{if(!state.busy){state.files=[];queue();status('Queue cleared.');}};
  $('#files-list').onclick=e=>{if(state.busy)return;const remove=e.target.closest('[data-remove]'),move=e.target.closest('[data-move]');if(remove)state.files.splice(Number(remove.dataset.remove),1);if(move){const i=Number(move.dataset.move);if(i>0)[state.files[i-1],state.files[i]]=[state.files[i],state.files[i-1]];}queue();};choose(state.tool);
}
