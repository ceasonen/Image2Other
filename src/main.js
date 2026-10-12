import './style.css';
import {escapeXml,validateScene,sceneToSvg,outputName,FONT_FACES} from './scene.js';
import {selectionBounds,moveSelection,setLineAttachment,removeLayers,nearestPort,ATTACHMENT_PORTS} from './geometry-edit.js';
import {SCENE_PROMPT,rebuildImage,parseSceneResponse} from './ai.js';
import {mountFileStudio} from './file-studio.js';
import {canReplaceWord,reviewEraseMask,maskWords,appendOcrText,reviewData,prepareWords} from './ocr-core.js';
import {paddleWords} from './paddle-import.js';
import {readLocalPaddle} from './paddle-client.js';
import {MAX_MASK_PIXELS} from './ocr-mask.js';
import {mountMaskEditor} from './mask-editor.js';
import {chooseCropCandidate} from './ocr-candidates.js';
import {mountCropEditor} from './crop-editor.js';
import {pixelMetrics,refineSelection,feedbackManifest} from './feedback-loop.js';
import {comparisonSize,referenceCanvas,renderVectorCanvas,canvasPixels,differenceCanvas,feedbackArchive} from './feedback-browser.js';

const icon=(name)=>{
  const paths={upload:'M12 16V4m-4 4 4-4 4 4M4 16v4h16v-4',arrow:'M5 12h14m-5-5 5 5-5 5',image:'M4 4h16v16H4z M4 16l5-5 4 4 3-3 4 4 M8 8h.01',layers:'m12 3 9 5-9 5-9-5 9-5m-9 9 9 5 9-5m-18 5 9 5 9-5',spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3',download:'M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4',lock:'M6 10h12v11H6z M8 10V7a4 4 0 0 1 8 0v3',github:'M9 19c-4 1-4-2-6-2m12 5v-4c0-1-.3-2-1-2 3 0 6-2 6-6 0-2-1-3-1-4 0-1 0-2-1-3-2 0-3 1-4 1-2-1-4-1-6 0-1-1-2-1-4-1-1 1-1 2-1 3-1 1-1 2-1 4 0 4 3 6 6 6-1 0-1 1-1 2v4',settings:'M4 7h16M4 17h16M8 4v6M16 14v6',check:'m5 12 4 4L19 6',close:'m6 6 12 12M6 18 18 6',code:'m8 7-5 5 5 5m8-10 5 5-5 5m-3-12-2 14',undo:'M8 4 3 9l5 5M3 9h11a6 6 0 0 1 0 12',plus:'M12 4v16M4 12h16'};
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]??paths.image}"/></svg>`;
};
const $=selector=>document.querySelector(selector);
const state={mode:'trace',file:null,source:null,scene:null,selected:null,selection:[],multiSelect:false,busy:false,history:[],originalUrl:null,controller:null,worker:null,ocr:null,sourceLinked:false,sampleSource:false,feedback:null};
document.querySelector('#app').innerHTML=`
  <header class="header"><a class="brand" href="./"><span class="brand-mark">${icon('layers')}</span>Image<span>2</span>Other<span class="beta">BETA</span></a><nav aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="https://ceasonen.github.io/">Cheng Chen</a><a class="github-link" href="https://github.com/ceasonen/Image2Other" target="_blank" rel="noopener">${icon('github')}<span>Star on GitHub</span></a></nav></header>
  <main>
    <section class="hero"><div class="hero-copy"><div class="eyebrow"><span class="live-dot"></span> THE IMAGE CONVERSION STUDIO</div><h1>Your images.<br><em>Editable again.</em></h1><p>Give your research figures a second life.<br>Turn pixels into vector paths, editable slides, or a better-fitting format.</p><div class="hero-actions"><button class="primary" id="hero-upload">${icon('upload')}Open an image</button><button class="text-button" id="try-sample">Try a diagram ${icon('arrow')}</button></div><div class="privacy-line">${icon('lock')}Local conversion. No account. No automatic uploads.</div></div>
    <div class="hero-art" aria-label="Illustration of turning a flat diagram into editable layers"><div class="art-label"><span class="file-chip">figure.png</span><span class="art-arrow">${icon('arrow')}</span><span class="file-chip file-chip-green">editable.svg</span></div><div class="art-canvas"><div class="art-line line-one"></div><div class="art-line line-two"></div><div class="art-block block-input"><span class="block-icon">◈</span>Input</div><div class="art-block block-model"><div class="handles"></div>${icon('layers')}Model<span class="selection-label">shape · editable</span></div><div class="art-block block-output"><span class="block-icon">✧</span>Output</div><span class="art-caption">Every element has a next chapter.</span><span class="cursor">↖ <span>You</span></span></div><div class="art-bottom"><span><span class="mini-dot"></span>Shapes & paths</span><span><span class="mini-dot lilac"></span>Live text with AI rebuild</span></div></div></section>
    <section class="studio" id="studio" aria-labelledby="studio-title"><div class="studio-heading"><div><div class="eyebrow">WORKSPACE</div><h2 id="studio-title">A little less redrawing.</h2></div><span class="session-label">${icon('lock')}Private by default</span></div>
    <div class="studio-shell"><div class="mode-bar" role="tablist" aria-label="Conversion mode"><button class="mode active" data-mode="trace" role="tab" aria-selected="true">${icon('layers')}Vector trace<span>LOCAL</span></button><button class="mode" data-mode="ai" role="tab" aria-selected="false">${icon('spark')}AI rebuild<span>OPTIONAL</span></button><button class="mode" data-mode="raster" role="tab" aria-selected="false">${icon('image')}Image formats</button><button class="settings-button" id="settings" title="Configure your AI provider" aria-label="Configure your AI provider">${icon('settings')}</button></div>
      <div class="options-bar"><div id="trace-options"><label>Palette <select id="colors"><option value="8">8 colors</option><option value="16" selected>16 colors</option><option value="32">32 colors</option><option value="64">64 colors</option></select></label><label>Detail <select id="detail"><option value=".5">Fine</option><option value="1" selected>Balanced</option><option value="2">Simple</option></select></label></div><div id="ai-options" hidden><span>${icon('spark')}Recover text, shapes and connectors with your vision model.</span><button class="small-button" id="copy-prompt">Copy prompt</button><button class="small-button" id="import-scene">Import JSON</button></div><div id="raster-options" hidden><label>Format <select id="raster-format"><option value="png">PNG</option><option value="jpeg">JPEG</option><option value="webp">WebP</option></select></label><label>Size <select id="raster-scale"><option value="1">Original</option><option value=".5">50%</option><option value="2">200%</option></select></label><label>Quality <input id="quality" type="range" min="10" max="100" value="92" aria-label="JPEG and WebP quality"/></label><label>Background <input id="raster-bg" type="color" value="#ffffff" aria-label="JPEG background color"/></label></div><button class="run-button" id="convert" disabled>${icon('spark')}Trace image ${icon('arrow')}</button><button id="cancel" class="small-button" hidden>Cancel</button></div>
      <div class="workbench"><div class="canvas-column"><div class="canvas-top"><span>01 <strong>Source image</strong></span><button class="text-button small" id="replace-file">Replace ${icon('upload')}</button></div><div class="canvas checker dropzone" id="dropzone" tabindex="0" role="button" aria-label="Upload image or drop it here"><div class="empty-state" id="source-empty"><span class="upload-glyph">${icon('upload')}</span><h3>A fresh starting point.</h3><p>Drop your image here<br>or click to browse</p><div class="formats"><span>PNG</span><span>JPG</span><span>WebP</span><span>SVG</span><span>+ more</span></div><small>Up to 20 MB · browser-supported images</small></div><img id="source-image" alt="Original uploaded image" hidden/></div><div class="canvas-bottom" id="source-meta">Your image stays here unless you enable AI rebuild.</div></div>
      <div class="canvas-column result-column"><div class="canvas-top"><span>02 <strong>Your next format</strong></span><span class="result-type" id="result-type">SVG / PPTX</span></div><div class="canvas checker" id="result-canvas"><div class="empty-state" id="result-empty"><span class="result-glyph">${icon('layers')}</span><h3>Ready for another life.</h3><p>Your conversion will appear here.<br>Preview, refine, then take it with you.</p><button class="small-button" id="open-example">Open an editable example</button></div><div id="result-svg" hidden></div><img id="raster-preview" alt="Image format conversion preview" hidden/></div><div class="canvas-bottom" id="result-meta">Real vector paths. Native PowerPoint objects.</div></div></div>
      <div class="edit-bar"><div class="edit-tools"><button class="small-button" id="undo" disabled>${icon('undo')}Undo</button><button class="small-button" id="add-text" disabled>${icon('plus')}Add text</button><button class="small-button" id="toggle-layers" disabled>${icon('layers')}Layers <span id="layer-count">0</span></button></div><div class="exports"><button class="small-button" id="export-svg" disabled>${icon('download')}SVG</button><button class="small-button" id="export-pptx" disabled>${icon('download')}PPTX</button><button class="small-button" id="export-json" disabled>${icon('code')}Scene JSON</button><button class="primary compact" id="export-raster" hidden disabled>${icon('download')}Download image</button></div></div>
      <div class="layer-editor" id="layer-editor" hidden><div class="layer-list" id="layer-list" aria-label="Editable layers"></div><div id="inspector"><p>Select a layer to adjust its color, text or position.</p></div></div>
      <div class="status-bar"><span class="status-indicator" id="status-indicator"></span><span id="status" role="status" aria-live="polite">Waiting for an image</span><span class="status-end">Built for the details.</span></div>
    </div><p class="mode-note" id="mode-note">Vector trace preserves outlines as editable paths. Letters remain outlines, not editable text. For text boxes and meaningful shapes, use AI rebuild.</p></section>
    <section id="how-it-works" class="how-section"><div class="how-heading"><div class="eyebrow">ONE STUDIO, DIFFERENT JOBS</div><h2>Choose what you want to keep.</h2><p>A format change and a reconstruction are different things.<br>We make the distinction clear.</p></div><div class="features"><article><span class="feature-icon indigo">${icon('layers')}</span><h3>The outlines.</h3><p>Trace illustrations, icons and flat graphics into separate colored paths. Adjust layers and export SVG or native PPTX. All in your browser.</p><span class="feature-caption">No API key needed</span></article><article><span class="feature-icon mint">${icon('spark')}</span><h3>The meaning.</h3><p>Ask your vision model to reconstruct a diagram as editable text, shapes and arrows. Check it against the original before using it in a paper.</p><span class="feature-caption">Your provider, your choice</span></article><article><span class="feature-icon peach">${icon('image')}</span><h3>The pixels.</h3><p>Switch between PNG, JPEG and WebP. Resize, choose quality, and set a background for JPEG. Photos stay photos, without tracing.</p><span class="feature-caption">Fast, local format conversion</span></article></div></section>
    <section class="closing"><div><h2>Made for the figure you don't want to redraw.</h2><p>An open-source experiment by Cheng Chen. Small tools, fewer detours.</p></div><a class="github-link" href="https://github.com/ceasonen/Image2Other" target="_blank" rel="noopener">${icon('github')}Explore the source ${icon('arrow')}</a></section>
  </main><footer><a class="footer-brand" href="https://ceasonen.github.io/">Cheng Chen</a><a href="/Image2Other/research/">Research project page</a><a href="https://github.com/ceasonen/Image2Other/blob/main/THIRD_PARTY_NOTICES.md">Image2Other · licenses</a><a href="https://github.com/ceasonen/Image2Other/blob/main/docs/research.md">Research & acknowledgements</a></footer>
  <input id="file-input" type="file" accept="image/*" hidden/><input id="json-input" type="file" accept="application/json,.json" hidden/>
  <dialog id="ai-dialog"><form method="dialog"><div class="dialog-title"><div><span class="eyebrow">AI REBUILD</span><h2>Bring your own vision model.</h2></div><button class="icon-button" aria-label="Close settings">${icon('close')}</button></div><p>Use a chat-completions-compatible vision provider. Your key stays in memory and is sent only to the endpoint you enter. Images leave your browser only when you consent and run AI rebuild.</p><label>API base URL<input id="api-endpoint" type="url" placeholder="https://your-provider.example/v1" autocomplete="off"/></label><label>Vision model<input id="api-model" placeholder="Your provider's vision model ID" autocomplete="off"/></label><label>API key <span>(optional for a local provider)</span><input id="api-key" type="password" placeholder="Session only. Never saved." autocomplete="off"/></label><label class="consent"><input id="ai-consent" type="checkbox"/>I allow my image and the reconstruction prompt to be sent to this provider. Its fees and privacy policy apply.</label><p class="dialog-note">No key? Copy the prompt, use your own AI chat, then import the returned Scene JSON. Providers must allow browser requests (CORS).</p><div class="dialog-actions"><button class="small-button" id="clear-key" type="button">Clear credentials</button><button class="primary compact">Use these settings</button></div></form></dialog>
`;

// Text-first reconstruction is distinct from outline-only tracing and remote AI rebuilding.
$('[data-mode="trace"]').insertAdjacentHTML('beforebegin','<button class="mode" data-mode="ocr" role="tab" aria-selected="false">'+icon('code')+'Text + vectors<span>OCR</span></button>');
$('#trace-options').insertAdjacentHTML('afterend',`<div id="ocr-options" hidden><label>Language<select id="ocr-language"><option value="eng">English</option><option value="eng+chi_sim">English + 简体中文</option></select></label><label>Layout<select id="ocr-layout"><option value="11">Diagram labels</option><option value="3">Document / columns</option><option value="6">One text block</option></select></label><label class="ocr-consent"><input id="ocr-download-consent" type="checkbox"/>Allow OCR download · no image upload</label></div>`);
$('#ocr-options').insertAdjacentHTML('afterbegin','<label>Engine<select id="ocr-engine"><option value="browser">Browser OCR</option><option value="paddle">Local PaddleOCR</option></select></label><button class="small-button" id="paddle-settings">Local Paddle settings</button>');
$('#ocr-options').insertAdjacentHTML('beforeend','<label class="ocr-consent"><input id="paddle-source-confirmed" type="checkbox"/>JSON matches this unmodified source</label><button class="small-button" id="paddle-json">Import Paddle JSON</button><input id="paddle-json-input" type="file" accept="application/json,.json" hidden/>');
document.body.insertAdjacentHTML('beforeend',`<dialog id="paddle-dialog"><form method="dialog"><div class="dialog-title"><div><span class="eyebrow">LOCAL PYTHON · OPTIONAL</span><h2>PaddleOCR, on your machine.</h2></div><button class="small-button">Close</button></div><p>Start scripts/paddle_service.py with existing local models. This static website does not host PaddleOCR. No models are installed automatically. Browser local-network permission may be required.</p><label>Loopback service URL<input id="paddle-endpoint" type="url" value="http://127.0.0.1:8766" autocomplete="off"/></label><label>Session token<input id="paddle-token" type="password" autocomplete="off" placeholder="Printed by your local service"/></label><label class="consent"><input id="paddle-consent" type="checkbox"/>I allow this working PNG to be sent to my local Python service when I click Recognize. No external OCR endpoint is allowed.</label><p>Use horizontal labels and disabled document preprocessing. Results still require review; confidence is not correctness.</p><p><a href="https://github.com/ceasonen/Image2Other/blob/main/docs/paddleocr.md" target="_blank" rel="noopener">Setup and limitations →</a></p><div class="dialog-actions"><button class="small-button" id="paddle-clear" type="button">Clear session</button><button class="primary compact">Save for this tab</button></div></form></dialog>`);
$('.edit-bar').insertAdjacentHTML('beforebegin',`<section id="ocr-review" class="ocr-review" hidden aria-labelledby="ocr-review-title"><div class="ocr-review-heading"><div><h3 id="ocr-review-title">Check the words. Keep the figure.</h3><p>Selected words become editable text. Unselected regions stay as traced outlines. Scores are engine confidence, not guaranteed accuracy.</p></div><button class="small-button" id="ocr-review-export">Export review JSON</button></div><div id="ocr-words" class="ocr-words"></div><div class="ocr-review-actions"><button class="primary compact" id="ocr-build">Build with reviewed text →</button><span>Flat backgrounds only; check symbols and labels before exporting.</span></div></section>`);
const maskEditor=mountMaskEditor({onSave:(word,strokes,protectedRuns)=>{
  const index=state.ocr?.words.indexOf(word)??-1;if(index<0||state.busy)throw Error('Source changed. Close and recognize the image again.');
  state.ocr.words[index]=reviewEraseMask(word,strokes,protectedRuns);renderOcrReview();status('Mask approved locally. Build and inspect the result before export.');
},onDrop:word=>{
  if(!state.ocr?.words.includes(word)||state.busy)throw Error('Source changed. Close and recognize the image again.');
  delete word.maskReview;word.selected=false;renderOcrReview();status('Saved mask removed. This label is unselected.');
}});
const cropEditor=mountCropEditor({onRead:async(word,canvas,options)=>{
  if(!state.ocr?.words.includes(word)||state.busy)throw Error('Source changed. Recognize the image again.');
  if(!$('#ocr-download-consent').checked)throw Error('Allow the OCR download before re-reading. Your image stays local.');
  setBusy(true);
  try{
    const {recognizeCrop}=await import('./ocr-browser.js');
    const result=await recognizeCrop(canvas,word.box,{...options,language:state.ocr.language,allowDownload:true});
    if(!state.ocr?.words.includes(word))throw Error('Source changed. Recognize the image again.');
    return result;
  }finally{setBusy(false);}
},onChoice:(word,report,index)=>{
  const i=state.ocr?.words.indexOf(word)??-1;if(i<0||state.busy)throw Error('Source changed. Recognize the image again.');
  state.ocr.words[i]=chooseCropCandidate(word,report,index);renderOcrReview();status('Crop text draft chosen. Check it, then explicitly select Replace if appropriate.');
}});
$('#toggle-layers').insertAdjacentHTML('beforebegin','<button class="small-button" id="multi-select" aria-pressed="false" disabled>Select multiple</button>');
$('.edit-bar').insertAdjacentHTML('beforebegin',`<section id="feedback" class="feedback" hidden aria-labelledby="feedback-title"><div class="feedback-heading"><div><span class="eyebrow">RENDER · COMPARE · REFINE</span><h3 id="feedback-title">See what the SVG kept.</h3><p>Compare the rendered SVG with your source at the same working size. Red marks visible differences; the score is RGB error, not text or connection correctness.</p></div><div class="feedback-actions"><button class="small-button" id="feedback-compare">Compare again</button><button class="primary compact" id="feedback-refine" disabled>Refine selected layers</button><button class="small-button" id="feedback-export" disabled>Export experiment ZIP</button></div></div><div class="feedback-body"><div class="feedback-visual"><canvas id="feedback-heatmap" aria-label="Difference heatmap"></canvas><span>Difference map · red = larger mismatch</span></div><div class="feedback-stats"><div><span>Visual error · lower is better</span><strong id="feedback-mae" data-value="">—</strong><small>Mean absolute RGB error · 0–255</small></div><div><span>Changed pixels</span><strong id="feedback-changed">—</strong><small>Difference above 24/255</small></div><p id="feedback-history">Compare to start a local experiment.</p></div></div><p class="feedback-help">Select one or several layers first. Refinement tries small position shifts, keeps only a lower-error result and preserves manual line attachments. Check labels, arrows and edit behavior yourself. Exported examples are unverified and stay in your browser until you download them.</p><p id="feedback-status" role="status" aria-live="polite"></p></section>`);

const sampleScene={width:800,height:460,background:'#ffffff',engine:'editable-example',nodes:[
  {type:'text',x:52,y:35,width:700,height:40,text:'Complementary information, one model',fontSize:25,bold:true,fill:'#252b40'},
  {type:'rect',x:52,y:155,width:160,height:105,radius:14,fill:'#e2eafa',stroke:'#bfd0ed',strokeWidth:2},
  {type:'text',x:67,y:187,width:130,height:38,text:'Visual input',fontSize:21,align:'center',fill:'#3e5b85'},
  {type:'rect',x:320,y:140,width:160,height:135,radius:16,fill:'#eceafb',stroke:'#cac5ee',strokeWidth:2},
  {type:'text',x:340,y:183,width:120,height:40,text:'Model',fontSize:25,bold:true,align:'center',fill:'#6053b2'},
  {type:'rect',x:587,y:155,width:160,height:105,radius:14,fill:'#e4f2eb',stroke:'#bfdccd',strokeWidth:2},
  {type:'text',x:602,y:187,width:130,height:38,text:'Prediction',fontSize:21,align:'center',fill:'#3d7960'},
  {type:'line',x:222,y:207,x2:308,y2:207,stroke:'#7c85a1',strokeWidth:2.5,arrow:true},
  {type:'line',x:490,y:207,x2:575,y2:207,stroke:'#7c85a1',strokeWidth:2.5,arrow:true},
  {type:'text',x:55,y:332,width:690,height:36,text:'A small example. Real text and separate shapes.',fontSize:18,align:'center',fill:'#8991a7'}
]};
function status(message,error=false){$('#status').textContent=message;$('#status-indicator').classList.toggle('error',error);}
function clearFeedback(){state.feedback=null;$('#feedback-mae').textContent='—';$('#feedback-mae').dataset.value='';$('#feedback-changed').textContent='—';$('#feedback-history').textContent='Compare to start a local experiment.';$('#feedback-status').textContent='';$('#feedback-refine').disabled=true;$('#feedback-export').disabled=true;$('#feedback-heatmap').getContext('2d').clearRect(0,0,$('#feedback-heatmap').width,$('#feedback-heatmap').height);}
function saveHistory(){if(state.scene){state.history.push(JSON.stringify(state.scene));if(state.history.length>30)state.history.shift();}clearFeedback();$('#undo').disabled=!state.history.length;}
function setBusy(value){state.busy=value;$('#convert').disabled=value||!state.source;$('#convert').classList.toggle('loading',value);$('#cancel').hidden=!value;$('#replace-file').disabled=value;$('#try-sample').disabled=value;
  $('#paddle-json').disabled=value||!state.source;$('#paddle-settings').disabled=value;
  document.querySelectorAll('#ocr-options input,#ocr-options select,#ocr-review input,#ocr-build,#ocr-review-export,[data-mode]').forEach(el=>el.disabled=value);
  for(const el of document.querySelectorAll('[data-ocr-select]'))el.disabled=value||!canReplaceWord(state.ocr?.words.find(w=>w.id===el.dataset.ocrSelect));
  for(const el of document.querySelectorAll('[data-ocr-mask]')){const word=state.ocr?.words.find(w=>w.id===el.dataset.ocrMask);el.disabled=value||!word?.safeBackground||word.box.width*word.box.height>MAX_MASK_PIXELS;}
  for(const el of document.querySelectorAll('[data-ocr-reread]')){const word=state.ocr?.words.find(w=>w.id===el.dataset.ocrReread);el.disabled=value||!word||word.box.width*word.box.height>MAX_MASK_PIXELS;}
  for(const id of ['export-svg','export-pptx','export-json','add-text','toggle-layers','multi-select'])$('#'+id).disabled=value||!state.scene;
  $('#feedback-compare').disabled=value||!state.sourceLinked;$('#feedback-refine').disabled=value||!state.feedback||!state.selection.length;$('#feedback-export').disabled=value||!state.feedback;
  updateOcrEngineControls();
}
function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function showScene(scene,{sourceLinked=false}={}){state.scene=validateScene(scene);state.sourceLinked=sourceLinked;state.selected=null;state.selection=[];clearFeedback();$('#feedback').hidden=!sourceLinked||state.mode==='raster';renderScene();}
function renderScene(){
  if(!state.scene)return;
  $('#result-empty').hidden=true;$('#raster-preview').hidden=true;$('#result-svg').hidden=false;
  $('#result-svg').innerHTML=sceneToSvg(state.scene,{selected:state.selection});
  $('#result-type').textContent=state.scene.engine==='local-trace'?'VECTOR PATHS':'EDITABLE SCENE';
  $('#result-meta').textContent=`${state.scene.width} × ${state.scene.height} · ${state.scene.nodes.length} editable layers`;
  $('#layer-count').textContent=state.scene.nodes.length;
  for(const id of ['export-svg','export-pptx','export-json','add-text','toggle-layers','multi-select'])$('#'+id).disabled=false;
  $('#undo').disabled=!state.history.length;
  renderLayers();
  $('#feedback-refine').disabled=state.busy||!state.feedback||!state.selection.length;
}
function renderLayers(){
  $('#layer-list').innerHTML=state.scene.nodes.map(n=>`<button class="layer-item${state.selection.includes(n.id)?' active':''}" aria-pressed="${state.selection.includes(n.id)}" data-layer="${n.id}"><span class="layer-swatch" style="background:${n.fill==='none'?n.stroke:n.fill}"></span><span>${escapeXml(n.name)}</span><small>${n.type}</small></button>`).join('');
  const node=state.scene.nodes.find(n=>n.id===state.selected);
  if(!node){$('#inspector').innerHTML='<p>Select a layer to adjust its color, text or position.</p>';return;}
  const bounds=selectionBounds(state.scene,state.selection),multiple=state.selection.length>1;
  const bound=state.scene.connections?.some(c=>state.selection.includes(c.lineId));
  const position=`<label>X<input id="edit-x" type="number" step="any" value="${bounds.x}" ${bound?'disabled':''}/></label><label>Y<input id="edit-y" type="number" step="any" value="${bounds.y}" ${bound?'disabled':''}/></label>`;
  $('#inspector').innerHTML=`<div class="inspector-heading"><strong>${multiple?state.selection.length+' layers · move together':escapeXml(node.name)}</strong><button class="small-button" id="delete-layer">Remove${multiple?' selection':''}</button></div><div class="inspector-fields">${position}${multiple?'':`<label>Fill<input id="edit-fill" type="color" value="${node.fill==='none'?'#ffffff':node.fill}"/></label><label>Opacity<input id="edit-opacity" type="range" min="0" max="100" value="${node.opacity*100}"/></label>${node.type==='text'?`<label class="text-field">Text<textarea id="edit-text" rows="2">${escapeXml(node.text)}</textarea></label><label>Font size<input id="edit-font" type="number" min="1" max="500" value="${node.fontSize}"/></label><label>Font family<select id="edit-font-face">${FONT_FACES.map(face=>`<option ${face===node.fontFace?'selected':''}>${face}</option>`).join('')}</select></label>`:''}${node.type==='line'?attachmentFields(node):''}`}</div><p class="geometry-help">${bound?'Move the attached artwork, or set both endpoints to Free before moving this line.':multiple?'Selected artwork and labels keep their relative positions; explicitly attached line ends follow their targets. Free connectors still need checking.':'Shift-click layers, or use Select multiple, to move artwork and labels together. Line attachments are set manually.'}</p>`;
}
function attachmentFields(node){
  const connection=state.scene.connections?.find(c=>c.lineId===node.id);
  const targets=state.scene.nodes.filter(n=>['rect','ellipse','path'].includes(n.type));
  return ['start','end'].map(end=>{
    const anchor=connection?.[end],port=anchor?ATTACHMENT_PORTS.findIndex(p=>p.u===anchor.u&&p.v===anchor.v):-1;
    return `<label>${end==='start'?'Start':'End'} target<select id="attach-${end}-target"><option value="">Free</option>${targets.map(n=>`<option value="${n.id}" ${n.id===anchor?.nodeId?'selected':''}>${escapeXml(n.name)}</option>`).join('')}</select></label><label>${end==='start'?'Start':'End'} port<select id="attach-${end}-port" ${anchor?'':'disabled'}>${port<0?'<option value="custom">Custom / unset</option>':''}${ATTACHMENT_PORTS.map((p,i)=>`<option value="${i}" ${i===port?'selected':''}>${p.name}</option>`).join('')}</select></label>`;
  }).join('');
}
function selectLayer(id,additive=false){
  if(additive||state.multiSelect)state.selection=state.selection.includes(id)?state.selection.filter(x=>x!==id):[...state.selection,id];
  else state.selection=[id];
  state.selected=state.selection.at(-1)??null;$('#layer-editor').hidden=false;renderScene();
}
function paintFeedback(session){
  const {size,measurement}=session,heat=$('#feedback-heatmap');heat.width=size.width;heat.height=size.height;
  heat.getContext('2d').putImageData(new ImageData(measurement.heatmap,size.width,size.height),0,0);
  $('#feedback-mae').textContent=measurement.mae.toFixed(2);$('#feedback-mae').dataset.value=String(measurement.mae);
  $('#feedback-changed').textContent=(measurement.changedFraction*100).toFixed(1)+'%';
  $('#feedback-history').textContent=session.history.map((row,i)=>`round ${i} · ${row.mae.toFixed(2)}`).join(' → ');
  $('#feedback-refine').disabled=state.busy||!state.selection.length;$('#feedback-export').disabled=state.busy;
}
async function compareFeedback(){
  if(!state.sourceLinked||!state.source||!state.scene)throw Error('Generate a scene from this source image first.');
  const wasBusy=state.busy;if(!wasBusy)setBusy(true);
  try{
    const size=comparisonSize(state.scene),reference=referenceCanvas(state.source,size),rendered=await renderVectorCanvas(state.scene,size),measurement=pixelMetrics(canvasPixels(reference),canvasPixels(rendered));
    const session={size,reference,rendered,measurement,initialScene:structuredClone(state.scene),history:[{mae:measurement.mae,changedFraction:measurement.changedFraction,action:'initial'}],trials:[]};
    state.feedback=session;paintFeedback(session);$('#feedback-status').textContent='Compared at '+size.width+' × '+size.height+'. Select layers to try a local repair.';
  }finally{if(!wasBusy)setBusy(false);}
}
async function refineFeedback(){
  if(!state.feedback||!state.selection.length)throw Error('Compare first, then select one or more layers.');
  const session=state.feedback,ids=[...state.selection],start=state.scene;
  if(session.trials.length+12>80||session.history.length+1>20)throw Error('Feedback log is full. Export it, then Compare again for a new run.');
  setBusy(true);state.controller=new AbortController();
  try{
    $('#feedback-status').textContent='Testing bounded shifts against the rendered source…';
    const result=await refineSelection({scene:start,selectedIds:ids,reference:canvasPixels(session.reference),render:async candidate=>canvasPixels(await renderVectorCanvas(candidate,session.size)),signal:state.controller.signal});
    if(result.accepted.length){saveHistory();state.scene=result.scene;renderScene();}
    session.trials.push(...result.trials.map(trial=>({...trial,selection:ids})));
    if(result.accepted.length)session.history.push({mae:result.final.mae,changedFraction:result.final.changedFraction,action:'position-shift',selection:ids,moves:result.accepted});
    session.rendered=await renderVectorCanvas(state.scene,session.size);session.measurement=pixelMetrics(canvasPixels(session.reference),canvasPixels(session.rendered));state.feedback=session;paintFeedback(session);
    $('#feedback-status').textContent=result.accepted.length?`Accepted ${result.accepted.length} lower-error move${result.accepted.length===1?'':'s'}. Inspect the text and connections before export.`:'No tested move improved visual error; the scene was kept.';
  }finally{state.controller=null;setBusy(false);}
}
async function svgImage(svg){const blob=new Blob([svg],{type:'image/svg+xml'}),url=URL.createObjectURL(blob);try{const image=new Image();image.src=url;await image.decode();return image;}finally{URL.revokeObjectURL(url);}}
async function loadSample(){
  if(state.busy)return;
  const image=await svgImage(sceneToSvg(sampleScene));const canvas=document.createElement('canvas');canvas.width=sampleScene.width;canvas.height=sampleScene.height;
  canvas.getContext('2d').drawImage(image,0,0);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  await loadFile(new File([blob],'research-diagram.png',{type:'image/png'}));
  state.sampleSource=true;
}
async function loadFile(file){
  if(state.busy)return;
  if(!file)return;if(file.size>20*1024*1024){status('Please choose an image smaller than 20 MB.',true);return;}
  let url=null;
  try{
    // SVGs are decoded as isolated images; scripts, foreign content and references are rejected first.
    if(file.type==='image/svg+xml'||/\.svg$/i.test(file.name)){
      const text=await file.text();const doc=new DOMParser().parseFromString(text,'image/svg+xml');
      if(doc.querySelector('parsererror,script,foreignObject,iframe,style')||[...doc.querySelectorAll('*')].some(el=>[...el.attributes].some(a=>/^on/i.test(a.name)||(/href$/i.test(a.name)&&!a.value.startsWith('#'))||/url\(\s*[^#]/i.test(a.value))))throw new Error('This SVG contains active content or external resources. Upload a self-contained SVG.');
    }
    url=URL.createObjectURL(file);const image=new Image();image.src=url;await image.decode();
    if(image.naturalWidth*image.naturalHeight>24_000_000)throw new Error('This image exceeds 24 megapixels. Resize it first.');
    if(state.originalUrl)URL.revokeObjectURL(state.originalUrl);state.originalUrl=url;state.source=image;state.file=file;
    state.scene=null;state.history=[];state.selected=null;state.selection=[];state.ocr=null;state.sourceLinked=false;state.sampleSource=false;clearFeedback();$('#feedback').hidden=true;$('#ocr-review').hidden=true;
    $('#paddle-source-confirmed').checked=false;
    $('#source-image').src=url;$('#source-image').hidden=false;$('#source-empty').hidden=true;
    $('#result-svg').hidden=true;$('#result-empty').hidden=false;$('#raster-preview').hidden=true;$('#layer-editor').hidden=true;
    for(const id of ['export-svg','export-pptx','export-json','add-text','toggle-layers','undo','multi-select'])$('#'+id).disabled=true;
    $('#source-meta').textContent=`${file.name} · ${image.naturalWidth} × ${image.naturalHeight} · ${(file.size/1024).toFixed(1)} KB`;
    $('#layer-count').textContent='0';$('#result-meta').textContent='Choose a conversion mode to begin.';
    $('#export-raster').disabled=false;setBusy(false);status('Image ready. Choose a mode and convert.');
    if(state.mode==='raster')showRasterPreview();
  }catch(error){if(url)URL.revokeObjectURL(url);status(error.message||'This image format cannot be decoded by your browser.',true);}
}
function rasterCanvas(){
  if(!state.source)throw new Error('Open an image first.');
  const scale=Number($('#raster-scale').value),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(state.source.naturalWidth*scale));canvas.height=Math.max(1,Math.round(state.source.naturalHeight*scale));
  if(canvas.width*canvas.height>24_000_000)throw new Error('The output exceeds 24 megapixels. Choose a smaller size.');
  const ctx=canvas.getContext('2d');if($('#raster-format').value==='jpeg'){ctx.fillStyle=$('#raster-bg').value;ctx.fillRect(0,0,canvas.width,canvas.height);}ctx.drawImage(state.source,0,0,canvas.width,canvas.height);return canvas;
}
function showRasterPreview(){if(!state.source)return;$('#result-empty').hidden=true;$('#result-svg').hidden=true;$('#raster-preview').hidden=false;$('#raster-preview').src=state.originalUrl;$('#result-type').textContent=$('#raster-format').value.toUpperCase();$('#result-meta').textContent='Pixel format conversion · no vector reconstruction';}
function setMode(mode){
  if(state.busy)return;state.mode=mode;
  for(const button of document.querySelectorAll('[data-mode]')){const selected=button.dataset.mode===mode;button.classList.toggle('active',selected);button.setAttribute('aria-selected',selected);}
  for(const id of ['trace','ocr','ai','raster'])$('#'+id+'-options').hidden=id!==mode;
  $('#ocr-review').hidden=mode!=='ocr'||!state.ocr;
  $('#convert').hidden=mode==='raster';$('#export-raster').hidden=mode!=='raster';
  for(const id of ['export-svg','export-pptx','export-json'])$('#'+id).hidden=mode==='raster';
  $('.edit-tools').hidden=mode==='raster';if(mode==='raster'){$('#layer-editor').hidden=true;showRasterPreview();}else if(state.scene)renderScene();else{$('#raster-preview').hidden=true;$('#result-empty').hidden=false;}
  $('#feedback').hidden=mode==='raster'||!state.sourceLinked;
  $('#convert').innerHTML=icon('spark')+(mode==='ocr'?'Recognize text':mode==='ai'?'Rebuild diagram':'Trace image')+icon('arrow');
  $('#mode-note').textContent=mode==='ocr'?'':mode==='trace'?'Outline-only tracing. Letters remain paths. Choose Text + vectors to recognize words as editable text before tracing the artwork.':mode==='ai'?'AI reconstruction can change labels or geometry. Compare against your original. Requires your vision provider, or import Scene JSON from your own AI chat.':'PNG preserves transparency. JPEG uses your selected background. WebP quality and format availability depend on your browser. Animated inputs export a single decoded frame.';
  updateOcrEngineControls();
}
function updateOcrEngineControls(){
  const local=$('#ocr-engine').value==='paddle';
  $('#ocr-layout').disabled=state.busy||local;$('#ocr-layout').title=local?'Browser segmentation is not used by local PaddleOCR.':'Segmentation for browser OCR.';
  $('#ocr-language').parentElement.firstChild.textContent=local?'Browser re-read language':'Language';
  $('#ocr-download-consent').parentElement.lastChild.textContent=local?'Allow browser re-read download · no image upload':'Allow browser OCR download · no image upload';
  if(state.mode==='ocr')$('#mode-note').textContent='OCR assists SVG reconstruction: review labels, protect artwork, then build native text + vector paths. '+(local?'Recognition uses your authorized local Python PaddleOCR service, not a hosted model. Browser layout settings do not apply; Re-read label uses browser Tesseract with separate download consent.':'Tesseract runs in your browser after download consent. Worker/language assets are served by this site; the pinned core loads from jsDelivr. Your image is not uploaded.')+' Fonts/placement are approximate; formulas and handwriting are not guaranteed.';
}
function traceCanvas(canvas){return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./trace.worker.js',import.meta.url),{type:'module'});state.worker=worker;
  const finish=(error,scene)=>{clearTimeout(timer);worker.terminate();state.worker=null;state.cancelTrace=null;error?reject(error):resolve(scene);};
  const timer=setTimeout(()=>finish(Error('Trace took too long. Try fewer colors or a simpler image.')),60000);
  worker.onmessage=e=>finish(e.data.error?Error(e.data.error):null,e.data.scene);
  worker.onerror=()=>finish(Error('Tracing worker failed. Try a simpler image.'));
  state.cancelTrace=()=>finish(Error('Conversion cancelled.'));
  worker.postMessage({image:canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height),colors:Number($('#colors').value),detail:Number($('#detail').value)});
});}
function renderOcrReview(){
  $('#ocr-review').hidden=false;
  $('#ocr-words').innerHTML=state.ocr.words.map(w=>{
    const c=document.createElement('canvas');c.width=w.box.width+8;c.height=w.box.height+8;
    c.getContext('2d').drawImage(state.ocr.canvas,w.box.x-4,w.box.y-4,c.width,c.height,0,0,c.width,c.height);
    return `<div class="ocr-word${w.confidence<85||w.reviewReason||w.cropReview?' uncertain':''}"><label><input type="checkbox" data-ocr-select="${w.id}" ${w.selected?'checked':''} ${canReplaceWord(w)?'':'disabled'}/>Replace</label><img src="${c.toDataURL()}" alt="Source crop for ${escapeXml(w.originalText)}"/><input data-ocr-text="${w.id}" value="${escapeXml(w.text)}" maxlength="500" aria-label="Correct recognized word ${escapeXml(w.originalText)}"/><div class="ocr-mask-actions"><small>${w.confidence.toFixed(0)} · ${w.cropReview?'crop draft · check'+(w.maskReview?' · mask reviewed':''):w.maskReview?'mask reviewed':w.replacementBlock==='crossing-stroke'?'crossing stroke · kept':!w.safeBackground?'mixed background · kept':w.reviewReason?'identifier · check':w.confidence<85?'check carefully':'review label'}</small><div class="ocr-label-buttons"><button class="small-button" data-ocr-reread="${w.id}" ${w.box.width*w.box.height<=MAX_MASK_PIXELS?'':'disabled'}>Re-read label</button><button class="small-button" data-ocr-mask="${w.id}" ${w.safeBackground&&w.box.width*w.box.height<=MAX_MASK_PIXELS?'':'disabled'}>Review mask</button></div></div></div>`;
  }).join('')||'<p>No text found. Try another layout, a sharper image, or outline-only tracing.</p>';
  $('#ocr-build').disabled=!state.ocr.words.length;
}
async function scanOcr(){
  if($('#ocr-engine').value==='paddle'){await scanPaddle();return;}
  if(!$('#ocr-download-consent').checked){status('Please allow the OCR download first. Your image is not uploaded.',true);return;}
  setBusy(true);state.controller=new AbortController();const timer=setTimeout(()=>state.controller?.abort(),180000);
  try{
    const canvas=document.createElement('canvas'),w=state.source.naturalWidth,h=state.source.naturalHeight;
    const factor=Math.min(2,2400/Math.max(w,h),Math.sqrt(4e6/(w*h)));
    canvas.width=Math.max(1,Math.round(w*factor));canvas.height=Math.max(1,Math.round(h*factor));
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(state.source,0,0,canvas.width,canvas.height);
    const artwork=document.createElement('canvas');artwork.width=canvas.width;artwork.height=canvas.height;artwork.getContext('2d',{willReadFrequently:true}).drawImage(state.source,0,0,canvas.width,canvas.height);
    const {recognizeOcr}=await import('./ocr-browser.js');
    const language=$('#ocr-language').value;
    status('Loading OCR engine… your image stays local.');
    const words=await recognizeOcr(canvas,{artwork,language,layout:$('#ocr-layout').value,allowDownload:true,signal:state.controller.signal,onProgress:m=>status(`OCR: ${m}`)});
    state.ocr={canvas:artwork,words,language};renderOcrReview();status(`${words.length} words found. Check the crops and corrections, then build with reviewed text.`);
  }catch(error){status(error.name==='AbortError'?'OCR cancelled or timed out.':error.message,true);}finally{clearTimeout(timer);state.controller=null;setBusy(false);$('#ocr-build').disabled=!state.ocr?.words.length;}
}
function paddleCanvas(){
  const canvas=document.createElement('canvas'),w=state.source.naturalWidth,h=state.source.naturalHeight,factor=Math.min(1,2400/Math.max(w,h),Math.sqrt(4e6/(w*h)));
  canvas.width=Math.max(1,Math.round(w*factor));canvas.height=Math.max(1,Math.round(h*factor));canvas.getContext('2d',{willReadFrequently:true}).drawImage(state.source,0,0,canvas.width,canvas.height);return canvas;
}
function applyPaddleResult(result,canvas,sourceWidth,sourceHeight,engine){
  const words=paddleWords(result,canvas.width,canvas.height,{width:sourceWidth,height:sourceHeight,confirmed:true});
  const pixels=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height);
  state.ocr={canvas,words:prepareWords(words,pixels).map(w=>({...w,selected:false})),language:$('#ocr-language').value,engine};
  renderOcrReview();status(`${words.length} PaddleOCR labels loaded. Check source crops and explicitly select replacements before building SVG.`);
}
async function scanPaddle(){
  if(!$('#paddle-consent').checked||!$('#paddle-token').value){$('#paddle-dialog').showModal();status('Configure and authorize your local PaddleOCR service first.',true);return;}
  setBusy(true);state.controller=new AbortController();const timer=setTimeout(()=>state.controller?.abort(),180000);
  try{
    const canvas=paddleCanvas(),white=document.createElement('canvas');white.width=canvas.width;white.height=canvas.height;const ctx=white.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,white.width,white.height);ctx.drawImage(canvas,0,0);
    status('Recognizing with your local PaddleOCR service…');
    const result=await readLocalPaddle({endpoint:$('#paddle-endpoint').value,token:$('#paddle-token').value,image:white.toDataURL('image/png'),consent:true,signal:state.controller.signal});
    if(result.width!==canvas.width||result.height!==canvas.height)throw Error('Local result dimensions do not match the working image.');
    applyPaddleResult(result.res,canvas,canvas.width,canvas.height,'paddleocr-local');
  }catch(error){status(error.name==='AbortError'?'Local request stopped; Python inference may continue.':error instanceof TypeError?'Cannot reach local PaddleOCR. Start the service and allow browser local-network access, or use JSON import.':error.message,true);}
  finally{clearTimeout(timer);state.controller=null;setBusy(false);$('#ocr-build').disabled=!state.ocr?.words.length;}
}
async function buildOcr(){
  if(state.busy||!state.ocr)return;setBusy(true);status('Removing reviewed glyphs, then tracing the artwork…');
  try{
    const original=state.ocr.canvas;
    const pixels=maskWords(original.getContext('2d',{willReadFrequently:true}).getImageData(0,0,original.width,original.height),state.ocr.words);
    const masked=document.createElement('canvas');masked.width=original.width;masked.height=original.height;
    masked.getContext('2d').putImageData(new ImageData(pixels.data,pixels.width,pixels.height),0,0);
    const trace=document.createElement('canvas'),factor=Math.min(1,768/Math.max(masked.width,masked.height));trace.width=Math.max(1,Math.round(masked.width*factor));trace.height=Math.max(1,Math.round(masked.height*factor));
    trace.getContext('2d').drawImage(masked,0,0,trace.width,trace.height);
    const scene=appendOcrText(await traceCanvas(trace),state.ocr.words,original.width,original.height);
    saveHistory();showScene(scene,{sourceLinked:true});await compareFeedback();status(`${scene.nodes.filter(n=>n.type==='text').length} editable text labels + vector artwork ready. Check the source before export.`);
  }catch(error){status(error.message,true);}finally{state.cancelTrace=null;setBusy(false);}
}
async function convert(){
  if(!state.source||state.busy)return;
  if(state.mode==='ocr'){await scanOcr();return;}
  if(state.mode==='ai'&&(!$('#api-endpoint').value||!$('#api-model').value||!$('#ai-consent').checked)){$('#ai-dialog').showModal();return;}
  setBusy(true);status(state.mode==='ai'?'Reconstructing with your vision provider…':'Tracing colors and curves locally…');
  try{
    const canvas=document.createElement('canvas');const factor=Math.min(1, (state.mode==='ai'?1600:768)/Math.max(state.source.naturalWidth,state.source.naturalHeight));
    canvas.width=Math.max(1,Math.round(state.source.naturalWidth*factor));canvas.height=Math.max(1,Math.round(state.source.naturalHeight*factor));
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(state.source,0,0,canvas.width,canvas.height);
    let scene;
    if(state.mode==='ai'){
      state.controller=new AbortController();const timer=setTimeout(()=>state.controller.abort(),180000);
      try{scene=await rebuildImage({endpoint:$('#api-endpoint').value,key:$('#api-key').value,model:$('#api-model').value,image:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height,consent:$('#ai-consent').checked,signal:state.controller.signal});}finally{clearTimeout(timer);state.controller=null;}
    }else{
      scene=await traceCanvas(canvas);
    }
    saveHistory();showScene(scene,{sourceLinked:true});await compareFeedback();status(scene.engine==='local-trace'?`${scene.nodes.length} vector paths ready. Download or edit layers.`:`${scene.nodes.length} reconstructed layers ready. Check labels and layout.`);
  }catch(error){status(error.name==='AbortError'?'AI request cancelled or timed out.':error.message,true);}finally{state.cancelTrace=null;setBusy(false);}
}

$('#hero-upload').onclick=()=>$('#file-input').click();$('#replace-file').onclick=()=>$('#file-input').click();$('#dropzone').onclick=()=>{if(!state.busy)$('#file-input').click();};
$('#dropzone').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#file-input').click();}};
$('#file-input').onchange=async e=>{await loadFile(e.target.files[0]);e.target.value='';};
$('#json-input').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>5*1024*1024)throw new Error('Scene JSON exceeds 5 MB.');saveHistory();showScene(parseSceneResponse(await file.text()));status('Imported scene ready. Check it against your original.');}catch(error){status(error.message,true);}finally{e.target.value='';}};
$('#dropzone').ondragover=e=>{e.preventDefault();$('#dropzone').classList.add('drag-over');};$('#dropzone').ondragleave=()=>$('#dropzone').classList.remove('drag-over');
$('#dropzone').ondrop=e=>{e.preventDefault();$('#dropzone').classList.remove('drag-over');loadFile(e.dataTransfer.files[0]);};
document.addEventListener('paste',e=>{if(['INPUT','TEXTAREA'].includes(document.activeElement.tagName))return;const image=[...e.clipboardData.items].find(item=>item.type.startsWith('image/'));if(image)loadFile(image.getAsFile());});
$('#try-sample').onclick=()=>loadSample().catch(error=>status(error.message,true));
$('#open-example').onclick=async()=>{saveHistory();showScene(sampleScene,{sourceLinked:state.sampleSource});if(state.sourceLinked)try{await compareFeedback();}catch(error){status(error.message,true);return;}status('Editable example ready. This is an authored scene, not an automatic reconstruction.');};
$('#convert').onclick=convert;$('#cancel').onclick=()=>{state.controller?.abort();state.cancelTrace?.();};
$('#ocr-build').onclick=buildOcr;
$('#feedback-compare').onclick=async()=>{try{await compareFeedback();}catch(error){$('#feedback-status').textContent=error.message;status(error.message,true);}};
$('#feedback-refine').onclick=async()=>{try{await refineFeedback();}catch(error){$('#feedback-status').textContent=error.name==='AbortError'?'Local refinement stopped.':error.message;status(error.message,true);}};
$('#feedback-export').onclick=async()=>{
  const session=state.feedback;if(!session||state.busy)return;setBusy(true);
  try{
    const manifest=feedbackManifest({scene:state.scene,sourceName:state.file?.name,originalWidth:state.source.naturalWidth,originalHeight:state.source.naturalHeight,comparisonWidth:session.size.width,comparisonHeight:session.size.height,history:session.history,trials:session.trials});
    const difference=differenceCanvas(session.measurement,session.size);
    const blob=await feedbackArchive({reference:session.reference,rendered:session.rendered,difference,initialScene:session.initialScene,finalScene:state.scene,manifest});
    download(blob,outputName(state.file.name,'feedback.zip'));$('#feedback-status').textContent='Local experiment archive downloaded. Text and connection checks remain unverified.';
  }catch(error){$('#feedback-status').textContent=error.message;status(error.message,true);}finally{setBusy(false);}
};
$('#ocr-words').oninput=e=>{const w=state.ocr?.words.find(w=>w.id===e.target.dataset.ocrText);if(w)w.text=e.target.value;};
$('#ocr-words').onchange=e=>{const w=state.ocr?.words.find(w=>w.id===e.target.dataset.ocrSelect);if(w&&canReplaceWord(w))w.selected=e.target.checked;};
$('#ocr-words').onclick=e=>{
  const button=e.target.closest('[data-ocr-mask],[data-ocr-reread]'),id=button?.dataset.ocrMask??button?.dataset.ocrReread;
  const word=state.ocr?.words.find(w=>w.id===id);if(!word||state.busy||button.disabled)return;
  try{(button.dataset.ocrMask?maskEditor:cropEditor).open(word,state.ocr.canvas);}catch(error){status(error.message,true);}
};
$('#ocr-review-export').onclick=()=>{if(!state.ocr)return;download(new Blob([JSON.stringify(reviewData(state.ocr.words,state.ocr.canvas.width,state.ocr.canvas.height,state.ocr.language,state.ocr.engine),null,2)],{type:'application/json'}),outputName(state.file.name,'ocr-review.json'));};
$('#paddle-settings').onclick=()=>$('#paddle-dialog').showModal();
$('#ocr-engine').onchange=updateOcrEngineControls;
$('#paddle-clear').onclick=()=>{$('#paddle-token').value='';$('#paddle-consent').checked=false;};
$('#paddle-json').onclick=()=>{if(!state.source||state.busy)return;if(!$('#paddle-source-confirmed').checked){status('Confirm that the JSON belongs to this same unmodified source image.',true);return;}$('#paddle-json-input').click();};
$('#paddle-json-input').onchange=async e=>{
  const file=e.target.files?.[0];e.target.value='';if(!file||state.busy)return;setBusy(true);
  try{if(!state.source||!$('#paddle-source-confirmed').checked)throw Error('Confirm the JSON source image first.');if(file.size>4e6)throw Error('PaddleOCR JSON must be smaller than 4 MB.');const result=JSON.parse(await file.text()),canvas=paddleCanvas();applyPaddleResult(result,canvas,state.source.naturalWidth,state.source.naturalHeight,'paddleocr-import');}
  catch(error){status(error.message,true);}finally{setBusy(false);$('#ocr-build').disabled=!state.ocr?.words.length;}
};
document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>setMode(button.dataset.mode));
$('#settings').onclick=()=>$('#ai-dialog').showModal();$('#clear-key').onclick=()=>{$('#api-key').value='';$('#api-endpoint').value='';$('#api-model').value='';$('#ai-consent').checked=false;};
$('#copy-prompt').onclick=async()=>{try{await navigator.clipboard.writeText(SCENE_PROMPT);status('Reconstruction prompt copied. Attach your image in your AI chat, then import its JSON.');}catch{status('Clipboard access unavailable. The prompt is in docs/ai-rebuild.md.',true);}};
$('#import-scene').onclick=()=>$('#json-input').click();
$('#toggle-layers').onclick=()=>{$('#layer-editor').hidden=!$('#layer-editor').hidden;};
$('#multi-select').onclick=()=>{state.multiSelect=!state.multiSelect;$('#multi-select').setAttribute('aria-pressed',state.multiSelect);status(state.multiSelect?'Click layers to add/remove selection. X/Y moves the selected layers together.':'Single-layer selection. Shift-click still adds layers.');};
$('#layer-list').onclick=e=>{const button=e.target.closest('[data-layer]');if(button)selectLayer(button.dataset.layer,e.shiftKey);};
$('#result-svg').onclick=e=>{const shape=e.target.closest('[data-node-id]');if(shape)selectLayer(shape.dataset.nodeId,e.shiftKey);};
$('#inspector').onchange=e=>{
  const node=state.scene.nodes.find(n=>n.id===state.selected);if(!node)return;
  const attachment=e.target.id.match(/^attach-(start|end)-(target|port)$/);
  if(attachment){
    const [,end,field]=attachment;
    try{
      let anchor=null;
      if(field==='target'&&e.target.value){const target=state.scene.nodes.find(n=>n.id===e.target.value),p=nearestPort(target,node[end==='start'?'x':'x2'],node[end==='start'?'y':'y2']);anchor={nodeId:target.id,u:p.u,v:p.v};}
      if(field==='port'){const current=state.scene.connections?.find(c=>c.lineId===node.id)?.[end],p=ATTACHMENT_PORTS[Number(e.target.value)];if(!current||!p)throw Error('Choose a target and valid port.');anchor={nodeId:current.nodeId,u:p.u,v:p.v};}
      const next=setLineAttachment(state.scene,node.id,end,anchor);saveHistory();state.scene=next;renderScene();status('Manual endpoint attachment updated. Save Scene JSON to retain editing constraints.');
    }catch(error){renderScene();status(error.message,true);}return;
  }
  if(['edit-x','edit-y'].includes(e.target.id)){
    try{const next=moveSelection(state.scene,state.selection,{[e.target.id==='edit-x'?'x':'y']:Number(e.target.value)});saveHistory();state.scene=next;renderScene();status('Vector geometry moved. Attached line ends followed their targets; unrelated layers are unchanged.');}catch(error){renderScene();status(error.message,true);}return;
  }
  const fields={'edit-fill':'fill','edit-font':'fontSize','edit-text':'text','edit-opacity':'opacity','edit-font-face':'fontFace'};
  const field=fields[e.target.id];if(!field)return;
  saveHistory();const old=node[field];node[field]=['fill','text','fontFace'].includes(field)?e.target.value:Number(e.target.value)/(field==='opacity'?100:1);
  try{validateScene(state.scene);renderScene();status('Layer updated.');}catch(error){node[field]=old;state.history.pop();renderScene();status(error.message,true);}
};
$('#inspector').onclick=e=>{if(e.target.closest('#delete-layer')){const next=removeLayers(state.scene,state.selection);saveHistory();state.scene=next;state.selected=null;state.selection=[];renderScene();status('Selected layers removed; affected endpoints detached. Undo is available.');}};
$('#add-text').onclick=()=>{saveHistory();state.scene.nodes.push({type:'text',name:'New label',x:30,y:30,width:state.scene.width/2,height:45,text:'Your label',fontSize:24,fill:'#222222'});state.scene=validateScene(state.scene);state.selected=state.scene.nodes.at(-1).id;state.selection=[state.selected];$('#layer-editor').hidden=false;renderScene();};
$('#undo').onclick=()=>{if(state.history.length){showScene(JSON.parse(state.history.pop()),{sourceLinked:state.sourceLinked});status('Previous edit restored. Compare again to start a fresh run.');}};
$('#export-svg').onclick=()=>{download(new Blob([sceneToSvg(state.scene)],{type:'image/svg+xml'}),outputName(state.file?.name??'editable-example','svg'));status('SVG downloaded with editable vector elements.');};
$('#export-json').onclick=()=>{download(new Blob([JSON.stringify(state.scene,null,2)],{type:'application/json'}),outputName(state.file?.name??'editable-example','json'));status('Scene JSON downloaded. Reimport it to continue editing.');};
$('#export-pptx').onclick=async()=>{const button=$('#export-pptx');button.disabled=true;try{status('Building native PowerPoint objects…');const {exportPptx}=await import('./export.js');download(await exportPptx(state.scene),outputName(state.file?.name??'editable-example','pptx'));status('PPTX downloaded with native editable objects.');}catch(error){status(error.message,true);}finally{button.disabled=false;}};
$('#export-raster').onclick=async()=>{try{const canvas=rasterCanvas(),format=$('#raster-format').value,mime=`image/${format}`,blob=await new Promise(resolve=>canvas.toBlob(resolve,mime,Number($('#quality').value)/100));if(!blob||blob.type!==mime)throw new Error(`Your browser cannot encode ${format.toUpperCase()}. Try PNG.`);download(blob,outputName(state.file.name,format==='jpeg'?'jpg':format));status(`${format.toUpperCase()} downloaded · ${canvas.width} × ${canvas.height}`);}catch(error){status(error.message,true);}};
$('#raster-format').onchange=showRasterPreview;
window.addEventListener('beforeunload',()=>{if(state.originalUrl)URL.revokeObjectURL(state.originalUrl);state.worker?.terminate();state.controller?.abort();$('#api-key').value='';$('#paddle-token').value='';});
const fileSection=document.createElement('section');fileSection.id='files';fileSection.className='studio file-studio';
$('#how-it-works').before(fileSection);
const filesLink=document.createElement('a');filesLink.href='#files';filesLink.textContent='PDF & slides';$('.header nav').prepend(filesLink);
mountFileStudio(fileSection,async file=>{setMode('ocr');await loadFile(file);$('#studio').scrollIntoView({behavior:'smooth'});});
setMode('ocr');
